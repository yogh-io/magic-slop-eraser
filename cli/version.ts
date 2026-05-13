import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The version of the slopmop skill this CLI ships against. Sent as
 * `X-Skill-Version` on every API call so the server can flag staleness.
 *
 * Single source of truth: `.claude/skills/slopmop/SKILL.md`'s frontmatter
 * `skillVersion` field. Source mode reads it at startup; the bundler
 * (`scripts/build-cli.ts`) substitutes BUILD_VERSION_SENTINEL with the
 * resolved value at build time so the shipped binary stays self-contained
 * even when SKILL.md isn't sitting next to it on a user's machine.
 *
 * Never hand-edit a version here. Bump SKILL.md and everything else
 * follows.
 */
const BUILD_TIME_INJECTED = 'BUILD_VERSION_SENTINEL'

function readSkillMdVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  let dir = here
  for (let i = 0; i < 6; i++) {
    try {
      const raw = readFileSync(
        resolve(dir, '.claude/skills/slopmop/SKILL.md'),
        'utf8',
      )
      const m = raw.match(/^skillVersion:\s*(\S+)/m)
      if (m) return m[1]
    } catch {
      /* try parent */
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(
    'cli/version: cannot find .claude/skills/slopmop/SKILL.md - run the CLI from the repo or rebuild the bundle',
  )
}

export const SKILL_VERSION: string =
  BUILD_TIME_INJECTED === 'BUILD_VERSION_SENTINEL'
    ? readSkillMdVersion()
    : BUILD_TIME_INJECTED
