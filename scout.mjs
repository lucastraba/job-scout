#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config, profileFile } from './config.mjs'
import { classify, prescore, titleWorthHydrating } from './src/filter.mjs'
import { settleAll } from './src/http.mjs'
import { ats } from './src/sources/ats.mjs'
import { loadSources } from './src/sources/index.mjs'
import { deliver } from './src/deliver.mjs'
import { scoresFromReply, scoringAgents } from './src/agents.mjs'
import { openStore, stages } from './src/store.mjs'
import { clip, normalizeKey } from './src/text.mjs'
import { buildLetterPdf, chosenCv, extractLetter, letterMarkdown, readVersion, recordVersion, replaceLetter } from './src/letter.mjs'
import { contactsAt, loadConnections, recruiters } from './src/linkedin.mjs'
import { appendPack, replacePack, updateRoleStage, vaultLink, writeRoleNote } from './src/vault.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const today = () => new Date().toISOString().slice(0, 10)

// The profile's prose for the agents: who the person is and how to score (about.md), how to write a pack (application.md).
const profileDocs = () => ['about.md', 'application.md'].map(profileFile).filter((path) => existsSync(path))
const cli = (command, { send = false } = {}) =>
  `node ${join(root, 'scout.mjs')} ${command} --profile ${config.profileDir}${send && config.delivery ? ' --send' : ''}`

const fetchAll = async () => {
  const sources = loadSources(join(root, 'sources'), config.companies, config.boards)
  const results = await settleAll(sources.map((source) => source.run))
  const failed = []
  const jobs = []
  results.forEach((result, index) => {
    const { name, source } = sources[index]
    if (!result.ok) return failed.push(`${name} (${result.error.message})`)
    for (const job of result.value) jobs.push({ ...job, source, description: job.description ?? '' })
  })
  const needDetails = jobs.filter((job) => job.hydrate && titleWorthHydrating(job.title))
  await settleAll(needDetails.map((job) => async () => { job.description = await job.hydrate() }))
  return { sources: sources.length, failed, jobs }
}

// Every fetch is saved, so `run --dry --cached` can re-run the filters while tuning a profile without refetching.
const lastFetch = () => join(config.stateDir, 'last-fetch.json')
const fetchOrCached = async (cached) => {
  if (cached) {
    if (!existsSync(lastFetch())) throw new Error('No saved fetch yet: run `run --dry` once without --cached.')
    return JSON.parse(readFileSync(lastFetch(), 'utf8'))
  }
  const result = await fetchAll()
  mkdirSync(config.stateDir, { recursive: true })
  writeFileSync(lastFetch(), JSON.stringify({ ...result, jobs: result.jobs.map(({ hydrate, ...job }) => job) }))
  return result
}

// What the filters dropped, a few titles per reason, for tuning a profile's patterns.
const dropReport = (dropped, perReason = 12) =>
  Object.entries(dropped)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([reason, jobs]) => [
      `--- dropped: ${reason} (${jobs.length}) ---`,
      ...jobs.slice(0, perReason).map((job) => `  ${job.company} — ${job.title} | ${clip(job.location ?? '', 60)}`),
    ].join('\n'))
    .join('\n')

