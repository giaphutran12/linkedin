import { promises as fs } from "node:fs";

import { z } from "zod";

import type { AssetFamily, MetricSnapshot } from "@/lib/types";

const geminiResponseSchema = z.object({
  extracted_text: z.string().optional(),
  asset_family: z
    .enum([
      "no_media",
      "single_screenshot",
      "multi_screenshot",
      "camera_photo",
      "analytics_screenshot",
      "product_code_screenshot",
      "mixed",
      "unknown",
    ])
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
  metrics: z
    .object({
      impressions: z.number().optional(),
      likes: z.number().optional(),
      comments: z.number().optional(),
      reposts: z.number().optional(),
      membersReached: z.number().optional(),
      followers: z.number().optional(),
      profileViews: z.number().optional(),
    })
    .partial()
    .optional(),
  notes: z.array(z.string()).optional(),
});

const linkedInPostSchema = z.object({
  hook: z.string().optional(),
  post_text: z.string().optional(),
  comments: z.array(z.string()).optional(),
  media_present: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  metrics: z
    .object({
      impressions: z.number().optional(),
      likes: z.number().optional(),
      comments: z.number().optional(),
      reposts: z.number().optional(),
      membersReached: z.number().optional(),
      followers: z.number().optional(),
      profileViews: z.number().optional(),
    })
    .partial()
    .optional(),
});

const linkedInProfileSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
  metrics: z
    .object({
      followers: z.number().optional(),
      profileViews: z.number().optional(),
      profileAppearances: z.number().optional(),
      postImpressions: z.number().optional(),
      connectionRequests: z.number().optional(),
    })
    .partial()
    .optional(),
});

export type GeminiVisionResult = {
  extractedText: string;
  assetFamily: AssetFamily;
  confidence: number;
  metrics: Partial<
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
  notes: string[];
};

export type LinkedInPostVisionResult = {
  hook?: string;
  postText?: string;
  comments: string[];
  confidence: number;
  metrics: Partial<
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
  mediaPresent?: boolean;
};

export type LinkedInProfileVisionResult = {
  confidence: number;
  metrics: {
    followers?: number;
    profileViews?: number;
    profileAppearances?: number;
    postImpressions?: number;
    connectionRequests?: number;
  };
};

function getGeminiModel() {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

export function geminiIsConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function getFirstTextCandidate(payload: unknown) {
  const candidates =
    ((payload as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    }).candidates ?? []);

  return candidates[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

async function runGeminiJson<T>({
  filePath,
  mimeType,
  prompt,
  schema,
}: {
  filePath: string;
  mimeType: string;
  prompt: string;
  schema: z.ZodSchema<T>;
}): Promise<T | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const imageBuffer = await fs.readFile(filePath);
  const inlineData = imageBuffer.toString("base64");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: inlineData,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const rawText = stripCodeFence(getFirstTextCandidate(payload));
  if (!rawText) {
    return null;
  }

  const parsed = schema.safeParse(JSON.parse(rawText));
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export async function analyzeImageWithGemini(
  filePath: string,
  mimeType: string,
  prompt: string,
): Promise<GeminiVisionResult | null> {
  const parsed = await runGeminiJson({
    filePath,
    mimeType,
    prompt,
    schema: geminiResponseSchema,
  });
  if (!parsed) return null;

  return {
    extractedText: parsed.extracted_text ?? "",
    assetFamily: parsed.asset_family ?? "unknown",
    confidence: parsed.confidence ?? 0.55,
    metrics: parsed.metrics ?? {},
    notes: parsed.notes ?? [],
  };
}

export async function analyzeLinkedInPostImage(
  filePath: string,
  mimeType: string,
): Promise<LinkedInPostVisionResult | null> {
  const prompt = [
    "You are parsing a LinkedIn post screenshot.",
    "Return JSON only with fields:",
    "hook (short first line if visible),",
    "post_text (full post body text if visible),",
    "metrics (impressions, likes, comments, reposts, membersReached, followers, profileViews),",
    "comments (array of visible comment snippets if any),",
    "media_present (boolean),",
    "confidence (0-1).",
    "If a field is missing, omit it rather than guessing.",
  ].join(" ");

  const parsed = await runGeminiJson({
    filePath,
    mimeType,
    prompt,
    schema: linkedInPostSchema,
  });
  if (!parsed) return null;

  return {
    hook: parsed.hook,
    postText: parsed.post_text,
    comments: parsed.comments ?? [],
    confidence: parsed.confidence ?? 0.6,
    metrics: parsed.metrics ?? {},
    mediaPresent: parsed.media_present,
  };
}

export async function analyzeLinkedInProfileImage(
  filePath: string,
  mimeType: string,
): Promise<LinkedInProfileVisionResult | null> {
  const prompt = [
    "You are parsing a LinkedIn profile analytics screenshot.",
    "Return JSON only with fields:",
    "metrics (followers, profileViews, profileAppearances, postImpressions, connectionRequests),",
    "confidence (0-1).",
    "Do not guess.",
  ].join(" ");

  const parsed = await runGeminiJson({
    filePath,
    mimeType,
    prompt,
    schema: linkedInProfileSchema,
  });
  if (!parsed) return null;

  return {
    confidence: parsed.confidence ?? 0.6,
    metrics: parsed.metrics ?? {},
  };
}
