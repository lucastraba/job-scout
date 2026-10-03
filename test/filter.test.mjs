import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classify } from '../src/filter.mjs'

const now = Date.parse('2026-10-01T12:00:00Z')
const job = (overrides) => ({
  source: 'greenhouse',
  company: 'Acme',
  title: 'Staff Frontend Engineer',
  location: 'Remote, Europe',
  remote: null,
  postedAt: '2026-09-25T00:00:00Z',
  description: 'You will lead our Vue 3 and TypeScript platform.',
  ...overrides,
})
const verdict = (overrides) => classify(job(overrides), now)

test('keeps a senior remote-Europe frontend role and tags its stack', () => {
  assert.deepEqual(verdict({}), { keep: true, region: 'wide', flags: ['vue', 'typescript'] })
})

test('drops roles outside the frontend/platform/lead lanes', () => {
  assert.equal(verdict({ title: 'Senior Backend Engineer' }).reason, 'excluded title')
  assert.equal(verdict({ title: 'Account Executive, DACH' }).reason, 'excluded title')
  assert.equal(verdict({ title: 'Junior Frontend Developer' }).reason, 'excluded title')
  assert.equal(verdict({ title: 'Software Engineer II, Frontend' }).reason, 'excluded title')
})

test('keeps backend-sounding titles that are clearly frontend', () => {
  assert.equal(verdict({ title: 'Frontend Infrastructure Engineer' }).keep, true)
})

test('keeps generic engineer titles only when the posting shows frontend work', () => {
  assert.equal(verdict({ title: 'Senior Software Engineer' }).keep, true)
  assert.equal(
    verdict({ title: 'Senior Software Engineer', description: 'Build our billing services in Go.' }).reason,
    'off-target title',
  )
})

test('requires remote work open to someone living in the EU', () => {
  assert.equal(verdict({ location: 'Berlin, Germany' }).reason, 'not remote')
  assert.equal(verdict({ remote: false, location: 'Remote-friendly, Vienna' }).reason, 'not remote')
  assert.equal(verdict({ location: 'Remote - US' }).reason, 'outside EU')
  assert.equal(verdict({ location: 'Remote, U.S. · Remote' }).reason, 'outside EU')
  assert.equal(verdict({ location: 'Remote, UK' }).reason, 'outside EU')
  assert.equal(verdict({ location: 'Remote (US or EU)' }).keep, true)
  assert.equal(verdict({ location: 'Remote', description: 'Vue role. US-based candidates only.' }).reason, 'outside EU')
})

test('marks single-country remote roles so the scorer can weigh them', () => {
  assert.equal(verdict({ location: 'Remote, Spain' }).region, 'country')
  assert.equal(verdict({ location: 'Remote' }).region, 'unknown')
})

test('drops postings that need German, but not ones where it is a bonus', () => {
  const german = 'Wir suchen dich für unser Team und die Plattform. Du arbeitest mit uns an der Zukunft, ist das nicht spannend? Bei uns oder remote.'
  assert.equal(verdict({ description: german }).reason, 'posting in German')
  assert.equal(verdict({ description: 'Vue role. Fluent German is required.' }).reason, 'German required')
  assert.equal(verdict({ description: 'Vue role. German (C1) for customer calls.' }).reason, 'German required')
  assert.equal(verdict({ description: 'Vue role. Fluent German is a plus.' }).keep, true)
})

test('drops old board postings, but not roles still listed on a company job board', () => {
  assert.equal(verdict({ source: 'remoteok', postedAt: '2026-07-01T00:00:00Z' }).reason, 'stale')
  assert.equal(verdict({ source: 'greenhouse', postedAt: '2026-07-01T00:00:00Z' }).keep, true)
})

test('keeps AI adoption and enablement roles', () => {
  assert.equal(verdict({ title: 'AI Adoption Lead' }).keep, true)
  assert.equal(verdict({ title: 'Agentic Engineering Platform Engineer' }).keep, true)
  assert.equal(verdict({ title: 'AI Researcher' }).reason, 'excluded title')
})

test('judges Hacker News posts by their whole text', () => {
  const hn = { source: 'hn', title: 'Senior Engineers | REMOTE (EU)', location: 'Acme | Senior Engineers | REMOTE (EU)', remote: true }
  assert.equal(verdict({ ...hn, description: 'We use Vue and TypeScript.' }).keep, true)
  assert.equal(verdict({ ...hn, description: 'Kernel and storage engineers wanted.' }).reason, 'off-target post')
})
