# Stanley + LinkedIn Engine Research

Date: 2026-03-28

## Why this note exists

Figure out:

1. what Stanley actually does
2. what is worth learning from Stanley + Dylan Kim style posts
3. whether Edward can build a cheaper internal LinkedIn engine right now
4. what should change in Edward's content strategy given his ICP

## Short answer

Yes, Edward can build a Stanley-like internal tool.

But the hard part is NOT GPT.

The hard part is LinkedIn data access.

If the goal is an internal tool for Edward only, the safest MVP is:

- use repo context (`profile.md`, `posts/`, `posts/POST-LOG.md`, research notes)
- ingest screenshots / pasted metrics / manual notes
- use OCR + structured logging
- generate drafts, critiques, weekly summaries, and post ideas

If the goal is a polished auto-sync SaaS that pulls LinkedIn analytics and content automatically, LinkedIn API access and policy become the bottleneck very quickly.

## What Stanley appears to be

From official Stan / Stanley materials, Stanley is basically a LinkedIn-specialized AI content advisor with:

- idea extraction / interview flow
- rewrite-in-your-voice flow
- recent post analysis
- weekly analytics + post idea emails
- analytics dashboard
- mobile app

The moat is not some magical model.

The moat is:

1. user data access
2. workflow polish
3. distribution
4. social proof
5. creator-specific prompting and product packaging

## Important source contradictions

Stanley's pricing / trial story appears inconsistent across sources:

- Stan blog says: "Try Stanley free for 14 days"
- Lindsey Gamble article mentions a free 3-day trial through her link
- Kleo review says $149/month and no free trial
- Stanley FAQ emphasizes cancellation + first month refund, but does not clearly state base price

Inference:

Stanley pricing / trial terms may be changing quickly, or different offers may exist by campaign / affiliate / cohort.

Do NOT treat one third-party review as canonical pricing truth.

## What Stanley's official ecosystem claims

Official Stan / Stanley sources claim:

- Stanley launched fast and scaled through build-in-public distribution
- they "hacked their way" to LinkedIn data early
- the product evolved from generic advice to more personalized content strategy
- weekly insights / post ideas are part of the value
- analytics dashboard now includes follower growth, heatmaps, post breakdowns, content pillars, and time-range filtering

## LinkedIn policy reality

LinkedIn's official user agreement and help docs are extremely clear:

- scraping is prohibited
- bots and unauthorized automation are prohibited
- browser plugins / extensions that scrape or modify LinkedIn are prohibited
- using bots to create, comment, like, share, or drive inauthentic engagement is prohibited

Official sources also state:

- robots / automated access require express permission
- robots.txt disallows broad crawling for most bots
- LinkedIn Help says prohibited tools can get accounts restricted or shut down

## What official LinkedIn APIs do allow

Official docs show:

- `w_member_social` is an open permission for posting / commenting / liking on behalf of an authenticated member
- `memberCreatorPostAnalytics` exists for post analytics
- metrics include impressions, members reached, reshares, reactions, comments
- OAuth 2.0 is the standard auth path

But there is a catch:

- most permissions and partner programs require explicit approval from LinkedIn
- Profile API is explicitly described as restricted to approved developers
- official access docs say most permissions beyond open ones require approval

Inference:

Building a fully official Stanley competitor is possible in theory, but likely gated in practice unless LinkedIn approves the app and required scopes.

## Honest feasibility assessment

### 1. Internal Edward-only tool

Very feasible right now

Build this first

Features:

- ingest repo context
- ingest screenshots of analytics
- ingest post URLs + pasted metrics
- generate weekly summaries
- suggest next post ideas based on what performed
- critique draft against Edward ICP + voice
- maintain post log automatically

Risk:

- low

Value:

- high

### 2. Official OAuth app with publishing

Feasible, but limited

Likely features:

- sign in with LinkedIn
- create / publish posts via official permissions
- fetch basic member info

Unknown / gated:

- analytics access in practice
- depth of access without partner approval

Risk:

- medium

Value:

- medium to high if approved

### 3. Unofficial scraper / browser automation engine

Fastest to prototype

But:

- violates LinkedIn rules
- brittle
- account risk
- bad SaaS foundation

Risk:

- high

Value:

- only reasonable for private experimentation if Edward accepts the risk

Recommendation:

Do NOT make this the foundation of a real product.

## Best product direction for Edward

Build an "Edward engine" first, not a broad Stanley clone.

### MVP that actually makes sense

Inputs:

- `profile.md`
- `posts/POST-LOG.md`
- all post text in `posts/*/post.md`
- attached post images
- screenshot uploads from LinkedIn analytics
- quick voice notes / rambles

