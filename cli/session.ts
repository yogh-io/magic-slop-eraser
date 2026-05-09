import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/**
 * Per-cwd CLI session. Walks up like git for `.slopmop/session.json`. Holds
 * the doc id, host, and current sourceHash so commands don't re-pass them.
 */
export interface Session {
  id: string
  host: string
  /** sha-256 of the current source. Refreshed on every API response that
   *  returns an updated `sourceHash`. */
  sourceHash: string
  title?: string
  eventsUrl?: string
  createdAt: string
}

const SESSION_DIR = '.slopmop'
const SESSION_FILE = 'session.json'

/** Find the nearest `.slopmop/session.json` walking up from cwd. Returns
 *  the directory containing `.slopmop`, or null if none found. */
export function findSessionRoot(start: string = process.cwd()): string | null {
  let dir = resolve(start)
  while (true) {
    const candidate = join(dir, SESSION_DIR, SESSION_FILE)
    if (existsSync(candidate)) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function readSession(start?: string): Session | null {
  const root = findSessionRoot(start)
  if (!root) return null
  const path = join(root, SESSION_DIR, SESSION_FILE)
  try {
    const raw = readFileSync(path, 'utf8')
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function writeSession(session: Session, root: string = process.cwd()): string {
  const dir = join(root, SESSION_DIR)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, SESSION_FILE)
  writeFileSync(path, JSON.stringify(session, null, 2) + '\n', 'utf8')
  return path
}

/** Resolve effective host: --host > $SLOPMOP_HOST > session.host > default. */
export function resolveHost(override?: string, session?: Session | null): string {
  return (
    override ??
    process.env.SLOPMOP_HOST ??
    session?.host ??
    'http://localhost:8787'
  )
}

/** Resolve effective doc id: --id > $SLOPMOP_ID > session.id. */
export function resolveId(override?: string, session?: Session | null): string | null {
  return override ?? process.env.SLOPMOP_ID ?? session?.id ?? null
}
