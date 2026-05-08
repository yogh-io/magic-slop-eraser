/**
 * Copies the canonical slopmop SKILL.md into public/slopmop.md so agents can
 * fetch it at /slopmop.md after build. The URL artifact carries the project
 * identity; the local install path inside Claude Code stays SKILL.md (the
 * convention the loader expects). The HTML page at /skill imports the same
 * file via ?raw for the human-facing render.
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = resolve(__dirname, '../.claude/skills/slopmop/SKILL.md')
const destDir = resolve(__dirname, '../public')
const dest = resolve(destDir, 'slopmop.md')

mkdirSync(destDir, { recursive: true })
copyFileSync(src, dest)
console.log(`copy-skill: copied SKILL.md to ${dest}`)
