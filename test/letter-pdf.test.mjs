import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findBrowser, letterHtml } from '../src/letter-pdf.mjs'

test('escapes the letter text and drops markdown emphasis', () => {
  const html = letterHtml({
    name: 'Jane Doe', headline: '', contact: ['jane@example.com'], company: 'A&B', role: 'Lead <UI>',
    greeting: 'Hello team,', paragraphs: ['I **built** it.'], date: '3 October 2026',
  })
  assert.match(html, /A&amp;B/)
  assert.match(html, /Lead &lt;UI&gt;/)
  assert.match(html, /<p>I built it\.<\/p>/)
  assert.doesNotMatch(html, /class="headline"/)
})

test('uses a configured browser path only if it exists', () => {
  assert.equal(findBrowser('/nonexistent/chrome'), null)
})
