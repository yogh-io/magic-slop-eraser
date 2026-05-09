/**
 * Hand-rolled arg parser. Subcommand + positionals + `--flag value` +
 * `--bool` + `--key=value`. Use `--` to force everything after into
 * positional. Single-letter `-n N` is also supported.
 */
export interface Args {
  /** First positional, the subcommand name. Empty string if none. */
  verb: string
  /** Remaining positionals after the verb, in order. */
  positional: string[]
  /** Flags. Booleans set true; valued flags carry their string value. */
  flags: Record<string, string | boolean>
}

export function parseArgs(argv: string[]): Args {
  const verb = argv[0] ?? ''
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  let inPositional = false

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (inPositional) {
      positional.push(arg)
      continue
    }
    if (arg === '--') {
      inPositional = true
      continue
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1)
        continue
      }
      const name = arg.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('-')) {
        flags[name] = next
        i++
      } else {
        flags[name] = true
      }
      continue
    }
    if (arg.startsWith('-') && arg.length > 1 && arg !== '-') {
      const name = arg.slice(1)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('-')) {
        flags[name] = next
        i++
      } else {
        flags[name] = true
      }
      continue
    }
    positional.push(arg)
  }

  return { verb, positional, flags }
}

/** Read a flag as a string. Returns `undefined` if absent or a bare boolean. */
export function flagString(args: Args, name: string): string | undefined {
  const v = args.flags[name]
  return typeof v === 'string' ? v : undefined
}

/** Read a flag as boolean. True if the flag is set at all (string or bool). */
export function flagBool(args: Args, name: string): boolean {
  return args.flags[name] !== undefined
}

/** Read a flag as a comma-separated list. Returns `undefined` if absent. */
export function flagList(args: Args, name: string): string[] | undefined {
  const v = flagString(args, name)
  if (v === undefined) return undefined
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
