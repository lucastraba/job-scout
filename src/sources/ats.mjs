import { getJson, getText } from '../http.mjs'
import { decodeEntities, htmlToText } from '../text.mjs'

const joinLocations = (...locations) => [...new Set(locations.flat().filter(Boolean))].join(' · ')
const iso = (value) => (value ? new Date(value).toISOString() : null)

// One fetcher per applicant-tracking system. Each returns jobs in the shared shape:
// { key, source, company, title, location, remote (true | false | null), url, postedAt, description, salary }
export const ats = {
  greenhouse: async ({ name, slug }) => {
    const { jobs } = await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`)
    return jobs.map((job) => ({
      key: `greenhouse:${slug}:${job.id}`,
      company: name,
      title: job.title,
      location: joinLocations(job.location?.name, (job.offices ?? []).map((office) => office.location || office.name)),
      remote: null,
      url: job.absolute_url,
      postedAt: iso(job.first_published ?? job.updated_at),
      description: htmlToText(job.content),
      salary: null,
    }))
  },

  lever: async ({ name, slug, endpoint }) => {
    const host = endpoint?.includes('api.eu.lever.co') ? 'https://api.eu.lever.co' : 'https://api.lever.co'
    const jobs = await getJson(`${host}/v0/postings/${slug}?mode=json`)
    return jobs.map((job) => ({
      key: `lever:${slug}:${job.id}`,
      company: name,
      title: job.text,
      location: joinLocations(job.categories?.location, job.categories?.allLocations ?? []),
      remote: job.workplaceType === 'remote' ? true : ['onsite', 'hybrid'].includes(job.workplaceType) ? false : null,
      url: job.hostedUrl,
      postedAt: iso(job.createdAt),
      description: [
        job.descriptionPlain,
        ...(job.lists ?? []).map((list) => `${list.text}\n${htmlToText(list.content)}`),
        job.additionalPlain,
      ].filter(Boolean).join('\n'),
      salary: job.salaryRange
        ? `${job.salaryRange.min}–${job.salaryRange.max} ${job.salaryRange.currency} / ${job.salaryRange.interval}`
        : null,
    }))
  },

  ashby: async ({ name, slug }) => {
    const { jobs } = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`)
    return jobs
      .filter((job) => job.isListed !== false)
      .map((job) => ({
        key: `ashby:${slug}:${job.id}`,
        company: name,
        title: job.title,
        location: joinLocations(job.location, (job.secondaryLocations ?? []).map((secondary) => secondary.location)),
        remote: job.workplaceType ? job.workplaceType === 'Remote' : (job.isRemote ?? null),
        url: job.jobUrl,
        postedAt: iso(job.publishedAt),
        description: job.descriptionPlain ?? htmlToText(job.descriptionHtml),
        salary: job.compensation?.compensationTierSummary ?? null,
      }))
  },

  personio: async ({ name, slug, endpoint }) => {
    const base = endpoint?.replace(/\/xml.*$/, '') ?? `https://${slug}.jobs.personio.de`
    const xml = await getText(`${base}/xml?language=en`)
    const field = (block, tag) => decodeEntities(block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()
    return [...xml.matchAll(/<position>([\s\S]*?)<\/position>/g)].map(([, block]) => {
      const id = field(block, 'id')
      const offices = [field(block, 'office'), ...[...block.matchAll(/<additionalOffice>([\s\S]*?)<\/additionalOffice>/g)].map(([, office]) => office.trim())]
      return {
        key: `personio:${slug}:${id}`,
        company: name,
        title: field(block, 'name'),
        location: joinLocations(offices),
        remote: null,
        url: `${base}/job/${id}`,
        postedAt: iso(field(block, 'createdAt') || null),
        description: [...block.matchAll(/<jobDescription>([\s\S]*?)<\/jobDescription>/g)]
          .map(([, section]) => `${field(section, 'name')}\n${htmlToText(field(section, 'value'))}`)
          .join('\n'),
        salary: null,
      }
    })
  },

  workable: async ({ name, slug }) => {
    const { jobs } = await getJson(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`)
    return jobs.map((job) => ({
      key: `workable:${slug}:${job.shortcode}`,
      company: name,
      title: job.title,
      location: joinLocations((job.locations ?? []).map((place) => [place.city, place.country].filter(Boolean).join(', ')), job.country),
      remote: job.telecommuting ? true : null,
      url: job.url ?? job.shortlink,
      postedAt: iso(job.published_on ?? job.created_at),
      description: htmlToText(job.description),
      salary: null,
    }))
  },

  recruitee: async ({ name, slug }) => {
    const { offers } = await getJson(`https://${slug}.recruitee.com/api/offers/`)
    return offers.map((offer) => ({
      key: `recruitee:${slug}:${offer.id}`,
      company: name,
      title: offer.title,
      location: joinLocations(offer.location, (offer.locations ?? []).map((place) => place.name)),
      remote: offer.remote ? true : offer.on_site && !offer.hybrid ? false : null,
      url: offer.careers_url,
      postedAt: iso(offer.published_at ?? offer.created_at),
      description: htmlToText(`${offer.description ?? ''}\n${offer.requirements ?? ''}`),
      salary: offer.salary?.min ? `${offer.salary.min}–${offer.salary.max} ${offer.salary.currency} / ${offer.salary.period}` : null,
    }))
  },

  // Listing has no descriptions; hydrate() fetches one only for jobs that survive the title filter.
  smartrecruiters: async ({ name, slug }) => {
    const { content } = await getJson(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`)
    return content.map((job) => ({
      key: `smartrecruiters:${slug}:${job.id}`,
      company: name,
      title: job.name,
      location: joinLocations(job.location?.fullLocation, job.location?.country),
      remote: job.location?.remote ? true : null,
      url: `https://jobs.smartrecruiters.com/${slug}/${job.id}`,
      postedAt: iso(job.releasedDate),
      description: '',
      salary: null,
      hydrate: async () => {
        const detail = await getJson(job.ref)
        return Object.values(detail.jobAd?.sections ?? {}).map((section) => htmlToText(section.text)).join('\n')
      },
    }))
  },
}
