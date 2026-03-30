"use server";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { revalidatePath } from "next/cache";

import {
  analyzePublication,
  buildVariants,
  detectPlatform,
  extractExternalIds,
  isBlockingGuardrailIssue,
  parseMetricsFromText,
  scanGuardrails,
} from "@/lib/content";
import { runOcr } from "@/lib/ocr";
import { publishVariantToPlatform, syncPlatformMetrics } from "@/lib/platforms";
import { getUploadDirectory, readStore, updateStore } from "@/lib/store";
import type {
  CommentNote,
  ContentItem,
  ManualEvidence,
  MediaAsset,
  MetricSnapshot,
  Publication,
} from "@/lib/types";

function parseList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function saveFiles(
  files: File[],
  source: MediaAsset["source"],
): Promise<MediaAsset[]> {
  const uploadDir = getUploadDirectory();
  await fs.mkdir(uploadDir, { recursive: true });

  const saved: MediaAsset[] = [];
  for (const file of files) {
    if (!file || file.size === 0) continue;
    const extension = path.extname(file.name) || ".bin";
    const safeName = `${Date.now()}-${randomUUID()}${extension}`;
    const target = path.join(uploadDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(target, buffer);

    saved.push({
      id: randomUUID(),
      originalName: file.name,
      storedPath: target,
      publicUrl: `/uploads/${safeName}`,
      mimeType: file.type || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
      source,
    });
  }

  return saved;
}

function manualMetricsFromForm(formData: FormData) {
  const getNumber = (key: string) => {
    const raw = formData.get(key);
    if (!raw) return undefined;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : undefined;
  };

  return {
    impressions: getNumber("manualImpressions"),
    likes: getNumber("manualLikes"),
    comments: getNumber("manualComments"),
    reposts: getNumber("manualReposts"),
    membersReached: getNumber("manualMembersReached"),
    followers: getNumber("manualFollowers"),
    profileViews: getNumber("manualProfileViews"),
  };
}

export async function createContentItemAction(formData: FormData) {
  const files = (formData.getAll("attachments") as File[]).filter(
    (file) => file.size > 0,
  );
  const uploadedAssets = await saveFiles(files, "composer");

  const now = new Date().toISOString();
  const contentItem: ContentItem = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    rawIdea: String(formData.get("rawIdea") ?? "").trim(),
    thesis: String(formData.get("thesis") ?? "").trim(),
    sourceStory: String(formData.get("sourceStory") ?? "").trim(),
    relatedProduct: String(formData.get("relatedProduct") ?? "").trim(),
    lane: String(formData.get("lane") ?? "build_receipt") as ContentItem["lane"],
    tags: parseList(formData.get("tags")),
  };

  const variants = buildVariants(
    contentItem,
    uploadedAssets.map((asset) => asset.id),
  );

  await updateStore((store) => ({
    ...store,
    contentItems: [contentItem, ...store.contentItems],
    mediaAssets: [...uploadedAssets, ...store.mediaAssets],
    platformVariants: [...variants, ...store.platformVariants],
  }));

  revalidatePath("/");
}

export async function regenerateVariantsAction(formData: FormData) {
  const contentItemId = String(formData.get("contentItemId"));

  await updateStore((store) => {
    const item = store.contentItems.find((entry) => entry.id === contentItemId);
    if (!item) return store;

    const existingAssetIds = store.platformVariants
      .filter((entry) => entry.contentItemId === contentItemId)
      .flatMap((entry) => entry.assetIds);

    const nextVariants = buildVariants(item, Array.from(new Set(existingAssetIds)));

    return {
      ...store,
      platformVariants: [
        ...store.platformVariants.filter(
          (entry) => entry.contentItemId !== contentItemId,
        ),
        ...nextVariants,
      ],
    };
  });

  revalidatePath("/");
}

