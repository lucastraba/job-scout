# Daily scout: scoring runbook

You are scoring new job postings for one person. The candidates are in the **Script Output** block above this prompt. Its first lines name the person, their profile (`about.md`), the scores file to write, and the command to run afterwards. Each candidate starts with `[key]`.

Read the profile's `about.md` first. It says who the person is, their hard requirements, the scoring rubric, the lanes, and what to mention in `why` and `gaps`.

## Scoring
- A posting that breaks a hard requirement scores 3 or lower.
- Otherwise score it out of 10 with the profile's rubric. Use whole numbers.
- Be strict: a 7 means you would tell them to spend 15 minutes on it.
- `region` on each candidate comes from the filter: `wide` means open across the person's whole region, `country` one country in it, `unknown` that the location didn't say.

Each entry is `{ "key", "score", "lane", "why", "gaps" }`:
- `lane` is one of the lanes the Script Output lists.
- `why` is one sentence (max ~160 characters) on why it fits, using the signals the profile asks for.
- `gaps` is one short sentence naming the biggest doubt, or `""`.
- For Hacker News posts (`hn:` keys) also add `"role"` and `"where"`: the single role that best fits the person and a short location like `Remote (Europe)`.

## Steps
1. Read every candidate in the Script Output. If a snippet is too thin to judge, run the "Look closer" command it gives (at most 10 times per run).
2. Write the JSON array, one entry per candidate key, to the scores file the Script Output names. Every candidate must be scored, including the bad ones.
3. Run the "Then run" command from the Script Output.
4. Your final reply is the stdout of that command, verbatim, with no preamble. If the Script Output listed failed sources, add one last line: `⚠️ Failing sources: <names>`.

## Rules
- Don't browse the web, open LinkedIn, apply to anything, or contact anyone. This job only scores and files.
- Don't edit files in this repo or in the profile.
