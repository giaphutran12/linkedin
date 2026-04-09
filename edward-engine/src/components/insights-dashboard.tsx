import { Brain, Clock3, Layers3, Sparkles, Target } from "lucide-react";

import { setOptimizationPresetAction } from "@/app/actions";
import type { LinkedInInsights } from "@/lib/insights";

function metricValue(value: number | undefined) {
  if (value === undefined) return "—";
  return Intl.NumberFormat("en-US").format(value);
}

function scoreBarWidth(value: number, maxValue: number) {
  if (maxValue <= 0) return "0%";
  return `${Math.max((value / maxValue) * 100, 6)}%`;
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: LinkedInInsights["hookBreakdown"];
}) {
  const maxScore = rows[0]?.medianScore ?? 0;

  return (
    <div className="rounded-[1.5rem] border border-border bg-white/75 p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-4 space-y-3">
        {rows.length > 0 ? (
          rows.slice(0, 5).map((row) => (
            <div key={`${title}-${row.label}`} className="space-y-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium capitalize">
                  {row.label.replace(/_/g, " ")}
                </span>
                <span className="text-muted">
                  {metricValue(row.medianScore)} · {row.sampleSize} samples · {row.confidence}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-panel">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: scoreBarWidth(row.medianScore, maxScore) }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-muted">
            No synced posts yet for this breakdown.
          </p>
        )}
      </div>
    </div>
  );
}

export function InsightsDashboard({ insights }: { insights: LinkedInInsights }) {
  const presetLabel = insights.preset.name.toLowerCase();
  return (
    <section className="panel rounded-[2rem] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Insights</p>
          <h2 className="mt-2 text-3xl font-semibold">what is actually working on LinkedIn</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            {presetLabel}-first read, but every recommendation stays tied to real
            synced evidence instead of fake certainty.
          </p>
        </div>

        <form action={setOptimizationPresetAction} className="grid gap-2">
          <label className="text-sm font-semibold">Optimization preset</label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="input-base min-w-52"
              name="presetId"
              defaultValue={insights.preset.id}
            >
              <option value="engagement">engagement</option>
              <option value="business">business</option>
              <option value="career">career</option>
            </select>
            <button className="button-secondary" type="submit">
              <Target className="h-4 w-4" />
              apply preset
            </button>
          </div>
          <p className="text-xs leading-5 text-muted">{insights.preset.description}</p>
        </form>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="metric-card">
          <p className="eyebrow">Tracked posts</p>
          <p className="mt-3 text-3xl font-semibold">{insights.overview.trackedPosts}</p>
        </div>
        <div className="metric-card">
          <p className="eyebrow">24h / 72h / 7d</p>
          <p className="mt-3 text-2xl font-semibold">
            {insights.overview.coverage.within24h} / {insights.overview.coverage.within72h} /{" "}
            {insights.overview.coverage.within7d}
          </p>
          <p className="mt-1 text-sm text-muted">posts with a snapshot in that window</p>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Latest sync</p>
          <p className="mt-3 text-sm leading-6">
            {insights.overview.latestSync
              ? `${insights.overview.latestSync.status} · ${new Date(
                  insights.overview.latestSync.startedAt,
                ).toLocaleString()}`
              : "no LinkedIn sync run yet"}
          </p>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Preset</p>
          <p className="mt-3 text-2xl font-semibold">{insights.preset.name}</p>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Primary timezone</p>
          <p className="mt-3 text-sm leading-6">{insights.primaryTimezone}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-border bg-panel-strong p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold">Top posts right now</p>
          </div>
          <div className="mt-4 space-y-3">
            {insights.topPosts.length > 0 ? (
              insights.topPosts.map((entry) => (
                <div
                  key={entry.publication.id}
                  className="rounded-[1.2rem] border border-border bg-white/70 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="line-clamp-3 break-words font-semibold leading-7">
                        {entry.displayTitle}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {entry.featureSet?.hookType.replace(/_/g, " ") ?? "unknown hook"} ·{" "}
                        {entry.featureSet?.assetFamily.replace(/_/g, " ") ?? "unknown media"}
                      </p>
                      {entry.needsRecapture ? (
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted">
                          needs re-capture
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold">
                      {metricValue(entry.score)}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="metric-card">
                      <p className="eyebrow">Impressions</p>
                      <p className="mt-2 text-xl font-semibold">
                        {metricValue(entry.snapshot?.impressions)}
                      </p>
                    </div>
                    <div className="metric-card">
                      <p className="eyebrow">Likes</p>
                      <p className="mt-2 text-xl font-semibold">
                        {metricValue(entry.snapshot?.likes)}
                      </p>
                    </div>
                    <div className="metric-card">
                      <p className="eyebrow">Comments</p>
                      <p className="mt-2 text-xl font-semibold">
                        {metricValue(entry.snapshot?.comments)}
                      </p>
                    </div>
                    <div className="metric-card">
                      <p className="eyebrow">Reposts</p>
                      <p className="mt-2 text-xl font-semibold">
                        {metricValue(entry.snapshot?.reposts)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-muted">
                    {entry.analysis.likelyReason}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted">
                No LinkedIn posts have enough data yet. Pair the local reader and run
                your first sync.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.75rem] border border-border bg-panel-strong p-5">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-accent" />
              <p className="text-sm font-semibold">Double down / test / stop</p>
            </div>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-muted">
              {insights.recommendations.map((recommendation, index) => (
                <li key={recommendation}>
                  {index + 1}. {recommendation}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-panel-strong p-5">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-accent" />
              <p className="text-sm font-semibold">Timing</p>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6">
              <p>
                Best recent window:{" "}
                <span className="font-semibold">
                  {insights.hourBreakdown[0]?.label ?? "not enough data"}
                </span>
              </p>
              <p>
                Strongest weekday:{" "}
                <span className="font-semibold">
                  {insights.weekdayBreakdown[0]?.label ?? "not enough data"}
                </span>
              </p>
              {insights.compareTiming.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">
                    Compare timezones
                  </p>
                  {insights.compareTiming.map((zone) => (
                    <div key={zone.timezone} className="text-sm text-muted">
                      {zone.timezone}: {zone.hourBreakdown[0]?.label ?? "n/a"} ·{" "}
                      {zone.weekdayBreakdown[0]?.label ?? "n/a"}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-panel-strong p-5">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-accent" />
              <p className="text-sm font-semibold">Creative quick read</p>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-muted">
              <p>
                Best hook type:{" "}
                <span className="font-semibold">
                  {insights.hookBreakdown[0]?.label.replace(/_/g, " ") ?? "unknown"}
                </span>
              </p>
              <p>
                Best asset family:{" "}
                <span className="font-semibold">
                  {insights.assetBreakdown[0]?.label.replace(/_/g, " ") ?? "unknown"}
                </span>
              </p>
              <p>
                Best proof type:{" "}
                <span className="font-semibold">
                  {insights.proofBreakdown[0]?.label.replace(/_/g, " ") ?? "unknown"}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <BreakdownCard title="Hook types" rows={insights.hookBreakdown} />
        <BreakdownCard title="Content lanes" rows={insights.laneBreakdown} />
        <BreakdownCard title="CTAs" rows={insights.ctaBreakdown} />
        <BreakdownCard title="Asset families" rows={insights.assetBreakdown} />
        <BreakdownCard title="Proof types" rows={insights.proofBreakdown} />
        <BreakdownCard title="Timing by hour" rows={insights.hourBreakdown} />
        <BreakdownCard title="Weekday" rows={insights.weekdayBreakdown} />
        <BreakdownCard title="Length buckets" rows={insights.lengthBreakdown} />
        <BreakdownCard title="Numbered vs plain" rows={insights.numberedBreakdown} />
      </div>
    </section>
  );
}
