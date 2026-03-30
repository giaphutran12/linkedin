import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  AccountConnection,
  CapabilityFlags,
  EngineStore,
  Platform,
  RepoSummary,
} from "@/lib/types";

const APP_ROOT = process.cwd();
const REPO_ROOT = path.resolve(APP_ROOT, "..");
const DATA_DIR = path.join(APP_ROOT, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const UPLOAD_DIR = path.join(APP_ROOT, "public", "uploads");

const blankStore: EngineStore = {
  version: 1,
  contentItems: [],
  platformVariants: [],
  mediaAssets: [],
  publications: [],
  metricSnapshots: [],
  commentNotes: [],
  accountConnections: [],
  manualEvidence: [],
};

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
  return JSON.parse(raw) as EngineStore;
}

export async function writeStore(store: EngineStore) {
  await ensureStoreFiles();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

export async function updateStore(
  updater: (store: EngineStore) => EngineStore | Promise<EngineStore>,
) {
  const store = await readStore();
  const updated = await updater(store);
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
    next.push(connection);
    return { ...store, accountConnections: next };
  });
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
