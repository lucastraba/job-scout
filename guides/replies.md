# Acting on the digest

Each role in a digest has a permanent number (`#17`). The person answers with short replies; map each one to a command, run it, and confirm in one or two lines what changed. Never answer with only an emoji.

| They say | Run |
|---|---|
| `👍 17`, `like 17`, `yes 17`, `prepare 17` | `job-scout mark 17 liked`, then write an application pack (`job-scout guide prepare`) |
| `👍 17 later`, "just save it" | `job-scout mark 17 liked` only |
| `pass 17`, `no 17`, `👎 17` (optionally with a reason) | `job-scout mark 17 passed "<reason>"` |
| `applied 17` | `job-scout mark 17 applied` |
| `interview 17`, `rejected 17`, `offer 17`, `closed 17` | `job-scout mark 17 interviewing` / `rejected` / `offer` / `closed` |
| `why 17`, `show 17` | `job-scout show 17`, then summarise: role, company, remote terms, salary, why it fits, gaps, link |
| `letter 17` | `job-scout letter 17` (shows the letter and rebuilds the PDF) |
| `letter 17: <what to change>` | edit only the cover letter section of the pack file (`prepare` printed its path; it is `<stateDir>/packs/17.md`), following the voice and truth rules in `job-scout guide prepare`, then `job-scout letter 17`. Every version is kept |
| `letter 17 v1` | `job-scout letter 17 v1` puts version 1 back |
| `stats`, `pipeline` | `job-scout stats` |
| "what was in the last digest?" | `job-scout latest` |
| `run the scout` | `job-scout run`, then `job-scout guide scout` |

Several numbers in one message (`👍 17 19, pass 18`) means one command per number. "All" or a bare 👍 / 👎 with no number means every role in the latest digest: run `job-scout latest` first and skip roles marked Duplicate.

If the profile has a `delivery` section, add `--send` to `letter` so the new PDF reaches them there too.

## Application form questions

When they paste an application form's questions for role #n (or a screenshot), draft an answer for each non-obvious one. Use the role's pack, the posting (`job-scout show <n>`), their CV and the profile's `application.md`, and follow the voice and truth rules in `job-scout guide prepare`. Give one copy-ready block per question, flag anything you inferred rather than found, and add the answers to the role's note above `## Log`.

## Rules
- Agents prepare; the person submits. Never apply, send email, or message anyone for them.
- Never log into or automate LinkedIn.
