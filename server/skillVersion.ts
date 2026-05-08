import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILL_PATH = resolve(__dirname, '../.claude/skills/eraser/SKILL.md')

/**
 * Parse the eraser skill's frontmatter and return its declared version.
 * The version is the source of truth for the canonical SKILL.md version
 * the server vouches for.
 *
 * Read once at import time. To bump, edit SKILL.md and restart the server.
 */
function readSkillVersion(): string {
  try {
    const raw = readFileSync(SKILL_PATH, 'utf8')
    const fm = parseFrontmatter(raw)
    const v = fm.skillVersion
    if (typeof v === 'string' && v.length > 0) return v
  } catch {
    // SKILL.md missing in some deploy contexts (server-only image). Fall through.
  }
  return 'unknown'
}

function parseFrontmatter(raw: string): Record<string, string> {
  if (!raw.startsWith('---\n')) return {}
  const end = raw.indexOf('\n---', 4)
  if (end === -1) return {}
  const block = raw.slice(4, end)
  const out: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const val = line.slice(colon + 1).trim()
    if (key) out[key] = val
  }
  return out
}

export const SKILL_VERSION = readSkillVersion()