const run = async ({ dry, why, cached, unattended = false }) => {
  const { sources, failed, jobs } = await fetchOrCached(dry && cached)
  const dropped = {}
  const reasons = {}
  const kept = []
  for (const job of jobs) {
    const verdict = classify(job)
    if (!verdict.keep) {
      reasons[verdict.reason] = (reasons[verdict.reason] ?? 0) + 1
      ;(dropped[verdict.reason] ??= []).push(job)
      continue
    }
    kept.push({
      ...job,
      region: verdict.region,
      flags: verdict.flags,
      dedupeKey: `${normalizeKey(job.company)}|${normalizeKey(job.title)}`,
      prescore: prescore(job),
      location: job.location ?? '',
      postedAt: job.postedAt ?? null,
      salary: job.salary ?? null,
    })
  }

  if (dry) {
    console.log(JSON.stringify({ sources, failed, fetched: jobs.length, kept: kept.length, dropped: reasons }, null, 2))
    for (const job of kept.sort((a, b) => b.prescore - a.prescore)) {
      console.log(`${job.prescore}\t${job.region}\t${job.company} — ${job.title}\t${clip(job.location, 60)}`)
    }
    if (why) console.log(`\n${dropReport(dropped)}`)
    return
  }

  const store = openStore()
  const inserted = store.upsert(kept)
  store.recordRun({ sources, failed, fetched: jobs.length, kept: kept.length, inserted })
  const batch = store.unscreened(config.screen.maxPerRun)
  // Empty output tells Hermes there is nothing to score, so no model call and no message.
  if (batch.length === 0) {
    if (store.queued(config.digest.minScore).length > 0) {
      return 'SCOUT RUN: no new candidates today, but strong roles are queued. Write [] to the scores file and run record as usual.'
    }
    return failed.length ? `Scout ran, nothing new. Failed sources: ${failed.join('; ')}` : ''
  }

  const waiting = store.countUnscreened() - batch.length
  const scoresFile = join(config.stateDir, 'scores', `${today()}.json`)
  const lines = [
    `SCOUT RUN ${today()} for ${config.name}: ${jobs.length} open roles fetched from ${sources} sources; ${kept.length} passed the filters; ${inserted} new today.`,
    `Profile: ${profileFile('about.md')} (read it before scoring). Lanes: ${config.lanes.join(', ')}.`,
    `Scores file: ${scoresFile}`,
    // Unattended runs (`daily`) record the scores themselves after the agent writes them.
    unattended ? 'The record step runs after you finish: only write the scores file.' : `Then run: ${cli(`record ${scoresFile}`, { send: true })}`,
    unattended ? null : `Look closer at a candidate: ${cli('show <key>')}`,
    `Candidates to score now: ${batch.length}${waiting > 0 ? ` (${waiting} more wait for the next run)` : ''}.`,
    failed.length ? `Failed sources: ${failed.join('; ')}` : 'All sources answered.',
    '',
  ]
  for (const job of batch) {
    lines.push(
      `[${job.key}] ${job.company} — ${job.title}`,
      `location: ${clip(job.location, 120) || '—'} | region: ${job.region} | posted: ${job.posted_at?.slice(0, 10) ?? '—'} | flags: ${job.flags || '—'} | salary: ${job.salary ?? '—'}`,
      clip(job.description.replace(/\s+/g, ' '), config.screen.snippetChars * (unattended ? 2 : 1)),
      '',
    )
  }
  return lines.filter((line) => line !== null).join('\n')
}

// One unattended run for cron: fetch and filter, let the agent score, then record and (with --send) deliver.
// Nothing new means no agent call at all.
const daily = async (agentName, model) => {
  const agent = scoringAgents[agentName]
  if (!agent) throw new Error(`Usage: daily --agent <${Object.keys(scoringAgents).join('|')}>`)
  const candidates = await run({ unattended: true })
  if (!candidates.startsWith('SCOUT RUN')) return candidates
  const scoresDir = join(config.stateDir, 'scores')
  const scoresFile = join(scoresDir, `${today()}.json`)
  rmSync(scoresFile, { force: true })
  // Nothing new, but strong roles queued from earlier runs: no scoring needed to digest them.
  if (candidates.startsWith('SCOUT RUN:')) {
    writeFileSync(scoresFile, '[]')
    return record(scoresFile)
  }
  const prompt = [
    readFileSync(join(root, 'guides', 'scout.md'), 'utf8'),
    `## Profile (about.md)\n${readFileSync(profileFile('about.md'), 'utf8')}`,
    `## Script Output\n${candidates}`,
    'Reply with only the JSON array, nothing before or after it. Don\'t write files or run commands; the scout saves your reply and records it.',
  ].join('\n\n')
  const reply = join(scoresDir, `${today()}.reply.txt`)
  rmSync(reply, { force: true })
  const [bin, binArgs] = agent({ prompt, model, reply })
  // Output is captured, not shown: some agents echo the whole prompt. It only matters when no scores appear.
  const result = spawnSync(bin, binArgs, { cwd: scoresDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30 * 60_000, maxBuffer: 64 * 1024 * 1024 })
  if (result.error) throw new Error(`${bin} failed to start: ${result.error.message}`)
  const answer = existsSync(reply) ? readFileSync(reply, 'utf8') : result.stdout ?? ''
  const scores = scoresFromReply(answer)
  if (!scores) {
    const tail = `${answer}\n${result.stderr ?? ''}`.trim().split('\n').slice(-12).join('\n')
    throw new Error(`${bin} didn't reply with a scores array. The end of its output:\n${tail}`)
  }
  writeFileSync(scoresFile, JSON.stringify(scores, null, 2))
  return record(scoresFile)
}

