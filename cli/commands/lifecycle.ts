import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { Client, exitOnHttpError, HttpError } from '../client'
import { SKILL_VERSION } from '../version'
import {
  readSession,
  resolveHost,
  resolveId,
  writeSession,
  type Session,
} from '../session'
import { flagBool, flagList, flagString, type Args } from '../args'
import { emit } from '../io'

function nowIso(): string {
  return new Date().toISOString()
}

/** Pre-Client phase: build a minimal Session-shaped object for create/attach. */
function bootstrapSession(host: string): Pick<Session, 'host' | 'sourceHash' | 'createdAt'> {
  return { host, sourceHash: '', createdAt: nowIso() }
}

async function withClient(args: Args): Promise<Client> {
  const session = readSession()
  const host = resolveHost(flagString(args, 'host'), session)
  const id = resolveId(flagString(args, 'id'), session)
  if (!id) {
    throw new Error(
      'no slopmop session in this directory. run `slopmop init <file>` or `slopmop attach <url>` first.',
    )
  }
  const effective: Session = session ?? {
    id,
    host,
    sourceHash: '',
    createdAt: nowIso(),
  }
  effective.host = host
  effective.id = id
  return new Client(effective, process.cwd())
}

/* ------------------------------ init / attach ------------------------------ */

interface CreateDocResponse {
  id: string
  sourceHash: string
  eventsUrl: string
}

export async function cmdInit(args: Args): Promise<void> {
  const file = args.positional[0]
  if (!file) throw new Error('usage: slopmop init <file> [--title T] [--host URL]')
  const source = readFileSync(file, 'utf8')
  const title = flagString(args, 'title') ?? basename(file)
  const host = resolveHost(flagString(args, 'host'), null)

  const tempSession: Session = { ...bootstrapSession(host), id: '' }
  const tempClient = new Client(tempSession, process.cwd())

  let created: CreateDocResponse
  try {
    created = await tempClient.request<CreateDocResponse>({
      method: 'POST',
      path: '/docs',
      body: { source, title },
    })
  } catch (e) {
    return exitOnHttpError(e)
  }

  const session: Session = {
    id: created.id,
    host,
    sourceHash: created.sourceHash,
    title,
    eventsUrl: created.eventsUrl,
    createdAt: nowIso(),
  }
  const path = writeSession(session, process.cwd())
  process.stdout.write(`Created doc ${created.id}\n`)
  process.stdout.write(`Open ${host}/d/${created.id} in your browser.\n`)
  process.stdout.write(`Session at ${path}\n`)
}

export async function cmdAttach(args: Args): Promise<void> {
  const arg = args.positional[0]
  if (!arg) throw new Error('usage: slopmop attach <url-or-id> [--host URL]')
  const { id, host: parsedHost } = parseDocRef(arg)
  const host = flagString(args, 'host') ?? parsedHost ?? resolveHost(undefined, null)

  const provisional: Session = { id, host, sourceHash: '', createdAt: nowIso() }
  const client = new Client(provisional, process.cwd())
  let doc: { sourceHash: string; doc: { title: string } }
  try {
    doc = await client.request<{ sourceHash: string; doc: { title: string } }>({
      method: 'GET',
      path: `/docs/${id}`,
    })
  } catch (e) {
    return exitOnHttpError(e, `doc id ${id}`)
  }

  const session: Session = {
    id,
    host,
    sourceHash: doc.sourceHash,
    title: doc.doc.title,
    createdAt: nowIso(),
  }
  const path = writeSession(session, process.cwd())
  process.stdout.write(`Attached to ${id} (${doc.doc.title}) on ${host}\n`)
  process.stdout.write(`Session at ${path}\n`)
}

