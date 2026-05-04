i let Claude train a language model on my Mac while i slept

woke up to 22 experiments completed and this masterpiece:

"Once upon a time, the first time was done quickly to the 12th period. A time is a good time. With its time, it was a time to try a time that time was time compared to the 10th time"

not exactly Shakespeare

the setup is Andrej Karpathy's autoresearch — you give an AI agent a real training script and tell it "GO WILD" and "NEVER STOP"
it tweaks architecture, hyperparameters, optimizer settings
trains for 5 minutes, checks if the result improved, keeps or discards, repeats

no human in the loop

here's what it figured out on its own overnight:

1. batch size was holding it back — it halved from 65K to 32K to 16K, each step improving 5-7%. tried 8K and crashed. learned its own limits

2. a smaller model beat the bigger one — went from 11.5M params to 10.7M, fewer layers, more training steps. the model got SMALLER and better

3. weight tying nearly doubled the error — val_bpb shot from 1.75 to 3.22. it tried, it learned, it moved on

4. it had taste — 8 out of 22 experiments were kept. it tried SwiGLU, GELU, wider aspect ratios, removing weight decay. discarded all of them

24.5% improvement from baseline
trained on a MacBook Pro M5
while i was asleep

the output is mostly coherent gibberish
but the process — an AI agent running its OWN ML research loop, evaluating its own ideas, discarding most of them — that's the part worth paying attention to

we're at the "it works but the output is hilarious" stage

that stage NEVER lasts long

if you're following the AI research space, follow me — i run these experiments and share what i find

Ave Christus Rex
