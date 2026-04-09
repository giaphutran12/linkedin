import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { randomUUID } from "node:crypto";

import {
  sanitizeLinkedInProfileUrl,
  sanitizeLinkedInPublicationText,
  sanitizeUrl,
} from "@/lib/content";
import { analyzeLinkedInPostImage, analyzeLinkedInProfileImage } from "@/lib/gemini";
import { syncPublicationFeatureSets } from "@/lib/insights";
import { getUploadDirectory, updateStore } from "@/lib/store";
import type {
  CaptureArtifact,
  LocalReaderConfig,
  LocalReaderSyncMode,
  MediaAsset,
  MetricSnapshot,
  Publication,
} from "@/lib/types";

const execFileAsync = promisify(execFile);

const APP_ROOT = process.cwd();
const REPO_ROOT = path.resolve(APP_ROOT, "..");
const BROWSE_BIN = path.join(
  REPO_ROOT,
  ".agents",
  "skills",
  "gstack",
  "browse",
  "dist",
  "browse",
);

type RunnerStatus = {
  available: boolean;
  mode: "headed" | "headless" | "unknown";
  error?: string;
};

type LinkedInRunnerConfig = {
  profileUrl: string;
  recentPostLimit: number;
  preferredBrowserMode: "headless" | "visible";
};

type PostCapture = {
  url: string;
  hook?: string;
  body?: string;
  metrics?: Partial<
    Pick<
      MetricSnapshot,
      | "impressions"
      | "likes"
      | "comments"
      | "reposts"
      | "membersReached"
      | "followers"
      | "profileViews"
    >
  >;
  comments?: string[];
  mediaUrls: string[];
  artifacts: CaptureArtifact[];
};

type RunnerResult = {
  runId: string;
  posts: PostCapture[];
  profileArtifacts: CaptureArtifact[];
  profileMetrics: Partial<MetricSnapshot>;
  pagesVisited: number;
};

