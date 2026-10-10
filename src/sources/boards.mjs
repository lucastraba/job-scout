import { getJson, getText } from '../http.mjs'
import { decodeEntities, htmlToText } from '../text.mjs'

const iso = (value) => (value ? new Date(value).toISOString() : null)
const rssField = (item, tag) => decodeEntities(item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()
const salaryRange = (min, max, currency, period) => (Number(min) > 0 ? `${min}–${max} ${currency ?? ''} / ${period ?? 'year'}`.replace('  ', ' ') : null)

// Remote job boards with public feeds, keyed by the `id` in sources/boards.json. Every job here is remote by definition,
// so `location` carries the board's region restriction ("Europe", "USA", "Anywhere in the World").
export const boards = {
  remotive: async ({ url }) => {
    const { jobs } = await getJson(url ?? 'https://remotive.com/api/remote-jobs?category=software-dev')
    return jobs.map((job) => ({
      key: `remotive:${job.id}`,
      company: job.company_name,
      title: job.title,
      location: job.candidate_required_location,
      remote: true,
      url: job.url,
      postedAt: iso(job.publication_date),
      description: htmlToText(job.description),
      salary: job.salary || null,
    }))
  },

  remoteok: async ({ url }) => {
    const [, ...jobs] = await getJson(url ?? 'https://remoteok.com/api')
    return jobs.map((job) => ({
      key: `remoteok:${job.id}`,
      company: job.company?.trim(),
      title: job.position,
      location: job.location || 'Worldwide',
      remote: true,
      url: job.url,
      postedAt: iso(job.date),
      description: htmlToText(job.description),
      salary: salaryRange(job.salary_min, job.salary_max, 'USD', 'year'),
    }))
  },

  // RSS titles look like "Company: Job title".
  weworkremotely: async ({ urls }) => {
    const feeds = urls ?? [
      'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
      'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
    ]
    const items = (await Promise.all(feeds.map(getText))).flatMap((xml) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => item))
    return items.map((item) => {
      const [company, ...title] = rssField(item, 'title').split(': ')
      const link = rssField(item, 'link')
      return {
        key: `weworkremotely:${rssField(item, 'guid') || link}`,
        company,
        title: title.join(': ') || company,
        location: [rssField(item, 'region'), rssField(item, 'country')].filter(Boolean).join(' · '),
        remote: true,
        url: link,
        postedAt: iso(rssField(item, 'pubDate')),
        description: htmlToText(rssField(item, 'description')),
        salary: null,
      }
    })
  },

  jobicy: async ({ url }) => {
    const { jobs = [] } = await getJson(url ?? 'https://jobicy.com/api/v2/remote-jobs?count=100&geo=europe&industry=dev')
    return jobs.map((job) => ({
      key: `jobicy:${job.id}`,
      company: job.companyName,
      title: decodeEntities(job.jobTitle),
      location: job.jobGeo,
      remote: true,
      url: job.url,
      postedAt: iso(job.pubDate),
      description: htmlToText(job.jobDescription),
      salary: salaryRange(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod),
    }))
  },

  // `categories` is a pattern over the board's category names ("Development", "Marketing", "Sales"...).
  workingnomads: async ({ url, categories = 'develop|engineer|programm' }) => {
    const jobs = await getJson(url ?? 'https://www.workingnomads.com/api/exposed_jobs/')
    return jobs
      .filter((job) => new RegExp(categories, 'i').test(job.category_name ?? ''))
      .map((job) => ({
        key: `workingnomads:${job.url}`,
        company: job.company_name,
        title: job.title,
        location: job.location,
        remote: true,
        url: job.url,
        postedAt: iso(job.pub_date),
        description: htmlToText(job.description),
        salary: null,
      }))
  },

  // Get on Board: Latin America, many postings in Spanish, and not only tech. Categories are ids from
  // https://www.getonbrd.com/api/v0/categories (programming, sales, digital-marketing, customer-support, hr...).
  getonbrd: async ({ categories = ['programming'], pages = 2 }) => {
    const requests = categories.flatMap((category) =>
      Array.from({ length: pages }, (_, page) =>
        getJson(`https://www.getonbrd.com/api/v0/categories/${category}/jobs?per_page=100&page=${page + 1}&expand=%5B%22company%22%5D`)))
    const jobs = (await Promise.all(requests)).flatMap(({ data = [] }) => data)
    const where = { fully_remote: 'Remote', remote_local: 'Remote, local only', hybrid: 'Hybrid', no_remote: 'On-site' }
    return jobs.map(({ id, attributes: job }) => ({
      key: `getonbrd:${id}`,
      company: job.company?.data?.attributes?.name ?? '',
      title: job.title,
      location: [where[job.remote_modality], ...(job.countries ?? [])].filter(Boolean).join(' · '),
      remote: job.remote_modality === 'fully_remote' || job.remote_modality === 'remote_local',
      url: `https://www.getonbrd.com/jobs/${id}`,
      postedAt: job.published_at ? new Date(job.published_at * 1000).toISOString() : null,
      description: htmlToText([job.description, job.functions, job.desirable, job.benefits].filter(Boolean).join('\n')),
      salary: job.min_salary ? `${job.min_salary}–${job.max_salary ?? job.min_salary} USD / month` : null,
    }))
  },

  // Himalayas: remote jobs in every field, searched by free text (https://himalayas.app/docs/remote-jobs-api).
  // Each query is one search ("revit", "autocad drafter"); `country` keeps jobs open to that country (a name or
  // ISO code). The API is rate limited and pages hold 20 jobs, so requests go one at a time.
  himalayas: async ({ queries = [], country, pages = 2 }) => {
    const jobs = new Map()
    for (const query of queries) {
      for (let page = 1; page <= pages; page++) {
        const params = new URLSearchParams({ q: query, sort: 'recent', page: String(page), ...(country && { country }) })
        const { jobs: found = [] } = await getJson(`https://himalayas.app/jobs/api/search?${params}`)
        for (const job of found) jobs.set(job.guid, job)
        if (!found.length) break
      }
    }
    return [...jobs.values()].map((job) => ({
      key: `himalayas:${job.guid}`,
      company: job.companyName,
      title: job.title,
      location: job.locationRestrictions?.length ? job.locationRestrictions.join(' · ') : 'Worldwide',
      remote: true,
      url: job.applicationLink ?? job.guid,
      postedAt: job.pubDate ? new Date(Number(job.pubDate) * 1000).toISOString() : null,
      description: htmlToText(job.description),
      salary: salaryRange(job.minSalary, job.maxSalary ?? job.minSalary, job.currency, job.salaryPeriod),
    }))
  },
}
