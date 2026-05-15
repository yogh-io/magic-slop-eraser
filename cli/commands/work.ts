import { readFileSync } from 'node:fs'
import { Client, exitOnHttpError } from '../client'
import { readSession, resolveHost, resolveId, type Session } from '../session'
import { flagBool, flagList, flagString, type Args } from '../args'
import { resolveBody, resolveJsonBody, emit } from '../io'

function nowIso(): string {
  return new Date().toISOString()
}

async function withClient(args: Args): Promise<Client> {
  const session = readSession()
  const host = resolveHost(flagString(args, 'host'), session)
  const id = resolveId(flagString(args, 'id'), session)
  if (!id) {
    throw new Error('no slopmop session. run `slopmop init` or `slopmop attach` first.')
  }
  const effective: Session = session ?? { id, host, sourceHash: '', createdAt: nowIso() }
  effective.host = host
  effective.id = id
  return new Client(effective, process.cwd())
}

/* -------------------------------- flag-post ------------------------------- */

interface FlagsBody {
  flags: Array<Record<string, unknown>>
  modelTag?: string
  source?: string
}

export async function cmdFlagPost(args: Args): Promise<void> {
  const c = await withClient(args)
  // Body shape may either be a bare array (just `flags`) or the full
  // {flags, modelTag, source}. Accept either.
  const raw = await resolveJsonBody<unknown>(args.positional, flagBool(args, 'stdin'), 0)
  let body: FlagsBody
  if (Array.isArray(raw)) {
    body = { flags: raw }
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as FlagsBody).flags)) {
    body = raw as FlagsBody
  } else {
    throw new Error('flag-post expects either an array of flags or {flags: [...]}')
  }
  const modelTag = flagString(args, 'model-tag')
  if (modelTag) body.modelTag = modelTag

  const data = await c
    .request<{ added: number; skipped: Array<{ reason: string }> }>({
      method: 'POST',
      path: `/docs/${c.session.id}/flags`,
      body,
      ifMatch: true,
    })
    .catch(exitOnHttpError)
  process.stdout.write(`added ${data.added}, skipped ${data.skipped.length}\n`)
  if (data.skipped.length > 0) {
    for (const s of data.skipped) {
      process.stdout.write(`  skipped: ${s.reason}\n`)
    }
  }
}

/* ---------------------------------- pull --------------------------------- */

/**
 * `pull` returns pending work for the drafter to act on.
 *
 *  - Default (no `--source`): pending **Responses** - scan-mode directives the
 *    user issued ("more committal", "drop the qualifier", free text) on flags
 *    the catalogue walk surfaced. The drafter generates a single candidate per
 *    directive.
 *  - `--source user`: open user-sourced **Flags** - brush-mode complaints the
 *    reader posted by highlighting a span. The flag itself *is* the directive
 *    (the userNote). The drafter generates ~3 candidate fixes per flag and
 *    posts them via `resolve`.
 *
 * The drafter loop typically alternates: pull --source user for brush work,
 * pull (default) for scan responses, until both queues are empty.
 */
export async function cmdPull(args: Args): Promise<void> {
  const c = await withClient(args)
  const source = flagString(args, 'source')
  if (source === 'user') return pullUserFlags(c, args)

  const params = new URLSearchParams()
  params.set('status', flagString(args, 'status') ?? 'pending')
  const rung = flagList(args, 'rung')
  if (rung) params.set('rung', rung.join(','))
  const category = flagList(args, 'category')
  if (category) params.set('category', category.join(','))
  const severity = flagList(args, 'severity')
  if (severity) params.set('severity', severity.join(','))
  const pattern = flagList(args, 'pattern')
  if (pattern) params.set('patternId', pattern.join(','))
  const limit = flagString(args, 'limit')
  if (limit) params.set('limit', limit)

  const data = await c
    .request<{ responses: Array<{ id: string; flagId: string; kind: string; body: string }> }>({
      method: 'GET',
      path: `/docs/${c.session.id}/responses?${params.toString()}`,
    })
    .catch(exitOnHttpError)

  if (flagBool(args, 'json')) {
    emit(data, true)
    return
  }
  if (data.responses.length === 0) {
    process.stdout.write('queue clear\n')
    return
  }
  for (const r of data.responses) {
    const trimmed = r.body.length > 80 ? r.body.slice(0, 77) + '...' : r.body
    process.stdout.write(`${r.id}  flag=${r.flagId}  kind=${r.kind}  ${trimmed}\n`)
  }
}

