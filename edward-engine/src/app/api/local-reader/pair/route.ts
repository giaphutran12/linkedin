import { NextResponse } from "next/server";

import { createPairToken, isLocalhostHost } from "@/lib/local-reader";
import { updateStore } from "@/lib/store";

export async function POST(request: Request) {
  if (!isLocalhostHost(request.headers.get("host"))) {
    return NextResponse.json(
      { ok: false, error: "Local reader is only available on localhost." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    extensionVersion?: string;
    appOrigin?: string;
  };
  const token = createPairToken();
  const now = new Date().toISOString();

  await updateStore((store) => {
    const existing = store.accountConnections.find(
      (entry) => entry.platform === "linkedin",
    );
    const nextConnection = {
      ...(existing ?? {
        id: crypto.randomUUID(),
        platform: "linkedin" as const,
        status: "needs_setup" as const,
        displayName: "LinkedIn local reader",
        scopes: [],
        capabilityFlags: {
          canPublish: false,
          canReadProfile: "limited" as const,
          canReadPosts: false,
          canReadComments: false,
          canReadPostAnalytics: false,
          requiresManualBackfill: true,
          privateLocalReaderAvailable: true,
        },
      }),
      capabilityFlags: {
        ...(existing?.capabilityFlags ?? {
          canPublish: false,
          canReadProfile: "limited" as const,
          canReadPosts: false,
          canReadComments: false,
          canReadPostAnalytics: false,
          requiresManualBackfill: true,
          privateLocalReaderAvailable: true,
        }),
        privateLocalReaderAvailable: true,
      },
      localReader: {
        ...existing?.localReader,
        pairToken: token,
        appOrigin:
          body.appOrigin ??
          `${request.headers.get("x-forwarded-proto") ?? "http"}://${request.headers.get("host")}`,
        pairedAt: now,
        extensionVersion: body.extensionVersion,
      },
    };

    return {
      ...store,
      accountConnections: [
        nextConnection,
        ...store.accountConnections.filter((entry) => entry.platform !== "linkedin"),
      ],
    };
  });

  return NextResponse.json({
    ok: true,
    pairToken: token,
    localOnly: true,
  });
}
