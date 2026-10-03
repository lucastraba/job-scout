#!/usr/bin/env node
// Entry point of the `job-scout` command. Commands that work before a profile exists run here;
// everything else goes to scout.mjs, which loads the profile.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listProfiles, profilesRoot } from './src/profiles.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const guidesDir = join(root, 'guides')
const [command, ...args] = process.argv.slice(2)

const guides = () => readdirSync(guidesDir).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -3))

// `guide <topic>` prints a runbook from the installed version, so skills never carry a stale copy.
const guide = (topic) => {
  if (!topic || !guides().includes(topic)) {
    console.log(`Guides: ${guides().join(', ')}. Run \`job-scout guide <topic>\`.`)
    if (topic) process.exitCode = 1
    return
  }
  console.log(readFileSync(join(guidesDir, `${topic}.md`), 'utf8'))
}

// `init <name>` copies the example profile to ~/.config/job-scout/<name> for the setup interview to fill in.
const init = (name) => {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name ?? '')) throw new Error('Usage: job-scout init <name>, a short lowercase name like "jane"')
  const dir = join(profilesRoot, name)
  if (existsSync(dir)) throw new Error(`${dir} already exists`)
  mkdirSync(profilesRoot, { recursive: true })
  cpSync(join(root, 'profiles', 'example'), dir, { recursive: true })
  const file = join(dir, 'profile.json')
  const profile = JSON.parse(readFileSync(file, 'utf8'))
  writeFileSync(file, `${JSON.stringify({ ...profile, stateDir: `~/.local/state/job-scout/${name}`, notes: { ...profile.notes, dir: `~/.local/state/job-scout/${name}/notes` } }, null, 2)}\n`)
  console.log([
    `Created ${dir} from the example profile (a fictional frontend lead in the EU).`,
    'Every file in it is a placeholder until the setup interview rewrites it: `job-scout guide setup`.',
  ].join('\n'))
}

// Agent skill folders: Claude Code reads ~/.claude/skills; Codex, Cursor and OpenCode read ~/.agents/skills.
const skillTargets = {
  claude: join(homedir(), '.claude', 'skills'),
  agents: join(homedir(), '.agents', 'skills'),
}

const installSkill = (which = 'all') => {
  const targets = which === 'all' ? Object.keys(skillTargets) : [which]
  for (const target of targets) {
    if (!skillTargets[target]) throw new Error(`Usage: job-scout install-skill [claude|agents|all]`)
    const dest = join(skillTargets[target], 'job-scout')
    cpSync(join(root, 'skills', 'job-scout'), dest, { recursive: true })
    console.log(`Installed the job-scout skill in ${dest}`)
  }
}

const local = {
  guide: () => guide(args[0]),
  init: () => init(args[0]),
  'install-skill': () => installSkill(args[0]),
  profiles: () => console.log(listProfiles().map((name) => join(profilesRoot, name)).join('\n') || `No profiles in ${profilesRoot}`),
}

try {
  if (local[command]) local[command]()
  else if (!command || command === 'help' || command === '--help') {
    console.log(`job-scout: a daily job scout your coding agent runs.

Before a profile exists:
  init <name>                        start a profile from the example
  guide [topic]                      print a runbook (${guides().join(', ')})
  install-skill [claude|agents|all]  copy the agent skill to ~/.claude/skills and/or ~/.agents/skills
  profiles                           list profiles

With a profile (add --profile <name> when there are several):
  run, record, mark, show, latest, stats, prepare, pack, letter, check, recruiters
  \`job-scout usage\` explains each one.`)
  } else await import('./scout.mjs')
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
