import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  fetchProviderProfile,
  getProvider,
  getRedirectUri,
} from "@/lib/oauth";
import { buildCapabilities } from "@/lib/platforms";
import { upsertConnection } from "@/lib/store";
import type { Platform } from "@/lib/types";

async function exchangeCodeForToken(
  platform: Platform,
  code: string,
  verifier?: string,
) {
  const provider = getProvider(platform);
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", getRedirectUri(platform));
  body.set("client_id", provider.clientId ?? "");

  if (platform === "linkedin") {
    body.set("client_secret", provider.clientSecret ?? "");
  } else if (verifier) {
    body.set("code_verifier", verifier);
    body.set("client_secret", provider.clientSecret ?? "");
  }

  const response = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OAuth token exchange failed: ${error}`);
  }

  return (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> },
) {
  const { platform } = await context.params;
  if (platform !== "x" && platform !== "linkedin") {
    return NextResponse.redirect(
      new URL("/?oauth_error=unsupported-platform", request.nextUrl.origin),
    );
  }

  const resolvedPlatform: Platform = platform;
  const cookieStore = await cookies();
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const expectedState = cookieStore.get(`oauth_state_${resolvedPlatform}`)?.value;
  const verifier = cookieStore.get(`oauth_pkce_${resolvedPlatform}`)?.value;

  if (!state || !code || state !== expectedState) {
    return NextResponse.redirect(
      new URL(
        `/?oauth_error=${resolvedPlatform}-state-mismatch`,
        request.nextUrl.origin,
      ),
    );
  }

  try {
    const tokenResponse = await exchangeCodeForToken(
      resolvedPlatform,
      code,
      verifier,
    );
    const accessToken = tokenResponse.access_token;

    if (!accessToken) {
      throw new Error("Missing access token");
    }

    const profile = await fetchProviderProfile(resolvedPlatform, accessToken);
    const scopes =
      tokenResponse.scope?.split(/\s+/).filter(Boolean) ??
      getProvider(resolvedPlatform).scopes;

    await upsertConnection({
      id: randomUUID(),
      platform: resolvedPlatform,
      status: "connected",
      displayName: profile.displayName,
      externalAccountId: profile.externalAccountId,
      profileUrl: profile.profileUrl,
      authorUrn: "authorUrn" in profile ? profile.authorUrn : undefined,
      username: "username" in profile ? profile.username : undefined,
      scopes,
      capabilityFlags: buildCapabilities(resolvedPlatform, scopes),
      accessToken,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
        : undefined,
      connectedAt: new Date().toISOString(),
    });

    cookieStore.delete(`oauth_state_${resolvedPlatform}`);
    cookieStore.delete(`oauth_pkce_${resolvedPlatform}`);

    return NextResponse.redirect(
      new URL(`/?oauth_success=${resolvedPlatform}`, request.nextUrl.origin),
    );
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        `/?oauth_error=${resolvedPlatform}-${encodeURIComponent(
          error instanceof Error ? error.message : "unknown",
        )}`,
        request.nextUrl.origin,
      ),
    );
  }
}
