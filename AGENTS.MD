---
name: nia
description: Use Nia MCP server for external documentation, GitHub repos, package source code, and research. Invoke when needing to index/search remote codebases, fetch library docs, explore packages, or do web research.
---

# How to use Nia

Nia provides tools for indexing and searching external repositories, research papers, local folders, documentation, packages, and performing AI-powered research. Its primary goal is to reduce hallucinations in LLMs and provide up-to-date context for AI agents.

## CRITICAL: Nia-First Workflow

**BEFORE using WebFetch or WebSearch, you MUST:**

1. **Check indexed sources first**: `manage_resource(action='list', query='relevant-keyword')` - Many sources may already be indexed
2. **If source exists**: Use `search`, `nia_grep`, `nia_read`, `nia_explore` for targeted queries
3. **If source doesn't exist but you know the URL**: Index it with `index` tool, then search
4. **Only if source unknown**: Use `nia_research(mode='quick')` to discover URLs, then index
5. **Subscribe to a source**: Use Nia to subscribe to a source by using manage_resource tool (subscribe option)

**Why this matters**: Indexed sources provide more accurate, complete context than web fetches. WebFetch returns truncated/summarized content while Nia provides full source code and documentation.

## Deterministic Workflow

1. Check if the source is already indexed using manage_resource (when listing sources, use targeted query to save tokens since users can have multiple sources indexed) or check any nia.md files for already indexed sources.
2. If it is indexed, check the tree of the source or ls relevant directories.
3. After getting the grasp of the structure (tree), use 'search', 'nia_grep', 'nia_read' for targeted searches.
4. If helpful, use the context tool to save your research findings to make them reusable for future conversations.
5. Save your findings in an .md file to track: source indexed, used, its ID, and link so you won't have to list sources in the future and can get straight to work.

## Notes

- **IMPORTANT**: Always prefer Nia tools over WebFetch/WebSearch. Nia provides full, structured content while web tools give truncated summaries.
- If the source isn't indexed, index it. Note that for docs you should always index the root link like docs.stripe.com so it will always scrape all pages.
- If you need to index something but don't know the link for that source, use nia_research (quick or deep modes).
- Once you use the index tool, do not expect it to finish in 1-3 seconds. Stop your work or do something that will make your work pause for 1-5 minutes until the source is indexed, then run manage_resource again to check its status. You can also prompt the user to wait if needed.

## Pre-WebFetch Checklist

Before ANY WebFetch or WebSearch call, verify:
- [ ] Ran `manage_resource(action='list', query='...')` for relevant keywords
- [ ] Checked nia-sources.md or nia.md files for previously indexed sources
- [ ] Confirmed no indexed source covers this information
- [ ] For GitHub/npm/PyPI URLs: These should ALWAYS be indexed, not fetched

---

# LinkedIn Post Assistant — Rules for This Repo

## Post Tracking (NON-NEGOTIABLE)

Every time a post is finalized and ready to publish, it MUST be:

1. Moved from `/drafts` to `/posts/YYYY-MM-DD-short-topic/post.md` (each post is a folder containing `post.md` + optional images)
2. Logged in `posts/POST-LOG.md` with the following format:

```
| Date       | Folder                                    | Topic                        | Status    | Impressions | Likes | Comments |
|------------|-------------------------------------------|------------------------------|-----------|-------------|-------|----------|
| YYYY-MM-DD | posts/YYYY-MM-DD-short-topic/             | one-line description         | published | 179         | 9     | 0        |
```

This log is Edward's single source of truth for every post he has ever made.
He should never have to open LinkedIn just to remember what he posted.

## Workflow Summary

1. Edward drops a rough idea in chat
2. Assistant shapes it into a post following the voice rules in `profile.md`
3. Post is saved to `/drafts`
4. Edward reviews and approves (or gives feedback to refine)
5. On approval: move file to `/posts`, log it in `POST-LOG.md`, commit to git

## File Naming Convention

- drafts: `drafts/YYYY-MM-DD-topic.md`
- final: `posts/YYYY-MM-DD-topic/post.md` (folder per post, can include images)
- log: `posts/POST-LOG.md`

## Voice Rules

Always read `profile.md` before writing or refining any post.
It contains Edward's tone, capitalization rules, ammunition (real numbers), ICP, and goals.

## Every Post Must End With