const digestEntry = (job, ref) =>
  [
    `#${ref} · ${job.score}/10 · ${job.title} — ${job.company}`,
    `${clip(job.location, 80) || 'Remote'}${job.salary ? ` · ${job.salary}` : ''}`,
    `Why: ${job.why}`,
    job.gaps ? `Gaps: ${job.gaps}` : null,
    job.url,
  ].filter(Boolean).join('\n')

// Same company and either the same core title, or one side is a Hacker News post (which names several roles).
const titleCore = (title) => normalizeKey(title.replace(/\(.*?\)|\[.*?\]/g, '').split(/\s[-–—|]\s|,/)[0])
const sameRole = (a, b) =>
  normalizeKey(a.company) === normalizeKey(b.company) &&
  (a.source === 'hn' || b.source === 'hn' || titleCore(a.title) === titleCore(b.title))

const record = (file) => {
  const scores = JSON.parse(readFileSync(file, 'utf8'))
  const store = openStore()
  for (const entry of scores) store.saveScore(entry)

  // Strong roles that didn't fit in an earlier digest compete with today's.
  const shown = store.shown()
  const picks = []
  for (const job of store.queued(config.digest.minScore)) {
    if (picks.length === config.digest.max) break
    if ([...shown, ...picks].some((other) => sameRole(job, other))) {
      store.setStage(job.key, 'duplicate')
      continue
    }
    picks.push(job)
  }
  const stillQueued = store.queued(config.digest.minScore).length - picks.length

  const entries = picks.map((job) => {
    const ref = store.promote(job.key, null)
    const notePath = writeRoleNote({ ...job, ref }, ref)
    store.setNotePath(job.key, notePath)
    return { ref, text: digestEntry(job, ref) }
  })

  const header = [
    `🧭 Scout · ${today()}`,
    `${scores.length ? `Scored ${scores.length} new roles` : 'No new roles today'}; ${entries.length} worth a look${stillQueued > 0 ? ` (${stillQueued} more strong ones queued for the next digests)` : ''}.`,
  ].join('\n')
  if (entries.length === 0) return `${header}\nNothing scored ${config.digest.minScore}+ today.`
  const example = entries[0].ref
  const footer = config.digestFooter ?? `Reply "👍 ${example}" to shortlist, "pass ${example}" to skip, "why ${example}" for the full note.`
  return [header, ...entries.map((entry) => entry.text), footer].filter(Boolean).join('\n\n')
}

const mark = (refOrKey, stage, comment) => {
  if (!stages[stage]) throw new Error(`Unknown stage "${stage}". Known: ${Object.keys(stages).join(', ')}`)
  const store = openStore()
  const job = store.get(refOrKey)
  if (!job) throw new Error(`No role ${refOrKey}`)
  store.setStage(job.key, stage)
  updateRoleStage(job.note_path, stage, comment)
  console.log(`#${job.ref ?? '—'} ${job.title} — ${job.company}: ${stages[stage]}${job.note_path ? `\nNote: ${vaultLink(job.note_path)}` : ''}`)
}

const show = (refOrKey) => {
  const job = openStore().get(refOrKey)
  if (!job) throw new Error(`No role ${refOrKey}`)
  console.log(JSON.stringify({ ...job, description: clip(job.description, 6000) }, null, 2))
}

const latest = () => {
  for (const job of openStore().latestDigest()) {
    console.log(`#${job.ref} ${stages[job.stage]} · ${job.title} — ${job.company}`)
  }
}

const cvFor = (lane) => {
  const file = `${config.cv.byLane[lane] ?? config.cv.byLane.other}.pdf`
  return { file, path: join(config.cv.distDir, file), url: `${config.cv.publicUrl}/${file}` }
}

