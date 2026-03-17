i shipped an AI feature that worked perfectly

until it didn't

here's what happened:

i built a feature that takes credit bureau reports

runs them through an OCR LLM
and generates an AML report for our brokers
they paste it into Velocity and they're done

usually takes about 1 minute

"ship it"
so i shipped it

then the edge cases started rolling in

some reports are longer
some have weird formatting
some just... take forever

and Vercel serverless has a 5 minute timeout
guess what happens when the AI takes 5:01?

timeout
no report
angry broker

the fix? background jobs
i'm going with Inngest

but here's the lesson:

the "it only takes 1 minute" feature
will eventually take 6

serverless is great until it isn't

if your task CAN take long, assume it WILL

build for the worst case, not the demo case
currently refactoring to add proper job queues

learned this the hard way

follow for more lessons from shipping in production

Ave Christus Rex
