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

  workingnomads: async ({ url }) => {
    const jobs = await getJson(url ?? 'https://www.workingnomads.com/api/exposed_jobs/')
    return jobs
      .filter((job) => /develop|engineer|programm/i.test(job.category_name ?? ''))
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
}
