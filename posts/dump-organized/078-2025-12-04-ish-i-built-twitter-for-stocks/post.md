I built twitter for stocks

The idea started simple: what if there was a place where traders could share their thoughts on stocks and actually see what the community sentiment looks like in real-time?

So I built Stolk. You write a post, tag stocks with $TICKER (like $AAPL), and mark whether you're bullish, bearish, or neutral. The app aggregates everyone's sentiment so you can quickly gauge how the community feels about any given stock.

But I wanted to take it further. I integrated Claude AI to analyze the quality of discussions, extract key themes from posts, and generate summaries of what people are actually saying. There's also a news sentiment feature that pulls recent articles and uses AI to break down whether media coverage is leaning positive or negative.

The tech stack:
- Next.js 16 and React 19
- TypeScript and Tailwind
- Prisma with Neon PostgreSQL
- Clerk for authentication
- Yahoo Finance for market data
- Anthropic Claude for AI features
- Inngest for background jobs

Put together a 4-minute video walking through the whole thing.

This was a fun one to build. Learned a lot about caching strategies, background job queues, and making AI features feel responsive without burning through API costs.

If you're working on something similar or have questions about the stack, happy to chat.
