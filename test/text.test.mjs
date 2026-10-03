import assert from 'node:assert/strict'
import { test } from 'node:test'
import { htmlToText, normalizeKey } from '../src/text.mjs'

test('turns entity-escaped HTML into readable lines', () => {
  const escaped = '&lt;p&gt;We build &amp;amp; ship.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Vue 3&lt;/li&gt;&lt;li&gt;TypeScript&lt;/li&gt;&lt;/ul&gt;'
  assert.equal(htmlToText(escaped), 'We build & ship.\nVue 3\nTypeScript')
})

test('normalizes company names so the same job dedupes across boards', () => {
  assert.equal(normalizeKey('Storyblok GmbH'), normalizeKey('storyblok'))
  assert.equal(normalizeKey('Zürich Labs, Inc.'), 'zurich labs')
})

test('reads the scores array out of an agent reply, fenced or not', async () => {
  const { scoresFromReply } = await import('../src/agents.mjs')
  const scores = [{ key: 'ashby:x:1', score: 7, lane: 'other', why: 'w', gaps: '' }]
  assert.deepEqual(scoresFromReply(JSON.stringify(scores)), scores)
  assert.deepEqual(scoresFromReply(`Here you go:\n\`\`\`json\n${JSON.stringify(scores)}\n\`\`\``), scores)
  assert.equal(scoresFromReply('I could not score these.'), null)
  assert.equal(scoresFromReply('[{"key":"a"}]'), null)
})
