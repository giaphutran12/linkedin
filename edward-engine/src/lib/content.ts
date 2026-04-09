import { randomUUID } from "node:crypto";

import type {
  ContentItem,
  ContentLane,
  CtaType,
  HookType,
  ManualEvidence,
  Platform,
  PlatformVariant,
  ProofType,
  Publication,
  PublicationAnalysis,
  MetricSnapshot,
} from "@/lib/types";

const LINKEDIN_NOISE_LINE_PATTERNS = [
  /^skip to /i,
  /^keyboard shortcuts$/i,
  /^close jump menu$/i,
  /^new feed updates/i,
  /^open emoji keyboard$/i,
  /^activate to view larger image/i,
  /^view analytics$/i,
  /^share your support/i,
  /^sort by/i,
  /^for business$/i,
  /^post a job$/i,
  /^my network$/i,
  /^messaging$/i,
  /^notifications$/i,
  /^jobs$/i,
  /^home$/i,
  /^\d+\s+notifications?\b/i,
  /^0 notifications total/i,
];

const LINKEDIN_NOISE_SUBSTRINGS = [
  "skip to main content",
  "skip to search",
  "keyboard shortcuts",
  "close jump menu",
  "new feed updates",
  "open emoji keyboard",
  "activate to view larger image",
  "view analytics",
  "share your support",
  "reactivate premium",
  "privacy & terms",
  "help center",
];

const LINKEDIN_STOP_LINE_PATTERNS = [
  /^comment on /i,
  /^comments?$/i,
  /^add a comment/i,
  /^sort by/i,
  /^most relevant/i,
  /^top comments?/i,
  /^see more comments?/i,
  /^view more comments?/i,
  /^load more comments?/i,
];

const LINKEDIN_ACTION_ONLY_PATTERNS = [
  /(?:^|\s)like(?:\s+\d+)?(?:\s|$)/i,
  /(?:^|\s)comment(?:\s+\d+)?(?:\s|$)/i,
  /(?:^|\s)repost(?:\s+\d+)?(?:\s|$)/i,
  /(?:^|\s)send(?:\s|$)/i,
  /(?:^|\s)reply(?:\s+\d+)?(?:\s|$)/i,
];

const LINKEDIN_SOFT_BREAK_TOKENS = [
  "0 notifications total",
  "Skip to search",
  "Skip to main content",
  "Keyboard shortcuts",
  "Close jump menu",
  "new feed updates",
  "Open Emoji Keyboard",
  "Activate to view larger image",
  "View analytics",
  "Comment on ",
  "Home My Network Jobs Messaging",
];

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

export function sanitizeUrl(url: string) {
  try {
    const nextUrl = new URL(url.trim());
    nextUrl.search = "";
    nextUrl.hash = "";
    return nextUrl.toString();
  } catch {
    return url.trim();
  }
}

export function sanitizeLinkedInProfileUrl(url: string) {
  const normalized = sanitizeUrl(url);
  return normalized ? normalized.replace(/\/+$/, "/") : "";
}

function compactMultiline(value: string) {
  const prepared = LINKEDIN_SOFT_BREAK_TOKENS.reduce((accumulator, token) => {
    const safe = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return accumulator.replace(new RegExp(safe, "gi"), `\n${token}`);
  }, String(value || ""))
    .replace(/\bLike\b(?:\s+\d+)?\s+\bReply\b/gi, "\nLike Reply")
    .replace(/\bReply\b(?:\s+\d+)?\s+\bComment on\b/gi, "\nReply Comment on")
    .replace(/(•\s*(?:\d+[smhdw]|mo|yr))\s+/gi, "$1\n")
    .replace(/(\b\d+[smhdw]\b)\s+(?=[A-Z])/g, "$1\n");

  return prepared
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => compactLine(line))
    .filter(Boolean);
}

