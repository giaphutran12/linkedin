As LLMs get smarter and more expensive, it's crucial to route your prompt to the best-fit model
You don't want to route "hello world" to GPT-5 ($15/M) while you can use gpt-oss-20b for FREE.
You also don't want to route "fix this streaming bug" to gemini 1.5 lite. it's fast and cheap, but pretty bad at coding
My intelligent LLM router does exactly that
It routes your prompt the the best-fit model, depending on cost, capabilities, latency, and more
Check it out, it's live here: https://lnkd.in/gwemVcVe
Stack: Nextjs, OpenRouter API, TypeScript
Next step: I'll add the option for the user to freely choose whether they want the best response, cheapest response, or fastest response. They will be able to choose the modle they want every single time as well