const packPath = (ref) => join(config.stateDir, 'packs', `${ref}.md`)
const letterVersionsDir = (ref) => join(config.stateDir, 'packs', `${ref}.letters`)
const revisionHint = (ref) => `Want changes to the letter? Reply "letter ${ref}: <what to change>" and I'll send a new PDF.`

// Everything the writing agent needs for one role; PREPARE.md says what to do with it.
const prepare = (refOrKey) => {
  const store = openStore()
  const job = store.get(refOrKey)
  if (!job?.ref) throw new Error(`No digested role ${refOrKey}`)
  if (job.stage === 'digested') store.setStage(job.key, 'liked')
  mkdirSync(join(config.stateDir, 'packs'), { recursive: true })
  const cv = cvFor(job.lane)
  const contacts = contactsAt(job.company)
  console.log([
    `PREPARE #${job.ref}: ${job.title} — ${job.company}`,
    `Posting: ${job.url}`,
    `Location: ${job.location || '—'} | Salary: ${job.salary ?? 'not listed'} | Score: ${job.score}/10 | Lane: ${job.lane}`,
    `Scout's take: ${job.why}${job.gaps ? ` Gaps: ${job.gaps}` : ''}`,
    `CV variant for this lane: ${cv.file} (${existsSync(cv.path) ? cv.path : `MISSING from ${config.cv.distDir}`})`,
    contacts.length
      ? `LinkedIn connections at ${job.company}:\n${contacts.map((person) => `- ${person.name}, ${person.position} (${person.url})`).join('\n')}`
      : `LinkedIn connections at ${job.company}: none (checked ${loadConnections().length} connections)`,
    `Facts about ${config.name}: ${[config.cvData, ...profileDocs()].filter(Boolean).join(', ')}`,
    `Write the pack to: ${packPath(job.ref)}`,
    `Then file it: ${cli(`pack ${job.ref}`, { send: true })}`,
    '',
    '--- POSTING ---',
    clip(job.description, 12000),
  ].join('\n'))
}

// The cover letter PDF and the CV the pack chose, as Telegram attachments. Each rendered letter is kept as a version.
const attachments = (job, markdown) => {
  const cvFile = chosenCv(markdown) ?? cvFor(job.lane).file
  const cvPath = join(config.cv.distDir, cvFile)
  const letter = extractLetter(markdown)
  const saved = letter ? recordVersion(letterVersionsDir(job.ref), letter) : null
  return {
    letter,
    saved,
    lines: [
      letter ? `MEDIA:${buildLetterPdf({ job, letter, cvFile })}` : '⚠️ No cover letter found in the pack, so no PDF.',
      existsSync(cvPath) ? `MEDIA:${cvPath}` : config.cv.publicUrl ? `CV: ${config.cv.publicUrl}/${cvFile}` : `⚠️ CV not found: ${cvPath}`,
    ],
  }
}

// Files the written pack into the vault note and prints the Telegram message, letter and CV attached.
const pack = (refOrKey) => {
  const store = openStore()
  const job = store.get(refOrKey)
  if (!job?.ref) throw new Error(`No digested role ${refOrKey}`)
  const markdown = readFileSync(packPath(job.ref), 'utf8')
  appendPack(job.note_path, markdown)
  store.setStage(job.key, 'prepared')
  updateRoleStage(job.note_path, 'prepared')
  return [
    `📝 #${job.ref} · ${job.title} — ${job.company}`,
    markdown.trim(),
    `Apply: ${job.url}`,
    `Reply "applied ${job.ref}" once it's sent.`,
    revisionHint(job.ref),
    ...attachments(job, markdown).lines,
  ].join('\n\n')
}

// Rebuilds the letter PDF from the pack after an edit, or puts an earlier version back (`letter 17 v1`).
const letter = (refOrKey, versionArg) => {
  const job = openStore().get(refOrKey)
  if (!job?.ref) throw new Error(`No digested role ${refOrKey}`)
  let markdown = readFileSync(packPath(job.ref), 'utf8')
  const restore = versionArg ? Number(String(versionArg).replace(/^v/i, '')) : null
  if (restore) {
    const earlier = readVersion(letterVersionsDir(job.ref), restore)
    if (!earlier) throw new Error(`No cover letter v${restore} for #${job.ref}`)
    markdown = replaceLetter(markdown, earlier)
    writeFileSync(packPath(job.ref), markdown)
  }
  replacePack(job.note_path, markdown)
  const { letter: current, saved, lines } = attachments(job, markdown)
  const others = saved?.versions.filter((version) => version !== saved.version) ?? []
  return [
    `📎 #${job.ref} · ${job.title} — ${job.company}: cover letter${saved ? ` v${saved.version}` : ''} and CV`,
    current && letterMarkdown(current),
    others.length && `Earlier versions are kept (${others.map((version) => `v${version}`).join(', ')}). Reply "letter ${job.ref} v${others.at(-1)}" to go back.`,
    revisionHint(job.ref),
    ...lines,
  ].filter(Boolean).join('\n\n')
}

