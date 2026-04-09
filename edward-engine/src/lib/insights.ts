import { randomUUID } from "node:crypto";

import {
  analyzePublication,
  detectCtaType,
  detectHookType,
  detectProofType,
  sanitizeLinkedInExtractedText,
} from "@/lib/content";
import { inspectImageAsset } from "@/lib/evidence";
import { getOptimizationPresetById } from "@/lib/store";
import type {
  AccountMetricSnapshot,
  AssetFamily,
  ConfidenceLabel,
  ContentLane,
  EngineStore,
  OptimizationPreset,
  OptimizationPresetId,
  PostFeatureSet,
  Publication,
  PublicationAnalysis,
  ScoreMetric,
} from "@/lib/types";

type ScoredPublication = {
  publication: Publication;
  displayTitle: string;
  needsRecapture: boolean;
  score: number;
  snapshot?: EngineStore["metricSnapshots"][number];
  featureSet?: PostFeatureSet;
  analysis: PublicationAnalysis;
  founderSignals: number;
  recruiterSignals: number;
  accountLift: {
    followers: number;
    profileViews: number;
    profileAppearances: number;
    connectionRequests: number;
  };
};

export type BreakdownRow = {
  label: string;
  sampleSize: number;
  medianScore: number;
  confidence: ConfidenceLabel;
};

export type LinkedInInsights = {
  preset: OptimizationPreset;
  overview: {
    trackedPosts: number;
    latestSync?: EngineStore["localSyncRuns"][number];
    coverage: {
      within24h: number;
      within72h: number;
      within7d: number;
    };
  };
  primaryTimezone: string;
  compareTimezones: string[];
  compareTiming: Array<{
    timezone: string;
    hourBreakdown: BreakdownRow[];
    weekdayBreakdown: BreakdownRow[];
  }>;
  topPosts: ScoredPublication[];
  hookBreakdown: BreakdownRow[];
  laneBreakdown: BreakdownRow[];
  ctaBreakdown: BreakdownRow[];
  assetBreakdown: BreakdownRow[];
  proofBreakdown: BreakdownRow[];
  hourBreakdown: BreakdownRow[];
  weekdayBreakdown: BreakdownRow[];
  lengthBreakdown: BreakdownRow[];
  numberedBreakdown: BreakdownRow[];
  recommendations: string[];
};

type FeatureExtractionContext = {
  store: EngineStore;
  publication: Publication;
};

function percentileMedian(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle] ?? 0;
}

function confidenceFromSample(sampleSize: number): ConfidenceLabel {
  if (sampleSize >= 6) return "high";
  if (sampleSize >= 3) return "medium";
  return "low";
}

function latestSnapshotFor(
  publicationId: string,
  metricSnapshots: EngineStore["metricSnapshots"],
) {
  return metricSnapshots.find((snapshot) => snapshot.publicationId === publicationId);
}

function getPublicationLane(
  publication: Publication,
  store: EngineStore,
): ContentLane | "unknown" {
  if (publication.contentItemId) {
    const item = store.contentItems.find((entry) => entry.id === publication.contentItemId);
    if (item) {
      return item.lane;
    }
  }

  if (publication.variantId) {
    const variant = store.platformVariants.find((entry) => entry.id === publication.variantId);
    if (variant?.contentItemId) {
      const item = store.contentItems.find((entry) => entry.id === variant.contentItemId);
      if (item) {
        return item.lane;
      }
    }
  }

  return "unknown";
}

function extractPostingDate(publication: Publication) {
  const raw = publication.publishedAt ?? publication.createdAt;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function formatHourForTimezone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(date);
}

function formatWeekdayForTimezone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
}

function detectSpacingDensity(paragraphCount: number, blankLineCount: number) {
  const ratio = paragraphCount === 0 ? 0 : blankLineCount / paragraphCount;
  if (ratio >= 1) return "airy";
  if (ratio >= 0.45) return "balanced";
  return "tight";
}

function detectLengthBucket(wordCount: number) {
  if (wordCount >= 220) return "long";
  if (wordCount >= 90) return "medium";
  return "short";
}

function detectNumberedList(lines: string[]) {
  return lines.some((line) => /^\d+\.\s/.test(line.trim()));
}

