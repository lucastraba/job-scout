import { config } from '../config.mjs'

const anyMatch = (patterns, text) => patterns.some((pattern) => pattern.test(text))

const titleVerdict = (title, description, rules = config.title) => {
  if (anyMatch(rules.exclude, title)) return 'excluded title'
  if (!rules.focus.test(title) && anyMatch(rules.excludeUnlessFocus, title)) return 'excluded title'
  if (anyMatch(rules.include, title)) return null
  if (anyMatch(rules.generic, title) && config.descriptionSignals.test(description)) return null
  return 'off-target title'
}

// Cheap pre-check for sources that need a second request to get the description.
export const titleWorthHydrating = (title, rules = config.title) =>
  !anyMatch(rules.exclude, title) && (anyMatch(rules.include, title) || anyMatch(rules.generic, title))

// HN posts carry several roles in free text, so the role check runs on the whole post.
const hnVerdict = (job) =>
  config.descriptionSignals.test(job.description) || anyMatch(config.title.include, job.description)
    ? null
    : 'off-target post'

// wide: open to the person's whole region; country: one country in it; outside: somewhere they can't work.
export const regionOf = (location, rules = config.region) => {
  if (rules.wide.test(location)) return 'wide'
  if (rules.country.test(location)) return 'country'
  if (rules.outside.test(location)) return 'outside'
  return 'unknown'
}

const isRemote = (job) => {
  if (job.remote === false) return false
  if (job.remote === true) return true
  return config.region.remote.test(`${job.location} ${job.title}`)
}

const languageVerdict = (description, languages = config.languages) => {
  for (const language of languages) {
    const distinct = new Set((description.match(language.words) ?? []).map((word) => word.toLowerCase()))
    if (distinct.size >= language.minDistinctWords) return `posting in ${language.name}`
    if (language.required.test(description)) return `${language.name} required`
  }
  return null
}

const isStale = ({ source, postedAt }, now) => {
  if (!postedAt || config.screen.freshnessExempt.includes(source)) return false
  const age = (now - Date.parse(postedAt)) / 86_400_000
  return Number.isFinite(age) && age > config.screen.maxAgeDays
}

const flagsOf = (job) => {
  const text = `${job.title}\n${job.description}`
  return config.flags
    .filter(([pattern]) => pattern.test(text))
    .map(([, flag]) => flag)
}

// Returns why a job is dropped, or the region and flags the scoring agent should see.
export const classify = (job, now = Date.now()) => {
  const description = job.description ?? ''
  const titleProblem = job.source === 'hn' ? hnVerdict(job) : titleVerdict(job.title, description)
  if (titleProblem) return { keep: false, reason: titleProblem }
  if (isStale(job, now)) return { keep: false, reason: 'stale' }
  if (config.remoteOnly && !isRemote(job)) return { keep: false, reason: 'not remote' }
  const region = regionOf(job.location ?? '')
  const outside = `outside ${config.region.name}`
  if (region === 'outside') return { keep: false, reason: outside }
  if (region !== 'wide' && config.region.outsideText.test(description)) return { keep: false, reason: outside }
  const languageProblem = languageVerdict(description)
  if (languageProblem) return { keep: false, reason: languageProblem }
  return { keep: true, region, flags: flagsOf(job) }
}

export const prescore = (job) =>
  config.prescore.reduce(
    (total, [pattern, field, points]) => total + (pattern.test(job[field] ?? '') ? points : 0),
    0,
  )
