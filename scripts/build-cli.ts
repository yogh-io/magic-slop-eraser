/**
 * Bundle the slopmop CLI into a single Bun-runnable JS file at
 * dist/cli/slopmop.js, plus copy cli/install.sh into dist/cli/. Run after
 * vite-ssg build so the static dist/ tree exists.
 *
 * The bundle requires Bun at runtime (uses Bun-specific APIs and the
 * `#!/usr/bin/env bun` shebang). The install script bails clean if Bun
 * is missing.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

async function main(): Promise<void> {
  // SKILL.md is the single source of truth; cli/version.ts derives from it
  // (runtime read in source mode; sentinel substitution in the bundle).
  const skillVersion = readSkillVersion()

  // Bundle the CLI.
  const outDir = resolve(repoRoot, 'dist/cli')
  mkdirSync(outDir, { recursive: true })
  // Bun.build emits its own `#!/usr/bin/env bun` shebang automatically when
  // the entrypoint has one, so we don't pass `banner`. Don't double up.
  const result = await Bun.build({
    entrypoints: [resolve(repoRoot, 'cli/main.ts')],
    target: 'bun',
    outdir: outDir,
    naming: 'slopmop.js',
    format: 'esm',
    minify: false,
  })
  if (!result.success) {
    console.error('build-cli: bundle failed')
    for (const log of result.logs) console.error(log)
    process.exit(1)
  }
  // Bun.build doesn't chmod the output; do it ourselves so the file is
  // directly invocable when copied into ~/.local/bin.
  const bundlePath = resolve(outDir, 'slopmop.js')
  chmodSync(bundlePath, 0o755)

  // Bake the skill version into the bundle. cli/version.ts ships a sentinel
  // (`'BUILD_VERSION_SENTINEL'`) which we replace post-build so the shipped
  // CLI doesn't depend on SKILL.md being present on the user's machine.
  // Refuse to ship a bundle where the sentinel didn't appear - that would
  // mean the CLI silently falls back to a runtime SKILL.md lookup and fails
  // wherever the file is missing.
  const bundle = readFileSync(bundlePath, 'utf8')
  const sentinel = '"BUILD_VERSION_SENTINEL"'
  const altSentinel = "'BUILD_VERSION_SENTINEL'"
  let patched: string
  if (bundle.includes(sentinel)) {
    patched = bundle.replace(sentinel, JSON.stringify(skillVersion))
  } else if (bundle.includes(altSentinel)) {
    patched = bundle.replace(altSentinel, JSON.stringify(skillVersion))
  } else {
    console.error(
      'build-cli: BUILD_VERSION_SENTINEL not found in bundle - did cli/version.ts get refactored without updating this script?',
    )
    process.exit(1)
  }
  writeFileSync(bundlePath, patched, 'utf8')
  chmodSync(bundlePath, 0o755)

  // 3. Copy install.sh into dist/cli.
  copyFileSync(
    resolve(repoRoot, 'cli/install.sh'),
    resolve(outDir, 'install.sh'),
  )
  chmodSync(resolve(outDir, 'install.sh'), 0o755)

  // Stamp a manifest with the version so curl-then-extract flows can
  // sanity-check.
  writeFileSync(
    resolve(outDir, 'manifest.json'),
    JSON.stringify({ version: skillVersion, builtAt: new Date().toISOString() }, null, 2) + '\n',
    'utf8',
  )

  console.log(`build-cli: dist/cli/slopmop.js (v${skillVersion})`)
}

function readSkillVersion(): string {
  const path = resolve(repoRoot, '.claude/skills/slopmop/SKILL.md')
  const raw = readFileSync(path, 'utf8')
  const m = raw.match(/^skillVersion:\s*(\S+)/m)
  if (!m) {
    throw new Error(`build-cli: could not read skillVersion from ${path}`)
  }
  return m[1]
}

main()
