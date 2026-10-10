# job-scout

A daily job scout that your coding agent runs. It reads public job boards, drops the roles that can't fit you, has your agent score the rest against what you told it you want, and gives you a short digest. When you like a role, the agent writes an application pack: which CV to send, a cover letter (also as a PDF), answers for the usual form questions, and who you know there. You review it and apply yourself.

It works with Claude Code, Codex, Cursor, OpenCode and Hermes. The agent does the judgment through your existing subscription, and the CLI never calls a model or needs an API key.

What it never does: apply for you, message anyone, or touch LinkedIn. It reads public job-board APIs only. Agents prepare; you decide and submit.

## How it works

1. **Fetch**: Hacker News "Who is hiring", the public job boards of the companies in your profile (Greenhouse, Lever, Ashby, Personio, Workable, Recruitee, SmartRecruiters), and remote job boards (Remotive, RemoteOK, We Work Remotely, Jobicy, Working Nomads, Get on Board for Latin America, and Himalayas, searched by keyword for fields the other boards don't cover). The boards default to software roles in Europe; the profile sets their categories and region, so it works for sales, marketing, support or design roles elsewhere too.
2. **Filter**: title patterns, seniority, remote and region rules, languages you don't speak, posting age. All of it comes from your profile, and `run --dry --why` shows what each rule dropped.
3. **Score**: your agent reads your `about.md` and scores each new candidate out of 10 with your rubric. Up to 60 per run; the rest wait for the next one.
4. **Digest**: roles scoring 7 or more get a permanent number and a Markdown note (Obsidian-friendly). You reply `👍 17`, `pass 17`, `applied 17` or `why 17`.
5. **Prepare**: a 👍 makes the agent write an application pack from your CV and the posting, following your `application.md`. `letter 17: make it shorter` revises the cover letter; every version is kept.

## Install

Node 22.13 or newer. The scout has no dependencies; cover letter PDFs need Chrome, Chromium or Edge installed.

**Claude Code**, as a plugin (puts the `job-scout` command on the agent's PATH):

```
/plugin marketplace add lucastraba/job-scout
/plugin install job-scout@job-scout
```

**Codex, Cursor, OpenCode** (or Claude Code without the plugin):

```bash
git clone https://github.com/lucastraba/job-scout ~/job-scout
npm install -g ~/job-scout     # puts the job-scout command on your PATH; `git pull` there updates it
job-scout install-skill        # copies the skill to ~/.agents/skills and ~/.claude/skills
```

The scout keeps its data in `~/.local/state/job-scout` and fetches job boards, so Codex's default sandbox asks for approval the first time the agent runs `job-scout`. Approve it, or allow the `job-scout` command in your Codex rules.

Then ask your agent: "set up the job scout for me". It follows `job-scout guide setup`: reads your CV, interviews you, writes your profile, checks the job boards of companies that fit you, and tunes the filters with you until the results look right. Plan on 30–60 minutes.

## Every morning

Either ask your agent "run the job scout", or let cron do it:

```cron
0 8 * * * PATH=/usr/local/bin:/usr/bin:/bin job-scout daily --agent claude --profile jane --send >> ~/job-scout.log 2>&1
```

`daily` fetches and filters first, and calls the agent only when there is something new. The agent gets read-only access and replies with the scores; the CLI records them. With `--send` and a Telegram bot in your profile, the digest and packs arrive on your phone. Details: `job-scout guide schedule`.

A run with 50–60 new candidates costs roughly 160k input and 9k output tokens, mostly the postings themselves. Quiet days cost nothing.

## Your profile

Everything about you lives in `~/.config/job-scout/<name>/`, outside this repo:

| File | What it holds |
|---|---|
| `profile.json` | name and contact, lanes, title patterns, region and remote rules, languages, CV per lane, digest size, optional Telegram delivery |
| `about.md` | who you are, hard requirements, the scoring rubric: what the scoring agent reads every day |
| `application.md` | your standard form answers, salary rule, what never to claim, your voice: what the pack writer reads |
| `companies.json` | target companies and their job boards |
| `cvs/` | your CV PDFs |

`job-scout init <name>` starts one from `profiles/example`, a fictional frontend lead. Several people can share one install; every command takes `--profile <name>`. The database, notes and letters go to `~/.local/state/job-scout/<name>/` unless the profile says otherwise (point `notes.dir` at a folder in your Obsidian vault if you use one).

Your data stays on your machine, but your agent's model provider sees what the agent reads: your profile, your CV and the postings.

## Commands

```bash
job-scout init <name>                  # start a profile
job-scout guide [setup|scout|replies|prepare|schedule]   # the runbooks your agent follows
job-scout check <ats> <slug>           # does this company's job board answer? (--all checks your list)
job-scout run --dry --why [--cached]   # what passes your filters, and examples of what each rule dropped
job-scout run                          # fetch, filter, store; prints candidates for the agent
job-scout daily --agent claude|codex   # run + score + record, for cron
job-scout record <scores.json>         # store scores, write notes, print the digest
job-scout mark <n> <stage>             # liked | prepared | applied | interviewing | offer | rejected | passed | closed
job-scout show <n> | latest | stats
job-scout prepare <n>                  # brief for the pack-writing agent
job-scout pack <n> | letter <n> [v<k>] # file the pack and build the letter PDF; rebuild or restore a letter
job-scout recruiters                   # recruiters among your LinkedIn connections (from your own data export)
```

Add `--send` to `record`, `pack`, `letter` or `daily` to deliver through your profile's `delivery` adapter.

## LinkedIn

Not automated, on purpose. LinkedIn's User Agreement forbids automated access, it detects it, and a restricted account in the middle of a search costs far more than automation saves. Two things are allowed and supported: your own data export (unzip it into `<stateDir>/linkedin/` and packs list your connections at each company), and LinkedIn's job alert emails, which you can forward or paste to your agent.

## Adding a source

- A company: add `{ "name", "ats", "slug" }` to your `companies.json` and check it with `job-scout check <ats> <slug>`.
- A job board: write a fetcher in `src/sources/boards.mjs`, keyed by its `id` in `sources/boards.json`. Fetchers return the job shape documented at the top of `src/sources/ats.mjs`.

Remotive, RemoteOK, Jobicy and Himalayas ask for a link back to the original posting; the notes and digests keep each posting's URL.

## Development

Why it's built this way, what was rejected, and traps found in testing: [docs/design.md](docs/design.md).

```bash
npm test     # runs against profiles/example
```

## License

MIT
