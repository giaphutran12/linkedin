import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  getProvider,
  getRedirectUri,
  makePkceChallenge,
  makePkceVerifier,
  makeState,
  providerIsConfigured,
} from "@/lib/oauth";
import type { Platform } from "@/lib/types";

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
  const provider = getProvider(resolvedPlatform);

  if (!providerIsConfigured(resolvedPlatform)) {
    return NextResponse.redirect(
      new URL(
        `/?oauth_error=${resolvedPlatform}-provider-not-configured`,
        request.nextUrl.origin,
      ),
    );
  }

  const state = makeState();
  const cookieStore = await cookies();

  cookieStore.set(`oauth_state_${resolvedPlatform}`, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  const url = new URL(provider.authorizationUrl);
  url.searchParams.set("client_id", provider.clientId ?? "");
  url.searchParams.set("redirect_uri", getRedirectUri(resolvedPlatform));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes.join(" "));
  url.searchParams.set("state", state);

  if (resolvedPlatform === "x") {
    const verifier = makePkceVerifier();
    cookieStore.set(`oauth_pkce_${resolvedPlatform}`, verifier, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    url.searchParams.set("code_challenge", makePkceChallenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
  }

  if (resolvedPlatform === "linkedin") {
    url.searchParams.set("response_type", "code");
  }

  return NextResponse.redirect(url);
}
