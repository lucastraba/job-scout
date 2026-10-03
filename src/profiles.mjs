import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Profiles are folders with a profile.json, by default in ~/.config/job-scout.
export const profilesRoot = process.env.JOB_SCOUT_PROFILES ?? join(homedir(), '.config/job-scout')

export const listProfiles = (root = profilesRoot) =>
  existsSync(root)
    ? readdirSync(root).filter((name) => statSync(join(root, name)).isDirectory() && existsSync(join(root, name, 'profile.json')))
    : []
