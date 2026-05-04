I migrated 300k+ rows of business data into Postgres and here’s what I learned:

1. Have a BIG sample size

Your data will NEVER be clean or ideal. Some will be missing on this field, while others do. For some rows, the value provided for the col “heating” is “true”, but for others, the value is “200”. Since the db I migrated from was Velocity, a CRM, they don’t really care that much about data consistency, every thing could just be text. But that’s a nightmare for migration. Since I don’t have control over that, just have a huge sample size, so that you will have a full picture of  95%+ of the data.

2. Something weird will always spring up during the process, expect that

I was 99% done with db migration, just to realize that 74% of the deals didn’t have an assigned broker. No bueno. So I went in my automation script, found out that my sync api endpoint didn’t capture the broker_id in its velocity api GET request. Weird thing is, somehow the other 26% got captured with a broker_id. My speculation is that, those 76% were probably inactive deals, and Velocity won’t return the broker_id unless I specifically ask for it. Anyways, my point is, stupid stuff will always spring up out of nowhere. That is expected. Sometimes, it’s not even your fault, but it’s your responsibility to fix it. I fixed it by creating a backfill script to resync all the deals without a broker_id. Now all deals are assigned to a broker, which is the expected behaviour

Claude Code is your best friend
I wouldn’t be able to do this in ~24 working hours if I never used ANY ai, and I’m not afraid to say it. But Claude Code by itself sucks. You need MCP servers and slash commands to supercharge it. Here’s what I use:
Nia mcp: context management for agents. I save so much time, effort, and token with nia. The thing I abuse rn is nia_context, which saves the context of this current chat, gives you an ID, so that the next agent can retrieve that context, and work continuously without u having to repeat yourself, and the agent reading the same file for the millionth times
Compound-engineering: free official plugin from Anthropic itself. Contains a bunch of useful slash commands. My favourite one is /plan_review. Sometimes, Claude Code makes CRAZY plans. Once, I wanted to add pagination so I can see deals by clicking back and forth. It proposed React Tanstack Query + Zustand for prefetching on client side and UI caching through a small store. I was tempted to press approve, but figured I would review the plan anyways. The 3 agents came back and all agreed that it was an abomination of a plan. It tried to add 12 files, 500 LOC just to go from one page to another? It could have been 20 LOC and 1 file modified. The proposed plan is good for millions of users. But I’m building an internal tool, 50 DAU on a good day. Wth I need prefetching for? Plus, Postgres is fast with indexing alr, I don’t need to do all that work for a tiny UX improv that nobody cares about.

Ave Christus Rex
