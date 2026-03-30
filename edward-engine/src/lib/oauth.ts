import { createHash, randomBytes } from "node:crypto";

import type { Platform } from "@/lib/types";

const providers = {
  x: {
    platform: "x" as const,
    authorizationUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    scopes:
      process.env.X_SCOPES?.split(/\s+/).filter(Boolean) ??
      ["tweet.read", "users.read", "tweet.write", "offline.access"],
    clientId: process.env.X_CLIENT_ID,
    clientSecret: process.env.X_CLIENT_SECRET,
  },
  linkedin: {
    platform: "linkedin" as const,
    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes:
      process.env.LINKEDIN_SCOPES?.split(/\s+/).filter(Boolean) ??
      ["openid", "profile", "email", "w_member_social"],
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  },
};

type OAuthProvider = (typeof providers)[Platform];

export function getProvider(platform: Platform): OAuthProvider {
  return providers[platform];
}

export function getAppUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export function getRedirectUri(platform: Platform) {
  return `${getAppUrl()}/api/oauth/${platform}/callback`;
}

export function makeState() {
  return randomBytes(16).toString("hex");
}

export function makePkceVerifier() {
  return randomBytes(48).toString("base64url");
}

export function makePkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function providerIsConfigured(platform: Platform) {
  const provider = getProvider(platform);
  return Boolean(provider.clientId && provider.clientSecret);
}

export async function fetchProviderProfile(
  platform: Platform,
  accessToken: string,
) {
  if (platform === "linkedin") {
    const response = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LinkedIn profile fetch failed: ${error}`);
    }

    const profile = (await response.json()) as {
      sub?: string;
      name?: string;
      email?: string;
      picture?: string;
      locale?: { country?: string; language?: string };
    };

    return {
      externalAccountId: profile.sub ?? "",
      displayName: profile.name ?? "LinkedIn member",
      profileUrl: profile.sub
        ? `https://www.linkedin.com/in/${profile.sub}`
        : undefined,
      authorUrn: profile.sub ? `urn:li:person:${profile.sub}` : undefined,
    };
  }

  const response = await fetch(
    "https://api.x.com/2/users/me?user.fields=profile_image_url,username,name",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`X profile fetch failed: ${error}`);
  }

  const payload = (await response.json()) as {
    data?: {
      id?: string;
      name?: string;
      username?: string;
    };
  };

  return {
    externalAccountId: payload.data?.id ?? "",
    displayName: payload.data?.name ?? "X account",
    profileUrl: payload.data?.username
      ? `https://x.com/${payload.data.username}`
      : undefined,
    username: payload.data?.username,
  };
}
