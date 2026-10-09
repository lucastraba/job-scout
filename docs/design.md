# Design notes

Why the scout is built the way it is, what was tried and dropped, and the traps found while testing. Read this before changing how it installs, runs agents or fetches jobs.

## Decisions

- **The CLI never calls a model.** Agents run the CLI, not the other way round. Scoring, pack writing and the setup interview are runbooks in `guides/` that the person's own agent follows. Nobody needs an API key, it runs on the subscription they already pay for, and Claude Code, Codex, Cursor, OpenCode and Hermes all run the same thing. This rules out a hosted version and an "enter your API key" setup.
- **Everything personal lives in a profile folder outside the repo** (`~/.config/job-scout/<name>/`). `config.mjs` only holds defaults. One install can serve several people with `--profile <name>`, which is how someone runs it for a friend who isn't a developer.
- **The scoring agent is read-only.** `daily --agent claude|codex` gives the agent the candidates, the agent replies with JSON scores, and the CLI records them. Codex's sandbox couldn't write files on the test server, and read-only is safer anyway.
- **Delivery is pluggable.** Default is stdout plus Markdown notes; `--send` with a Telegram bot token and chat id in the profile delivers digests and packs. Hermes users can keep their own adapter.
- **Letters are revisable and versioned.** Every pack ends with how to ask for changes (`letter <n>: <what to change>`), every version is kept, and `letter <n> v<k>` restores one. The built-in letter template prints through any Chrome, Chromium or Edge; a profile can point at its own renderer.
- **Job boards follow the profile.** Out of the box the boards search software roles in Europe. A profile's `boards` section sets categories, region and on/off per board, so sales, marketing, support, design or HR searches elsewhere work too. Get on Board (Latin America, often Spanish, many non-tech categories) is off unless a profile turns it on.
- **Region rules are lists, not "EU or not".** `remoteOnly`, plus `region.onsite` for cities where on-site or hybrid work is fine, plus `wide`/`country`/`outside`. "Languages I don't speak" replaced a hard-coded German filter. Cover letters are written in the posting's language.
- **Fresh public repo.** The original private repo's history contains a real profile and salary, so this repo started from a clean single commit and a privacy scan (names, salary figures, employer, server and tailnet names, phone number, Telegram chat id) before the first push.

## Rejected

- **LinkedIn automation of any kind.** Technically possible (a browser on a logged-in session, or unofficial private-API libraries), but the User Agreement forbids it, LinkedIn detects it, and a restricted account mid-search costs far more than automation saves. Official APIs give individuals only name/email and posting. Supported instead: the user's own data export (contacts per company) and LinkedIn job-alert emails pasted or forwarded to the agent.
- **Scraping boards without a public API.** Same reason. This includes Argentine boards like Computrabajo, Bumeran and ZonaJobs; as far as we know none has a public API, so local non-tech markets there are only partly covered.
- **Auto-apply, messaging anyone, a hosted service, a web UI.** Agents prepare; the person decides and submits.
- **`npm install -g github:lucastraba/job-scout`.** npm 12 refuses git sources (`EALLOWGIT`) and remote tarballs by default. `--allow-git` works but is version-specific; clone plus `npm install -g <dir>` works on every npm version and `git pull` updates it.

## Gotchas found in testing

- Ubuntu's snap Chromium can't read or write `/tmp` or hidden folders, so with a snap browser the letter builder prints through a scratch folder in the home directory (`src/letter-pdf.mjs`).
- Codex's default sandbox asks for approval the first time `job-scout` runs, because it writes to `~/.local/state/job-scout` and fetches over the network. The README says so.
- The Claude Code plugin manifest validates with `"source": "./"`.
- A pack used to print `CV: null/…` when a profile's CV file was missing; check CV paths during setup.
- Title patterns are the weakest part of any new profile: too loose floods the agent, too strict drops good roles silently. That's why setup ends with `run --dry --why --cached` calibration with the person.
- Remotive and RemoteOK ask for a link back to the original posting; notes and digests keep each posting's URL.
