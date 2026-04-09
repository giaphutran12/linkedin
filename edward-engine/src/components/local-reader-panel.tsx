import { Bot, Cable, RefreshCcw, ShieldCheck } from "lucide-react";

import {
  connectLinkedInRunnerAction,
  runLinkedInDeepSyncAction,
  runLinkedInSnapshotSyncAction,
} from "@/app/actions";

type LocalReaderPanelProps = {
  isLocalhost: boolean;
  profileUrlHint?: string;
  lastSyncedAt?: string;
  runnerStatus: string;
  sessionStatus: string;
  preferredBrowserMode?: "headless" | "visible";
  snapshotEnabled?: boolean;
  snapshotCadenceHours?: number;
};

export function LocalReaderPanel({
  isLocalhost,
  profileUrlHint,
  lastSyncedAt,
  runnerStatus,
  sessionStatus,
  preferredBrowserMode,
  snapshotEnabled,
  snapshotCadenceHours,
}: LocalReaderPanelProps) {
  const availabilityLabel = isLocalhost ? runnerStatus : "local-only";

  return (
    <div className="panel rounded-[1.75rem] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">LinkedIn Runner</p>
          <h3 className="mt-2 text-xl font-semibold">gstack browser runner</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            local runner uses your logged-in session, captures evidence, and pushes
            clean metrics into the dashboard
          </p>
        </div>
        <div className="rounded-full border border-border bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {availabilityLabel}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="metric-card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Profile hint
          </p>
          <p className="mt-2 break-all text-sm leading-6">
            {profileUrlHint ?? "add your LinkedIn profile URL hint below"}
          </p>
        </div>
        <div className="metric-card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Last sync
          </p>
          <p className="mt-2 text-sm leading-6">
            {lastSyncedAt
              ? new Date(lastSyncedAt).toLocaleString()
              : "no LinkedIn sync yet"}
          </p>
        </div>
        <div className="metric-card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Session
          </p>
          <p className="mt-2 text-sm leading-6">{sessionStatus}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Snapshot cadence
          </p>
          <p className="mt-2 text-sm leading-6">
            {snapshotEnabled
              ? `${snapshotCadenceHours ?? 6}h (enabled)`
              : "disabled"}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-[1.25rem] border border-border bg-white/75 p-4 text-sm leading-6 text-muted">
        <div className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="h-4 w-4 text-success" />
          <span className="font-semibold">Status</span>
        </div>
        <p className="mt-2">
          {isLocalhost
            ? `runner is ${runnerStatus}, session is ${sessionStatus}, browser mode is ${preferredBrowserMode ?? "visible"}`
            : "runner is local-only; open Edward Engine on localhost to sync"}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <form action={connectLinkedInRunnerAction}>
          <button className="button-secondary" type="submit" disabled={!isLocalhost}>
            <Cable className="h-4 w-4" />
            open runner
          </button>
        </form>
        <form action={runLinkedInDeepSyncAction}>
          <button className="button-primary" type="submit" disabled={!isLocalhost}>
            <RefreshCcw className="h-4 w-4" />
            deep sync now
          </button>
        </form>
        <form action={runLinkedInSnapshotSyncAction}>
          <button className="button-secondary" type="submit" disabled={!isLocalhost}>
            <RefreshCcw className="h-4 w-4" />
            snapshot refresh
          </button>
        </form>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-4 py-2 text-sm font-medium">
          <Bot className="h-4 w-4 text-accent" />
          Gemini parses screenshots when the runner captures them
        </div>
      </div>
    </div>
  );
}