function lineLooksLikeLinkedInNoise(line: string) {
  const lowered = line.toLowerCase();
  return (
    LINKEDIN_NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line)) ||
    LINKEDIN_NOISE_SUBSTRINGS.some((token) => lowered.includes(token))
  );
}

function lineLooksLikeLinkedInStop(line: string) {
  return LINKEDIN_STOP_LINE_PATTERNS.some((pattern) => pattern.test(line));
}

function lineLooksLikeLinkedInActionFooter(line: string) {
  const matches = LINKEDIN_ACTION_ONLY_PATTERNS.filter((pattern) =>
    pattern.test(line),
  ).length;
  if (matches < 2) {
    return false;
  }

  return line.length < 100;
}

function lineLooksLikeLinkedInCommentContext(line: string) {
  return (
    /\bcomment on\b/i.test(line) ||
    (/\blike\b/i.test(line) && /\breply\b/i.test(line) && /\bcomment\b/i.test(line))
  );
}

function lineLooksLikeLinkedInAuthorMeta(line: string) {
  if (/(?:^|\s)•\s*(?:\d+[smhdw]|mo|yr)/i.test(line)) return true;
  if (/\bfollowers?\b/i.test(line) && /\b\d+[smhdw]\b/i.test(line) && !/[.!?]/.test(line)) {
    return true;
  }

  return (
    /\b(?:followers?|connections?|series [a-z]|intern|founder|growth|engineer|student|software|developer|product|author)\b/i.test(
      line,
    ) &&
    /[|@]/.test(line) &&
    !/[.!?]/.test(line)
  );
}

function trimRepeatedLinkedInAuthorLine(lines: string[]) {
  if (lines.length === 0) return lines;

  let startIndex = 0;
  while (
    startIndex < Math.min(lines.length, 3) &&
    lineLooksLikeLinkedInAuthorMeta(lines[startIndex] ?? "")
  ) {
    startIndex += 1;
  }

  return lines.slice(startIndex);
}

export function sanitizeLinkedInExtractedText(
  text: string,
  pageType: "profile" | "activity" | "post" = "post",
) {
  const rawLines = compactMultiline(text);
  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of rawLines) {
    if (lineLooksLikeLinkedInNoise(rawLine)) {
      continue;
    }

    if (
      pageType === "post" &&
      cleaned.length > 0 &&
      lineLooksLikeLinkedInCommentContext(rawLine)
    ) {
      break;
    }

    const shouldStripActionTokens =
      lineLooksLikeLinkedInActionFooter(rawLine) ||
      (/\blike\b/i.test(rawLine) && /\breply\b/i.test(rawLine) && /\bcomment\b/i.test(rawLine));
    const line = (shouldStripActionTokens
      ? rawLine.replace(/\b(?:Like|Comment|Repost|Send|Reply)\b(?:\s+\d+)?/gi, " ")
      : rawLine
    )
      .replace(/\s+/g, " ")
      .trim();

    if (!line || seen.has(line)) {
      continue;
    }

    if (pageType === "post" && cleaned.length > 0) {
      if (lineLooksLikeLinkedInStop(line) || lineLooksLikeLinkedInActionFooter(line)) {
        break;
      }
    }

    seen.add(line);
    cleaned.push(line);
  }

  const withoutHeader = pageType === "post" ? trimRepeatedLinkedInAuthorLine(cleaned) : cleaned;
  return withoutHeader.join("\n").trim();
}

export function sanitizeLinkedInPublicationText(text: string) {
  return sanitizeLinkedInExtractedText(text, "post");
}