export async function publishVariantAction(formData: FormData) {
  const variantId = String(formData.get("variantId"));
  const store = await readStore();
  const variant = store.platformVariants.find((entry) => entry.id === variantId);

  if (!variant) {
    throw new Error("Variant not found");
  }

  const latestGuardrailIssues = scanGuardrails(variant.text);
  if (latestGuardrailIssues.some(isBlockingGuardrailIssue)) {
    await updateStore((current) => ({
      ...current,
      platformVariants: current.platformVariants.map((entry) =>
        entry.id === variantId
          ? { ...entry, guardrailIssues: latestGuardrailIssues }
          : entry,
      ),
    }));
    revalidatePath("/");
    return;
  }

  const connection = store.accountConnections.find(
    (entry) => entry.platform === variant.platform,
  );
  const contentItem = store.contentItems.find(
    (entry) => entry.id === variant.contentItemId,
  );
  const assets = store.mediaAssets.filter((asset) => variant.assetIds.includes(asset.id));

  const publicationBase: Publication = {
    id: randomUUID(),
    contentItemId: variant.contentItemId,
    variantId: variant.id,
    platform: variant.platform,
    mode: "through_app",
    status: "draft",
    title: contentItem?.rawIdea.split("\n")[0] || `${variant.platform} post`,
    finalText: variant.text,
    assetIds: variant.assetIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const result = await publishVariantToPlatform(variant, connection, assets);
    const publication: Publication = {
      ...publicationBase,
      status: "published",
      externalId: result.externalId,
      externalUrn: result.externalUrn,
      canonicalUrl: result.canonicalUrl,
      publishedAt: result.publishedAt,
      updatedAt: new Date().toISOString(),
    };

    await updateStore((current) => ({
      ...current,
      publications: [publication, ...current.publications],
      platformVariants: current.platformVariants.map((entry) =>
        entry.id === variant.id
          ? {
              ...entry,
              guardrailIssues: latestGuardrailIssues,
              updatedAt: new Date().toISOString(),
            }
          : entry,
      ),
    }));
  } catch (error) {
    await updateStore((current) => ({
      ...current,
      publications: [
        {
          ...publicationBase,
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : "Unknown publish failure",
          updatedAt: new Date().toISOString(),
        },
        ...current.publications,
      ],
    }));
  }

  revalidatePath("/");
}

export async function importPublicationAction(formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const selectedPlatform = String(formData.get("platform") ?? "auto");
  const selectedContentItemId = String(formData.get("contentItemId") ?? "").trim();
  const files = (formData.getAll("attachments") as File[]).filter(
    (file) => file.size > 0,
  );
  const uploadedAssets = await saveFiles(files, "import");
  const detectedPlatform =
    selectedPlatform === "auto"
      ? detectPlatform(url)
      : (selectedPlatform as Publication["platform"]);
  const platform = detectedPlatform ?? "linkedin";
  const now = new Date().toISOString();

  const ocrTexts = await Promise.all(
    uploadedAssets
      .filter((asset) => asset.mimeType.startsWith("image/"))
      .map((asset) => runOcr(asset.storedPath).catch(() => "")),
  );
  const combinedOcrText = ocrTexts.filter(Boolean).join("\n\n");
  const parsedFromOcr = parseMetricsFromText(combinedOcrText);
  const manualMetrics = manualMetricsFromForm(formData);
  const parsedMetrics = {
    ...parsedFromOcr,
    ...Object.fromEntries(
      Object.entries(manualMetrics).filter(([, value]) => value !== undefined),
    ),
  };
  const externalIds = extractExternalIds(url);

  await updateStore((store) => {
    let contentItemId = selectedContentItemId;
    const newContentItems = [...store.contentItems];

    if (!contentItemId) {
      const generatedContentItem: ContentItem = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        rawIdea: notes || url || "imported post",
        thesis: notes || "imported from a native platform post",
        sourceStory: notes || "backfilled through mixed-mode import",
        relatedProduct: "",
        lane: "builder_story",
        tags: ["imported"],
      };
      newContentItems.unshift(generatedContentItem);
      contentItemId = generatedContentItem.id;
    }

    const publication: Publication = {
      id: randomUUID(),
      contentItemId,
      platform,
      mode: "imported",
      status: "imported",
      title: notes || url || `${platform} import`,
      finalText: notes || "imported post",
      assetIds: uploadedAssets.map((asset) => asset.id),
      canonicalUrl: url || undefined,
      externalId: externalIds.externalId,
      externalUrn: externalIds.externalUrn,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const evidence: ManualEvidence = {
      id: randomUUID(),
      publicationId: publication.id,
      platform,
      url: url || undefined,
      assetIds: uploadedAssets.map((asset) => asset.id),
      ocrText: combinedOcrText || undefined,
      notes: notes || undefined,
      verified: Boolean(url),
      parsedMetrics,
      createdAt: now,
    };

    const snapshots: MetricSnapshot[] = [];
    const hasMetrics = Object.values(parsedMetrics).some(
      (value) => value !== undefined,
    );

    if (hasMetrics) {
      snapshots.push({
        id: randomUUID(),
        publicationId: publication.id,
        platform,
        source: combinedOcrText ? "ocr" : "manual",
        capturedAt: now,
        ...parsedMetrics,
        rawText: combinedOcrText || undefined,
      });
    }

    return {
      ...store,
      contentItems: newContentItems,
      mediaAssets: [...uploadedAssets, ...store.mediaAssets],
      publications: [publication, ...store.publications],
      manualEvidence: [evidence, ...store.manualEvidence],
      metricSnapshots: [...snapshots, ...store.metricSnapshots],
    };
  });

  revalidatePath("/");
}