async function runBrowse(args: string[]) {
  const { stdout } = await execFileAsync(BROWSE_BIN, args, {
    cwd: REPO_ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

async function runBrowseJson<T>(args: string[]) {
  const output = await runBrowse(args);
  if (!output) return null;
  try {
    return JSON.parse(output) as T;
  } catch {
    return null;
  }
}

export async function getRunnerStatus(): Promise<RunnerStatus> {
  try {
    await fs.access(BROWSE_BIN);
  } catch {
    return { available: false, mode: "unknown", error: "browse binary missing" };
  }

  try {
    const status = await runBrowse(["status"]);
    if (status.includes("Mode: cdp")) {
      return { available: true, mode: "headed" };
    }
    if (status.includes("Mode: launched")) {
      return { available: true, mode: "headless" };
    }
    return { available: true, mode: "unknown" };
  } catch (error) {
    return {
      available: true,
      mode: "unknown",
      error: error instanceof Error ? error.message : "runner status failed",
    };
  }
}

export async function connectRunnerVisible() {
  return runBrowse(["connect"]);
}

export async function disconnectRunner() {
  return runBrowse(["disconnect"]);
}

async function ensureUploadDir() {
  const dir = getUploadDirectory();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function buildCapturePath(kind: string) {
  const fileName = `${Date.now()}-${randomUUID()}-${kind}.png`;
  return {
    filePath: path.join(getUploadDirectory(), fileName),
    publicUrl: `/uploads/${fileName}`,
  };
}

async function persistRemoteImages(
  images: Array<{ url: string; alt?: string }>,
): Promise<MediaAsset[]> {
  const uploadDir = await ensureUploadDir();
  const assets: MediaAsset[] = [];

  for (const image of images) {
    try {
      const response = await fetch(image.url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`image fetch failed: ${response.status}`);
      }
      const mimeType = response.headers.get("content-type") || "image/jpeg";
      const extension = mimeType.includes("png")
        ? ".png"
        : mimeType.includes("webp")
          ? ".webp"
          : mimeType.includes("gif")
            ? ".gif"
            : ".jpg";
      const fileName = `${Date.now()}-${randomUUID()}${extension}`;
      const target = path.join(uploadDir, fileName);
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(target, buffer);
      assets.push({
        id: randomUUID(),
        originalName: image.alt?.trim() || `linkedin-runner-${fileName}`,
        storedPath: target,
        publicUrl: `/uploads/${fileName}`,
        remoteUrl: image.url,
        mimeType,
        uploadedAt: new Date().toISOString(),
        source: "browser",
      });
    } catch {
      assets.push({
        id: randomUUID(),
        originalName: image.alt?.trim() || "linkedin-runner-image",
        storedPath: image.url,
        publicUrl: image.url,
        remoteUrl: image.url,
        mimeType: "image/jpeg",
        uploadedAt: new Date().toISOString(),
        source: "browser",
      });
    }
  }

  return assets;
}

async function capturePostArtifacts(url: string): Promise<PostCapture> {
  await runBrowse(["goto", url]);

  const selectorPayload = await runBrowseJson<{
    mediaUrls: string[];
    bodyRect?: { x: number; y: number; width: number; height: number };
    metricsRect?: { x: number; y: number; width: number; height: number };
    commentsRect?: { x: number; y: number; width: number; height: number };
  }>([
    "js",
    `(() => {
      const postRoot =
        document.querySelector('[data-urn*="urn:li:activity"]') ||
        document.querySelector('div.feed-shared-update-v2') ||
        document.querySelector('article');
      const normalizeRect = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width < 10 || rect.height < 10) return null;
        return {
          x: Math.max(rect.x, 0),
          y: Math.max(rect.y, 0),
          width: rect.width,
          height: rect.height,
        };
      };
      const bodyEl =
        postRoot?.querySelector('[data-test-id="main-feed-activity-card__commentary"]') ||
        postRoot?.querySelector('div.update-components-text') ||
        postRoot?.querySelector('div.feed-shared-update-v2__description') ||
        postRoot;
      const metricsEl =
        postRoot?.querySelector('ul.social-details-social-counts') ||
        postRoot?.querySelector('div.social-details-social-counts') ||
        postRoot?.querySelector('div.social-details-social-counts__counts');
      const commentsEl =
        postRoot?.querySelector('div.comments-comments-list') ||
        postRoot?.querySelector('div.comments-comment-list');
      const mediaEl =
        postRoot?.querySelector('div.feed-shared-image') ||
        postRoot?.querySelector('img')?.closest('div');
      const mediaUrls = Array.from(
        postRoot?.querySelectorAll('img') || [],
      )
        .map((img) => img.src)
        .filter(Boolean);
      return JSON.stringify({
        bodyRect: normalizeRect(bodyEl),
        metricsRect: normalizeRect(metricsEl),
        commentsRect: normalizeRect(commentsEl),
        mediaUrls,
      });
    })()`,
  ]);

  const artifacts: CaptureArtifact[] = [];
  const mediaUrls = selectorPayload?.mediaUrls ?? [];

  const bodyCapture = buildCapturePath("body");
  await runBrowse([
    "screenshot",
    selectorPayload?.bodyRect
      ? "--clip"
      : "--viewport",
    selectorPayload?.bodyRect
      ? `${selectorPayload.bodyRect.x},${selectorPayload.bodyRect.y},${selectorPayload.bodyRect.width},${selectorPayload.bodyRect.height}`
      : "",
    bodyCapture.filePath,
  ].filter(Boolean));
  artifacts.push({
    id: randomUUID(),
    platform: "linkedin",
    pageUrl: url,
    pageKind: "post",
    cropKind: "body",
    filePath: bodyCapture.filePath,
    publicUrl: bodyCapture.publicUrl,
    mimeType: "image/png",
    captureMethod: "browser",
    confidence: 0.75,
    createdAt: new Date().toISOString(),
  });

  if (selectorPayload?.metricsRect) {
    const metricsCapture = buildCapturePath("metrics");
    await runBrowse([
      "screenshot",
      "--clip",
      `${selectorPayload.metricsRect.x},${selectorPayload.metricsRect.y},${selectorPayload.metricsRect.width},${selectorPayload.metricsRect.height}`,
      metricsCapture.filePath,
    ]);
    artifacts.push({
      id: randomUUID(),
      platform: "linkedin",
      pageUrl: url,
      pageKind: "post",
      cropKind: "metrics",
      filePath: metricsCapture.filePath,
      publicUrl: metricsCapture.publicUrl,
      mimeType: "image/png",
      captureMethod: "browser",
      confidence: 0.75,
      createdAt: new Date().toISOString(),
    });
  }

  if (selectorPayload?.commentsRect) {
    const commentsCapture = buildCapturePath("comments");
    await runBrowse([
      "screenshot",
      "--clip",
      `${selectorPayload.commentsRect.x},${selectorPayload.commentsRect.y},${selectorPayload.commentsRect.width},${selectorPayload.commentsRect.height}`,
      commentsCapture.filePath,
    ]);
    artifacts.push({
      id: randomUUID(),
      platform: "linkedin",
      pageUrl: url,
      pageKind: "post",
      cropKind: "comments",
      filePath: commentsCapture.filePath,
      publicUrl: commentsCapture.publicUrl,
      mimeType: "image/png",
      captureMethod: "browser",
      confidence: 0.65,
      createdAt: new Date().toISOString(),
    });
  }

  const bodyAnalysis = await analyzeLinkedInPostImage(bodyCapture.filePath, "image/png");
  const metricsAnalysis = selectorPayload?.metricsRect
    ? await analyzeLinkedInPostImage(
        artifacts.find((a) => a.cropKind === "metrics")?.filePath ?? bodyCapture.filePath,
        "image/png",
      )
    : null;

  const combinedMetrics = {
    ...bodyAnalysis?.metrics,
    ...metricsAnalysis?.metrics,
  };

  return {
    url,
    hook: bodyAnalysis?.hook,
    body: bodyAnalysis?.postText,
    metrics: combinedMetrics,
    comments: bodyAnalysis?.comments ?? [],
    mediaUrls,
    artifacts,
  };
}

async function captureProfileArtifacts(profileUrl: string) {
  await runBrowse(["goto", profileUrl]);
  const profileCapture = buildCapturePath("profile");
  await runBrowse(["screenshot", "--viewport", profileCapture.filePath]);
  const analysis = await analyzeLinkedInProfileImage(profileCapture.filePath, "image/png");

  const artifact: CaptureArtifact = {
    id: randomUUID(),
    platform: "linkedin",
    pageUrl: profileUrl,
    pageKind: "profile",
    cropKind: "full",
    filePath: profileCapture.filePath,
    publicUrl: profileCapture.publicUrl,
    mimeType: "image/png",
    captureMethod: "browser",
    confidence: analysis?.confidence ?? 0.6,
    createdAt: new Date().toISOString(),
  };

  return { artifact, metrics: analysis?.metrics ?? {} };
}

export async function runLinkedInSync(
  mode: LocalReaderSyncMode,
  config: LocalReaderConfig,
  runId: string,
): Promise<RunnerResult> {
  await fs.access(BROWSE_BIN);
  const profileUrl = sanitizeLinkedInProfileUrl(config.profileUrlHint ?? "");
  if (!profileUrl) {
    throw new Error("LinkedIn profile URL hint is required.");
  }

  const recentPostLimit = Math.max(1, Math.min(config.recentPostLimit ?? 30, 60));
  const preferredBrowserMode = config.preferredBrowserMode ?? "visible";
  await ensureUploadDir();

  await runBrowse(["state", "load", "linkedin"]).catch(() => undefined);
  if (preferredBrowserMode === "visible") {
    await connectRunnerVisible().catch(() => undefined);
  }

  const { artifact: profileArtifact, metrics: profileMetrics } =
    await captureProfileArtifacts(profileUrl);

  const activityUrl = `${profileUrl}recent-activity/posts/`;
  await runBrowse(["goto", activityUrl]);

  const discovered = await runBrowseJson<string[]>([
    "js",
    `(() => {
      const links = Array.from(
        document.querySelectorAll('a[href*="/feed/update/urn:li:activity"]'),
      ).map((link) => link.href).filter(Boolean);
      const unique = Array.from(new Set(links));
      return JSON.stringify(unique.slice(0, ${recentPostLimit}));
    })()`,
  ]);

  const postUrls = (discovered ?? []).slice(0, recentPostLimit);
  const posts: PostCapture[] = [];

  for (const url of postUrls) {
    const capture = await capturePostArtifacts(url);
    posts.push(capture);
  }

  return {
    runId,
    posts,
    profileArtifacts: [profileArtifact],
    profileMetrics,
    pagesVisited: postUrls.length + 2,
  };
}

export async function applyLinkedInRunnerResults(
  mode: LocalReaderSyncMode,
  config: LinkedInRunnerConfig,
  result: RunnerResult,
) {
  const now = new Date().toISOString();
  const sanitizedProfileUrl = sanitizeLinkedInProfileUrl(config.profileUrl);

  await updateStore(async (store) => {
    const nextArtifacts = [...store.captureArtifacts, ...result.profileArtifacts];
    const nextMediaAssets: MediaAsset[] = [];
    const touchedIds: string[] = [];

    const profileSnapshot = Object.values(result.profileMetrics).some(
      (value) => value !== undefined,
    )
      ? {
          id: randomUUID(),
          platform: "linkedin" as const,
          source: "vision" as const,
          capturedAt: now,
          pageUrl: sanitizedProfileUrl,
          captureMethod: "vision" as const,
          confidence: 0.7,
          ...result.profileMetrics,
        }
      : null;

    let publications = [...store.publications];
    let manualEvidence = [...store.manualEvidence];
    let metricSnapshotsNext = [...store.metricSnapshots];
    let commentNotes = [...store.commentNotes];
    let commentsCaptured = 0;

    for (const post of result.posts) {
      const sanitizedUrl = sanitizeUrl(post.url);
      const existing = publications.find(
        (publication) =>
          publication.platform === "linkedin" &&
          publication.canonicalUrl === sanitizedUrl,
      );
      const finalText = sanitizeLinkedInPublicationText(post.body ?? "");
      const title = finalText.split("\n")[0] || sanitizedUrl || "LinkedIn post";
      const publication: Publication = existing
        ? {
            ...existing,
            title: post.hook || title || existing.title,
            finalText: finalText || existing.finalText,
            canonicalUrl: sanitizedUrl,
            updatedAt: now,
          }
        : {
            id: randomUUID(),
            platform: "linkedin",
            mode: "imported",
            status: "imported",
            title: post.hook || title,
            finalText: finalText || title,
            assetIds: [],
            canonicalUrl: sanitizedUrl,
            publishedAt: now,
            createdAt: now,
            updatedAt: now,
          };

      const assets = await persistRemoteImages(
        post.mediaUrls.map((url) => ({ url })),
      );
      nextMediaAssets.push(...assets);
      const assetIds = Array.from(
        new Set([...(publication.assetIds ?? []), ...assets.map((asset) => asset.id)]),
      );

      const updatedPublication = {
        ...publication,
        assetIds,
      };

      publications = [
        updatedPublication,
        ...publications.filter((entry) => entry.id !== publication.id),
      ];
      touchedIds.push(updatedPublication.id);

      if (post.metrics && Object.values(post.metrics).some((value) => value !== undefined)) {
        metricSnapshotsNext = [
          {
            id: randomUUID(),
            publicationId: updatedPublication.id,
            platform: "linkedin",
            source: "vision",
            capturedAt: now,
            ...post.metrics,
          },
          ...metricSnapshotsNext,
        ];
      }

      manualEvidence = [
        {
          id: randomUUID(),
          publicationId: updatedPublication.id,
          platform: "linkedin",
          url: sanitizedUrl,
          assetIds,
          extractedText: finalText || undefined,
          ocrText: undefined,
          notes: "gstack runner sync",
          verified: true,
          captureMethod: "vision",
          extractionConfidence: 0.75,
          parsedMetrics: post.metrics ?? {},
          createdAt: now,
        },
        ...manualEvidence,
      ];

      const newComments = (post.comments ?? []).slice(0, 5).map((note) => ({
        id: randomUUID(),
        publicationId: updatedPublication.id,
        authorName: "LinkedIn comment",
        authorType: "unknown" as const,
        note,
        replyStatus: "manual" as const,
        tags: ["runner"],
        source: "browser" as const,
        createdAt: now,
      }));
      if (newComments.length > 0) {
        commentNotes = [...newComments, ...commentNotes];
        commentsCaptured += newComments.length;
      }

      nextArtifacts.push(...post.artifacts.map((artifact) => ({
        ...artifact,
        publicationId: updatedPublication.id,
      })));
    }

    const nextStore = {
      ...store,
      publications,
      mediaAssets: [...nextMediaAssets, ...store.mediaAssets],
      manualEvidence,
      metricSnapshots: metricSnapshotsNext,
      commentNotes,
      captureArtifacts: nextArtifacts,
      accountMetricSnapshots: profileSnapshot
        ? [profileSnapshot, ...store.accountMetricSnapshots]
        : store.accountMetricSnapshots,
      localSyncRuns: store.localSyncRuns.map((run) =>
        run.id === result.runId
          ? {
              ...run,
              finishedAt: now,
              status: "succeeded" as const,
              mode,
              pagesVisited: result.pagesVisited,
              publicationsTouched: touchedIds.length,
              commentsCaptured,
            }
          : run,
      ),
      accountConnections: store.accountConnections.map((entry) =>
        entry.platform === "linkedin"
          ? {
              ...entry,
              localReader: {
                ...entry.localReader,
                profileUrlHint: sanitizedProfileUrl,
                lastSyncedAt: now,
              },
              capabilityFlags: {
                ...entry.capabilityFlags,
                privateLocalReaderAvailable: true,
              },
            }
          : entry,
      ),
    };

    return syncPublicationFeatureSets(nextStore, touchedIds);
  });
}

export async function startLinkedInRunnerSync(
  mode: LocalReaderSyncMode,
  config: LocalReaderConfig,
) {
  const runId = randomUUID();
  const now = new Date().toISOString();

  await updateStore((store) => ({
    ...store,
    localSyncRuns: [
      {
        id: runId,
        platform: "linkedin",
        startedAt: now,
        status: "running",
        mode,
        pagesVisited: 0,
        publicationsTouched: 0,
        commentsCaptured: 0,
      },
      ...store.localSyncRuns,
    ],
  }));

  const result = await runLinkedInSync(mode, config, runId);
  return { runId, result };
}
