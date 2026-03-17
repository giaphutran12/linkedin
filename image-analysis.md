# Image Analysis: How Pictures Affect Post Engagement

Analysis date: 2026-03-17
Dataset: 16 published LinkedIn posts (Feb 10 – Mar 17, 2026)
Posts with engagement data: 12 of 16 (4 posts scheduled or too new for metrics)

## Key Finding

Every single post includes at least one image, so there's no "with vs without" comparison.
But the IMAGE TYPE matters enormously — proof images outperform personal photos by 7x on impressions.

## Image Type Breakdown

Each image was visually inspected and categorized into one of four types:

### 1. Proof / Evidence (screenshots proving a claim)

| Date | Post | Image Description | Impressions | Likes | Comments |
|------|------|-------------------|-------------|-------|----------|
| 2026-02-17 | Claude Max orchestrating agents | Usage dashboard screenshot + "MAXED OUT" handwritten in red | 7,710 | 626 | 6 |
| 2026-02-14 | GPT-2 from scratch | Live webinar screenshot showing Jupyter Notebook | 2,319 | 13 | 0 |
| 2026-02-10 | Kevin tutoring | Text message screenshot — student's 99% grade | 2,222 | 19 | 2 |

Average: **4,084 impressions** / **219 likes** / **2.7 comments**

### 2. Product Demos (screenshots of something Edward built)

| Date | Post | Image Description | Impressions | Likes | Comments |
|------|------|-------------------|-------------|-------|----------|
| 2026-03-13 | X algorithm TypeScript | Interactive web app — sliders adjusting ranking factors | 993 | 25 | 11 |
| 2026-03-05 | Viet Bike Scout | Multiple browser agents running in parallel on rental sites | 470 | 10 | — |
| 2026-02-18 | ClinicBook Mino | App showing clinic search results UI | 284 | 1 | 0 |

Average: **582 impressions** / **12 likes** / **5.5 comments**

### 3. Personal Photos (selfies, lifestyle shots)

| Date | Post | Image Description | Impressions | Likes | Comments |
|------|------|-------------------|-------------|-------|----------|
| 2026-03-05 | AI Tinkerers event | Selfie outdoors at night, city lights | 673 | 13 | 4 |
| 2026-02-12 | Serverless timeout | Selfie on airplane with laptop | 603 | 9 | 8 |
| 2026-02-23 | Dengue / LinkedIn fraud | Sitting by koi pond, recovering | 600 | 12 | — |
| 2026-03-05 | Context layer | Mirror selfie at resort, palm trees | 243 | 2 | 3 |
| 2026-03-16 | SWE not sexy | Pier selfie with "SWE is BORING" text overlay | 179 | 9 | 0 |

Average: **460 impressions** / **9 likes** / **3.8 comments**

### 4. AI-Generated

| Date | Post | Image Description | Impressions | Likes | Comments |
|------|------|-------------------|-------------|-------|----------|
| 2026-03-05 | Anthropic Bun | AI-generated meme — Claude forcing Bun into npm project | 200 | 6 | 1 |

Average: **200 impressions** / **6 likes** / **1 comment**

## Rankings

### By Impressions (avg)

1. Proof / evidence: **4,084** (even without the Claude Max outlier: 2,271)
2. Product demos: **582**
3. Personal photos: **460**
4. AI-generated: **200**

### By Likes-per-Impression Ratio (engagement quality)

| Type | Ratio |
|------|-------|
| Proof (Claude Max alone) | 8.1% |
| AI-generated | 3.0% |
| Product demos | 2.1% |
| Personal photos | 2.0% |

### By Comments (avg) — proxy for discussion

1. Product demos: **5.5** (X algorithm post got 11 — highest of all posts)
2. Personal photos: **3.8**
3. Proof / evidence: **2.7**
4. AI-generated: **1.0**

## Insights

1. **Proof images destroy everything else.** The top 3 posts by impressions (7,710 / 2,319 / 2,222) ALL use proof screenshots. When you claim something and show the receipt, people engage.

2. **Product demos drive the most discussion.** They don't get the most eyeballs, but they get the most comments. The X algorithm post (993 impressions, 11 comments) had the highest comment count. Demos invite technical conversation.

3. **Personal photos are consistent but won't viral.** All 5 clustered between 179–673 impressions. They humanize the post and feel authentic, but they don't amplify the message.

4. **AI-generated images perform worst.** Single data point, but 200 impressions is below average. LinkedIn audience likely scrolls past obviously AI-generated art.

5. **The image IS the hook.** The Claude Max post works because "I maxed out Claude 20x" + a screenshot of the maxed-out dashboard is undeniable. "SWE is boring" + a pier selfie is just a selfie with an opinion.

## Tactical Takeaways

- When making a claim in a post, SHOW THE RECEIPT — dashboard, terminal output, text message, metrics
- For build posts, screenshot the actual product working (not a mockup or diagram)
- Personal photos are fine for story posts but won't boost reach
- Skip AI-generated images — they signal low effort to LinkedIn's audience
- If you have a product demo AND proof, use proof (proof > demos on impressions)

## AVIF Migration (2026-03-17)

All 17 post images converted from PNG to AVIF:

| Metric | Value |
|--------|-------|
| Files converted | 17 |
| Total PNG size | 21.6 MB |
| Total AVIF size | 1.2 MB |
| Space saved | 94.1% |
| Conversion tool | ffmpeg (libsvtav1, CRF 30) |

Individual conversions ranged from 88.4% to 97.5% size reduction.
Original PNG files deleted after verification.
