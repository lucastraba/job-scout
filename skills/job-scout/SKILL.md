---
name: job-scout
description: Daily job search scout. Use when the user wants to set up their job search profile, run the job scout or score new postings, act on a digest reply ("👍 17", "pass 17", "applied 17", "why 17", "letter 17: shorter"), write an application pack or cover letter for a shortlisted role, answer application form questions, or schedule the scout.
---

# Job scout

The `job-scout` command fetches public job boards, filters, stores and files; you do the judgment (scoring, writing, interviewing). Each task has a runbook that the command prints. Read the right one before acting, and follow it exactly:

| Task | Runbook |
|---|---|
| First-time setup, tuning filters, adding companies | `job-scout guide setup` |
| Running the scout and scoring candidates | `job-scout guide scout` |
| Replies to a digest, tracking, form questions | `job-scout guide replies` |
| Application pack or cover letter after a 👍 | `job-scout guide prepare` |
| Running it every morning, Telegram delivery | `job-scout guide schedule` |

If `job-scout profiles` lists several, pass `--profile <name>` to every command.

If `job-scout` is not on PATH: with the Claude Code plugin it is in the plugin's `bin/`; otherwise `git clone https://github.com/lucastraba/job-scout ~/job-scout && npm install -g ~/job-scout` (Node 22.13 or newer).

Never apply, message anyone, or log into or automate LinkedIn. Agents prepare; the person decides and submits.
