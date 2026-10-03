import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { chosenCv, extractLetter, readVersion, recordVersion, replaceLetter } from '../src/letter.mjs'

const pack = `**CV:** \`Jane-Doe-CV-Leadership.pdf\`

Leads with leadership.

**Cover letter**

Dear Colin,

First paragraph
wrapped over two lines.

Second paragraph.

Jane Doe

**Form answers**

- **Salary expectation:** €140,000`

test('pulls the greeting and paragraphs out of a pack, without the signature or later sections', () => {
  assert.deepEqual(extractLetter(pack), {
    greeting: 'Dear Colin,',
    paragraphs: ['First paragraph wrapped over two lines.', 'Second paragraph.'],
  })
})

test('returns nothing when the pack has no cover letter', () => {
  assert.equal(extractLetter('**CV:** `Jane-Doe-CV.pdf`'), null)
})

test('uses the CV the pack chose, but only if it is one we build', () => {
  assert.equal(chosenCv(pack), 'Jane-Doe-CV-Leadership.pdf')
  assert.equal(chosenCv('**CV:** `Some-Other.pdf`'), null)
})

test('swaps the cover letter and keeps the sections around it', () => {
  const revised = replaceLetter(pack, { greeting: 'Hello Checkly team,', paragraphs: ['Shorter.'] })
  assert.deepEqual(extractLetter(revised), { greeting: 'Hello Checkly team,', paragraphs: ['Shorter.'] })
  assert.match(revised, /^\*\*CV:\*\* `Jane-Doe-CV-Leadership.pdf`/)
  assert.match(revised, /\*\*Form answers\*\*\n\n- \*\*Salary expectation:\*\* €140,000$/)
})

test('numbers each new letter and reuses the number when an earlier one comes back', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'letters-')), '17.letters')
  const first = { greeting: 'Dear Colin,', paragraphs: ['One.'] }
  const second = { greeting: 'Dear Colin,', paragraphs: ['Two.'] }
  assert.deepEqual(recordVersion(dir, first), { version: 1, versions: [1] })
  assert.deepEqual(recordVersion(dir, first), { version: 1, versions: [1] })
  assert.deepEqual(recordVersion(dir, second), { version: 2, versions: [1, 2] })
  assert.deepEqual(recordVersion(dir, first), { version: 1, versions: [1, 2] })
  assert.deepEqual(readVersion(dir, 2), second)
  assert.equal(readVersion(dir, 3), null)
})