export async function syncMetricsAction(formData: FormData) {
  const publicationId = String(formData.get("publicationId"));
  const store = await readStore();
  const publication = store.publications.find((entry) => entry.id === publicationId);

  if (!publication) {
    throw new Error("Publication not found");
  }

  const connection = store.accountConnections.find(
    (entry) => entry.platform === publication.platform,
  );

  let snapshot = await syncPlatformMetrics(publication, connection).catch(
    () => null,
  );

  if (!snapshot && publication.platform === "linkedin") {
    const latestEvidence = store.manualEvidence.find(
      (entry) => entry.publicationId === publication.id,
    );

    if (latestEvidence) {
      snapshot = {
        id: randomUUID(),
        publicationId: publication.id,
        platform: publication.platform,
        source: latestEvidence.ocrText ? "ocr" : "manual",
        capturedAt: new Date().toISOString(),
        ...latestEvidence.parsedMetrics,
        rawText: latestEvidence.ocrText,
      };
    }
  }

  if (snapshot) {
    await updateStore((current) => ({
      ...current,
      metricSnapshots: [snapshot, ...current.metricSnapshots],
    }));
  }

  revalidatePath("/");
}

export async function addCommentNoteAction(formData: FormData) {
  const publicationId = String(formData.get("publicationId"));
  const note = String(formData.get("note") ?? "").trim();

  if (!publicationId || !note) {
    return;
  }

  const commentNote: CommentNote = {
    id: randomUUID(),
    publicationId,
    authorName: String(formData.get("authorName") ?? "manual note").trim(),
    authorType: String(formData.get("authorType") ?? "unknown") as CommentNote["authorType"],
    note,
    replyStatus: String(formData.get("replyStatus") ?? "manual") as CommentNote["replyStatus"],
    tags: parseList(formData.get("tags")),
    createdAt: new Date().toISOString(),
  };

  await updateStore((store) => ({
    ...store,
    commentNotes: [commentNote, ...store.commentNotes],
  }));

  revalidatePath("/");
}

export async function analyzePublicationAction(formData: FormData) {
  const publicationId = String(formData.get("publicationId"));
  const store = await readStore();
  const publication = store.publications.find((entry) => entry.id === publicationId);

  if (!publication) {
    return;
  }

  const analysis = analyzePublication(publication, store.manualEvidence);
  const commentNote: CommentNote = {
    id: randomUUID(),
    publicationId,
    authorName: "Edward Engine Analyst",
    authorType: "unknown",
    note: `${analysis.hookType} / ${analysis.proofType}: ${analysis.likelyReason}. Next: ${analysis.suggestedNextStep}`,
    replyStatus: "manual",
    tags: ["analysis"],
    createdAt: new Date().toISOString(),
  };

  await updateStore((store) => ({
    ...store,
    commentNotes: [commentNote, ...store.commentNotes],
  }));

  revalidatePath("/");
}
