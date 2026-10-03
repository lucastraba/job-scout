import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from '../config.mjs'
import { renderLetter } from './letter-pdf.mjs'

// The pack's sections start with a line that is only a bold label ("**Cover letter**", "**Form answers**").
const sectionHeading = /^\*\*[^*]+\*\*:?\s*$/

// Greeting and body paragraphs of the pack's cover letter; the signature line is dropped (the PDF adds its own).
export const extractLetter = (markdown) => {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => /^\*\*Cover letter/i.test(line.trim()))
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => sectionHeading.test(line.trim()))
  const blocks = rest
    .slice(0, end === -1 ? rest.length : end)
    .join('\n')
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
  if (blocks.length < 2) return null
  const [greeting, ...body] = blocks
  const signature = [config.name, config.name.split(' ')[0]].map((name) => name.toLowerCase())
  const last = body.at(-1)?.replace(/[,.]$/, '').toLowerCase()
  const signed = signature.includes(last) || /^(best|regards|kind regards|best regards|un saludo|saludos)$/.test(last)
  const paragraphs = signed ? body.slice(0, -1) : body
  return { greeting, paragraphs: paragraphs.filter((paragraph) => !/^(best|kind) regards,?$/i.test(paragraph)) }
}

// The letter as the pack writes it: greeting, paragraphs, signature, separated by blank lines.
export const letterMarkdown = ({ greeting, paragraphs }) => [greeting, ...paragraphs, config.name].join('\n\n')

// Swaps the pack's cover letter for another one and leaves the other sections alone.
export const replaceLetter = (markdown, letter) => {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => /^\*\*Cover letter/i.test(line.trim()))
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => sectionHeading.test(line.trim()))
  const after = end === -1 ? [] : rest.slice(end)
  return [...lines.slice(0, start + 1), '', letterMarkdown(letter), ...(after.length ? ['', ...after] : [])].join('\n')
}

const versionFile = (dir, version) => join(dir, `v${version}.json`)
const versionsIn = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).map((name) => Number(name.match(/^v(\d+)\.json$/)?.[1])).filter(Boolean).sort((a, b) => a - b)
    : []

// Every letter that gets rendered is kept as a numbered version, so a revision can be undone.
// A letter identical to an earlier version (a restore) keeps that version's number.
export const recordVersion = (dir, letter) => {
  mkdirSync(dir, { recursive: true })
  const text = JSON.stringify(letter)
  const versions = versionsIn(dir)
  const same = versions.find((version) => readFileSync(versionFile(dir, version), 'utf8') === text)
  if (same) return { version: same, versions }
  const version = (versions.at(-1) ?? 0) + 1
  writeFileSync(versionFile(dir, version), text)
  return { version, versions: [...versions, version] }
}

export const readVersion = (dir, version) =>
  existsSync(versionFile(dir, version)) ? JSON.parse(readFileSync(versionFile(dir, version), 'utf8')) : null

// The CV the pack chose ("**CV:** `Jane-Doe-CV-Leadership.pdf`"), if it names one of the profile's CVs.
export const chosenCv = (markdown) => {
  const file = markdown.match(/\*\*CV:?\*\*:?\s*`?([\w.-]+\.pdf)`?/i)?.[1]
  return file && Object.values(config.cv.byLane).some((name) => `${name}.pdf` === file) ? file : null
}

const variantOf = (cvFile) =>
  Object.entries(config.cv.variants).find(([, name]) => `${name}.pdf` === cvFile)?.[0] ?? config.cv.defaultVariant

const slug = (text) => text.split(' (')[0].normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')

export const buildLetterPdf = ({ job, letter, cvFile }) => {
  mkdirSync(config.letters.outDir, { recursive: true })
  const input = join(config.stateDir, 'packs', `${job.ref}.letter.json`)
  const output = join(config.letters.outDir, `${config.fileStem}-Cover-Letter-${slug(job.company)}.pdf`)
  writeFileSync(input, JSON.stringify({
    variant: variantOf(cvFile),
    company: job.company.split(' (')[0],
    role: job.title,
    ...letter,
  }))
  if (!config.letters.builder) {
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    return renderLetter({ company: job.company.split(' (')[0], role: job.title, date, ...letter }, output)
  }
  execFileSync(process.execPath, [config.letters.builder, input, output], { cwd: config.letters.cwd, stdio: 'pipe' })
  return output
}