function deriveDisplayTitle(
  publication: Publication,
  evidence: EngineStore["manualEvidence"],
) {
  const latestEvidence = evidence
    .filter(
      (entry) =>
        entry.publicationId === publication.id &&
        (entry.captureMethod === "vision" || entry.notes?.includes("runner")),
    )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )[0];

  if (latestEvidence?.extractedText && latestEvidence.extractionConfidence >= 0.7) {
    const cleaned = sanitizeLinkedInExtractedText(latestEvidence.extractedText, "post");
    const line = cleaned.split("\n").find(Boolean);
    if (line && !/^https?:/i.test(line)) {
      return { title: line, needsRecapture: false };
    }
  }

  if (publication.title && !/^https?:/i.test(publication.title)) {
    return { title: publication.title, needsRecapture: false };
  }

  if (publication.canonicalUrl) {
    return { title: publication.canonicalUrl, needsRecapture: true };
  }

  return { title: "needs re-capture", needsRecapture: true };
}

function assetFamilyConfidence(assetFamily: AssetFamily): ConfidenceLabel {
  if (assetFamily === "unknown") return "low";
  if (
    assetFamily === "analytics_screenshot" ||
    assetFamily === "product_code_screenshot" ||
    assetFamily === "camera_photo"
  ) {
    return "high";
  }
  return "medium";
}

function buildBreakdown(
  publications: ScoredPublication[],
  labelFor: (publication: ScoredPublication) => string | undefined,
) {
  const buckets = new Map<string, number[]>();

  for (const publication of publications) {
    const label = labelFor(publication);
    if (!label) continue;
    const next = buckets.get(label) ?? [];
    next.push(publication.score);
    buckets.set(label, next);
  }

  return Array.from(buckets.entries())
    .map(([label, values]) => ({
      label,
      sampleSize: values.length,
      medianScore: percentileMedian(values),
      confidence: confidenceFromSample(values.length),
    }))
    .sort((left, right) => right.medianScore - left.medianScore);
}

function scoreMetricValue(
  publication: ScoredPublication,
  metric: ScoreMetric,
) {
  switch (metric) {
    case "impressions":
      return publication.snapshot?.impressions ?? 0;
    case "likes":
      return publication.snapshot?.likes ?? 0;
    case "comments":
      return publication.snapshot?.comments ?? 0;
    case "reposts":
      return publication.snapshot?.reposts ?? 0;
    case "followers":
      return publication.accountLift.followers;
    case "profileViews":
      return publication.accountLift.profileViews;
    case "profileAppearances":
      return publication.accountLift.profileAppearances;
    case "connectionRequests":
      return publication.accountLift.connectionRequests;
    case "founderSignals":
      return publication.founderSignals;
    case "recruiterSignals":
      return publication.recruiterSignals;
    default:
      return 0;
  }
}

function computeScore(
  publication: ScoredPublication,
  preset: OptimizationPreset,
) {
  return Object.entries(preset.weights).reduce((total, [metric, weight]) => {
    return total + scoreMetricValue(publication, metric as ScoreMetric) * (weight ?? 0);
  }, 0);
}

function closestSnapshotBefore(
  publishedAt: string,
  snapshots: AccountMetricSnapshot[],
) {
  const publishedMs = new Date(publishedAt).getTime();
  return snapshots
    .filter((snapshot) => new Date(snapshot.capturedAt).getTime() <= publishedMs)
    .sort(
      (left, right) =>
        new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime(),
    )[0];
}

function closestSnapshotAfter(
  publishedAt: string,
  snapshots: AccountMetricSnapshot[],
) {
  const publishedMs = new Date(publishedAt).getTime();
  return snapshots
    .filter((snapshot) => new Date(snapshot.capturedAt).getTime() >= publishedMs)
    .sort(
      (left, right) =>
        new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime(),
    )[0];
}

function buildAccountLift(
  publication: Publication,
  accountSnapshots: AccountMetricSnapshot[],
) {
  const publishedAt = publication.publishedAt ?? publication.createdAt;
  const before = closestSnapshotBefore(publishedAt, accountSnapshots);
  const after = closestSnapshotAfter(publishedAt, accountSnapshots);

  return {
    followers: Math.max((after?.followers ?? 0) - (before?.followers ?? 0), 0),
    profileViews: Math.max((after?.profileViews ?? 0) - (before?.profileViews ?? 0), 0),
    profileAppearances: Math.max(
      (after?.profileAppearances ?? 0) - (before?.profileAppearances ?? 0),
      0,
    ),
    connectionRequests: Math.max(
      (after?.connectionRequests ?? 0) - (before?.connectionRequests ?? 0),
      0,
    ),
  };
}