interface UserFlagOut {
  id: string
  source?: string
  status?: string
  userNote?: string
  excerpt?: string
  anchor?: { text?: string }
}

async function pullUserFlags(c: Client, args: Args): Promise<void> {
  const params = new URLSearchParams()
  params.set('source', 'user')
  params.set('status', flagString(args, 'status') ?? 'open')
  const limit = flagString(args, 'limit')
  if (limit) params.set('limit', limit)
  const data = await c
    .request<{ flags: UserFlagOut[] }>({
      method: 'GET',
      path: `/docs/${c.session.id}/flags?${params.toString()}`,
    })
    .catch(exitOnHttpError)
  if (flagBool(args, 'json')) {
    emit(data, true)
    return
  }
  if (data.flags.length === 0) {
    process.stdout.write('no brush flags pending\n')
    return
  }
  for (const f of data.flags) {
    const note = (f.userNote ?? '').replace(/\s+/g, ' ').trim()
    const trimmedNote = note.length > 80 ? note.slice(0, 77) + '...' : note
    const excerpt = (f.excerpt ?? f.anchor?.text ?? '').replace(/\s+/g, ' ').trim()
    const trimmedExcerpt = excerpt.length > 60 ? excerpt.slice(0, 57) + '...' : excerpt
    process.stdout.write(`${f.id}  "${trimmedExcerpt}"  note=${trimmedNote}\n`)
  }
}

/* ----------------------- resolve / patch / fullsource ---------------------- */

interface PatchInput {
  flagId: string
  /** Multi-candidate (brush always, scan optional). */
  replacementTexts?: string[]
  /** Legacy singular form - accepted by the server for back-compat. */
  replacementText?: string
  /** Optional. Scan-mode patches answer a Response; brush-mode patches
   *  answer a user-sourced flag directly (no preceding Response). */
  respondedTo?: string
  prompt?: string
}

interface FullSourceInput {
  respondedTo: string[]
  source: string
}

interface ResolveBody {
  patches?: PatchInput[]
  fullSource?: FullSourceInput
  modelTag?: string
  notes?: string
}

export async function cmdResolve(args: Args): Promise<void> {
  const c = await withClient(args)
  const body = await resolveJsonBody<ResolveBody>(args.positional, flagBool(args, 'stdin'), 0)
  const modelTag = flagString(args, 'model-tag')
  if (modelTag) body.modelTag = modelTag

  const data = await c
    .request<{ ok: boolean; sourceHash: string; version: number }>({
      method: 'POST',
      path: `/docs/${c.session.id}/resolutions`,
      body,
      ifMatch: true,
    })
    .catch(exitOnHttpError)
  process.stdout.write(
    `resolved v${data.version} hash=${data.sourceHash.slice(0, 8)}\n`,
  )
}

export async function cmdPatch(args: Args): Promise<void> {
  const c = await withClient(args)
  const [rid, fid] = args.positional
  if (!rid || !fid) {
    throw new Error('usage: slopmop patch <rid> <fid> <text|@file|->')
  }
  const replacement = (await resolveBody(args.positional, flagBool(args, 'stdin'), 2)).replace(
    /\n+$/,
    '',
  )
  if (!replacement) throw new Error('replacement text is empty')

  const body: ResolveBody = {
    patches: [{ respondedTo: rid, flagId: fid, replacementText: replacement }],
    modelTag: flagString(args, 'model-tag') ?? 'cli',
  }
  const data = await c
    .request<{ ok: boolean; sourceHash: string; version: number }>({
      method: 'POST',
      path: `/docs/${c.session.id}/resolutions`,
      body,
      ifMatch: true,
    })
    .catch(exitOnHttpError)
  process.stdout.write(
    `patched v${data.version} hash=${data.sourceHash.slice(0, 8)}\n`,
  )
}

