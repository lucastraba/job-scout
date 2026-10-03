# Running the scout every morning

Scheduling is optional. Without it, the person asks their agent "run the job scout" when they want a digest.

## One command for cron

`job-scout daily --agent claude` (or `--agent codex`) does a whole run:
1. Fetches and filters. If nothing is new, it stops there, so a quiet day costs no tokens.
2. Starts the agent CLI with the scoring runbook, the profile's `about.md` and the candidates. The agent replies with the scores as JSON; the CLI saves them.
3. Records the scores, writes the role notes, and prints the digest. With `--send` it also delivers it (below).

A typical run with 50–60 candidates used about 160k input and 9k output tokens with a GPT-5-class model; most of that is reading the postings.

Add it to the person's crontab (`crontab -e`). Use full paths, because cron has a minimal `PATH`:

```cron
# 08:00 every day; the log keeps the last run's output and errors.
0 8 * * * PATH=/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin job-scout daily --agent claude --profile jane --send >> $HOME/.local/state/job-scout/jane/cron.log 2>&1
```

Check `which job-scout node claude` (or `codex`) and put their folders in that `PATH`. Run the command once by hand first: the first `claude -p` or `codex exec` may ask to log in.

The agent only reads and replies, so it runs with narrow permissions:
- Claude Code: `claude -p ... --allowedTools Read --permission-mode dontAsk`.
- Codex: `codex exec --sandbox read-only --output-last-message ...`.

Add `--model <name>` to pick the model; otherwise the agent's default is used.

On a Mac, cron needs Full Disk Access for the profile folder in some setups; a LaunchAgent works too. On Windows, use Task Scheduler with the same command.

## Telegram delivery

To get the digest and packs on the phone:
1. In Telegram, talk to @BotFather, send `/newbot`, and copy the token.
2. Send any message to the new bot, then open `https://api.telegram.org/bot<token>/getUpdates` and copy `message.chat.id`.
3. Add to `profile.json`: `"delivery": { "telegram": { "chatId": "<id>" } }`. For a topic in a group, add `"threadId"`.
4. Put the token in the environment as `JOB_SCOUT_TELEGRAM_TOKEN` (in the crontab line, or `tokenEnv` names another variable). Never write the token into the profile.
5. Test it: `job-scout latest`, then `job-scout letter <n> --send` for a role with a pack.

Delivery is one-way: replies (`👍 17`) go to the agent, in a chat with the job-scout skill (`job-scout guide replies`). Hermes users can bind the skill to a Telegram topic instead and reply there.

## Hermes

Hermes runs the scout as a cron job with a pre-run script, `job-scout run --profile <name>`, whose output becomes the prompt context; the prompt says to follow `job-scout guide scout`. Hermes delivers the digest itself, so the profile needs no `delivery` section.
