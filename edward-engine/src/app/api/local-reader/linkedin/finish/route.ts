import { NextResponse } from "next/server";

import {
  authorizeLocalReader,
  isLocalhostHost,
} from "@/lib/local-reader";
import { readStore, updateStore } from "@/lib/store";

export async function POST(request: Request) {
  if (!isLocalhostHost(request.headers.get("host"))) {
    return NextResponse.json(
      { ok: false, error: "Local reader is only available on localhost." },
      { status: 403 },
    );
  }

  const store = await readStore();
  const connection = store.accountConnections.find(
    (entry) => entry.platform === "linkedin",
  );

  if (!authorizeLocalReader(request, connection)) {
    return NextResponse.json(
      { ok: false, error: "Invalid local reader token." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    runId?: string;
    status?: "succeeded" | "partial" | "failed";
    error?: string;
    pagesVisited?: number;
    publicationsTouched?: number;
    commentsCaptured?: number;
  };

  if (!body.runId) {
    return NextResponse.json(
      { ok: false, error: "Missing sync run id." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  await updateStore((current) => ({
    ...current,
    localSyncRuns: current.localSyncRuns.map((run) =>
      run.id === body.runId
        ? {
            ...run,
            finishedAt: now,
            status: body.status ?? "succeeded",
            error: body.error,
            pagesVisited: body.pagesVisited ?? run.pagesVisited,
            publicationsTouched:
              body.publicationsTouched ?? run.publicationsTouched,
            commentsCaptured: body.commentsCaptured ?? run.commentsCaptured,
          }
        : run,
    ),
    accountConnections: current.accountConnections.map((entry) =>
      entry.platform === "linkedin"
        ? {
            ...entry,
            capabilityFlags: {
              ...entry.capabilityFlags,
              privateLocalReaderAvailable: true,
            },
            localReader: {
              ...entry.localReader,
              lastSyncedAt: now,
            },
          }
        : entry,
    ),
  }));

  return NextResponse.json({ ok: true });
}