Outputs:

- draft posts in Edward's voice
- critique: hireability vs vanity
- weekly performance summary
- content lane analysis
- "what should i post tonight" suggestions
- post log updates
- image recommendations

Nice-to-have:

- OCR for analytics screenshots
- heatmap of post times vs performance
- compare post structure vs outcomes
- hook analyzer
- question / CTA analyzer

## What to learn from Dylan Kim posts

## What is actually good

### 1. Strong first-line tension

He opens with a sharp sentence that creates curiosity fast.

Examples:

- "UGC programs are killing startups"
- "Straight A students might be the least prepared for what's coming"
- "Vibe coding is the best thing to happen to startups"

This is worth copying.

### 2. One core thesis per post

Each post picks one argument and stays on it.

This is worth copying.

### 3. Clean scan pattern

The structure is easy to skim:

- hook
- tension
- explanation
- punchline
- question

This is worth copying.

### 4. Comment bait that still feels like a real question

He ends with prompts that invite a viewpoint, not just "thoughts?"

This is worth copying selectively.

## What is NOT worth copying

### 1. Founder authority posture

Dylan writes from the top down.

That works for him because:

- he is a founder
- he has scale
- he has status
- his audience expects strategic takes

Edward should NOT imitate this posture.

### 2. Generic startup morality tales

Some of Dylan's writing is broad and persuasive, but not evidence-heavy.

That may drive engagement.

It does not automatically drive hireability for a 22-year-old SWE.

### 3. Stanley promo line in every post

This likely helps his funnel, but it also means some post success is downstream from product distribution and audience conditioning, not just writing quality.

Do not mistake product flywheel for pure writing skill.

### 4. Warm polished founder voice

Edward's edge is sharper:

- younger
- more internet-native
- more proof-of-work
- more underdog

He should not sanitize himself into polished founder bro language.

## What Edward should change

### Keep

- raw honesty
- builder receipts
- technical specificity
- messy real screenshots
- underdog energy

### Improve

### 1. More single-thesis posts

Too many Edward drafts try to say 3 things at once.

Pick 1.

### 2. More explicit context anchors

Do not assume reader context.

Say:

- what was built
- why it mattered
- why it was hard
- what changed

### 3. Fewer meta-LinkedIn posts

Posting about posting is okay sometimes.

But Edward's best lane is still:

- what i built
- what broke
- what i learned shipping under pressure

### 4. More artifact-backed posts

Whenever possible:

- screenshots
- terminal output
- metrics
- demo clip
- repo

### 5. Stronger endings

Question endings are good, but they should feel specific and earned.

## Content lanes Edward should bias toward

### Lane 1: build / demo / proof-of-work

Best for hireability

### Lane 2: pressure / tradeoff / what broke

Best for judgment signal

### Lane 3: underdog personal story with a real lesson

Best for breakout reach

Use sparingly, but deliberately.

## Story ideas from Edward's new context

### Strong

- community college to startup engineer / growth intern
- multiple adults told me i was stupid, then i became a youth leader / tutor / builder
- the weird fragmentation of shipping across 3 projects
- first real startup exposure at Build Launch Iterate

### Interesting but risky

- League of Legends account flipping in grade 7

Reason:

- fun story
- entrepreneurial instinct

Risk:

- may read unserious or against game rules

### Too raw for default LinkedIn use

- porn addiction specifics
- family "Down syndrome" quote in raw form

These details are too explicit and can distort the post away from the point.

If used, they should be abstracted and handled carefully.

## Recommendation

Do this in order:

1. build an internal LinkedIn copilot for Edward only
2. use screenshot / OCR / manual metric ingestion first
3. keep the repo as the memory layer
4. postpone any scraping-heavy or automation-heavy LinkedIn product until there is a clearer legal / API path
5. optimize Edward's posts for hireability first, vanity second

## Sources used

Official / primary:

- https://stan.store/blog/how-we-built-stanley-linkedin/
- https://help.stan.store/article/428-stanley-linkedin-faq
- https://help.stan.store/article/150-what-can-stanley-do-for-you
- https://stan.store/blog/linkedin-engagement/
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics?view=li-lms-2025-11
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2025-02
- https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api
- https://www.linkedin.com/legal/user-agreement
- https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions
- https://www.linkedin.com/robots.txt

Secondary / context:

- https://www.kleo.so/blog/stanley-review
- https://www.lindsey-gamble.com/blog/linkedin-ai-content-tool-stanley-adds-analytics-dashboard-and-launches-ios-app
