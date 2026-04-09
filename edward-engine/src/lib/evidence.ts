import type { AssetFamily, ManualEvidence, MediaAsset, MetricSnapshot } from "@/lib/types";
import { parseMetricsFromText } from "@/lib/content";
import { analyzeImageWithGemini, geminiIsConfigured } from "@/lib/gemini";
import { runOcrWithConfidence } from "@/lib/ocr";

type ParsedMetricShape = Partial<
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

export type ImageEvidenceResult = {
  text: string;
  parsedMetrics: ParsedMetricShape;
  captureMethod: ManualEvidence["captureMethod"];
  confidence: number;
  assetFamily: AssetFamily;
  notes: string[];
};

function mergeMetrics(
  base: ParsedMetricShape,
  next: ParsedMetricShape,
): ParsedMetricShape {
  return {
    impressions: next.impressions ?? base.impressions,
    likes: next.likes ?? base.likes,
    comments: next.comments ?? base.comments,
    reposts: next.reposts ?? base.reposts,
    membersReached: next.membersReached ?? base.membersReached,
    followers: next.followers ?? base.followers,
    profileViews: next.profileViews ?? base.profileViews,
  };
}

function guessAssetFamilyFromText(
  asset: MediaAsset,
  text: string,
): AssetFamily {
  const loweredText = text.toLowerCase();
  const loweredName = asset.originalName.toLowerCase();

  if (!asset.mimeType.startsWith("image/")) {
    return "unknown";
  }

  if (
    /\b(impressions|followers|members reached|profile views|analytics|profile appearances|post impressions)\b/.test(
      loweredText,
    )
  ) {
    return "analytics_screenshot";
  }

  if (
    /\b(import\s|const\s|function\s|error\b|stack trace|terminal|npm\b|npx\b|tsconfig|package\.json|console\.)\b/.test(
      loweredText,
    )
  ) {
    return "product_code_screenshot";
  }

  if (
    loweredName.includes("whatsapp image") ||
    loweredName.includes("img_") ||
    loweredName.includes("photo")
  ) {
    return "camera_photo";
  }

  if (text.trim()) {
    return "single_screenshot";
  }

  return "unknown";
}

function needsVisionFallback(confidence: number, metrics: ParsedMetricShape) {
  const parsedMetricCount = Object.values(metrics).filter(
    (value) => value !== undefined,
  ).length;

  return confidence < 0.72 || parsedMetricCount === 0;
}

export async function inspectImageAsset(
  asset: MediaAsset,
  contextText = "",
): Promise<ImageEvidenceResult> {
  if (!asset.mimeType.startsWith("image/")) {
    return {
      text: "",
      parsedMetrics: {},
      captureMethod: "manual",
      confidence: 0.2,
      assetFamily: "unknown",
      notes: [],
    };
  }

  const ocr = await runOcrWithConfidence(asset.storedPath).catch(() => ({
    text: "",
    confidence: 0,
  }));
  const ocrMetrics = parseMetricsFromText(ocr.text);
  let result: ImageEvidenceResult = {
    text: ocr.text,
    parsedMetrics: ocrMetrics,
    captureMethod: "ocr",
    confidence: ocr.confidence,
    assetFamily: guessAssetFamilyFromText(asset, `${contextText}\n${ocr.text}`),
    notes: [],
  };

  if (geminiIsConfigured() && needsVisionFallback(ocr.confidence, ocrMetrics)) {
    const vision = await analyzeImageWithGemini(
      asset.storedPath,
      asset.mimeType,
      [
        "You are classifying a social-media analytics or build screenshot.",
        "Return JSON only.",
        "Extract any visible post metrics if present.",
        "Choose one asset_family from:",
        "no_media, single_screenshot, multi_screenshot, camera_photo, analytics_screenshot, product_code_screenshot, mixed, unknown.",
        "Use confidence from 0 to 1.",
      ].join(" "),
    ).catch(() => null);

    if (vision) {
      result = {
        text: vision.extractedText || result.text,
        parsedMetrics: mergeMetrics(result.parsedMetrics, vision.metrics),
        captureMethod: "vision",
        confidence: Math.max(result.confidence, vision.confidence),
        assetFamily:
          vision.assetFamily !== "unknown" ? vision.assetFamily : result.assetFamily,
        notes: vision.notes,
      };
    }
  }

  return result;
}

export async function collectImportedEvidence(assets: MediaAsset[]) {
  const imageAssets = assets.filter((asset) => asset.mimeType.startsWith("image/"));
  const analyses = await Promise.all(imageAssets.map((asset) => inspectImageAsset(asset)));

  return analyses.reduce<{
    text: string;
    parsedMetrics: ParsedMetricShape;
    captureMethod: ManualEvidence["captureMethod"];
    confidence: number;
    assetFamily: AssetFamily;
    notes: string[];
  }>(
    (accumulator, analysis) => ({
      text: [accumulator.text, analysis.text].filter(Boolean).join("\n\n"),
      parsedMetrics: mergeMetrics(accumulator.parsedMetrics, analysis.parsedMetrics),
      captureMethod:
        analysis.captureMethod === "vision" || accumulator.captureMethod === "vision"
          ? ("vision" as const)
          : analysis.captureMethod === "ocr" || accumulator.captureMethod === "ocr"
            ? ("ocr" as const)
            : ("manual" as const),
      confidence: Math.max(accumulator.confidence, analysis.confidence),
      assetFamily:
        accumulator.assetFamily === "unknown"
          ? analysis.assetFamily
          : accumulator.assetFamily,
      notes: [...accumulator.notes, ...analysis.notes],
    }),
    {
      text: "",
      parsedMetrics: {} as ParsedMetricShape,
      captureMethod: "manual" as ManualEvidence["captureMethod"],
      confidence: 0,
      assetFamily: "unknown" as AssetFamily,
      notes: [] as string[],
    },
  );
}
