import { getJson } from '../http.mjs'
import { clip, htmlToText } from '../text.mjs'

const algolia = 'https://hn.algolia.com/api/v1'

// Top-level comments on the latest "Ask HN: Who is hiring?" thread. The first line is "Company | Role | Location | …".
export const fetchHn = async () => {
  const search = await getJson(`${algolia}/search_by_date?tags=story,author_whoishiring&hitsPerPage=10`)
  const thread = search.hits.find((hit) => /who is hiring/i.test(hit.title))
  if (!thread) return []
  const item = await getJson(`${algolia}/items/${thread.objectID}`)
  return item.children
    .filter((comment) => comment.text && comment.author)
    .map((comment) => {
      const text = htmlToText(comment.text)
      const header = text.split('\n')[0]
      const [company, ...rest] = header
        .split('|')
        .map((part) => part.trim())
        .filter((part) => part && !/^(https?:\/\/|www\.)\S+$/i.test(part))
      return {
        key: `hn:${comment.id}`,
        source: 'hn',
        company: clip(company || comment.author, 80),
        title: clip(rest.join(' | ') || header, 160),
        location: header,
        remote: /remote/i.test(header) ? true : null,
        url: `https://news.ycombinator.com/item?id=${comment.id}`,
        postedAt: comment.created_at,
        description: text,
        salary: null,
      }
    })
}