export async function classifyImageEvidence(
  context: FeatureExtractionContext,
): Promise<{ assetFamily: AssetFamily; confidence: ConfidenceLabel }> {
  const assets = context.store.mediaAssets.filter((asset) =>
    context.publication.assetIds.includes(asset.id),
  );

  if (assets.length === 0) {
    return { assetFamily: "no_media", confidence: "high" };
  }

  const imageAssets = assets.filter((asset) => asset.mimeType.startsWith("image/"));
  if (imageAssets.length === 0) {
    return { assetFamily: "unknown", confidence: "low" };
  }

  if (imageAssets.length > 1) {
    const analyses = await Promise.all(
      imageAssets.slice(0, 2).map((asset) => inspectImageAsset(asset, context.publication.finalText)),
    );
    const families = new Set(analyses.map((analysis) => analysis.assetFamily));
    if (families.size > 1) {
      return { assetFamily: "mixed", confidence: "medium" };
    }
    const winner = analyses.find((analysis) => analysis.assetFamily !== "unknown");
    if (winner) {
      return {
        assetFamily: winner.assetFamily === "single_screenshot" ? "multi_screenshot" : winner.assetFamily,
        confidence: assetFamilyConfidence(winner.assetFamily),
      };
    }
    return { assetFamily: "multi_screenshot", confidence: "medium" };
  }

  const first = await inspectImageAsset(imageAssets[0], context.publication.finalText);
  return {
    assetFamily: first.assetFamily,
    confidence: assetFamilyConfidence(first.assetFamily),
  };
}

export async function extractPostFeatures(
  context: FeatureExtractionContext,
): Promise<PostFeatureSet> {
  const { publication, store } = context;
  const lines = publication.finalText.split("\n");
  const textLines = lines.map((line) => line.trim()).filter(Boolean);
  const firstLine = textLines[0] ?? "";
  const paragraphCount = publication.finalText
    .split(/\n\s*\n/g)
    .filter((chunk) => chunk.trim().length > 0).length;
  const blankLineCount = lines.filter((line) => line.trim().length === 0).length;
  const postingDate = extractPostingDate(publication);
  const assetClassification = await classifyImageEvidence(context);
  const evidence = store.manualEvidence.filter(
    (item) => item.publicationId === publication.id,
  );
  const snapshots = store.metricSnapshots.filter(
    (item) => item.publicationId === publication.id,
  );

  return {
    id: randomUUID(),
    publicationId: publication.id,
    platform: publication.platform,
    extractedAt: new Date().toISOString(),
    hookType: detectHookType(publication.finalText),
    hasQuestionHook: firstLine.includes("?"),
    usesNumberedList: detectNumberedList(textLines),
    paragraphCount,
    spacingDensity: detectSpacingDensity(paragraphCount, blankLineCount),
    ctaType: detectCtaType(publication.finalText),
    assetCount: publication.assetIds.length,
    assetFamily: assetClassification.assetFamily,
    assetFamilyConfidence: assetClassification.confidence,
    proofType: detectProofType(publication, evidence, snapshots),
    wordCount: publication.finalText.trim().split(/\s+/).filter(Boolean).length,
    characterCount: publication.finalText.length,
    firstLineLength: firstLine.length,
    postingHour: postingDate?.getHours(),
    postingWeekday: postingDate?.toLocaleDateString("en-US", { weekday: "short" }),
    lengthBucket: detectLengthBucket(
      publication.finalText.trim().split(/\s+/).filter(Boolean).length,
    ),
    lane: getPublicationLane(publication, store),
  };
}

export async function syncPublicationFeatureSet(
  store: EngineStore,
  publicationId: string,
) {
  const publication = store.publications.find((entry) => entry.id === publicationId);
  if (!publication) {
    return store;
  }

  const nextFeatureSet = await extractPostFeatures({ store, publication });
  return {
    ...store,
    postFeatureSets: [
      nextFeatureSet,
      ...store.postFeatureSets.filter((entry) => entry.publicationId !== publicationId),
    ],
  };
}

