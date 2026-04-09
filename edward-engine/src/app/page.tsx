import {
  ArrowUpRight,
  Brain,
  CheckCircle2,
  Link2,
  NotebookTabs,
  ScanSearch,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { headers } from "next/headers";

import {
  addCommentNoteAction,
  analyzePublicationAction,
  connectLinkedInRunnerAction,
  createContentItemAction,
  importPublicationAction,
  publishVariantAction,
  regenerateVariantsAction,
  runLinkedInDeepSyncAction,
  runLinkedInSnapshotSyncAction,
  syncMetricsAction,
  updateLinkedInRunnerConfigAction,
} from "@/app/actions";
import { InsightsDashboard } from "@/components/insights-dashboard";
import { LocalReaderPanel } from "@/components/local-reader-panel";
import { analyzePublication } from "@/lib/content";
import { buildLinkedInInsights } from "@/lib/insights";
import { isLocalhostHost } from "@/lib/local-reader";
import { getProvider, providerIsConfigured } from "@/lib/oauth";
import { getDefaultCapabilities, getRepoSummary, readStore } from "@/lib/store";
import type { Platform, Publication } from "@/lib/types";

function sectionTitle(title: string, description: string) {
  return (
    <div className="flex flex-col gap-2">
      <p className="eyebrow">{title}</p>
      <p className="max-w-2xl text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

function metricValue(value: number | undefined) {
  if (value === undefined) return "—";
  return Intl.NumberFormat("en-US").format(value);
}

function latestSnapshotFor(
  publicationId: string,
  snapshots: Awaited<ReturnType<typeof readStore>>["metricSnapshots"],
) {
  return snapshots.find((snapshot) => snapshot.publicationId === publicationId);
}

function latestCommentNotesFor(
  publicationId: string,
  notes: Awaited<ReturnType<typeof readStore>>["commentNotes"],
) {
  return notes.filter((note) => note.publicationId === publicationId).slice(0, 3);
}

function latestEvidenceFor(
  publicationId: string,
  evidence: Awaited<ReturnType<typeof readStore>>["manualEvidence"],
) {
  return evidence.filter((entry) => entry.publicationId === publicationId).slice(0, 1);
}

function assetsForPublication(
  publication: Publication,
  assets: Awaited<ReturnType<typeof readStore>>["mediaAssets"],
) {
  return assets.filter((asset) => publication.assetIds.includes(asset.id));
}

function publishedOrImported(publications: Publication[]) {
  return publications.filter(
    (publication) =>
      publication.status === "published" || publication.status === "imported",
  );
}

function connectionCard(
  platform: Platform,
  connection:
    | Awaited<ReturnType<typeof readStore>>["accountConnections"][number]
    | undefined,
) {
  const provider = getProvider(platform);
  const configured = providerIsConfigured(platform);
  const capabilities = connection?.capabilityFlags ?? getDefaultCapabilities(platform);
  const officialAccountName =
    connection?.status === "connected" && connection?.displayName
      ? connection.displayName
      : "not connected yet";

  return (
    <div className="panel rounded-[1.75rem] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{platform === "linkedin" ? "LinkedIn" : "X"}</p>
          <h3 className="mt-2 text-xl font-semibold">{officialAccountName}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            {platform === "linkedin"
              ? "safe path for publish, local reader for visible analytics"
              : "official OAuth, publish, and API metric sync"}
          </p>
        </div>
        <a
          className={`button-secondary ${!configured ? "opacity-50" : ""}`}
          href={configured ? `/api/oauth/${platform}/start` : "/"}
        >
          <Link2 className="h-4 w-4" />
          {configured ? "Connect" : "Add env vars"}
        </a>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="metric-card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Granted scopes
          </p>
          <p className="mt-2 text-sm leading-6">
            {connection?.scopes.join(", ") || provider.scopes.join(", ")}
          </p>
        </div>
        <div className="metric-card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Capability flags
          </p>
          <ul className="mt-2 space-y-1 text-sm leading-6">
            <li>publish: {capabilities.canPublish ? "yes" : "no"}</li>
            <li>profile: {capabilities.canReadProfile}</li>
            <li>read posts: {capabilities.canReadPosts ? "yes" : "no"}</li>
            <li>
              analytics: {capabilities.canReadPostAnalytics ? "yes" : "mixed-mode"}
            </li>
            <li>
              local runner: {capabilities.privateLocalReaderAvailable ? "ready" : "not ready"}
            </li>
          </ul>
        </div>
      </div>

      {connection?.profileUrl ? (
        <a
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent"
          href={connection.profileUrl}
          target="_blank"
          rel="noreferrer"
        >
          open connected profile
          <ArrowUpRight className="h-4 w-4" />
        </a>
      ) : null}
    </div>
  );
}

export default async function Home() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const isLocalhost = isLocalhostHost(host);

  const [store, repoSummary] = await Promise.all([readStore(), getRepoSummary()]);
  const latestPublications = store.publications.slice(0, 8);
  const latestVariants = store.platformVariants.slice(0, 6);
  const latestContentItems = store.contentItems.slice(0, 5);
  const linkedInConnection = store.accountConnections.find(
    (entry) => entry.platform === "linkedin",
  );
  const insights = buildLinkedInInsights(
    store,
    store.selectedOptimizationPresetId,
  );
  const publishedItems = publishedOrImported(store.publications);
  const weeklySummary = {
    publicationCount: publishedItems.length,
    xCount: publishedItems.filter((item) => item.platform === "x").length,
    linkedInCount: publishedItems.filter((item) => item.platform === "linkedin")
      .length,
    metricSnapshotCount: store.metricSnapshots.length,
    accountSnapshotCount: store.accountMetricSnapshots.length,
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-72 bg-[radial-gradient(circle_at_top,rgba(10,124,255,0.18),transparent_58%)] lg:block" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">Edward Engine v3</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              write, sync, and learn from every LinkedIn post
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              safe-path publishing in the app, a gstack-powered LinkedIn runner, and
              a dashboard that keeps telling you what to double down on.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[30rem]">
            <div className="metric-card">
              <p className="eyebrow">Repo baseline</p>
              <p className="mt-3 text-3xl font-semibold">
                {repoSummary.publishedCount}
              </p>
              <p className="mt-1 text-sm text-muted">published posts already archived</p>
            </div>
            <div className="metric-card">
              <p className="eyebrow">Engine memory</p>
              <p className="mt-3 text-3xl font-semibold">
                {weeklySummary.metricSnapshotCount}
              </p>
              <p className="mt-1 text-sm text-muted">post-level metric snapshots</p>
            </div>
            <div className="metric-card">
              <p className="eyebrow">Account analytics</p>
              <p className="mt-3 text-3xl font-semibold">
                {weeklySummary.accountSnapshotCount}
              </p>
              <p className="mt-1 text-sm text-muted">profile analytics snapshots</p>
            </div>
            <div className="metric-card">
              <p className="eyebrow">X / LinkedIn split</p>
              <p className="mt-3 text-3xl font-semibold">
                {weeklySummary.xCount} / {weeklySummary.linkedInCount}
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-8 grid gap-3 md:grid-cols-5">
          <div className="metric-card">
            <p className="eyebrow">Composer</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              save the raw idea once and generate both variants
            </p>
          </div>
          <div className="metric-card">
            <p className="eyebrow">Publisher</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              official adapters for X and LinkedIn safe-path posts
            </p>
          </div>
          <div className="metric-card">
            <p className="eyebrow">Import Inbox</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              mixed-mode URL import plus OCR or Gemini fallback
            </p>
          </div>
          <div className="metric-card">
            <p className="eyebrow">Local Reader</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              local runner captures visible LinkedIn pages with evidence
            </p>
          </div>
          <div className="metric-card">
            <p className="eyebrow">Insights</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              score, timing, hook, and image feedback from real post history
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel rounded-[2rem] p-6">
          {sectionTitle(
            "Connections",
            "connect the official accounts first. LinkedIn stays safe-path for OAuth publishing, and the local runner fills in the visible analytics gap.",
          )}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {connectionCard("linkedin", linkedInConnection)}
            {connectionCard(
              "x",
              store.accountConnections.find((entry) => entry.platform === "x"),
            )}
          </div>
        </div>

        <LocalReaderPanel
          isLocalhost={isLocalhost}
          profileUrlHint={linkedInConnection?.localReader?.profileUrlHint}
          lastSyncedAt={linkedInConnection?.localReader?.lastSyncedAt}
          runnerStatus={linkedInConnection?.localReader?.runnerStatus ?? "unknown"}
          sessionStatus={linkedInConnection?.localReader?.runnerSession ?? "unknown"}
          preferredBrowserMode={linkedInConnection?.localReader?.preferredBrowserMode}
          snapshotEnabled={linkedInConnection?.localReader?.snapshotScheduleEnabled}
          snapshotCadenceHours={linkedInConnection?.localReader?.snapshotCadenceHours}
        />
      </section>

      <section className="panel rounded-[2rem] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          {sectionTitle(
            "Local reader settings",
            "The runner uses your local profile URL hint to discover posts and analytics pages faster.",
          )}

          <div className="grid w-full max-w-2xl gap-3">
            <form
              action={updateLinkedInRunnerConfigAction}
              className="grid gap-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="input-base"
                  name="profileUrlHint"
                  defaultValue={linkedInConnection?.localReader?.profileUrlHint ?? ""}
                placeholder="https://www.linkedin.com/in/your-profile/"
              />
              <input
                className="input-base"
                name="recentPostLimit"
                defaultValue={linkedInConnection?.localReader?.recentPostLimit ?? 30}
                placeholder="recent post limit (default 30)"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="input-base"
                name="primaryTimezone"
                defaultValue={linkedInConnection?.localReader?.primaryTimezone ?? ""}
                placeholder="primary timezone (e.g. Asia/Ho_Chi_Minh)"
              />
              <input
                className="input-base"
                name="savedTimezones"
                defaultValue={linkedInConnection?.localReader?.savedTimezones?.join(", ") ?? ""}
                placeholder="compare timezones (comma separated, up to 4)"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="input-base"
                name="preferredBrowserMode"
                defaultValue={linkedInConnection?.localReader?.preferredBrowserMode ?? "visible"}
              >
                <option value="visible">visible browser</option>
                <option value="headless">headless browser</option>
              </select>
                <input
                  className="input-base"
                  name="snapshotCadenceHours"
                  defaultValue={linkedInConnection?.localReader?.snapshotCadenceHours ?? 6}
                  placeholder="snapshot cadence hours"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  name="snapshotEnabled"
                  defaultChecked={Boolean(
                    linkedInConnection?.localReader?.snapshotScheduleEnabled,
                  )}
                />
                enable snapshot refresh (runs when the app is open)
              </label>
              <div className="flex flex-wrap gap-3">
                <button className="button-secondary" type="submit">
                  <ShieldCheck className="h-4 w-4" />
                  save runner settings
                </button>
              </div>
            </form>
            <div className="flex flex-wrap gap-3">
              <form action={connectLinkedInRunnerAction}>
                <button className="button-secondary" type="submit">
                  open runner
                </button>
              </form>
              <form action={runLinkedInDeepSyncAction}>
                <button className="button-primary" type="submit">
                  deep sync now
                </button>
              </form>
              <form action={runLinkedInSnapshotSyncAction}>
                <button className="button-secondary" type="submit">
                  snapshot refresh
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <InsightsDashboard insights={insights} />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel rounded-[2rem] p-6">
          {sectionTitle(
            "Composer",
            "drop the raw idea here. Edward Engine stores the story, attaches assets, and generates both platform variants immediately.",
          )}

          <form action={createContentItemAction} className="mt-6 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Content lane</span>
                <select name="lane" className="input-base">
                  <option value="build_receipt">build_receipt</option>
                  <option value="builder_story">builder_story</option>
                  <option value="industry_take">industry_take</option>
                  <option value="spicy_sidecar">spicy_sidecar</option>
                  <option value="conviction_story">conviction_story</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Related product</span>
                <input
                  className="input-base"
                  name="relatedProduct"
                  placeholder="Notion Code, True Weapon, TinyFish, personal brand"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Raw idea</span>
              <textarea
                className="input-base min-h-28"
                name="rawIdea"
                placeholder="what happened, what was built, what felt weird, what shipped"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Core thesis</span>
              <textarea
                className="input-base min-h-24"
                name="thesis"
                placeholder="the one thing this post is actually about"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Source story</span>
              <textarea
                className="input-base min-h-24"
                name="sourceStory"
                placeholder="receipts, context, tradeoffs, the part that makes the take feel earned"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Tags</span>
                <input
                  className="input-base"
                  name="tags"
                  placeholder="tinyfish, meetup, launch, screenshot"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Attachments</span>
                <input
                  className="input-base file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-2 file:text-white"
                  name="attachments"
                  type="file"
                  multiple
                />
              </label>
            </div>

            <button className="button-primary mt-2 w-fit" type="submit">
              <Sparkles className="h-4 w-4" />
              create content item + both variants
            </button>
          </form>
        </div>

        <div className="panel rounded-[2rem] p-6">
          {sectionTitle(
            "Import Inbox",
            "paste the post URL, upload screenshots, and let DOM, OCR, and Gemini fallback build the first pass before you correct anything.",
          )}

          <form action={importPublicationAction} className="mt-6 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Platform</span>
                <select className="input-base" name="platform">
                  <option value="auto">auto-detect</option>
                  <option value="linkedin">linkedin</option>
                  <option value="x">x</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Attach to content item</span>
                <select className="input-base" name="contentItemId" defaultValue="">
                  <option value="">create new imported item</option>
                  {latestContentItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.rawIdea.slice(0, 64)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Post URL</span>
              <input
                className="input-base"
                name="url"
                placeholder="https://www.linkedin.com/... or https://x.com/..."
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Notes</span>
              <textarea
                className="input-base min-h-24"
                name="notes"
                placeholder="what this post was about or what the screenshot is showing"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Screenshots or assets</span>
              <input
                className="input-base file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-2 file:text-white"
                name="attachments"
                type="file"
                multiple
              />
            </label>

            <div className="grid gap-3 md:grid-cols-4">
              <input className="input-base" name="manualImpressions" placeholder="impressions" />
              <input className="input-base" name="manualLikes" placeholder="likes" />
              <input className="input-base" name="manualComments" placeholder="comments" />
              <input className="input-base" name="manualReposts" placeholder="reposts" />
              <input className="input-base" name="manualMembersReached" placeholder="members reached" />
              <input className="input-base" name="manualFollowers" placeholder="followers" />
              <input className="input-base" name="manualProfileViews" placeholder="profile views" />
            </div>

            <button className="button-primary mt-2 w-fit" type="submit">
              <ScanSearch className="h-4 w-4" />
              import post + parse evidence
            </button>
          </form>
        </div>
      </section>

      <section className="panel rounded-[2rem] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {sectionTitle(
            "Variants + publishing queue",
            "variants are generated locally first. Publishing respects guardrails, then routes through the official adapter for that platform when credentials exist.",
          )}
          <div className="rounded-full border border-border bg-panel-strong px-4 py-2 text-sm font-medium">
            {latestVariants.length} ready-to-publish variants in memory
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {latestVariants.length > 0 ? (
            latestVariants.map((variant) => (
              <article
                key={variant.id}
                className="rounded-[1.6rem] border border-border bg-white/70 p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      <span>{variant.platform}</span>
                      {variant.guardrailIssues.length > 0 ? (
                        <span className="rounded-full bg-[rgba(176,61,46,0.12)] px-2 py-1 text-danger">
                          {variant.guardrailIssues.length} guardrail flags
                        </span>
                      ) : (
                        <span className="rounded-full bg-[rgba(34,120,78,0.12)] px-2 py-1 text-success">
                          clean
                        </span>
                      )}
                    </div>

                    <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-[1.4rem] border border-border bg-panel p-4 font-sans text-sm leading-6">
                      {variant.text}
                    </pre>

                    <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
                      {variant.generationNotes.map((note) => (
                        <span
                          key={`${variant.id}-${note}`}
                          className="rounded-full border border-border bg-white px-3 py-1"
                        >
                          {note}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <form action={publishVariantAction}>
                      <input type="hidden" name="variantId" value={variant.id} />
                      <button className="button-primary w-full" type="submit">
                        <Send className="h-4 w-4" />
                        publish via adapter
                      </button>
                    </form>

                    <form action={regenerateVariantsAction}>
                      <input
                        type="hidden"
                        name="contentItemId"
                        value={variant.contentItemId}
                      />
                      <button className="button-secondary w-full" type="submit">
                        <Sparkles className="h-4 w-4" />
                        regenerate both variants
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-border bg-white/60 p-5 text-sm leading-6 text-muted">
              No variants yet. Create a content item to populate the queue.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel rounded-[2rem] p-6">
          {sectionTitle(
            "Registry",
            "every publication becomes a post lab card with metrics, extracted features, evidence, and notes.",
          )}

          <div className="mt-6 space-y-4">
            {latestPublications.length > 0 ? (
              latestPublications.map((publication) => {
                const snapshot = latestSnapshotFor(
                  publication.id,
                  store.metricSnapshots,
                );
                const notes = latestCommentNotesFor(publication.id, store.commentNotes);
                const evidence = latestEvidenceFor(publication.id, store.manualEvidence);
                const assets = assetsForPublication(publication, store.mediaAssets);
                const featureSet = store.postFeatureSets.find(
                  (entry) => entry.publicationId === publication.id,
                );
                const analysis = analyzePublication(
                  publication,
                  store.manualEvidence,
                  store.metricSnapshots,
                );

                return (
                  <article
                    key={publication.id}
                    className="rounded-[1.6rem] border border-border bg-white/70 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          <span>{publication.platform}</span>
                          <span>{publication.status}</span>
                          <span>{publication.mode}</span>
                          {featureSet ? (
                            <span className="rounded-full bg-white px-2 py-1 text-foreground">
                              {featureSet.assetFamily.replace(/_/g, " ")}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-3 break-words text-xl font-semibold leading-8">
                          {publication.title}
                        </h3>
                        <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-[1.4rem] border border-border bg-panel p-4 font-sans text-sm leading-6">
                          {publication.finalText}
                        </pre>
                        {assets.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-3">
                            {assets.slice(0, 3).map((asset) => (
                              <a
                                key={asset.id}
                                href={asset.publicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-[1rem] border border-border bg-panel"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={asset.publicUrl}
                                  alt={asset.originalName}
                                  className="h-28 w-28 object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-3">
                        <form action={syncMetricsAction}>
                          <input
                            type="hidden"
                            name="publicationId"
                            value={publication.id}
                          />
                          <button className="button-secondary w-full" type="submit">
                            <Sparkles className="h-4 w-4" />
                            sync metrics
                          </button>
                        </form>

                        <form action={analyzePublicationAction}>
                          <input
                            type="hidden"
                            name="publicationId"
                            value={publication.id}
                          />
                          <button className="button-secondary w-full" type="submit">
                            <Brain className="h-4 w-4" />
                            log analysis
                          </button>
                        </form>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                      <div className="metric-card">
                        <p className="eyebrow">Impressions</p>
                        <p className="mt-2 text-2xl font-semibold">
                          {metricValue(snapshot?.impressions)}
                        </p>
                      </div>
                      <div className="metric-card">
                        <p className="eyebrow">Likes</p>
                        <p className="mt-2 text-2xl font-semibold">
                          {metricValue(snapshot?.likes)}
                        </p>
                      </div>
                      <div className="metric-card">
                        <p className="eyebrow">Comments</p>
                        <p className="mt-2 text-2xl font-semibold">
                          {metricValue(snapshot?.comments)}
                        </p>
                      </div>
                      <div className="metric-card">
                        <p className="eyebrow">Reposts</p>
                        <p className="mt-2 text-2xl font-semibold">
                          {metricValue(snapshot?.reposts)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                      <div className="rounded-[1.4rem] border border-border bg-white/70 p-4">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-accent" />
                          <p className="text-sm font-semibold">Analyst read</p>
                        </div>
                        <ul className="mt-3 space-y-2 text-sm leading-6">
                          <li>hook: {analysis.hookType}</li>
                          <li>proof: {analysis.proofType}</li>
                          <li>{analysis.likelyReason}</li>
                          <li>{analysis.suggestedNextStep}</li>
                          {featureSet ? (
                            <li>
                              post lab: {featureSet.postingWeekday ?? "—"} at{" "}
                              {featureSet.postingHour !== undefined
                                ? `${String(featureSet.postingHour).padStart(2, "0")}:00`
                                : "—"}{" "}
                              · {featureSet.lengthBucket} · {featureSet.ctaType}
                            </li>
                          ) : null}
                        </ul>
                      </div>

                      <div className="rounded-[1.4rem] border border-border bg-white/70 p-4">
                        <p className="text-sm font-semibold">Comment notes</p>
                        <div className="mt-3 space-y-2 text-sm leading-6">
                          {notes.length > 0 ? (
                            notes.map((note) => (
                              <div
                                key={note.id}
                                className="rounded-2xl border border-border bg-panel p-3"
                              >
                                <p className="font-semibold">
                                  {note.authorName} · {note.source}
                                </p>
                                <p className="text-muted">{note.note}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-muted">
                              nothing logged yet. add a manual note below
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                      {publication.canonicalUrl ? (
                        <a
                          className="inline-flex items-center gap-2 font-semibold text-accent"
                          href={publication.canonicalUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          open post
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      ) : null}
                      <span className="text-muted">
                        evidence files: {evidence.length}
                      </span>
                      <span className="text-muted">
                        assets: {publication.assetIds.length}
                      </span>
                    </div>

                    <form
                      action={addCommentNoteAction}
                      className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
                    >
                      <input type="hidden" name="publicationId" value={publication.id} />
                      <input
                        className="input-base"
                        name="authorName"
                        placeholder="who commented or who DMed"
                      />
                      <select className="input-base" name="authorType" defaultValue="unknown">
                        <option value="unknown">unknown</option>
                        <option value="founder">founder</option>
                        <option value="recruiter">recruiter</option>
                        <option value="engineer">engineer</option>
                        <option value="friend">friend</option>
                      </select>
                      <input
                        className="input-base"
                        name="note"
                        placeholder="what mattered about the comment or reply"
                      />
                      <button className="button-secondary" type="submit">
                        <NotebookTabs className="h-4 w-4" />
                        save note
                      </button>
                    </form>
                  </article>
                );
              })
            ) : (
              <div className="rounded-[1.6rem] border border-dashed border-border bg-white/60 p-5 text-sm leading-6 text-muted">
                No publications in memory yet. Publish or import something first.
              </div>
            )}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-6">
          {sectionTitle(
            "Analyst backlog",
            "high-signal reads pulled from the current store so the next move is always visible.",
          )}

          <div className="mt-6 space-y-4">
            <div className="rounded-[1.5rem] border border-border bg-panel-strong p-4">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-accent" />
                <p className="text-sm font-semibold">Current read</p>
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
                <li>
                  LinkedIn first means the dashboard should prioritize visible profile lift,
                  then expand to X later.
                </li>
                <li>
                  Raw screenshots, comment notes, and synced analytics are finally in the same
                  memory layer.
                </li>
                <li>
                  GPT handles the analysis, while Gemini only steps in when image understanding
                  is actually hard.
                </li>
              </ul>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-panel-strong p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <p className="text-sm font-semibold">Suggested next posts</p>
              </div>
              <ol className="mt-3 space-y-3 text-sm leading-6 text-muted">
                <li>1. Notion Code import flow: repo to tickets to agent execution in one place</li>
                <li>2. TinyFish proof-of-work hiring story as a build-before-asked thread</li>
                <li>3. Workflow orchestration: what breaks first when 5 projects pile up</li>
              </ol>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-panel-strong p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <p className="text-sm font-semibold">Why this app exists</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                the job is not fake growth. the job is to remember what you posted,
                what proof you used, what actually moved, and what story deserves the
                next rep.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
