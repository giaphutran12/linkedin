import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  LOCAL_READER_TOKEN_HEADER,
  authorizeLocalReader,
  buildBrowserCommentNotes,
  buildBrowserMetricSnapshot,
  buildImportedPublicationFromBrowser,
  isLocalhostHost,
  mergeProfileMetrics,
  parseBrowserPayload,
} from "@/lib/local-reader";
import { syncPublicationFeatureSets } from "@/lib/insights";
import { getUploadDirectory, readStore, updateStore } from "@/lib/store";
import type { MediaAsset } from "@/lib/types";

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("gif")) return ".gif";
  return ".jpg";
}

async function persistBrowserImages(
  images: Array<{ url: string; alt?: string }>,
): Promise<MediaAsset[]> {
  const uploadDir = getUploadDirectory();
  await fs.mkdir(uploadDir, { recursive: true });

  return Promise.all(
    images.map(async (image, index) => {
      try {
        const response = await fetch(image.url, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`image fetch failed: ${response.status}`);
        }

        const mimeType = response.headers.get("content-type") || "image/jpeg";
        const extension = extensionFromMimeType(mimeType);
        const fileName = `${Date.now()}-${randomUUID()}${extension}`;
        const target = path.join(uploadDir, fileName);
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(target, buffer);

        return {
          id: randomUUID(),
          originalName:
            image.alt?.trim() || `linkedin-browser-image-${index + 1}${extension}`,
          storedPath: target,
          publicUrl: `/uploads/${fileName}`,
          remoteUrl: image.url,
          mimeType,
          uploadedAt: new Date().toISOString(),
          source: "browser" as const,
        };
      } catch {
        return {
          id: randomUUID(),
          originalName: image.alt?.trim() || `linkedin-browser-image-${index + 1}`,
          storedPath: image.url,
          publicUrl: image.url,
          remoteUrl: image.url,
          mimeType: "image/jpeg",
          uploadedAt: new Date().toISOString(),
          source: "browser" as const,
        };
      }
    }),
  );
}

