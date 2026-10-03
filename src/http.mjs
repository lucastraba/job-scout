import { config } from '../config.mjs'

const request = async (url, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: { 'user-agent': config.fetch.userAgent, accept: 'application/json, application/xml, text/xml, */*', ...init.headers },
    signal: AbortSignal.timeout(config.fetch.timeoutMs),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response
}

export const getJson = async (url, init) => (await request(url, init)).json()
export const getText = async (url, init) => (await request(url, init)).text()

// Runs tasks with bounded concurrency; failures are collected, never thrown.
export const settleAll = async (tasks, concurrency = config.fetch.concurrency) => {
  const results = new Array(tasks.length)
  let next = 0
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++
      try {
        results[index] = { ok: true, value: await tasks[index]() }
      } catch (error) {
        results[index] = { ok: false, error }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
}
