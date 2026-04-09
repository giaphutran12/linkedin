import { NextResponse } from "next/server";

import { isLocalhostHost } from "@/lib/local-reader";
import { getRunnerStatus } from "@/lib/gstack-runner";
import { readStore } from "@/lib/store";

export async function GET(request: Request) {
  const store = await readStore();
  const connection = store.accountConnections.find(
    (entry) => entry.platform === "linkedin",
  );
  const runnerStatus = await getRunnerStatus();
  const latestSync = store.localSyncRuns
    .filter((run) => run.platform === "linkedin")
    .sort(
      (left, right) =>
        new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
    )[0];

  return NextResponse.json({
    ok: true,
    isLocalhost: isLocalhostHost(request.headers.get("host")),
    paired: Boolean(connection?.localReader?.pairToken),
    profileUrlHint: connection?.localReader?.profileUrlHint,
    capabilityFlags: connection?.capabilityFlags,
    latestSync,
    runnerStatus,
  });
}
