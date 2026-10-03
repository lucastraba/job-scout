const named = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•', euro: '€', middot: '·',
}

export const decodeEntities = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
    return Number.isFinite(code) ? String.fromCodePoint(code) : match
  })

// Decode first: some boards (Greenhouse) ship entity-escaped HTML.
export const htmlToText = (html) =>
  decodeEntities(
    decodeEntities(String(html ?? ''))
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .replace(/<\s*\/?\s*(br|p|li|h\d|div|tr)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()

export const clip = (text, max) => (text && text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text ?? '')

export const normalizeKey = (text) =>
  String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(inc|gmbh|ltd|llc|ag|bv|sa|sl|co)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
