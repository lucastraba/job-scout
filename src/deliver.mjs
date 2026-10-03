import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { config } from '../config.mjs'

// Messages use Hermes' convention for attachments: a line `MEDIA:<path>`. Everything else is text.
export const splitMessage = (output) => {
  const lines = output.split('\n')
  const files = lines.filter((line) => line.startsWith('MEDIA:')).map((line) => line.slice(6).trim())
  const text = lines.filter((line) => !line.startsWith('MEDIA:')).join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return { text, files }
}

// Telegram caps a message at 4096 characters; split at paragraph breaks.
export const chunks = (text, limit = 4000) => {
  const parts = []
  let current = ''
  for (const paragraph of text.split('\n\n')) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph
    if (next.length <= limit) current = next
    else {
      if (current) parts.push(current)
      current = paragraph.length <= limit ? paragraph : paragraph.slice(0, limit)
    }
  }
  if (current) parts.push(current)
  return parts
}

const telegram = async ({ tokenEnv = 'JOB_SCOUT_TELEGRAM_TOKEN', chatId, threadId }, { text, files }) => {
  const token = process.env[tokenEnv]
  if (!token) throw new Error(`Telegram delivery needs the bot token in $${tokenEnv}`)
  const call = async (method, body) => {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body })
    const result = await response.json()
    if (!result.ok) throw new Error(`Telegram ${method}: ${result.description}`)
  }
  const base = { chat_id: String(chatId), ...(threadId ? { message_thread_id: String(threadId) } : {}) }
  for (const part of chunks(text)) {
    await call('sendMessage', new URLSearchParams({ ...base, text: part, link_preview_options: JSON.stringify({ is_disabled: true }) }))
  }
  for (const file of files) {
    const form = new FormData()
    for (const [key, value] of Object.entries(base)) form.append(key, value)
    form.append('document', new Blob([readFileSync(file)]), basename(file))
    await call('sendDocument', form)
  }
}

const adapters = { telegram }

// Sends a command's output through the profile's `delivery` adapter, e.g. { "telegram": { "chatId": "123" } }.
export const deliver = async (output, delivery = config.delivery) => {
  if (!delivery) throw new Error('--send needs a "delivery" section in profile.json')
  for (const [name, options] of Object.entries(delivery)) {
    if (!adapters[name]) throw new Error(`Unknown delivery "${name}". Known: ${Object.keys(adapters).join(', ')}`)
    await adapters[name](options, splitMessage(output))
  }
}
