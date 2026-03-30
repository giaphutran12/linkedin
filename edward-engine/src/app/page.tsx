import {
  Activity,
  ArrowUpRight,
  Brain,
  CheckCircle2,
  CopyPlus,
  Link2,
  NotebookTabs,
  ScanSearch,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  addCommentNoteAction,
  analyzePublicationAction,
  createContentItemAction,
  importPublicationAction,
  publishVariantAction,
  regenerateVariantsAction,
  syncMetricsAction,
} from "@/app/actions";
import { analyzePublication } from "@/lib/content";
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
  publications: Awaited<ReturnType<typeof readStore>>["metricSnapshots"],
) {
  return publications.find((snapshot) => snapshot.publicationId === publicationId);
}

function latestCommentNotesFor(
  publicationId: string,
  notes: Awaited<ReturnType<typeof readStore>>["commentNotes"],
) {
  return notes.filter((note) => note.publicationId === publicationId).slice(0, 2);
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

  return (
    <div className="panel rounded-[1.75rem] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{platform === "linkedin" ? "LinkedIn" : "X"}</p>
          <h3 className="mt-2 text-xl font-semibold">
            {connection?.displayName ?? "not connected yet"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            {platform === "linkedin"
              ? "safe path first: profile + email + w_member_social"
              : "official OAuth, post publishing, and API metric sync"}
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
              analytics: {capabilities.canReadPostAnalytics ? "yes" : "manual"}
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
  const [store, repoSummary] = await Promise.all([readStore(), getRepoSummary()]);
  const latestPublications = store.publications.slice(0, 8);
  const latestVariants = store.platformVariants.slice(0, 6);
  const latestContentItems = store.contentItems.slice(0, 5);
  const publishedItems = publishedOrImported(store.publications);

  const weeklySummary = {
    publicationCount: publishedItems.length,
    xCount: publishedItems.filter((item) => item.platform === "x").length,
    linkedInCount: publishedItems.filter((item) => item.platform === "linkedin")
      .length,
    metricSnapshotCount: store.metricSnapshots.length,
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-72 bg-[radial-gradient(circle_at_top,rgba(10,124,255,0.18),transparent_58%)] lg:block" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">Edward Engine v1</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              your internal X + LinkedIn content portal
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              write once, generate variants, publish through official adapters when
              possible, import native posts when needed, OCR screenshots, and build a
              real memory for what is actually compounding
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[28rem]">
            <div className="metric-card">
              <p className="eyebrow">Repo baseline</p>
              <p className="mt-3 text-3xl font-semibold">
                {repoSummary.publishedCount}
              </p>
              <p className="mt-1 text-sm text-muted">published posts already in repo</p>
            </div>
            <div className="metric-card">
              <p className="eyebrow">Engine memory</p>
              <p className="mt-3 text-3xl font-semibold">
                {weeklySummary.metricSnapshotCount}
              </p>
              <p className="mt-1 text-sm text-muted">metric snapshots stored locally</p>
            </div>
          </div>
        </div>

        <div className="relative mt-8 grid gap-3 md:grid-cols-4">
          <div className="metric-card">
            <p className="eyebrow">Composer</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              draft a raw idea and auto-generate both variants
            </p>
          </div>
          <div className="metric-card">
            <p className="eyebrow">Publisher</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              official OAuth first, with canonical URL storage
            </p>
          </div>
          <div className="metric-card">
            <p className="eyebrow">Import Inbox</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              paste URLs and upload screenshots for mixed-mode import
            </p>
          </div>
          <div className="metric-card">
            <p className="eyebrow">Analyst</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              hook type, proof type, likely reason, and next move
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel rounded-[2rem] p-6">
          {sectionTitle(
            "Connections",
            "connect the official accounts first. LinkedIn stays on the safe path in v1, and anything outside those scopes comes through mixed-mode import.",
          )}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {connectionCard(
              "linkedin",
              store.accountConnections.find((entry) => entry.platform === "linkedin"),
            )}
            {connectionCard(
              "x",
              store.accountConnections.find((entry) => entry.platform === "x"),
            )}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-6">
          {sectionTitle(
            "Weekly pulse",
            "this is the high-level memory layer so you can see whether the machine is actually learning or just storing noise.",
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="metric-card">
              <p className="eyebrow">Tracked publications</p>
              <p className="mt-3 text-3xl font-semibold">
                {weeklySummary.publicationCount}
              </p>
            </div>
            <div className="metric-card">
              <p className="eyebrow">X / LinkedIn split</p>
              <p className="mt-3 text-3xl font-semibold">
                {weeklySummary.xCount} / {weeklySummary.linkedInCount}
              </p>
            </div>
            <div className="metric-card">
              <p className="eyebrow">Draft library</p>
              <p className="mt-3 text-3xl font-semibold">{repoSummary.draftCount}</p>
            </div>
            <div className="metric-card">
              <p className="eyebrow">Latest in repo</p>
              <p className="mt-3 text-sm leading-6">
                {repoSummary.latestPublished[0]?.topic ?? "nothing parsed yet"}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-border bg-panel-strong p-4">
            <p className="eyebrow">Default X mix</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
              <span className="rounded-full bg-white/80 px-3 py-1">60% Notion Code</span>
              <span className="rounded-full bg-white/80 px-3 py-1">
                25% personal builder
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1">
                15% True Weapon
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel rounded-[2rem] p-6">
          {sectionTitle(
            "Composer",
            "drop the raw idea here. The app will save the source story, attach assets, and generate both platform variants immediately.",
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
            "this is the mixed-mode safety net. If you posted natively, paste the URL, add screenshots, and let OCR do the first pass before you correct anything.",
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
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {latestVariants.map((variant) => {
            const contentItem = store.contentItems.find(
              (item) => item.id === variant.contentItemId,
            );

            return (
              <article key={variant.id} className="rounded-[1.6rem] border border-border bg-panel-strong p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">{variant.platform}</p>
                    <h3 className="mt-2 text-lg font-semibold">
                      {contentItem?.rawIdea.slice(0, 82) ?? "untitled variant"}
                    </h3>
                  </div>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
                    {contentItem?.lane ?? "lane"}
                  </span>
                </div>

                <pre className="mt-4 whitespace-pre-wrap rounded-[1.2rem] bg-white/75 p-4 text-sm leading-6">
                  {variant.text}
                </pre>

                <div className="mt-4 flex flex-wrap gap-2">
                  {variant.guardrailIssues.length > 0 ? (
                    variant.guardrailIssues.map((issue) => (
                      <span
                        key={issue}
                        className="rounded-full bg-[#fff1ef] px-3 py-1 text-xs font-semibold text-danger"
                      >
                        {issue}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-[#ecfff2] px-3 py-1 text-xs font-semibold text-success">
                      no blocking guardrails detected
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={publishVariantAction}>
                    <input type="hidden" name="variantId" value={variant.id} />
                    <button className="button-primary" type="submit">
                      <Send className="h-4 w-4" />
                      publish
                    </button>
                  </form>
                  <form action={regenerateVariantsAction}>
                    <input
                      type="hidden"
                      name="contentItemId"
                      value={variant.contentItemId}
                    />
                    <button className="button-secondary" type="submit">
                      <CopyPlus className="h-4 w-4" />
                      regenerate pair
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel rounded-[2rem] p-6">
          {sectionTitle(
            "Registry",
            "this is the canonical memory: what got posted, where it lives, what proof exists, and what the latest snapshot says.",
          )}

          <div className="mt-6 grid gap-4">
            {latestPublications.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-border px-5 py-8 text-sm text-muted">
                nothing in the registry yet. create or import a post and this starts compounding immediately
              </div>
            ) : (
              latestPublications.map((publication) => {
                const snapshot = latestSnapshotFor(
                  publication.id,
                  store.metricSnapshots,
                );
                const evidence = store.manualEvidence.filter(
                  (item) => item.publicationId === publication.id,
                );
                const analysis = analyzePublication(publication, store.manualEvidence);
                const notes = latestCommentNotesFor(
                  publication.id,
                  store.commentNotes,
                );

                return (
                  <article
                    key={publication.id}
                    className="rounded-[1.6rem] border border-border bg-panel-strong p-5"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="eyebrow">{publication.platform}</span>
                          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
                            {publication.mode}
                          </span>
                          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
                            {publication.status}
                          </span>
                        </div>
                        <h3 className="mt-2 text-lg font-semibold">
                          {publication.title}
                        </h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                          {publication.finalText.slice(0, 220)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <form action={syncMetricsAction}>
                          <input
                            type="hidden"
                            name="publicationId"
                            value={publication.id}
                          />
                          <button className="button-secondary" type="submit">
                            <Activity className="h-4 w-4" />
                            sync metrics
                          </button>
                        </form>
                        <form action={analyzePublicationAction}>
                          <input
                            type="hidden"
                            name="publicationId"
                            value={publication.id}
                          />
                          <button className="button-secondary" type="submit">
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
                                <p className="font-semibold">{note.authorName}</p>
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

                    <form action={addCommentNoteAction} className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
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
            )}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-6">
          {sectionTitle(
            "Analyst backlog",
            "quick reads pulled from what is already in the engine so you always have the next move in sight.",
          )}

          <div className="mt-6 space-y-4">
            <div className="rounded-[1.5rem] border border-border bg-panel-strong p-4">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-accent" />
                <p className="text-sm font-semibold">Current read</p>
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
                <li>
                  ugly real screenshots still beat polished graphics when the proof is visible
                </li>
                <li>
                  LinkedIn safe path is real for posting, but mixed-mode import is the memory unlock
                </li>
                <li>
                  X is the easier place to automate first, so the portal should treat it as the primary sync surface
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
                <li>3. True Weapon: block garbage without blocking the whole site</li>
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
                next rep
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