export async function syncPublicationFeatureSets(
  store: EngineStore,
  publicationIds: string[],
) {
  let nextStore = store;

  for (const publicationId of Array.from(new Set(publicationIds))) {
    nextStore = await syncPublicationFeatureSet(nextStore, publicationId);
  }

  return nextStore;
}

export function computePublicationScore(
  publication: ScoredPublication,
  preset: OptimizationPreset,
) {
  return computeScore(publication, preset);
}

export function recommendNextExperiments(insights: LinkedInInsights) {
  const recommendations = [...insights.recommendations];
  if (recommendations.length > 0) {
    return recommendations;
  }

  return [
    "Need more synced LinkedIn posts before timing and hook recommendations become reliable.",
  ];
}

export function buildLinkedInInsights(
  store: EngineStore,
  presetId: OptimizationPresetId,
): LinkedInInsights {
  const preset = getOptimizationPresetById(presetId, store.optimizationPresets);
  const engagementPreset = getOptimizationPresetById(
    "engagement",
    store.optimizationPresets,
  );
  const linkedInPublications = store.publications.filter(
    (publication) =>
      publication.platform === "linkedin" &&
      (publication.status === "published" || publication.status === "imported"),
  );
  const linkedInAccountSnapshots = store.accountMetricSnapshots
    .filter((snapshot) => snapshot.platform === "linkedin")
    .sort(
      (left, right) =>
        new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime(),
    );

  const linkedInConnection = store.accountConnections.find(
    (entry) => entry.platform === "linkedin",
  );
  const primaryTimezone =
    linkedInConnection?.localReader?.primaryTimezone ?? "Asia/Ho_Chi_Minh";
  const compareTimezones = (linkedInConnection?.localReader?.savedTimezones ?? [])
    .filter((zone) => zone && zone !== primaryTimezone)
    .slice(0, 4);

  const buildScored = (activePreset: OptimizationPreset) =>
    linkedInPublications
      .map((publication) => {
      const snapshot = latestSnapshotFor(publication.id, store.metricSnapshots);
      const featureSet = store.postFeatureSets.find(
        (entry) => entry.publicationId === publication.id,
      );
      const notes = store.commentNotes.filter(
        (entry) => entry.publicationId === publication.id,
      );
      const display = deriveDisplayTitle(publication, store.manualEvidence);

      const scoredPublication: ScoredPublication = {
        publication,
        displayTitle: display.title,
        needsRecapture: display.needsRecapture,
        score: 0,
        snapshot,
        featureSet,
        analysis: analyzePublication(publication, store.manualEvidence, store.metricSnapshots),
        founderSignals: notes.filter((note) => note.authorType === "founder").length,
        recruiterSignals: notes.filter((note) => note.authorType === "recruiter").length,
        accountLift: buildAccountLift(publication, linkedInAccountSnapshots),
      };

      return {
        ...scoredPublication,
        score: computePublicationScore(scoredPublication, activePreset),
      };
    })
    .sort((left, right) => right.score - left.score);

  const scoredForPreset = buildScored(preset);
  const needsFallbackRanking =
    scoredForPreset.length > 0 &&
    scoredForPreset.every((publication) => publication.score === 0);
  const scored = needsFallbackRanking
    ? buildScored(engagementPreset)
    : scoredForPreset;

  const coverage = linkedInPublications.reduce(
    (accumulator, publication) => {
      const publishedAt = new Date(publication.publishedAt ?? publication.createdAt).getTime();
      const snapshots = store.metricSnapshots.filter(
        (snapshot) => snapshot.publicationId === publication.id,
      );

      const hasSnapshotWithin = (hours: number) =>
        snapshots.some((snapshot) => {
          const capturedAt = new Date(snapshot.capturedAt).getTime();
          return capturedAt - publishedAt <= hours * 60 * 60 * 1000;
        });

      if (hasSnapshotWithin(24)) accumulator.within24h += 1;
      if (hasSnapshotWithin(72)) accumulator.within72h += 1;
      if (hasSnapshotWithin(24 * 7)) accumulator.within7d += 1;

      return accumulator;
    },
    { within24h: 0, within72h: 0, within7d: 0 },
  );

  const hookBreakdown = buildBreakdown(
    scored,
    (item) => item.featureSet?.hookType ?? detectHookType(item.publication.finalText),
  );
  const laneBreakdown = buildBreakdown(
    scored,
    (item) => item.featureSet?.lane ?? getPublicationLane(item.publication, store),
  );
  const ctaBreakdown = buildBreakdown(
    scored,
    (item) => item.featureSet?.ctaType ?? detectCtaType(item.publication.finalText),
  );
  const assetBreakdown = buildBreakdown(
    scored,
    (item) => item.featureSet?.assetFamily ?? "unknown",
  );
  const proofBreakdown = buildBreakdown(
    scored,
    (item) => item.featureSet?.proofType ?? item.analysis.proofType,
  );
  const hourBreakdown = buildBreakdown(
    scored,
    (item) => {
      const postingDate = extractPostingDate(item.publication);
      if (!postingDate) return undefined;
      return `${formatHourForTimezone(postingDate, primaryTimezone)}:00`;
    },
  );
  const weekdayBreakdown = buildBreakdown(
    scored,
    (item) => {
      const postingDate = extractPostingDate(item.publication);
      if (!postingDate) return undefined;
      return formatWeekdayForTimezone(postingDate, primaryTimezone);
    },
  );
  const lengthBreakdown = buildBreakdown(
    scored,
    (item) => item.featureSet?.lengthBucket,
  );
  const numberedBreakdown = buildBreakdown(
    scored,
    (item) =>
      item.featureSet?.usesNumberedList !== undefined
        ? item.featureSet.usesNumberedList
          ? "numbered"
          : "not numbered"
        : undefined,
  );

  const recommendations: string[] = [];
  const topAsset = assetBreakdown[0];
  const topHook = hookBreakdown[0];
  const topHour = hourBreakdown[0];

  if (topAsset && topAsset.sampleSize >= 2) {
    recommendations.push(
      `${topAsset.label.replace(/_/g, " ")} posts are currently the cleanest visual bet.`,
    );
  }
  if (topHook && topHook.sampleSize >= 2) {
    recommendations.push(
      `${topHook.label.replace(/_/g, " ")} hooks are outperforming the rest right now.`,
    );
  }
  if (topHour && topHour.sampleSize >= 2) {
    recommendations.push(`Your current best posting window is around ${topHour.label}.`);
  }
  if (linkedInAccountSnapshots.length < 2) {
    recommendations.push(
      "Need more profile analytics snapshots before business and career presets become trustworthy.",
    );
  }
  if (needsFallbackRanking && preset.id !== "engagement") {
    recommendations.unshift(
      `${preset.name} preset does not have enough account-lift or signal data yet, so rankings are temporarily using engagement evidence.`,
    );
  }

  return {
    preset,
    overview: {
      trackedPosts: linkedInPublications.length,
      latestSync: store.localSyncRuns
        .filter((run) => run.platform === "linkedin")
        .sort(
          (left, right) =>
            new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
        )[0],
      coverage,
    },
    primaryTimezone,
    compareTimezones,
    compareTiming: compareTimezones.map((timezone) => ({
      timezone,
      hourBreakdown: buildBreakdown(scored, (item) => {
        const postingDate = extractPostingDate(item.publication);
        if (!postingDate) return undefined;
        return `${formatHourForTimezone(postingDate, timezone)}:00`;
      }),
      weekdayBreakdown: buildBreakdown(scored, (item) => {
        const postingDate = extractPostingDate(item.publication);
        if (!postingDate) return undefined;
        return formatWeekdayForTimezone(postingDate, timezone);
      }),
    })),
    topPosts: scored.slice(0, 6),
    hookBreakdown,
    laneBreakdown,
    ctaBreakdown,
    assetBreakdown,
    proofBreakdown,
    hourBreakdown,
    weekdayBreakdown,
    lengthBreakdown,
    numberedBreakdown,
    recommendations,
  };
}

export function scoreLabel(publication: ScoredPublication) {
  if (publication.score >= 500) return "strong";
  if (publication.score >= 150) return "solid";
  if (publication.score > 0) return "emerging";
  return "thin";
}

export function summarizePostLab(publication: ScoredPublication) {
  return {
    title: publication.displayTitle,
    scoreLabel: scoreLabel(publication),
  };
}
