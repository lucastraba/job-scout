# Setting up a profile

You are helping someone set up their job scout. By the end they have a profile folder that says what they want, a list of companies whose job boards answer, and filters that let through roles they'd consider and little else. Expect this to take 30–60 minutes of their time; do the reading, writing and checking yourself.

Ask one or two questions at a time. Offer your best guess from their CV with each question, so they can answer "yes" instead of typing. Never invent facts about them.

## 1. Create the profile

Run `job-scout init <name>` with a short lowercase name (their first name is fine). It copies the example profile, a fictional frontend lead in the EU, to `~/.config/job-scout/<name>/`. Every file in it is a placeholder: you rewrite all of them below. If someone runs the scout for several people on one machine, each person gets their own profile and every command takes `--profile <name>`.

## 2. Read their CV

Ask for their CV (PDF, Word, Markdown, or a link to a page they control) and read all of it. Copy the PDF into the profile's `cvs/` folder. If they have several versions aimed at different kinds of role, copy each one; they become the CV variants per lane.

## 3. Interview

Cover these, in roughly this order:
- What kind of roles: two to four lanes, each a short id (`frontend-platform`, `people-lead`, `data-eng`) plus `other`. Titles they would and wouldn't consider. Seniority.
- Where they can work: fully remote only, or also hybrid/on-site in a named city? Which countries or regions they can legally work in, and which they can't (time zones, visas).
- Languages they speak, and any they don't that postings in their market often require.
- Salary: the gross annual floor and currency, and what to suggest when a posting shows a range.
- Notice period or earliest start date, work authorisation, location and time zone, years of experience: the standard form answers.
- What they never want: industries, stacks, company types.
- What they are proudest of, and how they talk about their work, for cover letters. Anything a letter must never claim (a prototype that didn't ship, work colleagues did).
- Where notes should go: a folder in their Obsidian vault, or the default inside the state folder.

## 4. Write profile.json

Rewrite every field. The example shows the shape.
- `name`, `headline`, `contact` (lines for the letter header: city, email, phone, LinkedIn).
- `lanes`, and `cv.variants` / `cv.byLane` mapping each lane to a CV file name without `.pdf` (all lanes may share one). `cv.distDir` is where those PDFs are; the default is the profile's `cvs/`. Leave `cv.data` out unless they keep their CV as a data file.
- `title.include`: patterns for titles to keep. `title.generic`: titles kept only when the description shows `descriptionSignals` (for "Senior Software Engineer"). `title.exclude`: titles always dropped (junior, wrong function, wrong stack). `title.excludeUnlessFocus` with `title.focus`: titles dropped unless they also match their focus ("Frontend Infrastructure Engineer" stays for a frontend person).
- `remoteOnly` (true drops roles that aren't remote), and `region`: `onsite` (locations where they'd also take on-site or hybrid work, like `"vienna|wien"`; leave it out for remote only), `name` (shown in drop reasons), `wide` (locations open across their whole region), `country` (single countries inside it), `outside` (locations they can't work from), `outsideText` (body text like "US-based candidates only").
- `languages.excluded`: one entry per language they don't speak, with `words` (15–20 common function words of that language, to spot postings written in it) and `required` (phrases that make it mandatory, not "a plus").
- `flags`: tags shown next to each candidate (`[pattern, "tag"]`); `prescore`: `[pattern, "title" | "description", points]`, which only orders candidates when there are too many.
- `digest`: `max` roles per digest and `minScore` to make it.
- `boards`: the job boards are set up for software developers in Europe by default. For anyone else, point them at the right categories and region, and turn on Get on Board for Latin America:
  - `remotive.url`: `https://remotive.com/api/remote-jobs?category=<software-dev|marketing|sales|customer-support|design|product|hr|finance-legal|...>`
  - `jobicy.url`: `https://jobicy.com/api/v2/remote-jobs?count=100&geo=<europe|latam|usa|...>&industry=<dev|marketing|...>` (leave `industry` out for all)
  - `weworkremotely.urls`: category RSS feeds, e.g. `https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss`
  - `workingnomads.categories`: a pattern over its category names (`"sales|marketing"`)
  - `getonbrd`: `{ "enabled": true, "categories": ["sales", "digital-marketing", ...] }`, ids from `https://www.getonbrd.com/api/v0/categories`. Many postings are in Spanish.
  - `"hn": { "enabled": false }` drops Hacker News, which is almost only tech; `{ "enabled": false }` drops any board.
  Check every URL you set by opening it once; a wrong category returns nothing rather than failing.

Patterns are JavaScript regular expressions written as JSON strings, matched case-insensitively, so `\b` is written `\\b`. After writing, run `job-scout run --dry` once; a bad pattern fails right away with its text.

## 5. Write about.md and application.md

`about.md` is what the scoring agent reads every day: who they are in five or six bullets, their hard requirements (a posting that breaks one scores 3 or lower), a rubric whose parts add up to 10, the lanes with one line each, and what `why` and `gaps` should mention.

`application.md` is what the pack writer reads: the files that are the only source of facts about them (their CV), what each CV variant leads with, their standard form answers word for word, the salary rule, a "Never claim" list, notes on voice, and how to deliver a pack (leave the delivery section out if they read packs in this chat).

Show both files to them and fix what they correct.

## 6. Pick companies

Propose 20–40 companies that hire for their lanes in places they can work, and that publish jobs on a supported job board: Greenhouse (`boards.greenhouse.io/<slug>`), Lever (`jobs.lever.co/<slug>`), Ashby (`jobs.ashbyhq.com/<slug>`), Personio (`<slug>.jobs.personio.de`), Workable (`apply.workable.com/<slug>`), Recruitee (`<slug>.recruitee.com`) and SmartRecruiters (`careers.smartrecruiters.com/<slug>`). Find each company's careers page and the slug in its job-board URL.

Check every one with `job-scout check <ats> <slug>`, and keep only those that answer. Write them to `companies.json` as `{ "name", "ats", "slug", "why" }`; `why` is one line on why it fits them. Then run `job-scout check --all` and show them the result. Hacker News "Who is hiring" and the job boards from `boards` are included on top.

## 7. Calibrate the filters

Run `job-scout run --dry --why`. It fetches everything, lists what passed with a pre-score, and shows examples of what each filter dropped. After the first run, add `--cached` to re-run the filters on the same jobs in seconds.

Show them the top 20 kept roles and the drop examples, and ask two questions: is anything kept they would never apply to, and is anything dropped they would want? Adjust the patterns and run again with `--cached`. Stop when they're happy. Usually 20–80 kept roles from a full fetch is about right: fewer means good roles are probably being dropped, more means the scoring agent wastes time.

## 8. First run

Run `job-scout run` and score the candidates following `job-scout guide scout`. Show them the digest and explain the replies (`job-scout guide replies`). Then offer the two optional extras: a daily schedule and Telegram delivery (`job-scout guide schedule`).

## Rules
- Never log into or automate LinkedIn, never apply, never contact anyone. If they have a LinkedIn data export, they can unzip it into `<stateDir>/linkedin/` themselves; `prepare` then lists their connections at each company.
- Their salary and personal answers stay in their profile folder. Never put them in this repo.
