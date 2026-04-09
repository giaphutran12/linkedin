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
  scanGuardrails,
  sanitizeLinkedInProfileUrl,
} from "@/lib/content";
import { collectImportedEvidence } from "@/lib/evidence";
import {
  applyLinkedInRunnerResults,
  connectRunnerVisible,
  getRunnerStatus,
  startLinkedInRunnerSync,
} from "@/lib/gstack-runner";
import { syncPublicationFeatureSets } from "@/lib/insights";
import { publishVariantToPlatform, syncPlatformMetrics } from "@/lib/platforms";
import {
  getUploadDirectory,
  getDefaultOptimizationPresets,
  readStore,
  updateStore,
} from "@/lib/store";
import type {
  CommentNote,
  ContentItem,
  MediaAsset,
  MetricSnapshot,
  OptimizationPresetId,
  Publication,
} from "@/lib/types";

function parseList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTimezones(value: FormDataEntryValue | null) {
  const list = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(list)).slice(0, 5);
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

    await updateStore(async (current) => {
      const nextStore = {
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
      };

      return syncPublicationFeatureSets(nextStore, [publication.id]);
    });
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
  const importedEvidence = await collectImportedEvidence(uploadedAssets);
  const manualMetrics = manualMetricsFromForm(formData);
  const parsedMetrics = {
    ...importedEvidence.parsedMetrics,
    ...Object.fromEntries(
      Object.entries(manualMetrics).filter(([, value]) => value !== undefined),
    ),
  };
  const externalIds = extractExternalIds(url);

  await updateStore(async (store) => {
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

    const evidence = {
      id: randomUUID(),
      publicationId: publication.id,
      platform,
      url: url || undefined,
      assetIds: uploadedAssets.map((asset) => asset.id),
      ocrText: importedEvidence.text || undefined,
      extractedText: importedEvidence.text || undefined,
      notes:
        [notes, ...importedEvidence.notes].filter(Boolean).join(" | ") || undefined,
      verified: Boolean(url),
      captureMethod: importedEvidence.captureMethod,
      extractionConfidence: importedEvidence.confidence || 0.55,
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
        source:
          importedEvidence.captureMethod === "vision"
            ? "vision"
            : importedEvidence.captureMethod === "ocr"
              ? "ocr"
              : "manual",
        capturedAt: now,
        ...parsedMetrics,
        rawText: importedEvidence.text || undefined,
      });
    }

    const nextStore = {
      ...store,
      contentItems: newContentItems,
      mediaAssets: [...uploadedAssets, ...store.mediaAssets],
      publications: [publication, ...store.publications],
      manualEvidence: [evidence, ...store.manualEvidence],
      metricSnapshots: [...snapshots, ...store.metricSnapshots],
    };

    return syncPublicationFeatureSets(nextStore, [publication.id]);
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
        source:
          latestEvidence.captureMethod === "vision"
            ? "vision"
            : latestEvidence.captureMethod === "ocr"
              ? "ocr"
              : latestEvidence.captureMethod === "browser"
                ? "browser"
                : "manual",
        capturedAt: new Date().toISOString(),
        ...latestEvidence.parsedMetrics,
        rawText: latestEvidence.extractedText ?? latestEvidence.ocrText,
      };
    }
  }

  if (snapshot) {
    await updateStore(async (current) => {
      const nextStore = {
        ...current,
        metricSnapshots: [snapshot, ...current.metricSnapshots],
      };

      return syncPublicationFeatureSets(nextStore, [publication.id]);
    });
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
    source: "manual",
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

  const analysis = analyzePublication(
    publication,
    store.manualEvidence,
    store.metricSnapshots,
  );
  const commentNote: CommentNote = {
    id: randomUUID(),
    publicationId,
    authorName: "Edward Engine Analyst",
    authorType: "unknown",
    note: `${analysis.hookType} / ${analysis.proofType}: ${analysis.likelyReason}. Next: ${analysis.suggestedNextStep}`,
    replyStatus: "manual",
    tags: ["analysis"],
    source: "manual",
    createdAt: new Date().toISOString(),
  };

  await updateStore((store) => ({
    ...store,
    commentNotes: [commentNote, ...store.commentNotes],
  }));

  revalidatePath("/");
}

