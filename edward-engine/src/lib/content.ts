import { randomUUID } from "node:crypto";

import type {
  ContentItem,
  ContentLane,
  ManualEvidence,
  Platform,
  PlatformVariant,
  Publication,
  PublicationAnalysis,
  ProofType,
} from "@/lib/types";

const CTA_BY_PLATFORM: Record<Platform, string> = {
  linkedin: "if you're building in this space, connect with me",
  x: "if you're building around this, reply and i’ll show more",
};

const laneLabels: Record<ContentLane, string> = {
  build_receipt: "build receipt",
  builder_story: "builder story",
  industry_take: "industry take",
  spicy_sidecar: "spicy sidecar",
  conviction_story: "conviction story",
};

const blockedPatterns = [
  {
    label: "Possible hateful or identity-targeted language",
    regex: /\b(race bait|racial bait|ethnic cleansing|subhuman|retard|slur)\b/i,
  },
  {
    label: "Possible fake-engagement tactic",
    regex: /\b(like if you agree|comment yes|repost this|retweet this for reach)\b/i,
  },
  {
    label: "Possible fake metric phrasing",
    regex: /\b(fake it till|manufacture outrage|rage bait for reach)\b/i,
  },
];

function compactLine(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function createHook(item: ContentItem, platform: Platform) {
  const seed = item.rawIdea.split("\n")[0]?.trim() || item.thesis;
  const prefix =
    platform === "linkedin"
      ? "this is the thing i’m actually paying attention to right now"
      : "this is the build thread right now";

  if (item.lane === "build_receipt") {
    return compactLine(seed || `i shipped another ${laneLabels[item.lane]}`);
  }

  if (item.lane === "spicy_sidecar") {
    return platform === "x"
      ? compactLine(seed || "most AI workflows still look fake until you see the proof")
      : compactLine(seed || prefix);
  }

  return compactLine(seed || prefix);
}

function createBody(item: ContentItem, platform: Platform) {
  const proofPrompt =
    platform === "linkedin"
      ? "the real value here is the proof and the tradeoff, not the aesthetic"
      : "the interesting part is the workflow, not the polished launch tweet";

  const lines = [
    createHook(item, platform),
    "",
    item.sourceStory || item.rawIdea,
    "",
    `core thesis: ${compactLine(item.thesis)}`,
    `lane: ${laneLabels[item.lane]}`,
    item.relatedProduct
      ? `related product: ${compactLine(item.relatedProduct)}`
      : proofPrompt,
    "",
    CTA_BY_PLATFORM[platform],
  ];

  if (platform === "linkedin") {
    lines.push("Ave Christus Rex");
  }

  return lines.join("\n").trim();
}

export function scanGuardrails(text: string) {
  return blockedPatterns
    .filter((pattern) => pattern.regex.test(text))
    .map((pattern) => pattern.label);
}

export function isBlockingGuardrailIssue(issue: string) {
  return (
    issue.includes("hateful") ||
    issue.includes("identity-targeted") ||
    issue.includes("fake-engagement") ||
    issue.includes("fake metric")
  );
}

export function buildVariants(
  item: ContentItem,
  assetIds: string[],
): PlatformVariant[] {
  return (["linkedin", "x"] as const).map((platform) => {
    const text = createBody(item, platform);
    return {
      id: randomUUID(),
      contentItemId: item.id,
      platform,
      text,
      cta: CTA_BY_PLATFORM[platform],
      assetIds,
      guardrailIssues: scanGuardrails(text),
      generationNotes: [
        `generated from ${laneLabels[item.lane]}`,
        platform === "linkedin"
          ? "boss-safe and proof-heavy"
          : "shorter, punchier, and more product-forward",
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

function parseCompactNumber(raw: string) {
  const cleaned = raw.toLowerCase().replace(/,/g, "").trim();

  if (cleaned.endsWith("k")) {
    return Math.round(Number.parseFloat(cleaned) * 1000);
  }

  if (cleaned.endsWith("m")) {
    return Math.round(Number.parseFloat(cleaned) * 1_000_000);
  }

  return Number.parseInt(cleaned, 10);
}

export function parseMetricsFromText(text: string) {
  const matchMetric = (pattern: RegExp) => {
    const match = text.match(pattern);
    if (!match?.[1]) return undefined;
    return parseCompactNumber(match[1]);
  };

  return {
    impressions: matchMetric(/([\d.,kKmM]+)\s+impressions?/i),
    likes: matchMetric(/([\d.,kKmM]+)\s+likes?/i),
    comments: matchMetric(/([\d.,kKmM]+)\s+comments?/i),
    reposts: matchMetric(/([\d.,kKmM]+)\s+(?:reposts?|reshares?)/i),
    membersReached: matchMetric(/([\d.,kKmM]+)\s+members reached/i),
    followers: matchMetric(/([\d.,kKmM]+)\s+followers?/i),
    profileViews: matchMetric(/([\d.,kKmM]+)\s+profile views?/i),
  };
}

export function detectPlatform(url: string): Platform | null {
  if (/x\.com|twitter\.com/i.test(url)) return "x";
  if (/linkedin\.com/i.test(url)) return "linkedin";
  return null;
}

export function extractExternalIds(url: string) {
  const xMatch = url.match(/status\/(\d+)/i);
  if (xMatch) {
    return { externalId: xMatch[1] };
  }

  const linkedInUrnMatch = url.match(/(urn:li:[^/?]+)/i);
  if (linkedInUrnMatch) {
    return { externalUrn: decodeURIComponent(linkedInUrnMatch[1]) };
  }

  return {};
}

function detectHookType(text: string): PublicationAnalysis["hookType"] {
  const firstLine = text.split("\n")[0]?.trim() ?? "";

  if (/^\d/.test(firstLine)) return "number_hook";
  if (firstLine.includes("?")) return "question_hook";
  if (/^(i|i’m|i'm)\b/i.test(firstLine)) return "confession_hook";
  return "statement_hook";
}

function detectProofType(publication: Publication, evidence: ManualEvidence[]) {
  if (publication.assetIds.length > 0) return "visual_proof";
  const relatedEvidence = evidence.filter(
    (item) => item.publicationId === publication.id,
  );
  const hasNumbers = relatedEvidence.some(
    (item) =>
      Object.values(item.parsedMetrics).filter((value) => value !== undefined)
        .length > 0,
  );

  if (hasNumbers) return "numeric_proof";
  if (publication.finalText.length > 80) return "story_proof";
  return "no_clear_proof";
}

export function analyzePublication(
  publication: Publication,
  evidence: ManualEvidence[],
): PublicationAnalysis {
  const proofType: ProofType = detectProofType(publication, evidence);
  const hookType = detectHookType(publication.finalText);

  let likelyReason =
    "this post still needs more visible proof or stronger distribution";
  let suggestedNextStep =
    "add a screenshot, circle the key number, and repost the lesson with one sharper hook";

  if (proofType === "visual_proof") {
    likelyReason = "visible proof makes the post easier to trust and easier to scan";
    suggestedNextStep =
      "keep using raw screenshots and annotate the one number you want people to see";
  } else if (proofType === "numeric_proof") {
    likelyReason = "the numbers give the story weight even if the reach is still uneven";
    suggestedNextStep =
      "pair the numbers with one visual so the proof lands faster on mobile";
  } else if (hookType === "confession_hook") {
    likelyReason = "personal framing makes the post feel more human than generic advice";
    suggestedNextStep =
      "keep the vulnerability, but tie it back to a build, a screenshot, or one hard tradeoff";
  }

  return {
    hookType,
    proofType,
    likelyReason,
    suggestedNextStep,
  };
}
