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
  // 1. Sanity-check: cli/version.ts and SKILL.md frontmatter agree.
  const cliVersion = readCliVersion()
  const skillVersion = readSkillVersion()
  if (cliVersion !== skillVersion) {
    console.error(
      `build-cli: version mismatch: cli/version.ts says ${cliVersion}, ` +
        `SKILL.md frontmatter says ${skillVersion}. Bump them in lockstep.`,
    )
    process.exit(1)
  }

  // 2. Bundle the CLI.
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
  chmodSync(resolve(outDir, 'slopmop.js'), 0o755)

  // 3. Copy install.sh into dist/cli.
  copyFileSync(
    resolve(repoRoot, 'cli/install.sh'),
    resolve(outDir, 'install.sh'),
  )
  chmodSync(resolve(outDir, 'install.sh'), 0o755)

  // 4. Stamp a manifest with the version so curl-then-extract flows can
  //    sanity-check.
  writeFileSync(
    resolve(outDir, 'manifest.json'),
    JSON.stringify({ version: cliVersion, builtAt: new Date().toISOString() }, null, 2) + '\n',
    'utf8',
  )

  console.log(`build-cli: dist/cli/slopmop.js (v${cliVersion})`)
}

function readCliVersion(): string {
  const path = resolve(repoRoot, 'cli/version.ts')
  const raw = readFileSync(path, 'utf8')
  const m = raw.match(/SKILL_VERSION\s*=\s*'([^']+)'/)
  if (!m) {
    throw new Error(`build-cli: could not read SKILL_VERSION from ${path}`)
  }
  return m[1]
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
