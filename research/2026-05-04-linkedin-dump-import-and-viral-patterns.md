# LinkedIn Dump Import And Viral Pattern Notes

Date: 2026-05-04

Source dump: `posts/bunch of posts.md`

Generated corpus: `posts/dump-organized/`

Script: `scripts/organize-linkedin-dump.mjs`

## What Changed

The dump has been split into 122 individual post folders.

Each folder contains:

- `post.md`: cleaned post text
- `metadata.json`: raw order, approximate date, hook, word count, metrics, inferred tags

The generated folder also contains:

- `index.md`: human-readable table
- `index.json`: machine-readable corpus index

Run again with:

```bash
/Users/edwardtran/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/organize-linkedin-dump.mjs --clean
```

Default input is `posts/bunch of posts.md`.

Default output is `posts/dump-organized/`.

Dates are approximate because LinkedIn dump timestamps are relative (`22h`, `1w`, `1mo`) instead of absolute dates. The importer currently anchors them to 2026-05-04.

## Corpus Summary

- Parsed posts: 122
- Posts with impression metrics: 109
- Generated files: 246 post-level files plus `index.md` and `index.json`

## Stanley Week Read

Assumption: latest 10 posts approximate the Stanley trial window.

Latest 10 posts:

- Total impressions: 4,792
- Average impressions: 479
- Median impressions: 288
- Reactions: 66
- Comments: 23

Latest 10 excluding the portfolio post:

- Total impressions: 2,902
- Average impressions: 322
- Median impressions: 219
- Reactions: 44
- Comments: 10

Previous 10 posts:

- Total impressions: 6,269
- Average impressions: 627
- Median impressions: 298
- Reactions: 73
- Comments: 20

Read:

Stanley did not clearly improve baseline performance.

The portfolio post carried the week because it was a strong artifact, not because the surrounding copy system suddenly got better. With the portfolio included, comments improved slightly. Without it, the week looks weaker than the previous bucket.

## What Actually Went Viral

Top posts by impressions:

| Rank | Impressions | Hook |
|---:|---:|---|
| 1 | 7,738 | the most valuable skill i've built this year isn't writing code |
| 2 | 6,800 | A software engineer’s job is to solve problems, NOT coding |
| 3 | 6,623 | I ran into Elon Musk last night and here’s his advices about breaking into tech |
| 4 | 5,862 | prisma 7 sucks. so many things are breaking |
| 5 | 5,684 | this MIT researcher just SMURFED vietnam's largest hackathon |
| 6 | 3,507 | Happy to announce our team just grew |
| 7 | 3,170 | opus 4.7 is mid |
| 8 | 2,472 | a YC founder cold messaged me 2 months ago |
| 9 | 2,344 | I'm building GPT-2 from scratch |
| 10 | 2,237 | nobody wanted him, so i took the kid in and proved them wrong |

Patterns:

- Specific known entity in the hook: Claude, Jensen, Elon, Prisma, MIT, YC
- Conflict or status gap: `sucks`, `mid`, `SMURFED`, `cold messaged`, `nobody wanted`
- Proof attached to the post: build, shipped artifact, real story, screenshot, demo, or social proof
- Human bridge: the reader understands why the thing matters without already caring about the tool

## What Flopped Recently

Recent weak posts were mostly inside-baseball tool updates:

- `you can now have angry Dario as your pet`: 131 impressions
- `you are sleeping on kimi k2.6`: 146 impressions
- `Introducing TinySkills`: 157 impressions
- `gpt 5.5 is here`: 211 impressions
- `gstack wasn't built for codex`: 194 impressions

Pattern:

These posts ask the reader to already care about the tool.

Most powerful people do not care about the tool yet. They care about business leverage, hiring signal, technical judgment, customer pain, social proof, or a strong human story.

## Most Likely To Go Viral

Best formula for Edward:

1. Hook with a recognizable entity, sharp conflict, or real status signal
2. Show the artifact fast
3. Explain why it was non-trivial
4. Tie it to a bigger career/business lesson
5. End with a CTA to the right room

Strong future angles:

- `i cloned myself so i could manage interns across a 14-hour timezone gap`
- `long-running agents do not fail because of prompts. they fail because of recovery`
- `Costco taught me why most software demos fail`
- `a YC founder cold messaged me because i shipped, not because my resume was pretty`
- `faith made me more ambitious, not less`

Avoid:

- Pure model review
- Pure tool launch
- Pure "link in comments"
- Pure AI news
- Posts that only make sense to other Codex power users

## Target Rooms

Do not aim at "powerful people" as one blob.

Post to one room at a time:

- YC/SF founder: wants speed, ownership, low hand-holding
- Senior AI engineer: wants judgment, architecture, failure modes
- Hiring manager or recruiter: wants easy-to-evaluate proof
- Technical founder/operator: wants business sense plus engineering ability
- Values-driven high-agency network: wants discipline, seriousness, faith, loyalty

The strongest position remains:

young engineer with abnormal proof of work, business sense, and enough chaos tolerance to be useful early.
