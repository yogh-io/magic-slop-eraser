import { SKILL_VERSION } from './version'
import type { Session } from './session'
import { writeSession } from './session'

/**
 * HttpError carries the server's status + body so commands can decide how
 * to surface it. 412 in particular is the source-moved race we want to
 * print specifically.
 */
export class HttpError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(`${status}: ${body}`)
    this.status = status
    this.body = body
  }
}

interface RequestOpts {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: unknown
  /** Send `If-Match: <currentHash>`. Required for source-mutating endpoints
   *  (POST /flags, /resolutions, PUT /source, etc). */
  ifMatch?: boolean
  /** Skip JSON parsing; return raw Response. Used for SSE streams. */
  raw?: boolean
}

export class Client {
  session: Session
  /** Filesystem root where the session.json lives. Used to persist hash
   *  refreshes after every response that returns a new sourceHash. */
  sessionRoot: string

  constructor(session: Session, sessionRoot: string) {
    this.session = session
    this.sessionRoot = sessionRoot
  }

  /** Issue a request, parse JSON, refresh sourceHash if the response carried
   *  one. Throws HttpError on 4xx/5xx. */
  async request<T = unknown>(opts: RequestOpts): Promise<T> {
    const headers: Record<string, string> = {
      'X-Skill-Version': SKILL_VERSION,
    }
    if (opts.body !== undefined) headers['content-type'] = 'application/json'
    if (opts.ifMatch && this.session.sourceHash) {
      headers['If-Match'] = this.session.sourceHash
    }

    const url = `${this.session.host}${opts.path}`
    const res = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })

    if (opts.raw) {
      if (!res.ok) {
        const text = await res.text()
        throw new HttpError(res.status, text)
      }
      return res as unknown as T
    }

    if (!res.ok) {
      const text = await res.text()
      throw new HttpError(res.status, text)
    }

    if (res.status === 204) return undefined as T

    const json = (await res.json()) as Record<string, unknown> | unknown
    if (json && typeof json === 'object' && 'sourceHash' in json) {
      const h = (json as { sourceHash: unknown }).sourceHash
      if (typeof h === 'string' && h !== this.session.sourceHash) {
        this.session.sourceHash = h
        writeSession(this.session, this.sessionRoot)
      }
    }
    return json as T
  }
}

/**
 * Pretty-print an HttpError to stderr and exit with a stable exit code:
 *   - 4: 412 Precondition Failed (source moved race)
 *   - 5: 404 Not Found
 *   - 6: 409 Conflict (stale flag, no candidate, etc.)
 *   - 1: anything else
 *
 * 412 in particular gets a dedicated message because it's the most common
 * recovery case: the source moved under us, the caller needs to re-pull.
 */
export function exitOnHttpError(err: unknown, ctx?: string): never {
  if (err instanceof HttpError) {
    if (err.status === 412) {
      process.stderr.write(
        `error: source moved (412). re-fetch the doc and rebase. server says: ${err.body}\n`,
      )
      process.exit(4)
    }
    if (err.status === 404) {
      process.stderr.write(`error: not found (404). ${ctx ?? ''} ${err.body}\n`)
      process.exit(5)
    }
    if (err.status === 409) {
      process.stderr.write(`error: conflict (409). ${err.body}\n`)
      process.exit(6)
    }
    process.stderr.write(`error: ${err.status}: ${err.body}\n`)
    process.exit(1)
  }
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
}
