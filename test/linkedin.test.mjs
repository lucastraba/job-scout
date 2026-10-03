import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contactsAt, parseCsv } from '../src/linkedin.mjs'

test('parses quoted CSV fields with commas, quotes and line breaks', () => {
  const rows = parseCsv('Name,Note\n"Doe, Jane","Said ""hi""\nthen left"\nBob,ok\n')
  assert.deepEqual(rows, [{ Name: 'Doe, Jane', Note: 'Said "hi"\nthen left' }, { Name: 'Bob', Note: 'ok' }])
})

test('finds connections at a company despite suffixes and scout notes in the name', () => {
  const people = [
    { name: 'Ana', company: 'Storyblok GmbH' },
    { name: 'Ben', company: 'Sourcegraph' },
    { name: 'Cleo', company: 'GTR (Govia Thameslink Railway)' },
    { name: 'Dan', company: 'Ashby Construction Ltd' },
  ]
  assert.deepEqual(contactsAt('Storyblok', people).map((p) => p.name), ['Ana'])
  assert.deepEqual(contactsAt('Sourcegraph (Amp)', people).map((p) => p.name), ['Ben'])
  assert.deepEqual(contactsAt('Railway', people).map((p) => p.name), ['Cleo'])
})
