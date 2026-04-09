import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  LOCAL_READER_TOKEN_HEADER,
  buildRecentActivityUrl,
  isLocalhostHost,
} from "@/lib/local-reader";
import { updateStore } from "@/lib/store";

export async function POST(request: Request) {
  if (!isLocalhostHost(request.headers.get("host"))) {
    return NextResponse.json(
      { ok: false, error: "Local reader is only available on localhost." },
      { status: 403 },
    );
  }

  const token = request.headers.get(LOCAL_READER_TOKEN_HEADER);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Missing local reader token." },
      { status: 401 },
    );
  }

  const now = new Date().toISOString();
  let responsePayload:
    | {
        runId: string;
        knownPostUrls: string[];
        profileUrlHint?: string;
        activityUrl?: string;
      }
    | undefined;

  await updateStore((store) => {
    const connection = store.accountConnections.find(
      (entry) => entry.platform === "linkedin",
    );

    if (!connection?.localReader?.pairToken || connection.localReader.pairToken !== token) {
      throw new Error("Local reader token mismatch.");
    }

    const runId = randomUUID();
    const knownPostUrls = store.publications
      .filter(
        (publication) =>
          publication.platform === "linkedin" &&
          Boolean(publication.canonicalUrl),
      )
      .map((publication) => publication.canonicalUrl!)
      .slice(0, 20);

    responsePayload = {
      runId,
      knownPostUrls,
      profileUrlHint: connection.localReader.profileUrlHint,
      activityUrl: connection.localReader.profileUrlHint
        ? buildRecentActivityUrl(connection.localReader.profileUrlHint)
        : undefined,
    };

    return {
      ...store,
      localSyncRuns: [
        {
          id: runId,
          platform: "linkedin",
          startedAt: now,
          status: "running",
          pagesVisited: 0,
          publicationsTouched: 0,
          commentsCaptured: 0,
        },
        ...store.localSyncRuns,
      ],
    };
  });

  return NextResponse.json({ ok: true, ...responsePayload });
}
