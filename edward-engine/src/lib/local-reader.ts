import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  deriveLinkedInPublicationTitle,
  extractExternalIds,
  parseAccountMetricsFromText,
  parseMetricsFromText,
  sanitizeLinkedInExtractedText,
  sanitizeLinkedInProfileUrl,
  sanitizeLinkedInPublicationText,
  sanitizeUrl,
} from "@/lib/content";
import { ensureConnection } from "@/lib/store";
import type {
  AccountConnection,
  CommentNote,
  MetricSnapshot,
  Publication,
} from "@/lib/types";

export const LOCAL_READER_TOKEN_HEADER = "x-edward-local-reader-token";

export const browserPayloadSchema = z.object({
  runId: z.string().min(1),
  pageType: z.enum(["profile", "activity", "post"]),
  pageUrl: z.string().url(),
  extractedText: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  captureMethod: z.enum(["browser", "vision"]).default("browser"),
  runner: z.boolean().optional(),
  profileMetrics: z
    .object({
      followers: z.number().optional(),
      profileViews: z.number().optional(),
      profileAppearances: z.number().optional(),
      postImpressions: z.number().optional(),
      connectionRequests: z.number().optional(),
    })
    .partial()
    .optional(),
  discoveredPosts: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().optional(),
        publishedAt: z.string().optional(),
        externalUrn: z.string().optional(),
      }),
    )
    .default([]),
  post: z
    .object({
      canonicalUrl: z.string().url(),
      title: z.string().optional(),
      finalText: z.string().optional(),
      externalUrn: z.string().optional(),
      images: z
        .array(
          z.object({
            url: z.string().url(),
            alt: z.string().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
          }),
        )
        .default([]),
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
      comments: z
        .array(
          z.object({
            authorName: z.string().min(1),
            note: z.string().min(1),
          }),
        )
        .default([]),
    })
    .optional(),
  artifacts: z
    .array(
      z.object({
        filePath: z.string().min(1),
        publicUrl: z.string().optional(),
        mimeType: z.string().min(1),
        pageKind: z
          .enum(["profile", "activity", "post", "analytics", "unknown"])
          .default("unknown"),
        cropKind: z
          .enum(["full", "body", "metrics", "media", "comments", "unknown"])
          .default("unknown"),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .default([]),
});

export type BrowserPayload = z.infer<typeof browserPayloadSchema>;

export function parseBrowserPayload(payload: unknown) {
  const parsed = browserPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Invalid local reader payload");
  }

  return parsed.data;
}

export function isLocalhostHost(host: string | null | undefined) {
  if (!host) return false;
  const hostname = host.split(":")[0]?.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function normalizeLinkedInProfileUrl(url: string) {
  return sanitizeLinkedInProfileUrl(url);
}

export function buildRecentActivityUrl(profileUrlHint: string) {
  return `${normalizeLinkedInProfileUrl(profileUrlHint)}recent-activity/posts/`;
}

export function createPairToken() {
  return randomUUID();
}

export async function ensureLinkedInConnection() {
  return ensureConnection("linkedin");
}

export function authorizeLocalReader(
  request: Request,
  connection?: AccountConnection,
) {
  const headerToken = request.headers.get(LOCAL_READER_TOKEN_HEADER);
  return Boolean(headerToken && connection?.localReader?.pairToken === headerToken);
}

export function buildImportedPublicationFromBrowser(input: {
  existing?: Publication;
  url: string;
  title?: string;
  finalText?: string;
  createdAt: string;
}): Publication {
  const sanitizedUrl = sanitizeUrl(input.url);
  const externalIds = extractExternalIds(sanitizedUrl);
  const finalText = sanitizeLinkedInPublicationText(input.finalText ?? "");
  const title = deriveLinkedInPublicationTitle({
    title: input.title,
    finalText,
    url: sanitizedUrl,
  });

  if (input.existing) {
    return {
      ...input.existing,
      title: title || input.existing.title,
      finalText: finalText || input.existing.finalText,
      canonicalUrl: sanitizedUrl,
      externalUrn: input.existing.externalUrn ?? externalIds.externalUrn,
      updatedAt: input.createdAt,
    };
  }

  return {
    id: randomUUID(),
    platform: "linkedin",
    mode: "imported",
    status: "imported",
    title,
    finalText: finalText || title || "LinkedIn import",
    assetIds: [],
    canonicalUrl: sanitizedUrl,
    externalUrn: externalIds.externalUrn,
    publishedAt: input.createdAt,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

export function buildBrowserMetricSnapshot(input: {
  publicationId: string;
  payload: BrowserPayload;
  createdAt: string;
}): MetricSnapshot | null {
  const cleanedText = input.payload.extractedText
    ? sanitizeLinkedInExtractedText(
        input.payload.extractedText,
        input.payload.pageType,
      )
    : undefined;
  const parsedTextMetrics = cleanedText
    ? parseMetricsFromText(cleanedText)
    : {};
  const metrics = {
    ...parsedTextMetrics,
    ...input.payload.post?.metrics,
  };

  const hasMetrics = Object.values(metrics).some((value) => value !== undefined);
  if (!hasMetrics) {
    return null;
  }

  return {
    id: randomUUID(),
    publicationId: input.publicationId,
    platform: "linkedin",
    source: input.payload.captureMethod === "vision" ? "vision" : "browser",
    capturedAt: input.createdAt,
    ...metrics,
    rawText: cleanedText,
  };
}

export function buildBrowserCommentNotes(input: {
  publicationId: string;
  payload: BrowserPayload;
  createdAt: string;
}) {
  return (input.payload.post?.comments ?? []).slice(0, 5).map(
    (comment): CommentNote => ({
      id: randomUUID(),
      publicationId: input.publicationId,
      authorName: comment.authorName,
      authorType: "unknown",
      note: comment.note,
      replyStatus: "manual",
      tags: ["browser"],
      source: "browser",
      createdAt: input.createdAt,
    }),
  );
}

export function mergeProfileMetrics(payload: BrowserPayload) {
  const cleanedText = payload.extractedText
    ? sanitizeLinkedInExtractedText(payload.extractedText, "profile")
    : "";
  const parsedText = cleanedText
    ? parseAccountMetricsFromText(cleanedText)
    : {};

  return {
    ...parsedText,
    ...payload.profileMetrics,
  };
}