export async function setOptimizationPresetAction(formData: FormData) {
  const presetId = String(formData.get("presetId") ?? "engagement") as OptimizationPresetId;
  const defaults = getDefaultOptimizationPresets();
  const valid = defaults.some((preset) => preset.id === presetId)
    ? presetId
    : "engagement";

  await updateStore((store) => ({
    ...store,
    selectedOptimizationPresetId: valid,
    optimizationPresets:
      store.optimizationPresets.length > 0 ? store.optimizationPresets : defaults,
  }));

  revalidatePath("/");
}

export async function updateLinkedInLocalReaderConfigAction(formData: FormData) {
  const profileUrlHint = sanitizeLinkedInProfileUrl(
    String(formData.get("profileUrlHint") ?? "").trim(),
  );

  await updateStore((store) => {
    const existing = store.accountConnections.find(
      (entry) => entry.platform === "linkedin",
    );

    const connection = existing ?? {
      id: randomUUID(),
      platform: "linkedin" as const,
      status: "needs_setup" as const,
      displayName: "LinkedIn local reader",
      scopes: [],
      capabilityFlags: {
        canPublish: false,
        canReadProfile: "limited" as const,
        canReadPosts: false,
        canReadComments: false,
        canReadPostAnalytics: false,
        requiresManualBackfill: true,
        privateLocalReaderAvailable: false,
      },
    };

    const nextConnection = {
      ...connection,
      localReader: {
        ...connection.localReader,
        profileUrlHint: profileUrlHint || undefined,
      },
    };

    return {
      ...store,
      accountConnections: [
        nextConnection,
        ...store.accountConnections.filter((entry) => entry.platform !== "linkedin"),
      ],
    };
  });

  revalidatePath("/");
}

export async function updateLinkedInRunnerConfigAction(formData: FormData) {
  const profileUrlHint = sanitizeLinkedInProfileUrl(
    String(formData.get("profileUrlHint") ?? "").trim(),
  );
  const recentPostLimit = Number(formData.get("recentPostLimit") ?? 30);
  const primaryTimezone = String(formData.get("primaryTimezone") ?? "").trim();
  const savedTimezones = parseTimezones(formData.get("savedTimezones"));
  const normalizedTimezones = primaryTimezone
    ? [primaryTimezone, ...savedTimezones.filter((zone) => zone !== primaryTimezone)]
    : savedTimezones;
  const preferredBrowserMode = (String(
    formData.get("preferredBrowserMode") ?? "visible",
  ) === "headless"
    ? "headless"
    : "visible") as "headless" | "visible";
  const snapshotScheduleEnabled = Boolean(formData.get("snapshotEnabled"));
  const snapshotCadenceHours = Number(formData.get("snapshotCadenceHours") ?? 6);

  await updateStore((store) => {
    const existing = store.accountConnections.find(
      (entry) => entry.platform === "linkedin",
    );

    const connection = existing ?? {
      id: randomUUID(),
      platform: "linkedin" as const,
      status: "needs_setup" as const,
      displayName: "LinkedIn local reader",
      scopes: [],
      capabilityFlags: {
        canPublish: false,
        canReadProfile: "limited" as const,
        canReadPosts: false,
        canReadComments: false,
        canReadPostAnalytics: false,
        requiresManualBackfill: true,
        privateLocalReaderAvailable: false,
      },
    };

    const nextLocalReader = {
      ...connection.localReader,
      profileUrlHint: profileUrlHint || undefined,
      recentPostLimit: Number.isFinite(recentPostLimit) ? recentPostLimit : 30,
      primaryTimezone: primaryTimezone || undefined,
      savedTimezones: normalizedTimezones,
      preferredBrowserMode,
      snapshotScheduleEnabled,
      snapshotCadenceHours: Number.isFinite(snapshotCadenceHours)
        ? snapshotCadenceHours
        : 6,
    };

    return {
      ...store,
      accountConnections: [
        {
          ...connection,
          localReader: nextLocalReader,
        },
        ...store.accountConnections.filter((entry) => entry.platform !== "linkedin"),
      ],
    };
  });

  revalidatePath("/");
}

