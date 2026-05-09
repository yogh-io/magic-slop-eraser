import { Client } from '../client'
import { readSession, resolveHost, resolveId, type Session } from '../session'
import { flagString, type Args } from '../args'

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Stream the SSE events log to stdout as NDJSON. Each line is one event JSON
 * blob; consumers can `| jq` for filtering. Resumes from `--since N` if given.
 */
export async function cmdEvents(args: Args): Promise<void> {
  const session = readSession()
  const host = resolveHost(flagString(args, 'host'), session)
  const id = resolveId(flagString(args, 'id'), session)
  if (!id) throw new Error('no slopmop session. run `slopmop init` or `slopmop attach` first.')

  const since = flagString(args, 'since')
  const url = `${host}/docs/${id}/events${since ? `?since=${encodeURIComponent(since)}` : ''}`

  // We bypass Client because we want the raw response body stream.
  const effective: Session = session ?? { id, host, sourceHash: '', createdAt: nowIso() }
  effective.host = host
  effective.id = id
  // Construct a Client only to keep the abort signal disposal symmetrical;
  // we don't actually use `c.request` for this command.
  void new Client(effective, process.cwd())

  const ac = new AbortController()
  const onSig = (): void => ac.abort()
  process.on('SIGINT', onSig)
  process.on('SIGTERM', onSig)

  const res = await fetch(url, {
    headers: { accept: 'text/event-stream' },
    signal: ac.signal,
  })
  if (!res.ok || !res.body) {
    process.stderr.write(`error: ${res.status} ${await res.text()}\n`)
    process.exit(1)
  }

  // Parse SSE: events are blocks of `event: foo\ndata: {...}\n\n`. We just
  // emit `{type, data}` per block.
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const event = parseSseBlock(block)
      if (event) process.stdout.write(JSON.stringify(event) + '\n')
    }
  }
}

function parseSseBlock(block: string): { type: string; data: unknown } | null {
  let type = 'message'
  let dataStr = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) type = line.slice(6).trim()
    else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
    // ignore `id:` and comment lines (those starting with `:`).
  }
  if (!dataStr) return null
  try {
    return { type, data: JSON.parse(dataStr) }
  } catch {
    return null
  }
}
