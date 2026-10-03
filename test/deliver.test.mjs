import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chunks, splitMessage } from '../src/deliver.mjs'

test('separates MEDIA attachment lines from the message text', () => {
  assert.deepEqual(splitMessage('📝 #2 pack\n\nBody.\n\nMEDIA:/tmp/letter.pdf\n\nMEDIA:/tmp/cv.pdf'), {
    text: '📝 #2 pack\n\nBody.',
    files: ['/tmp/letter.pdf', '/tmp/cv.pdf'],
  })
})

test('splits long messages at paragraph breaks under the limit', () => {
  const text = ['a'.repeat(30), 'b'.repeat(30), 'c'.repeat(30)].join('\n\n')
  assert.deepEqual(chunks(text, 70), [`${'a'.repeat(30)}\n\n${'b'.repeat(30)}`, 'c'.repeat(30)])
  assert.deepEqual(chunks('x'.repeat(10), 70), ['x'.repeat(10)])
})
