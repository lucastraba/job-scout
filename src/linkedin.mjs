import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { config } from '../config.mjs'
import { normalizeKey } from './text.mjs'

// Minimal RFC 4180 parser: quoted fields may hold commas, quotes ("") and newlines.
export const parseCsv = (text) => {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') field += text[++i]
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += char
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [header, ...body] = rows
  return body.filter((cells) => cells.some(Boolean)).map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ''])))
}

// Every export folder under <stateDir>/linkedin; the newest one wins.
const latestExport = () => {
  const root = join(config.stateDir, 'linkedin')
  if (!existsSync(root)) return null
  const dirs = readdirSync(root).map((name) => join(root, name)).filter((path) => statSync(path).isDirectory())
  return dirs.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ?? null
}

// Connections.csv starts with a "Notes:" preamble before the real header.
export const loadConnections = (dir = latestExport()) => {
  const path = dir && join(dir, 'Connections.csv')
  if (!path || !existsSync(path)) return []
  const text = readFileSync(path, 'utf8')
  return parseCsv(text.slice(text.indexOf('First Name,'))).map((row) => ({
    name: `${row['First Name']} ${row['Last Name']}`.replace(/\s+/g, ' ').trim(),
    url: row.URL,
    email: row['Email Address'] || null,
    company: row.Company,
    position: row.Position,
    connectedOn: row['Connected On'],
  }))
}

const sameCompany = (a, b) => {
  const left = normalizeKey(a)
  const right = normalizeKey(b)
  if (!left || !right) return false
  if (left === right) return true
  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left]
  return shorter.length >= 4 && new RegExp(`\\b${shorter}\\b`).test(longer)
}

// Company names in the scout carry notes like "Sourcegraph (Amp)"; match on the part before the parenthesis.
export const contactsAt = (company, connections = loadConnections()) => {
  const name = company.split(' (')[0]
  return connections.filter((person) => sameCompany(person.company, name))
}

export const recruiters = (connections = loadConnections()) =>
  connections.filter((person) => config.recruiterPattern.test(`${person.position} ${person.company}`))