export function deriveLinkedInPublicationTitle(input: {
  title?: string;
  finalText?: string;
  url?: string;
}) {
  const titleCandidate = sanitizeLinkedInPublicationText(input.title ?? "");
  const textCandidate = sanitizeLinkedInPublicationText(input.finalText ?? "");

  if (
    titleCandidate &&
    titleCandidate.length >= 16 &&
    !lineLooksLikeLinkedInAuthorMeta(titleCandidate)
  ) {
    return titleCandidate.split("\n")[0]!.slice(0, 140);
  }

  if (textCandidate) {
    return textCandidate.split("\n")[0]!.slice(0, 140);
  }

  return input.url ? sanitizeUrl(input.url) : "LinkedIn post";
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

  if (cleaned.endsWith("%")) {
    return Number.parseFloat(cleaned.slice(0, -1));
  }

  if (cleaned.endsWith("k")) {
    return Math.round(Number.parseFloat(cleaned) * 1000);
  }

  if (cleaned.endsWith("m")) {
    return Math.round(Number.parseFloat(cleaned) * 1_000_000);
  }

  const numeric = Number.parseFloat(cleaned);
  return Number.isFinite(numeric) ? Math.round(numeric) : undefined;
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
    reposts: matchMetric(/([\d.,kKmM]+)\s+(?:reposts?|reshares?|shares?)/i),
    membersReached: matchMetric(/([\d.,kKmM]+)\s+members reached/i),
    followers: matchMetric(/([\d.,kKmM]+)\s+followers?/i),
    profileViews: matchMetric(/([\d.,kKmM]+)\s+profile views?/i),
  };
}

export function parseAccountMetricsFromText(text: string) {
  const matchMetric = (pattern: RegExp) => {
    const match = text.match(pattern);
    if (!match?.[1]) return undefined;
    return parseCompactNumber(match[1]);
  };

  return {
    followers: matchMetric(/([\d.,kKmM]+)\s+followers?/i),
    profileViews: matchMetric(/([\d.,kKmM]+)\s+profile views?/i),
    profileAppearances: matchMetric(
      /([\d.,kKmM]+)\s+(?:profile appearances?|search appearances?)/i,
    ),
    postImpressions: matchMetric(/([\d.,kKmM]+)\s+post impressions?/i),
    connectionRequests: matchMetric(
      /(?:all\s*)?\(?([\d.,kKmM]+)\)?\s*(?:connection requests?|invitations?)/i,
    ),
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

  const linkedInIdMatch = url.match(/ugcPost:(\d+)/i);
  if (linkedInIdMatch) {
    return { externalUrn: `urn:li:ugcPost:${linkedInIdMatch[1]}` };
  }

  return {};
}

export function detectHookType(text: string): HookType {
  const firstLine = text.split("\n")[0]?.trim() ?? "";

  if (/^\d/.test(firstLine)) return "number_hook";
  if (firstLine.includes("?")) return "question_hook";
  if (/^(i|i’m|i'm)\b/i.test(firstLine)) return "confession_hook";
  return "statement_hook";
}

export function detectCtaType(text: string): CtaType {
  const lowered = text.trim().toLowerCase();

  if (/\b(comment|drop|tell me|what helps you|what do you think)\b/.test(lowered)) {
    return "comment";
  }
  if (/\b(follow me|follow for|follow if)\b/.test(lowered)) {
    return "follow";
  }
  if (/\b(connect with me|connect if)\b/.test(lowered)) {
    return "connect";
  }
  if (/\b(send this|share this|repost this)\b/.test(lowered)) {
    return "share";
  }
  if (/\b(reply\b|reply and)\b/.test(lowered)) {
    return "reply";
  }
  if (/\b(resonates|let me know)\b/.test(lowered)) {
    return "react";
  }

  return "none";
}

export function detectProofType(
  publication: Publication,
  evidence: ManualEvidence[],
  snapshots: MetricSnapshot[] = [],
): ProofType {
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
  if (snapshots.some((item) => item.publicationId === publication.id)) {
    return "numeric_proof";
  }
  if (publication.finalText.length > 80) return "story_proof";
  return "no_clear_proof";
}

export function analyzePublication(
  publication: Publication,
  evidence: ManualEvidence[],
  snapshots: MetricSnapshot[] = [],
): PublicationAnalysis {
  const proofType = detectProofType(publication, evidence, snapshots);
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
