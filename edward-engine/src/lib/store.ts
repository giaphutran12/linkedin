import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  deriveLinkedInPublicationTitle,
  sanitizeLinkedInExtractedText,
  sanitizeLinkedInProfileUrl,
  sanitizeLinkedInPublicationText,
  sanitizeUrl,
} from "@/lib/content";
import type {
  AccountConnection,
  CapabilityFlags,
  EngineStore,
  OptimizationPreset,
  OptimizationPresetId,
  Platform,
  RepoSummary,
} from "@/lib/types";

const APP_ROOT = process.cwd();
const REPO_ROOT = path.resolve(APP_ROOT, "..");
const DATA_DIR = path.join(APP_ROOT, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const UPLOAD_DIR = path.join(APP_ROOT, "public", "uploads");

const defaultCapabilities: Record<Platform, CapabilityFlags> = {
  x: {
    canPublish: true,
    canReadProfile: "limited",
    canReadPosts: true,
    canReadComments: false,
    canReadPostAnalytics: true,
    requiresManualBackfill: false,
    privateLocalReaderAvailable: false,
  },
  linkedin: {
    canPublish: true,
    canReadProfile: "limited",
    canReadPosts: false,
    canReadComments: false,
    canReadPostAnalytics: false,
    requiresManualBackfill: true,
    privateLocalReaderAvailable: false,
  },
};

const defaultOptimizationPresets: OptimizationPreset[] = [
  {
    id: "engagement",
    name: "Engagement",
    description: "Optimize for impressions, likes, comments, and reposts.",
    weights: {
      impressions: 1,
      likes: 4,
      comments: 7,
      reposts: 9,
    },
  },
  {
    id: "business",
    name: "Business",
    description:
      "Optimize for profile lift, followers, connection requests, and comments.",
    weights: {
      profileViews: 8,
      connectionRequests: 9,
      followers: 7,
      comments: 5,
      profileAppearances: 4,
    },
  },
  {
    id: "career",
    name: "Career",
    description:
      "Optimize for founder/recruiter attention, profile lift, and follower growth.",
    weights: {
      profileViews: 8,
      connectionRequests: 7,
      followers: 6,
      founderSignals: 10,
      recruiterSignals: 10,
    },
  },
];

const blankStore: EngineStore = {
  version: 3,
  contentItems: [],
  platformVariants: [],
  mediaAssets: [],
  publications: [],
  metricSnapshots: [],
  accountMetricSnapshots: [],
  commentNotes: [],
  accountConnections: [],
  manualEvidence: [],
  postFeatureSets: [],
  captureArtifacts: [],
  localSyncRuns: [],
  optimizationPresets: defaultOptimizationPresets,
  selectedOptimizationPresetId: "engagement",
};

function makePlaceholderConnection(platform: Platform): AccountConnection {
  return {
    id: randomUUID(),
    platform,
    status: "needs_setup",
    displayName: platform === "linkedin" ? "LinkedIn local reader" : "X account",
    scopes: [],
    capabilityFlags: defaultCapabilities[platform],
  };
}

const defaultPrimaryTimezone = "Asia/Ho_Chi_Minh";

function normalizeTimezones(input: string[] | undefined, primary: string | undefined) {
  const cleaned = (input ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
  const primaryZone = primary?.trim() || cleaned[0] || defaultPrimaryTimezone;
  const combined = [primaryZone, ...cleaned.filter((zone) => zone !== primaryZone)];
  return combined.slice(0, 5);
}

function mergeConnectionDefaults(connection: Partial<AccountConnection>) {
  const platform = (connection.platform ?? "linkedin") as Platform;
  const base = makePlaceholderConnection(platform);
  const localReader = {
    ...connection.localReader,
  };

  const normalizedTimezones = normalizeTimezones(
    localReader.savedTimezones,
    localReader.primaryTimezone,
  );

  return {
    ...base,
    ...connection,
    scopes: connection.scopes ?? [],
    capabilityFlags: {
      ...base.capabilityFlags,
      ...connection.capabilityFlags,
      privateLocalReaderAvailable: Boolean(
        connection.capabilityFlags?.privateLocalReaderAvailable ??
          connection.localReader?.pairToken,
      ),
    },
    localReader: {
      ...localReader,
      profileUrlHint: localReader.profileUrlHint
        ? sanitizeLinkedInProfileUrl(localReader.profileUrlHint)
        : undefined,
      recentPostLimit: localReader.recentPostLimit ?? 30,
      primaryTimezone: localReader.primaryTimezone ?? normalizedTimezones[0],
      savedTimezones: normalizedTimezones,
      snapshotScheduleEnabled: localReader.snapshotScheduleEnabled ?? false,
      snapshotCadenceHours: localReader.snapshotCadenceHours ?? 6,
      preferredBrowserMode: localReader.preferredBrowserMode ?? "visible",
    },
  } satisfies AccountConnection;
}

function normalizeStore(partial: Partial<EngineStore> | null | undefined): EngineStore {
  const store = partial ?? {};

  return {
    version: 3,
    contentItems: store.contentItems ?? [],
    platformVariants: store.platformVariants ?? [],
    mediaAssets: store.mediaAssets ?? [],
    publications: (store.publications ?? []).map((publication) => {
      if (publication.platform !== "linkedin") {
        return publication;
      }

      const sanitizedUrl = publication.canonicalUrl
        ? sanitizeUrl(publication.canonicalUrl)
        : publication.canonicalUrl;
      const sanitizedText = sanitizeLinkedInPublicationText(publication.finalText);

      return {
        ...publication,
        canonicalUrl: sanitizedUrl,
        title: deriveLinkedInPublicationTitle({
          title: publication.title,
          finalText: sanitizedText,
          url: sanitizedUrl,
        }),
        finalText:
          sanitizedText ||
          "sync this post again to capture a cleaner body. the metrics are still saved.",
      };
    }),
    metricSnapshots: store.metricSnapshots ?? [],
    accountMetricSnapshots: store.accountMetricSnapshots ?? [],
    commentNotes: (store.commentNotes ?? []).map((note) => ({
      ...note,
      source: note.source ?? "manual",
    })),
    accountConnections: (store.accountConnections ?? []).map(mergeConnectionDefaults),
    manualEvidence: (store.manualEvidence ?? []).map((evidence) => {
      const pageType =
        evidence.url && evidence.url.includes("/feed/update/")
          ? "post"
          : "profile";
      const cleanedText =
        evidence.platform === "linkedin"
          ? sanitizeLinkedInExtractedText(
              evidence.extractedText ?? evidence.ocrText ?? "",
              pageType,
            )
          : evidence.extractedText ?? evidence.ocrText;
      const cleanedOcr =
        evidence.platform === "linkedin" && evidence.ocrText
          ? sanitizeLinkedInExtractedText(evidence.ocrText, pageType)
          : evidence.ocrText;

      return {
        ...evidence,
        captureMethod: evidence.captureMethod ?? (evidence.ocrText ? "ocr" : "manual"),
        extractionConfidence: evidence.extractionConfidence ?? 0.6,
        extractedText: cleanedText,
        ocrText: cleanedOcr,
      };
    }),
    postFeatureSets: store.postFeatureSets ?? [],
    captureArtifacts: store.captureArtifacts ?? [],
    localSyncRuns: store.localSyncRuns ?? [],
    optimizationPresets:
      store.optimizationPresets?.length ? store.optimizationPresets : defaultOptimizationPresets,
    selectedOptimizationPresetId:
      store.selectedOptimizationPresetId ?? "engagement",
  };
}

async function ensureStoreFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(blankStore, null, 2));
  }
}