export async function POST(request: Request) {
  if (!isLocalhostHost(request.headers.get("host"))) {
    return NextResponse.json(
      { ok: false, error: "Local reader is only available on localhost." },
      { status: 403 },
    );
  }

  const store = await readStore();
  const connection = store.accountConnections.find(
    (entry) => entry.platform === "linkedin",
  );

  if (!authorizeLocalReader(request, connection)) {
    return NextResponse.json(
      { ok: false, error: "Invalid local reader token." },
      { status: 401 },
    );
  }

  const payload = parseBrowserPayload(await request.json());
  const now = new Date().toISOString();
  const existingRemoteUrls = new Set(
    store.mediaAssets
      .map((asset) => asset.remoteUrl)
      .filter((value): value is string => Boolean(value)),
  );
  const incomingImages =
    payload.post?.images?.filter((image) => !existingRemoteUrls.has(image.url)) ?? [];
  const browserAssets = incomingImages.length
    ? await persistBrowserImages(incomingImages)
    : [];

  await updateStore(async (current) => {
    let nextStore = { ...current };
    const touchedPublicationIds: string[] = [];

    if (payload.pageType === "profile") {
      const mergedMetrics = mergeProfileMetrics(payload);
      const hasProfileMetrics = Object.values(mergedMetrics).some(
        (value) => value !== undefined,
      );

      if (hasProfileMetrics) {
        nextStore = {
          ...nextStore,
          accountMetricSnapshots: [
            {
              id: randomUUID(),
              platform: "linkedin",
              source: payload.captureMethod === "vision" ? "vision" : "browser",
              capturedAt: now,
              pageUrl: payload.pageUrl,
              captureMethod: payload.captureMethod,
              confidence: payload.confidence ?? 0.75,
              rawText: payload.extractedText,
              ...mergedMetrics,
            },
            ...nextStore.accountMetricSnapshots,
          ],
        };
      }
    }

    if (payload.discoveredPosts.length > 0) {
      const existingPublications = [...nextStore.publications];

      for (const discovered of payload.discoveredPosts.slice(0, 20)) {
        const existing = existingPublications.find(
          (publication) =>
            publication.platform === "linkedin" &&
            (publication.canonicalUrl === discovered.url ||
              publication.externalUrn === discovered.externalUrn),
        );
        const publication = buildImportedPublicationFromBrowser({
          existing,
          url: discovered.url,
          title: discovered.title,
          createdAt: now,
        });

        if (!existing) {
          existingPublications.unshift(publication);
          touchedPublicationIds.push(publication.id);
        }
      }

      nextStore = {
        ...nextStore,
        publications: existingPublications,
      };
    }

    if (payload.post) {
      const existingBrowserAssets = nextStore.mediaAssets.filter(
        (asset) =>
          asset.remoteUrl &&
          browserAssets.some(
            (incoming) => incoming.remoteUrl && incoming.remoteUrl === asset.remoteUrl,
          ),
      );
      const dedupedBrowserAssets = browserAssets.filter(
        (asset) =>
          !nextStore.mediaAssets.some(
            (existingAsset) =>
              existingAsset.remoteUrl &&
              asset.remoteUrl &&
              existingAsset.remoteUrl === asset.remoteUrl,
          ),
      );
      const existing = nextStore.publications.find(
        (publication) =>
          publication.platform === "linkedin" &&
          (publication.canonicalUrl === payload.post?.canonicalUrl ||
            publication.externalUrn === payload.post?.externalUrn),
      );
      const publication = buildImportedPublicationFromBrowser({
        existing,
        url: payload.post.canonicalUrl,
        title: payload.post.title,
        finalText: payload.post.finalText,
        createdAt: now,
      });
      const syncedAssetIds = Array.from(
        new Set([
          ...(existing?.assetIds ?? publication.assetIds),
          ...existingBrowserAssets.map((asset) => asset.id),
          ...dedupedBrowserAssets.map((asset) => asset.id),
        ]),
      );
      const syncedPublication = {
        ...publication,
        assetIds: syncedAssetIds,
      };

      nextStore = {
        ...nextStore,
        publications: [
          syncedPublication,
          ...nextStore.publications.filter((entry) => entry.id !== publication.id),
        ],
        mediaAssets: [...dedupedBrowserAssets, ...nextStore.mediaAssets],
      };
      touchedPublicationIds.push(syncedPublication.id);

      const metricSnapshot = buildBrowserMetricSnapshot({
        publicationId: syncedPublication.id,
        payload,
        createdAt: now,
      });

      if (metricSnapshot) {
        nextStore = {
          ...nextStore,
          metricSnapshots: [metricSnapshot, ...nextStore.metricSnapshots],
        };
      }

      nextStore = {
        ...nextStore,
        manualEvidence: [
          {
            id: randomUUID(),
            publicationId: syncedPublication.id,
            platform: "linkedin",
            url: payload.pageUrl,
            assetIds: syncedAssetIds,
            extractedText: payload.extractedText,
            ocrText: payload.extractedText,
            verified: true,
            captureMethod: payload.captureMethod,
            extractionConfidence: payload.confidence ?? 0.75,
            notes: `browser sync (${payload.pageType})`,
            parsedMetrics: payload.post.metrics ?? {},
            createdAt: now,
          },
          ...nextStore.manualEvidence,
        ],
      };

      const nextCommentNotes = buildBrowserCommentNotes({
        publicationId: syncedPublication.id,
        payload,
        createdAt: now,
      }).filter((note) => {
        return !nextStore.commentNotes.some(
          (existingNote) =>
            existingNote.publicationId === note.publicationId &&
            existingNote.authorName === note.authorName &&
            existingNote.note === note.note,
        );
      });

      if (nextCommentNotes.length > 0) {
        nextStore = {
          ...nextStore,
          commentNotes: [...nextCommentNotes, ...nextStore.commentNotes],
        };
      }
    }

    return syncPublicationFeatureSets(nextStore, touchedPublicationIds);
  });

  return NextResponse.json({
    ok: true,
    tokenHeader: LOCAL_READER_TOKEN_HEADER,
  });
}