export async function connectLinkedInRunnerAction() {
  await connectRunnerVisible().catch(() => null);
  const status = await getRunnerStatus().catch(() => null);

  await updateStore((store) => ({
    ...store,
    accountConnections: store.accountConnections.map((entry) =>
      entry.platform === "linkedin"
        ? {
            ...entry,
            localReader: {
              ...entry.localReader,
              runnerStatus: status?.available ? "ready" : "missing",
              runnerSession: status?.mode === "headed" ? "valid" : "unknown",
              preferredBrowserMode: "visible",
            },
          }
        : entry,
    ),
  }));

  revalidatePath("/");
}

export async function runLinkedInDeepSyncAction() {
  const store = await readStore();
  const connection = store.accountConnections.find(
    (entry) => entry.platform === "linkedin",
  );

  if (!connection?.localReader?.profileUrlHint) {
    throw new Error("LinkedIn profile URL hint is required.");
  }

  await updateStore((current) => ({
    ...current,
    accountConnections: current.accountConnections.map((entry) =>
      entry.platform === "linkedin"
        ? {
            ...entry,
            localReader: {
              ...entry.localReader,
              runnerStatus: "busy",
            },
          }
        : entry,
    ),
  }));

  try {
    const { runId, result } = await startLinkedInRunnerSync(
      "deep",
      connection.localReader,
    );
    await applyLinkedInRunnerResults(
      "deep",
      {
        profileUrl: connection.localReader.profileUrlHint,
        recentPostLimit: connection.localReader.recentPostLimit ?? 30,
        preferredBrowserMode:
          connection.localReader.preferredBrowserMode ?? "visible",
      },
      { ...result, runId },
    );
  } catch (error) {
    await updateStore((current) => ({
      ...current,
      localSyncRuns: current.localSyncRuns.map((run) =>
        run.status === "running" && run.platform === "linkedin"
          ? {
              ...run,
              finishedAt: new Date().toISOString(),
              status: "failed",
              error: error instanceof Error ? error.message : "runner failed",
            }
          : run,
      ),
    }));
    throw error;
  } finally {
    await updateStore((current) => ({
      ...current,
      accountConnections: current.accountConnections.map((entry) =>
        entry.platform === "linkedin"
          ? {
              ...entry,
              localReader: {
                ...entry.localReader,
                runnerStatus: "ready",
              },
            }
          : entry,
      ),
    }));
  }

  revalidatePath("/");
}

export async function runLinkedInSnapshotSyncAction() {
  const store = await readStore();
  const connection = store.accountConnections.find(
    (entry) => entry.platform === "linkedin",
  );

  if (!connection?.localReader?.profileUrlHint) {
    throw new Error("LinkedIn profile URL hint is required.");
  }

  await updateStore((current) => ({
    ...current,
    accountConnections: current.accountConnections.map((entry) =>
      entry.platform === "linkedin"
        ? {
            ...entry,
            localReader: {
              ...entry.localReader,
              runnerStatus: "busy",
            },
          }
        : entry,
    ),
  }));

  try {
    const { runId, result } = await startLinkedInRunnerSync(
      "snapshot",
      connection.localReader,
    );
    await applyLinkedInRunnerResults(
      "snapshot",
      {
        profileUrl: connection.localReader.profileUrlHint,
        recentPostLimit: Math.min(connection.localReader.recentPostLimit ?? 30, 10),
        preferredBrowserMode:
          connection.localReader.preferredBrowserMode ?? "headless",
      },
      { ...result, runId },
    );
  } catch (error) {
    await updateStore((current) => ({
      ...current,
      localSyncRuns: current.localSyncRuns.map((run) =>
        run.status === "running" && run.platform === "linkedin"
          ? {
              ...run,
              finishedAt: new Date().toISOString(),
              status: "failed",
              error: error instanceof Error ? error.message : "runner failed",
            }
          : run,
      ),
    }));
    throw error;
  } finally {
    await updateStore((current) => ({
      ...current,
      accountConnections: current.accountConnections.map((entry) =>
        entry.platform === "linkedin"
          ? {
              ...entry,
              localReader: {
                ...entry.localReader,
                runnerStatus: "ready",
              },
            }
          : entry,
      ),
    }));
  }

  revalidatePath("/");
}