export async function readStore(): Promise<EngineStore> {
  await ensureStoreFiles();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  return normalizeStore(JSON.parse(raw) as Partial<EngineStore>);
}

export async function writeStore(store: EngineStore) {
  await ensureStoreFiles();
  await fs.writeFile(STORE_PATH, JSON.stringify(normalizeStore(store), null, 2));
}

export async function updateStore(
  updater: (store: EngineStore) => EngineStore | Promise<EngineStore>,
) {
  const store = await readStore();
  const updated = normalizeStore(await updater(store));
  await writeStore(updated);
  return updated;
}

export async function getConnection(platform: Platform) {
  const store = await readStore();
  return store.accountConnections.find((item) => item.platform === platform);
}

export async function upsertConnection(connection: AccountConnection) {
  return updateStore((store) => {
    const next = store.accountConnections.filter(
      (item) => item.platform !== connection.platform,
    );
    next.push(mergeConnectionDefaults(connection));
    return { ...store, accountConnections: next };
  });
}

export async function ensureConnection(platform: Platform) {
  const store = await readStore();
  const existing = store.accountConnections.find((item) => item.platform === platform);
  if (existing) {
    return existing;
  }

  const placeholder = makePlaceholderConnection(platform);
  await upsertConnection(placeholder);
  return placeholder;
}

export function getUploadDirectory() {
  return UPLOAD_DIR;
}

export function getRepoRoot() {
  return REPO_ROOT;
}

export async function getRepoSummary(): Promise<RepoSummary> {
  const postsDir = path.join(REPO_ROOT, "posts");
  const draftsDir = path.join(REPO_ROOT, "drafts");
  const postLogPath = path.join(postsDir, "POST-LOG.md");

  const [postFolders, draftFolders, postLog] = await Promise.all([
    fs.readdir(postsDir, { withFileTypes: true }).catch(() => []),
    fs.readdir(draftsDir, { withFileTypes: true }).catch(() => []),
    fs.readFile(postLogPath, "utf8").catch(() => ""),
  ]);

  const publishedCount = postFolders.filter(
    (entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}-/.test(entry.name),
  ).length;
  const draftCount = draftFolders.filter(
    (entry) => entry.isFile() || entry.isDirectory(),
  ).length;

  const latestPublished = postLog
    .split("\n")
    .filter((line) => line.startsWith("| 2026-") || line.startsWith("| 2025-"))
    .slice(-5)
    .reverse()
    .map((line) => {
      const cells = line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      return {
        date: cells[0] ?? "unknown",
        topic: cells[2] ?? "unknown",
      };
    });

  return {
    publishedCount,
    draftCount,
    latestPublished,
  };
}

export function getDefaultCapabilities(platform: Platform) {
  return defaultCapabilities[platform];
}

export function getDefaultOptimizationPresets() {
  return defaultOptimizationPresets;
}

export function getOptimizationPresetById(
  id: OptimizationPresetId,
  presets: OptimizationPreset[] = defaultOptimizationPresets,
) {
  return presets.find((preset) => preset.id === id) ?? defaultOptimizationPresets[0];
}