1. A CTA — pick the one that makes sense for the post (see CTA Toolkit below)
2. `Ave Christus Rex` — always, no exceptions, last line of every post

## CTA Toolkit

Every post needs a CTA, but not every post needs the same one.
Pick the action that actually makes sense given what the post is about:

1. like / react — when the post is a take or opinion people can agree with
   example: "if this resonates, let me know"
2. comment — when you want engagement, stories, or shared experiences
   example: "drop your worst AI debugging story below"
3. share / repost — when the post has utility or broad relevance
   example: "send this to someone who uses Claude daily"
4. follow — when the post showcases your expertise or ongoing journey
   example: "if you want to see more, follow me"
5. connect — when the post gives a reason to build a relationship
   example: "if you're building in this space, connect with me"

How to choose:
- does the post ask a question or invite stories? → comment
- does the post share a strong opinion? → like/react
- does the post help someone specific? → share/repost ("send this to...")
- does the post show what you're about? → follow
- does the post signal you want to meet certain people? → connect

Default if unsure: follow (safe, always relevant for growth)

## Post Format (NON-NEGOTIABLE)

All posts must be 100% copy-paste ready for LinkedIn.
NEVER use markdown formatting in the final post output:
- No pound signs (#) for headers
- No asterisks (*) for bold or bullet points
- No underscores (_) for italic
- No backticks, no markdown syntax of any kind

LinkedIn does NOT render markdown. A post with **bold** will literally show **bold** with the stars.

## How to Emphasize Text on LinkedIn
LinkedIn does NOT support markdown or native bold/italic in posts.
Unicode bold technically works but requires manually converting every word through an external tool — too much effort, not worth it.

Edward's emphasis system (plain text only):
1. ALL CAPS — for the most important words (e.g. "you need to SHIP")
2. Capitalized First Letter — for important words (e.g. "this is the most Important thing")
3. Isolation — put the key line alone on its own line with space around it

No bold. No italic. No underline. Plain text + smart spacing does the job.

## Spacing Rules (CRITICAL)

Spacing is intentional, not mechanical. Do NOT double-space every line.

same topic / same thought → single space (lines sit right next to each other, no blank line between them)
new topic / new section / re-hook → double space (one blank line to create breathing room)

How to judge:
- if two lines are part of the same idea, they stay together
- if you're switching to a new thought, new point, or new energy — give it space

Example (wrong — everything double-spaced):
i stopped posting for a week

not by choice

i got dengue fever here in vietnam

just recovered a few days ago

Example (right — intentional spacing):
i stopped posting for a week
not by choice

i got dengue fever here in vietnam — the lethal kind
just recovered a few days ago

here's what i found:

## Post Structure (Build/Project Posts)

When a post is about something Edward built, follow this structure:

1. hook — name the gap or problem (e.g. "there's no X for Y")
2. problem — what the current experience looks like (pain, friction)
3. why it's hard — technical or structural reasons this hasn't been solved (no API, no aggregator, etc.)
4. emotional bridge — personal reaction that motivates the build ("this drove me CRAZY")
5. solution with callback — tie back to the hook ("so i built X for Y", not "so i built one")
6. walkthrough — what it actually does, step by step
7. closing — impact, link, CTA

DO NOT jump from problem straight to solution. The difficulty context and personal frustration
need to come BETWEEN them. The harder the problem sounds, the more impressive the solution.

## Writing Techniques

1. reference comparisons — for unfamiliar tech, add a parenthetical comparison
   example: "using TinyFish Mino browser agents (it's like browseruse but better)"
   one comparison does more than a paragraph of explanation

2. callback to the hook — when revealing the solution, reference the hook line
   wrong: "so i built one"
   right: "so i built Kayak for motorbikes" (ties back to "there's no Kayak for motorbikes")

3. precision over vagueness — be accurate about whether features are automatic or user-controlled
   wrong: "sorted by price"
   right: "sortable by price or vehicle type"

4. real numbers over README numbers — if Edward gives a number, use it. NEVER pull numbers from
   docs/code and assume they're accurate. The user knows their actual product.

## Lists and Points

Whenever a post has multiple points, ALWAYS use a numbered system (1. 2. 3.)
Never use floating bold headers or bullet points without numbers.
The number comes first, then the plain text label, then the explanation below it.
Example:
1. most LinkedIn users are fraud

myself included...

2. the world will operate just fine without you
there are maybe 10 people...