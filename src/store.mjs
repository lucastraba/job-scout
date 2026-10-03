import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from '../config.mjs'

// Stages a role moves through; the vault note shows the label.
export const stages = {
  new: '🆕 Unscreened',
  screened: '🗂️ Screened',
  digested: '🆕 New',
  liked: '👍 Shortlisted',
  prepared: '📝 Pack ready',
  applied: '📨 Applied',
  interviewing: '💬 Interviewing',
  offer: '🎉 Offer',
  rejected: '🚫 Rejected',
  passed: '⏭️ Passed',
  closed: '🔒 Closed',
  duplicate: '♊ Duplicate',
}

const schema = `
  create table if not exists jobs (
    key text primary key,
    ref integer unique,
    source text not null,
    company text not null,
    title text not null,
    location text,
    region text,
    flags text,
    url text,
    posted_at text,
    description text,
    salary text,
    dedupe_key text not null,
    prescore integer not null default 0,
    stage text not null default 'new',
    score integer,
    lane text,
    why text,
    gaps text,
    note_path text,
    first_seen text not null,
    last_seen text not null
  );
  create index if not exists jobs_dedupe on jobs (dedupe_key);
  create index if not exists jobs_stage on jobs (stage);
  create table if not exists runs (
    at text primary key,
    sources integer, failed text, fetched integer, kept integer, inserted integer
  );
  create table if not exists log (
    at text not null, key text not null, event text not null
  );
`

export const openStore = (dir = config.stateDir) => {
  mkdirSync(join(dir, 'scores'), { recursive: true })
  const db = new DatabaseSync(join(dir, 'scout.db'))
  db.exec(schema)

  const insertJob = db.prepare(`
    insert into jobs (key, source, company, title, location, region, flags, url, posted_at, description, salary,
                      dedupe_key, prescore, first_seen, last_seen)
    values (:key, :source, :company, :title, :location, :region, :flags, :url, :postedAt, :description, :salary,
            :dedupeKey, :prescore, :now, :now)
    on conflict (key) do update set last_seen = :now, description = :description, location = :location`)
  const findByKey = db.prepare('select * from jobs where key = ?')
  const findDuplicate = db.prepare('select key from jobs where dedupe_key = ? and key != ? limit 1')
  const addLog = db.prepare('insert into log (at, key, event) values (?, ?, ?)')

  const now = () => new Date().toISOString()

  return {
    db,

    // Inserts unseen jobs; returns how many were new. Cross-source duplicates are skipped.
    upsert: (jobs) => {
      const at = now()
      let inserted = 0
      for (const job of jobs) {
        const existing = findByKey.get(job.key)
        if (!existing && findDuplicate.get(job.dedupeKey, job.key)) continue
        insertJob.run({
          key: job.key, source: job.source, company: job.company, title: job.title, location: job.location,
          region: job.region, flags: job.flags.join(','), url: job.url, postedAt: job.postedAt,
          description: job.description, salary: job.salary, dedupeKey: job.dedupeKey, prescore: job.prescore, now: at,
        })
        if (!existing) inserted++
      }
      return inserted
    },

    recordRun: (run) =>
      db.prepare('insert into runs (at, sources, failed, fetched, kept, inserted) values (?, ?, ?, ?, ?, ?)')
        .run(now(), run.sources, run.failed.join(', '), run.fetched, run.kept, run.inserted),

    unscreened: (limit) =>
      db.prepare(`select * from jobs where stage = 'new' order by prescore desc, first_seen asc limit ?`).all(limit),

    countUnscreened: () => db.prepare(`select count(*) as n from jobs where stage = 'new'`).get().n,

    get: (keyOrRef) =>
      /^\d+$/.test(String(keyOrRef))
        ? db.prepare('select * from jobs where ref = ?').get(Number(keyOrRef))
        : findByKey.get(String(keyOrRef)),

    // `role` and `where` let the scorer replace messy titles and locations (Hacker News headers).
    saveScore: ({ key, score, lane, why, gaps, role, where }) =>
      db.prepare(`update jobs set score = ?, lane = ?, why = ?, gaps = ?, title = coalesce(?, title),
                  location = coalesce(?, location), stage = 'screened' where key = ? and stage = 'new'`)
        .run(score, lane ?? null, why ?? null, gaps ?? null, role || null, where || null, key),

    // Gives the job a permanent short number the person can reply with ("👍 17").
    promote: (key, notePath) => {
      const { next } = db.prepare('select coalesce(max(ref), 0) + 1 as next from jobs').get()
      db.prepare(`update jobs set ref = ?, stage = 'digested', note_path = ? where key = ?`).run(next, notePath, key)
      addLog.run(now(), key, 'digested')
      return next
    },

    // Screened roles at or above the digest threshold that haven't been shown yet, best first.
    queued: (minScore) =>
      db.prepare(`select * from jobs where stage = 'screened' and score >= ?
                  order by score desc, prescore desc, first_seen desc`).all(minScore),

    // Roles from the most recent digest: everything promoted within 10 minutes of the last promotion.
    latestDigest: () =>
      db.prepare(`select j.* from jobs j join log l on l.key = j.key and l.event = 'digested'
                  where l.at >= strftime('%Y-%m-%dT%H:%M:%fZ', (select max(at) from log where event = 'digested'), '-10 minutes')
                  order by j.ref`).all(),

    shown: () => db.prepare('select * from jobs where ref is not null').all(),

    setNotePath: (key, notePath) => db.prepare('update jobs set note_path = ? where key = ?').run(notePath, key),

    setStage: (key, stage) => {
      db.prepare('update jobs set stage = ? where key = ?').run(stage, key)
      addLog.run(now(), key, stage)
    },

    stats: () => ({
      byStage: db.prepare('select stage, count(*) as n from jobs group by stage order by n desc').all(),
      lastRuns: db.prepare('select * from runs order by at desc limit 5').all(),
    }),
  }
}