const recruiterList = () => {
  for (const person of recruiters()) {
    console.log(`${person.name} | ${person.position} | ${person.company} | connected ${person.connectedOn} | ${person.url}`)
  }
}

// Checks a company's public job board before it goes into companies.json: `check ashby linear`, or every company with `check --all`.
const check = async (atsName, slug) => {
  const companies = atsName && atsName !== '--all'
    ? [{ name: slug, ats: atsName, slug }]
    : JSON.parse(readFileSync(config.companies, 'utf8')).filter((company) => company.enabled !== false)
  const lines = []
  for (const company of companies) {
    if (!ats[company.ats]) {
      lines.push(`✗ ${company.name}: unknown ATS "${company.ats}" (known: ${Object.keys(ats).join(', ')})`)
      continue
    }
    try {
      const jobs = await ats[company.ats](company)
      const fits = jobs.filter((job) => classify({ ...job, source: company.ats, description: job.description ?? '' }).keep)
      lines.push(`✓ ${company.ats}:${company.slug}: ${jobs.length} open roles, ${fits.length} pass this profile's filters${fits.length ? ` (${fits.slice(0, 3).map((job) => job.title).join('; ')})` : ''}`)
    } catch (error) {
      lines.push(`✗ ${company.ats}:${company.slug}: ${error.message}`)
    }
  }
  return lines.join('\n')
}

const usage = `Usage: scout.mjs [--profile <name|path>] <command> [--send]
  run [--dry [--why] [--cached]]   fetch, filter, store; print candidates for the scoring agent
  daily --agent <claude|codex> [--model <m>]  run, let the agent score, record: one command for cron
  record <scores.json>             store scores, write notes, print the digest
  mark <ref> <stage> [comment]     ${Object.keys(stages).join(' | ')}
  show <ref|key> | latest | stats
  prepare <ref> | pack <ref> | letter <ref> [v<n>]
  check <ats> <slug> | check --all  test a company's public job board
  recruiters
--send delivers record/pack/letter/daily output through the profile's "delivery" adapter.`

const stats = () => console.log(JSON.stringify(openStore().stats(), null, 2))

// Flags that apply to every command: --profile <name|path> (read by config.mjs) and --send.
const argv = process.argv.slice(2)
const profileAt = argv.indexOf('--profile')
if (profileAt !== -1) argv.splice(profileAt, 2)
const send = argv.includes('--send')
const [command, ...args] = argv.filter((arg) => arg !== '--send')
const flag = (name) => args.includes(name)
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const positional = args.filter((arg, index) => !arg.startsWith('--') && !['--agent', '--model'].includes(args[index - 1]))

const commands = {
  run: () => run({ dry: flag('--dry'), why: flag('--why'), cached: flag('--cached') }),
  daily: () => daily(option('--agent'), option('--model')),
  record: () => record(positional[0]),
  mark: () => mark(positional[0], positional[1], positional.slice(2).join(' ')),
  show: () => show(positional[0]),
  latest,
  prepare: () => prepare(positional[0]),
  pack: () => pack(positional[0]),
  letter: () => letter(positional[0], positional[1]),
  check: () => check(positional[0], positional[1]),
  recruiters: recruiterList,
  stats,
  usage: () => usage,
}

if (!commands[command]) {
  console.error(usage)
  process.exit(1)
}
// Commands that return a message print it. Digests and packs can also go out through the profile's adapter (--send).
const message = await commands[command]()
if (typeof message === 'string' && message) {
  console.log(message)
  if (send && ['record', 'pack', 'letter', 'daily'].includes(command)) await deliver(message)
}
