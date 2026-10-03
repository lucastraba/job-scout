// The agent CLIs `daily` can hand the scoring to. They only read and reply; the CLI saves their answer,
// so neither needs write access. `reply` is the file Codex writes its final message to.
export const scoringAgents = {
  claude: ({ prompt, model }) => ['claude', ['-p', prompt, '--allowedTools', 'Read', '--permission-mode', 'dontAsk', ...(model ? ['--model', model] : [])]],
  codex: ({ prompt, model, reply }) => ['codex', ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--output-last-message', reply, ...(model ? ['--model', model] : []), prompt]],
}

// The JSON array in an agent's reply, which may come wrapped in a code fence or a sentence.
export const scoresFromReply = (text) => {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end < start) return null
  try {
    const scores = JSON.parse(text.slice(start, end + 1))
    return Array.isArray(scores) && scores.every((entry) => entry?.key && Number.isFinite(entry.score)) ? scores : null
  } catch {
    return null
  }
}
