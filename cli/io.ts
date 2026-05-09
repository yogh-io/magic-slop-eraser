import { readFileSync } from 'node:fs'

/**
 * Read all of stdin. Used when commands take `--stdin` or `-` as the body
 * argument, e.g. `cat note.md | slopmop note finding -`.
 */
export async function readStdin(): Promise<string> {
  let out = ''
  for await (const chunk of process.stdin as AsyncIterable<Buffer | string>) {
    out += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  }
  return out
}

/**
 * Resolve a body string from the unified `<positional…> | --stdin | @file`
 * convention every write command uses.
 *
 * - `--stdin` flag, or single positional `-`: read from stdin
 * - single positional starting with `@`: read from file (path = arg.slice(1))
 * - otherwise: join the positionals at and after `from` with single spaces
 *
 * `from` lets the command skip leading positionals (e.g. `note <kind> <body>`
 * skips index 0 which is the kind).
 */
export async function resolveBody(
  positional: string[],
  useStdin: boolean,
  from = 0,
): Promise<string> {
  if (useStdin) return readStdin()
  const slice = positional.slice(from)
  if (slice.length === 1 && slice[0] === '-') return readStdin()
  if (slice.length === 1 && slice[0].startsWith('@')) {
    return readFileSync(slice[0].slice(1), 'utf8')
  }
  return slice.join(' ')
}

/**
 * Resolve a JSON body from the same convention. Used for batch endpoints
 * where the body is structured (flag-post, resolve, density-post): the
 * caller hands us positional + --stdin and we hand back a parsed object.
 */
export async function resolveJsonBody<T = unknown>(
  positional: string[],
  useStdin: boolean,
  from = 0,
): Promise<T> {
  const raw = await resolveBody(positional, useStdin, from)
  if (raw.trim().length === 0) {
    throw new Error('empty body; pass @file.json or pipe via --stdin')
  }
  try {
    return JSON.parse(raw) as T
  } catch (e) {
    throw new Error(
      `invalid JSON body: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

/**
 * Print JSON or pretty-stringify per `--json`. Default is the pretty form.
 */
export function emit(value: unknown, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(JSON.stringify(value, null, 2) + '\n')
  } else {
    process.stdout.write(JSON.stringify(value, null, 2) + '\n')
  }
}
