import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ats } from './ats.mjs'
import { boards } from './boards.mjs'
import { fetchHn } from './hn.mjs'

const readList = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [])

// Every source becomes { name, run }, where run() resolves to normalized jobs tagged with their source.
// Companies come from the person's profile. The boards in sources/boards.json are shared defaults; a profile's
// `boards` section changes their options per id ({ "jobicy": { "url": "..." } }), turns one on or off
// ({ "getonbrd": { "enabled": true } }), and `"hn": { "enabled": false }` drops Hacker News.
export const loadSources = (dir, companiesFile, overrides = {}) => {
  const companies = readList(companiesFile)
    .filter((company) => ats[company.ats] && company.enabled !== false)
    .map((company) => ({ name: `${company.ats}:${company.slug}`, run: () => ats[company.ats](company), source: company.ats }))
  const feeds = readList(join(dir, 'boards.json'))
    .map((board) => ({ ...board, ...overrides[board.id] }))
    .filter((board) => board.verified && board.enabled !== false && boards[board.id])
    .map((board) => ({ name: board.id, run: () => boards[board.id](board), source: board.id }))
  const hn = overrides.hn?.enabled === false ? [] : [{ name: 'hn', run: fetchHn, source: 'hn' }]
  return [...hn, ...companies, ...feeds]
}
