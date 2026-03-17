if you're not using a context layer for your agent, you're ngmi

agents keep getting better every hour

but there's a problem: training cutoff

all models have a training cutoff AT LEAST 1 year before the release date

that means they are:
1. referring to outdated framework versions
2. having no idea about your api's breaking changes
3. still calling webfetch "how to config edge function 2024"

this leads to HUGE hallucinations

we've all been there
Claude making up api endpoints that don't exist
Cursor having no idea prisma 7 is released (and still using prisma 6's convention on prisma 7)

there's a paper (link in comments) benchmarking hallucination rate between 3 groups of agents:
1. given official, latest docs
2. given webfetch tool
3. nothing

the result was expected

group 3 had a hallucination rate of 40%
group 2 was 6%
group 1 was 0%
yes, you heard that right — ZERO PERCENT

dropping from 6% to 0% means big things:
1. your app won't crash in prod at 3 am because some random dude triggered an edge case
2. not spending 3 hours reworking a feature that could've been one-shotted while you're playing league
3. your context window won't blow up after 3 prompts because of expensive webfetch

that's why using a context layer for your coding agent is CRUCIAL

here's what i'd recommend:
1. Context7 — OG, reliable, but limited functionalities
2. Exa — more capabilities, very reliable
3. Nia — MOST capable, SOTA in reducing hallucinations, LEAST reliable (still fails miserably in opencode, but works fine in claude code and cursor)

follow if you want more honest opinions about AI stuff
i'm a gen z dev so i'm basically born into this AI assisted engineering era

Ave Christus Rex