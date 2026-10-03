import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config } from '../config.mjs'

const escapeHtml = (text) => String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const plain = (text) => escapeHtml(String(text ?? '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1'))

// A plain A4 letter with system fonts, so it needs nothing but a browser to print.
export const letterHtml = ({ name, headline, contact, company, role, greeting, paragraphs, date }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(name)} — Cover letter</title>
<style>
@page{size:A4;margin:18mm 22mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:10.5pt;line-height:1.6;color:#1d2125}
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;padding-bottom:3mm;border-bottom:1.2pt solid #1d2125}
h1{font-family:Georgia,"Times New Roman",serif;font-weight:600;font-size:23pt;line-height:1}
.headline{margin-top:2mm;font-size:9.6pt;color:#555}
.contact{list-style:none;text-align:right;font-size:8.2pt;color:#555;line-height:1.55}
.meta{display:flex;justify-content:space-between;align-items:baseline;margin:11mm 0 8mm}
.company{font-weight:600}
.role,.date{color:#555}
.greeting,p{margin-bottom:4mm}
.sign{margin-top:8mm}
.sign .name{margin-top:1.5mm;font-family:Georgia,"Times New Roman",serif;font-weight:600;font-size:13pt}
</style></head><body>
<header class="top">
  <div><h1>${escapeHtml(name)}</h1>${headline ? `<div class="headline">${escapeHtml(headline)}</div>` : ''}</div>
  <ul class="contact">${contact.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
</header>
<div class="meta">
  <div><div class="company">${plain(company)}</div><div class="role">${plain(role)}</div></div>
  <div class="date">${escapeHtml(date)}</div>
</div>
<div class="greeting">${plain(greeting)}</div>
${paragraphs.map((paragraph) => `<p>${plain(paragraph)}</p>`).join('\n')}
<div class="sign"><div>Best regards,</div><div class="name">${escapeHtml(name)}</div></div>
</body></html>`

const browserNames = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome', 'microsoft-edge']
const browserPaths = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]

// CHROME_PATH or letters.chrome first, then the usual names on PATH, then the usual install locations.
export const findBrowser = (configured = config.letters.chrome) => {
  if (configured) return existsSync(configured) ? configured : null
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean)
  for (const name of browserNames) {
    for (const dir of dirs) if (existsSync(join(dir, name))) return join(dir, name)
  }
  return browserPaths.find((path) => existsSync(path)) ?? null
}

// Writes the letter as HTML next to the PDF path, then prints it to PDF with headless Chrome.
// Returns the PDF path, or the HTML path when no browser is available.
export const renderLetter = (letter, output) => {
  const htmlPath = output.replace(/\.pdf$/, '.html')
  rmSync(output, { force: true })
  writeFileSync(htmlPath, letterHtml({ name: config.name, headline: config.headline, contact: config.contact, ...letter }))
  const browser = findBrowser()
  if (!browser) return htmlPath
  // A snap-packaged Chromium (Ubuntu's default) can't read or write /tmp or hidden folders, so it prints
  // inside a short-lived visible folder in the home directory.
  const scratch = browser.startsWith('/snap/') ? mkdtempSync(join(homedir(), 'job-scout-print-')) : null
  const source = scratch ? join(scratch, 'letter.html') : htmlPath
  const target = scratch ? join(scratch, 'letter.pdf') : output
  try {
    if (scratch) copyFileSync(htmlPath, source)
    execFileSync(browser, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${target}`, pathToFileURL(source).href], { stdio: 'pipe', timeout: 60_000 })
    if (scratch && existsSync(target)) copyFileSync(target, output)
  } finally {
    if (scratch) rmSync(scratch, { recursive: true, force: true })
  }
  return existsSync(output) ? output : htmlPath
}
