/**
 * Copies the canonical eraser SKILL.md into public/skill.md so agents can
 * fetch it at /skill.md after build. The HTML page at /skill imports the
 * same file via ?raw for the human-facing render, but the public copy keeps
 * the raw text available for `curl` / WebFetch installs without touching
 * the SPA.
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = resolve(__dirname, '../.claude/skills/eraser/SKILL.md')
const destDir = resolve(__dirname, '../public')
const dest = resolve(destDir, 'skill.md')

mkdirSync(destDir, { recursive: true })
copyFileSync(src, dest)
console.log(`copy-skill: copied SKILL.md to ${dest}`)
