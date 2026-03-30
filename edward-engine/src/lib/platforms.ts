import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";

import type {
  AccountConnection,
  MediaAsset,
  MetricSnapshot,
  Platform,
  PlatformVariant,
  Publication,
} from "@/lib/types";

type PublishResult = {
  externalId?: string;
  externalUrn?: string;
  canonicalUrl: string;
  publishedAt: string;
};

function assertToken(connection?: AccountConnection) {
  if (!connection?.accessToken) {
    throw new Error("No connected account found for this platform");
  }

  return connection.accessToken;
}

async function publishTextToX(
  variant: PlatformVariant,
  connection?: AccountConnection,
  assets: MediaAsset[] = [],
): Promise<PublishResult> {
  const token = assertToken(connection);
  let mediaIds: string[] | undefined;

  if (assets.length > 0) {
    mediaIds = [];
    for (const asset of assets) {
      const encodedMedia = await fs.readFile(asset.storedPath, "base64");
      const uploadResponse = await fetch("https://api.x.com/2/media/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          media: encodedMedia,
          media_category: "tweet_image",
          media_type: asset.mimeType,
        }),
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        throw new Error(`X media upload failed: ${error}`);
      }

      const uploadPayload = (await uploadResponse.json()) as {
        data?: { id?: string };
      };
      const mediaId = uploadPayload.data?.id;
      if (!mediaId) {
        throw new Error("X media upload failed: missing media ID");
      }
      mediaIds.push(mediaId);
    }
  }

  const response = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: variant.text,
      ...(mediaIds?.length ? { media: { media_ids: mediaIds } } : {}),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`X publish failed: ${error}`);
  }

  const payload = (await response.json()) as {
    data?: { id?: string };
  };

  const tweetId = payload.data?.id;
  if (!tweetId) {
    throw new Error("X publish failed: missing tweet ID");
  }

  return {
    externalId: tweetId,
    canonicalUrl: `https://x.com/i/web/status/${tweetId}`,
    publishedAt: new Date().toISOString(),
  };
}

async function publishTextToLinkedIn(
  variant: PlatformVariant,
  connection?: AccountConnection,
  assets: MediaAsset[] = [],
): Promise<PublishResult> {
  const token = assertToken(connection);
  const authorUrn = connection?.authorUrn;

  if (!authorUrn) {
    throw new Error(
      "LinkedIn publish failed: missing author URN from the connected account",
    );
  }

  let imageAssetUrn: string | undefined;

  if (assets.length > 1) {
    throw new Error(
      "LinkedIn member publishing supports a single image in this v1 adapter",
    );
  }

  if (assets.length === 1) {
    const uploadRegistration = await fetch(
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
            owner: authorUrn,
            serviceRelationships: [
              {
                relationshipType: "OWNER",
                identifier: "urn:li:userGeneratedContent",
              },
            ],
          },
        }),
      },
    );

    if (!uploadRegistration.ok) {
      const error = await uploadRegistration.text();
      throw new Error(`LinkedIn image register failed: ${error}`);
    }

    const registrationPayload = (await uploadRegistration.json()) as {
      value?: {
        asset?: string;
        uploadMechanism?: {
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"?: {
            uploadUrl?: string;
          };
        };
      };
    };

    imageAssetUrn = registrationPayload.value?.asset;
    const uploadUrl =
      registrationPayload.value?.uploadMechanism?.[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ]?.uploadUrl;

    if (!imageAssetUrn || !uploadUrl) {
      throw new Error("LinkedIn image register failed: missing upload details");
    }

    const buffer = await fs.readFile(assets[0].storedPath);
    const uploadBinaryResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": assets[0].mimeType,
      },
      body: buffer,
    });

    if (!uploadBinaryResponse.ok) {
      const error = await uploadBinaryResponse.text();
      throw new Error(`LinkedIn binary upload failed: ${error}`);
    }
  }

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: variant.text,
          },
          shareMediaCategory: imageAssetUrn ? "IMAGE" : "NONE",
          ...(imageAssetUrn
            ? {
                media: [
                  {
                    status: "READY",
                    media: imageAssetUrn,
                  },
                ],
              }
            : {}),
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn publish failed: ${error}`);
  }

  const restliId = response.headers.get("x-restli-id");
  if (!restliId) {
    throw new Error("LinkedIn publish failed: missing URN");
  }

  const urn = restliId.startsWith("urn:li:")
    ? restliId
    : `urn:li:ugcPost:${restliId}`;

  return {
    externalUrn: urn,
    canonicalUrl: `https://www.linkedin.com/feed/update/${urn}/`,
    publishedAt: new Date().toISOString(),
  };
}

export async function publishVariantToPlatform(
  variant: PlatformVariant,
  connection?: AccountConnection,
  assets: MediaAsset[] = [],
): Promise<PublishResult> {
  if (variant.platform === "x") {
    return publishTextToX(variant, connection, assets);
  }

  return publishTextToLinkedIn(variant, connection, assets);
}

export async function syncPlatformMetrics(
  publication: Publication,
  connection?: AccountConnection,
): Promise<MetricSnapshot | null> {
  if (publication.platform === "linkedin") {
    return null;
  }

  if (!publication.externalId) {
    return null;
  }

  const token = assertToken(connection);
  const response = await fetch(
    `https://api.x.com/2/tweets/${publication.externalId}?tweet.fields=public_metrics,non_public_metrics,organic_metrics`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`X metric sync failed: ${error}`);
  }

  const payload = (await response.json()) as {
    data?: {
      public_metrics?: {
        like_count?: number;
        reply_count?: number;
        retweet_count?: number;
      };
      non_public_metrics?: {
        impression_count?: number;
      };
      organic_metrics?: {
        impression_count?: number;
        like_count?: number;
        reply_count?: number;
        retweet_count?: number;
      };
    };
  };

  const publicMetrics = payload.data?.public_metrics ?? {};
  const organicMetrics = payload.data?.organic_metrics ?? {};
  const nonPublicMetrics = payload.data?.non_public_metrics ?? {};

  return {
    id: randomUUID(),
    publicationId: publication.id,
    platform: publication.platform,
    source: "api",
    capturedAt: new Date().toISOString(),
    impressions:
      organicMetrics.impression_count ?? nonPublicMetrics.impression_count,
    likes: organicMetrics.like_count ?? publicMetrics.like_count,
    comments: organicMetrics.reply_count ?? publicMetrics.reply_count,
    reposts: organicMetrics.retweet_count ?? publicMetrics.retweet_count,
  };
}

export function buildCapabilities(
  platform: Platform,
  scopes: string[],
): AccountConnection["capabilityFlags"] {
  if (platform === "linkedin") {
    return {
      canPublish: scopes.includes("w_member_social"),
      canReadProfile: scopes.includes("profile") ? "limited" : "none",
      canReadPosts: false,
      canReadComments: false,
      canReadPostAnalytics: false,
      requiresManualBackfill: true,
      privateLocalReaderAvailable: false,
    };
  }

  return {
    canPublish: scopes.some((scope) => scope.includes("tweet.write")),
    canReadProfile: scopes.some((scope) => scope.includes("users.read"))
      ? "limited"
      : "none",
    canReadPosts: scopes.some((scope) => scope.includes("tweet.read")),
    canReadComments: false,
    canReadPostAnalytics: scopes.some((scope) => scope.includes("tweet.read")),
    requiresManualBackfill: false,
    privateLocalReaderAvailable: false,
  };
}
