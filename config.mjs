import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { listProfiles, profilesRoot } from './src/profiles.mjs'

// Everything about the person lives in their profile folder (profile.json, about.md, application.md,
// companies.json). This file only finds it and fills in defaults; src/ only holds logic.

const expand = (path) => (path?.startsWith('~/') ? join(homedir(), path.slice(2)) : path)

const profileArg = () => {
  const at = process.argv.indexOf('--profile')
  return at === -1 ? process.env.JOB_SCOUT_PROFILE : process.argv[at + 1]
}

// `--profile jane` (or JOB_SCOUT_PROFILE) names a folder in ~/.config/job-scout; a value with a slash is a path.
// With no name and exactly one profile there, that one is used.
const findProfile = () => {
  const requested = profileArg()
  if (requested) {
    const dir = requested.includes('/') ? resolve(requested) : join(profilesRoot, requested)
    if (!existsSync(join(dir, 'profile.json'))) throw new Error(`No profile.json in ${dir}`)
    return dir
  }
  const found = listProfiles()
  if (found.length === 1) return join(profilesRoot, found[0])
  throw new Error(found.length
    ? `Several profiles in ${profilesRoot} (${found.join(', ')}): pass --profile <name>.`
    : `No profile found in ${profilesRoot}. Start one with \`job-scout init <name>\`, then follow \`job-scout guide setup\`.`)
}

const profileDir = findProfile()
const profile = JSON.parse(readFileSync(join(profileDir, 'profile.json'), 'utf8'))

// Patterns are stored as strings and always match case-insensitively.
const pattern = (source, flags = 'i') => new RegExp(source, flags)
const patterns = (sources = []) => sources.map((source) => pattern(source))
const slug = (text) => text.normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')

const stateDir = expand(profile.stateDir) ?? join(homedir(), '.local/state/job-scout', slug(profile.name).toLowerCase())
const notesDir = expand(profile.notes?.dir) ?? join(stateDir, 'notes')

export const config = {
  profileDir,
  name: profile.name,
  fileStem: slug(profile.name),
  stateDir,
  notesDir,
  notesLinkPrefix: profile.notes?.linkPrefix ?? '',
  // Extra frontmatter for role notes, e.g. { "Project": "\"[[Job Search]]\"" }; {date} becomes today's date.
  notesFrontmatter: profile.notes?.frontmatter ?? {},
  // Where the person answers the digest, shown in each note: "in the 🧭 Job Search topic", "to your agent".
  replyWhere: profile.notes?.replyWhere ?? 'to your agent',

  // Shown on the built-in cover letter: a line under the name and contact lines on the right.
  headline: profile.headline ?? '',
  contact: profile.contact ?? [],

  // Optional push delivery for digests and packs (`--send`). Hermes users leave it out; Hermes delivers.
  delivery: profile.delivery ?? null,
  companies: join(profileDir, 'companies.json'),
  boards: profile.boards ?? {},
  cvData: expand(profile.cv?.data),

  // The CV variant each lane gets, by file name without .pdf.
  cv: {
    distDir: expand(profile.cv?.distDir) ?? join(profileDir, 'cvs'),
    publicUrl: profile.cv?.publicUrl ?? null,
    variants: profile.cv?.variants ?? {},
    byLane: profile.cv?.byLane ?? {},
    defaultVariant: profile.cv?.defaultVariant,
  },

  letters: {
    // A custom renderer: `node <builder> <letter.json> <out.pdf>`. Without one, the built-in template prints via Chrome.
    builder: expand(profile.letters?.builder),
    chrome: expand(profile.letters?.chrome ?? process.env.CHROME_PATH),
    cwd: expand(profile.letters?.cwd),
    outDir: join(notesDir, 'Letters'),
  },

  lanes: profile.lanes ?? ['other'],

  recruiterPattern: pattern(profile.recruiterPattern ?? 'recruit|talent|headhunt|\\bsourcer\\b|acquisition|selecci[oó]n'),

  fetch: {
    concurrency: 6,
    timeoutMs: 20_000,
    userAgent: 'Mozilla/5.0 (compatible; job-search-scout/0.1)',
  },

  screen: {
    maxPerRun: 60, // candidates handed to the scoring agent per run; the rest wait for the next run
    snippetChars: 600,
    maxAgeDays: 45, // board postings older than this are ignored when the source gives a date
    // A role still listed on the company's own job board is open, however old the posting.
    freshnessExempt: ['greenhouse', 'lever', 'ashby', 'personio', 'workable', 'recruitee', 'smartrecruiters'],
    ...profile.screen,
  },

  digest: { max: 8, minScore: 7, ...profile.digest },

  title: {
    include: patterns(profile.title?.include),
    // Generic titles pass only when the description shows the person's kind of work.
    generic: patterns(profile.title?.generic),
    exclude: patterns(profile.title?.exclude),
    // Dropped unless the title also matches `focus` ("Frontend Infrastructure Engineer" stays).
    excludeUnlessFocus: patterns(profile.title?.excludeUnlessFocus),
    focus: pattern(profile.title?.focus ?? '(?!)'),
  },

  descriptionSignals: pattern(profile.descriptionSignals ?? '(?!)'),

  // true: non-remote roles are dropped unless their location matches region.onsite (cities they'd commute to).
  remoteOnly: profile.remoteOnly ?? true,

  region: {
    name: profile.region?.name ?? 'region',
    remote: pattern(profile.region?.remote ?? 'remote|anywhere|distributed|work from home|\\bwfh\\b|fully remote'),
    wide: pattern(profile.region?.wide ?? '(?!)'),
    country: pattern(profile.region?.country ?? '(?!)'),
    // Body text that rules a job out even when its location field just says "Remote".
    outsideText: pattern(profile.region?.outsideText ?? '(?!)'),
    outside: pattern(profile.region?.outside ?? '(?!)'),
    onsite: pattern(profile.region?.onsite ?? '(?!)'),
  },

  // Languages the person doesn't speak: a posting written in one, or requiring it, is dropped.
  languages: (profile.languages?.excluded ?? []).map((language) => ({
    name: language.name,
    words: pattern(language.words, 'gi'),
    minDistinctWords: language.minDistinctWords ?? 8,
    required: pattern(language.required),
  })),

  // Tags shown to the scoring agent next to each candidate.
  flags: (profile.flags ?? []).map(([source, flag]) => [pattern(source), flag]),

  // Ordering only: decides which candidates reach the agent first when there are too many.
  prescore: (profile.prescore ?? []).map(([source, field, points]) => [pattern(source), field, points]),
}

export const profileFile = (name) => join(profileDir, name)