/** Pull `id` and (optionally) `host` out of either a URL or a bare id. */
function parseDocRef(arg: string): { id: string; host?: string } {
  if (arg.includes('://')) {
    try {
      const u = new URL(arg)
      const m = u.pathname.match(/\/d\/([^/?#]+)/)
      if (!m) throw new Error('URL does not match /d/<id> pattern')
      return { id: m[1], host: `${u.protocol}//${u.host}` }
    } catch (e) {
      throw new Error(`could not parse URL: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { id: arg }
}

/* --------------------------------- doc --------------------------------- */

export async function cmdDoc(args: Args): Promise<void> {
  const c = await withClient(args)
  const data = await c.request({ method: 'GET', path: `/docs/${c.session.id}` }).catch(exitOnHttpError)
  if (flagBool(args, 'json')) {
    emit(data, true)
    return
  }
  // Human-tuned summary
  const d = data as {
    doc: { title: string; version: number }
    sourceHash: string
    counts: Record<string, number>
    flags: { id: string }[]
    score: { value: number; rationale: string }
  }
  const lines: string[] = []
  lines.push(`${d.doc.title}  v${d.doc.version}  hash=${d.sourceHash.slice(0, 8)}`)
  lines.push(`flags: ${d.flags.length}  R1=${d.counts['1'] ?? 0} R2=${d.counts['2'] ?? 0} R3=${d.counts['3'] ?? 0}`)
  lines.push(`score: ${d.score.value.toFixed(1)} -- ${d.score.rationale}`)
  process.stdout.write(lines.join('\n') + '\n')
}

/* ------------------------------- catalogue ------------------------------ */

export async function cmdCatalogue(args: Args): Promise<void> {
  const session = readSession()
  const host = resolveHost(flagString(args, 'host'), session)
  // Bare GET; no doc id needed and no auth.
  const res = await fetch(`${host}/catalogue`, {
    headers: { 'X-Skill-Version': SKILL_VERSION },
  })
  if (!res.ok) return exitOnHttpError(new HttpError(res.status, await res.text()))
  const data = (await res.json()) as Record<string, unknown>
  emit(data, true)
}

/* ------------------------------- companion ------------------------------ */

export async function cmdCompanion(args: Args): Promise<void> {
  const c = await withClient(args)
  const data = await c
    .request({ method: 'GET', path: `/docs/${c.session.id}/companion` })
    .catch(exitOnHttpError)
  const out = flagString(args, 'out')
  if (out) {
    writeFileSync(out, JSON.stringify(data, null, 2) + '\n', 'utf8')
    process.stdout.write(`Wrote companion to ${out}\n`)
  } else {
    emit(data, true)
  }
}

/* --------------------------------- voice -------------------------------- */

export async function cmdVoice(args: Args): Promise<void> {
  const c = await withClient(args)
  const n = flagString(args, 'n') ?? '20'
  const data = await c
    .request({ method: 'GET', path: `/docs/${c.session.id}/voice-samples?n=${encodeURIComponent(n)}` })
    .catch(exitOnHttpError)
  emit(data, true)
}

/* --------------------------------- hints -------------------------------- */

export async function cmdHints(args: Args): Promise<void> {
  const c = await withClient(args)
  const sub = args.positional[0]

  if (!sub || sub === 'get') {
    const data = await c
      .request({ method: 'GET', path: `/docs/${c.session.id}/agent-hints` })
      .catch(exitOnHttpError)
    emit(data, true)
    return
  }
  if (sub === 'set') {
    const body: Record<string, unknown> = {}
    const rungs = flagList(args, 'rungs')
    if (rungs) body.rungs = rungs.map((s) => Number(s))
    const categories = flagList(args, 'category')
    if (categories) body.categories = categories
    const severities = flagList(args, 'severity')
    if (severities) body.severities = severities
    const patternIds = flagList(args, 'pattern')
    if (patternIds) body.patternIds = patternIds
    if (flagBool(args, 'paused')) body.paused = true
    if (flagBool(args, 'unpaused')) body.paused = false
    const data = await c
      .request({
        method: 'PUT',
        path: `/docs/${c.session.id}/agent-hints`,
        body,
      })
      .catch(exitOnHttpError)
    emit(data, true)
    return
  }
  throw new Error(`unknown hints subcommand: ${sub}. use 'get' or 'set'.`)
}

/* --------------------------------- source ------------------------------- */

export async function cmdSource(args: Args): Promise<void> {
  const c = await withClient(args)
  const file = args.positional[0]
  if (!file) throw new Error('usage: slopmop source <file>')
  const source = readFileSync(file, 'utf8')
  const data = await c
    .request({
      method: 'PUT',
      path: `/docs/${c.session.id}/source`,
      body: { source },
      ifMatch: true,
    })
    .catch(exitOnHttpError)
  emit(data, true)
}

export async function cmdRevert(args: Args): Promise<void> {
  const c = await withClient(args)
  const body: { toVersion?: number } = {}
  const tv = flagString(args, 'to-version')
  if (tv) body.toVersion = Number(tv)
  const data = await c
    .request({
      method: 'POST',
      path: `/docs/${c.session.id}/source/revert`,
      body,
    })
    .catch(exitOnHttpError)
  emit(data, true)
}

/* --------------------------------- reset -------------------------------- */

export async function cmdReset(args: Args): Promise<void> {
  const c = await withClient(args)
  const reason = args.positional.join(' ').trim()
  const data = await c
    .request({
      method: 'POST',
      path: `/docs/${c.session.id}/reset`,
      body: { reason },
    })
    .catch(exitOnHttpError)
  emit(data, true)
}
