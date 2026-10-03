import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { config } from '../config.mjs'
import { stages } from './store.mjs'
import { clip } from './text.mjs'

const rolesDir = () => join(config.notesDir, 'Roles')
const today = () => new Date().toISOString().slice(0, 10)

// Obsidian forbids these in file names, and # [ ] | ^ break wikilinks.
const safeName = (text) => text.replace(/[\\/:*?"<>|#^[\]]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120)

const yamlString = (value) => JSON.stringify(String(value ?? ''))

const bullets = (text) =>
  String(text ?? '')
    .split(/\n|;\s*/)
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n') || '- —'

const extraFrontmatter = () =>
  Object.entries(config.notesFrontmatter).map(([key, value]) => `${key}: ${String(value).replaceAll('{date}', today())}\n`).join('')

export const roleNote = (job, ref) => `---
${extraFrontmatter()}Ref: ${ref}
Company: ${yamlString(job.company)}
Role: ${yamlString(job.title)}
Stage: ${yamlString(stages.digested)}
Score: ${job.score}
Lane: ${yamlString(job.lane)}
Location: ${yamlString(job.location)}
Region: ${job.region}
Salary: ${yamlString(job.salary ?? '')}
Source: ${job.url}
Found: ${today()}
Posted: ${job.posted_at ? job.posted_at.slice(0, 10) : ''}
---

# ${job.company} — ${job.title}

Reply \`👍 ${ref}\`, \`pass ${ref}\` or \`applied ${ref}\` ${config.replyWhere}.

## Why it fits
${bullets(job.why)}

## Gaps and questions
${bullets(job.gaps)}

## Posting (excerpt)
${clip(job.description, 2500)
  .split('\n')
  .map((line) => `> ${line}`)
  .join('\n')}

## Log
- ${today()} found by the scout (${job.source})
`

export const writeRoleNote = (job, ref) => {
  mkdirSync(rolesDir(), { recursive: true })
  const path = join(rolesDir(), `${safeName(`${job.company} — ${job.title}`)}.md`)
  const finalPath = existsSync(path) ? path.replace(/\.md$/, ` (${ref}).md`) : path
  writeFileSync(finalPath, roleNote(job, ref))
  return finalPath
}

export const updateRoleStage = (notePath, stage, comment) => {
  if (!notePath || !existsSync(notePath)) return false
  const text = readFileSync(notePath, 'utf8').replace(/^Stage: .*$/m, `Stage: ${yamlString(stages[stage])}`)
  writeFileSync(notePath, text)
  appendFileSync(notePath, `- ${today()} ${stages[stage]}${comment ? ` — ${comment}` : ''}\n`)
  return true
}

// The pack goes above the Log so the note reads top-down: fit, gaps, posting, pack, history.
export const appendPack = (notePath, markdown) => {
  if (!notePath || !existsSync(notePath)) return false
  const text = readFileSync(notePath, 'utf8')
  const section = `## Application pack (${today()})\n${markdown.trim()}\n\n`
  const at = text.lastIndexOf('\n## Log')
  writeFileSync(notePath, at === -1 ? `${text}\n${section}` : `${text.slice(0, at + 1)}${section}${text.slice(at + 1)}`)
  return true
}

// Replaces the newest pack section after a revision, so the note shows the letter that was sent.
export const replacePack = (notePath, markdown) => {
  if (!notePath || !existsSync(notePath)) return false
  const text = readFileSync(notePath, 'utf8')
  const start = text.lastIndexOf('\n## Application pack (')
  if (start === -1) return appendPack(notePath, markdown)
  const next = text.indexOf('\n## ', start + 1)
  const heading = text.slice(start + 1, text.indexOf('\n', start + 1))
  const section = `${heading}\n${markdown.trim()}\n\n`
  writeFileSync(notePath, `${text.slice(0, start + 1)}${section}${next === -1 ? '' : text.slice(next + 1)}`)
  return true
}

export const vaultLink = (notePath) => join(config.notesLinkPrefix, relative(config.notesDir, notePath))