export async function cmdFullsource(args: Args): Promise<void> {
  const c = await withClient(args)
  const file = args.positional[0]
  if (!file) throw new Error('usage: slopmop fullsource <file> --responded-to rid1[,rid2]')
  const source = readFileSync(file, 'utf8')
  const respondedToRaw = flagString(args, 'responded-to')
  if (!respondedToRaw) {
    throw new Error('--responded-to <rid[,rid...]> is required')
  }
  const respondedTo = respondedToRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const body: ResolveBody = {
    fullSource: { source, respondedTo },
    modelTag: flagString(args, 'model-tag') ?? 'cli',
  }
  const data = await c
    .request<{ ok: boolean; sourceHash: string; version: number }>({
      method: 'POST',
      path: `/docs/${c.session.id}/resolutions`,
      body,
      ifMatch: true,
    })
    .catch(exitOnHttpError)
  process.stdout.write(
    `full-source v${data.version} hash=${data.sourceHash.slice(0, 8)}\n`,
  )
}

/* --------------------------- response transitions -------------------------- */

export async function cmdPunt(args: Args): Promise<void> {
  const rid = args.positional[0]
  if (!rid) throw new Error('usage: slopmop punt <rid> <reason...>')
  const reason = args.positional.slice(1).join(' ').trim()
  const c = await withClient(args)
  await c
    .request({
      method: 'POST',
      path: `/docs/${c.session.id}/responses/${rid}/transition`,
      body: { to: 'stuck', reason },
    })
    .catch(exitOnHttpError)
  process.stdout.write(`punted ${rid}: ${reason}\n`)
}

export async function cmdCancel(args: Args): Promise<void> {
  const rid = args.positional[0]
  if (!rid) throw new Error('usage: slopmop cancel <rid>')
  const c = await withClient(args)
  await c
    .request({
      method: 'POST',
      path: `/docs/${c.session.id}/responses/${rid}/transition`,
      body: { to: 'cancelled' },
    })
    .catch(exitOnHttpError)
  process.stdout.write(`cancelled ${rid}\n`)
}

/* ----------------------- flag-scoped user kinds ---------------------------- */

async function postFlagKind(args: Args, kind: 'accept' | 'discard' | 'skip' | 'keep'): Promise<void> {
  const fid = args.positional[0]
  if (!fid) throw new Error(`usage: slopmop ${kind} <fid>`)
  const c = await withClient(args)
  const data = await c
    .request<{ response: { id: string; status: string } }>({
      method: 'POST',
      path: `/docs/${c.session.id}/responses`,
      body: { flagId: fid, kind },
    })
    .catch(exitOnHttpError)
  process.stdout.write(`${kind} ${fid} -> ${data.response.id} (${data.response.status})\n`)
}

export const cmdAccept = (a: Args): Promise<void> => postFlagKind(a, 'accept')
export const cmdDiscard = (a: Args): Promise<void> => postFlagKind(a, 'discard')
export const cmdSkip = (a: Args): Promise<void> => postFlagKind(a, 'skip')
export const cmdKeep = (a: Args): Promise<void> => postFlagKind(a, 'keep')

/* --------------------------------- density --------------------------------- */

export async function cmdDensity(args: Args): Promise<void> {
  const c = await withClient(args)
  const data = await c
    .request({ method: 'GET', path: `/docs/${c.session.id}/density` })
    .catch(exitOnHttpError)
  emit(data, flagBool(args, 'json'))
}

export async function cmdDensityPost(args: Args): Promise<void> {
  const c = await withClient(args)
  const body = await resolveJsonBody<{ scores: unknown[]; modelTag?: string }>(
    args.positional,
    flagBool(args, 'stdin'),
    0,
  )
  const modelTag = flagString(args, 'model-tag')
  if (modelTag) body.modelTag = modelTag
  const data = await c
    .request<{ applied: number; skipped: number }>({
      method: 'POST',
      path: `/docs/${c.session.id}/density`,
      body,
    })
    .catch(exitOnHttpError)
  process.stdout.write(`applied ${data.applied}, skipped ${data.skipped}\n`)
}
