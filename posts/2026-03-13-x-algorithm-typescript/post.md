X open-sourced their recommendation algorithm

i rebuilt the whole thing from scratch in TypeScript

not a fork
not a wrapper
a full reimplementation of the 5-stage pipeline that decides what 500M+ people see every day

everyone talks about "the algorithm" like it's magic
it's not — it's 5 stages:

Retrieve → Hydrate → Filter → Score → Select

retrieval pulls from two sources: people you follow (recency-ranked) and people you don't(embedding similarity — Gemini + pgvector cosine search)

10 filters kill bad candidates before scoring — blocked authors, muted keywords, duplicates, age limits
all 10 mirror X's actual codebase

then the brain: a Two-Tower neural network that predicts 6 engagement probabilities per tweet

P(like), P(reply), P(repost), P(click), P(follow), P(not interested)

trained in PyTorch on 676K samples
exported to ONNX
runs inference in TypeScript

the entire model is 3.6KB
it FITS IN A TWEET

but here's what i'm most proud of

you can TUNE the algorithm live
slide the weights for recency vs popularity vs network proximity vs topic relevance
watch the feed re-rank in real-time
every tweet shows exactly WHY it's ranked where it is

your feed's algorithm is NOT magic

it's just MATH

and now you can see all of it

source code is fully open: github.com/giaphutran12/x-recommendation-algo

if you want to see how stuff actually works under the hood, follow me — i reverse-engineer the things everyone uses but nobody understands

Ave Christus Rex


