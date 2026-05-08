import type { DocStore } from '../store'
import type { DocState, NewDocInput, SourceVersion } from '../types'
import { SOURCE_HISTORY_LIMIT } from '../types'
import type { AgentHints, Flag, ResolutionEvent } from '../../src/types'
import { runDetectors, scoreFromFlags } from '../../src/detectors'
import { extractSkipZones, approximateProseWordCount } from '../../src/detectors/skipZones'
import { bus } from '../bus'
import { json, notFound } from '../shared'
import { authorize, fail } from '../auth'
import { sha256Hex } from '../hash'
import { reconcile } from '../reconcile'

function nowIso(): string {
  return new Date().toISOString()
}

function bumpCursor(state: DocState): number {
  state.doc.version += 1
  state.doc.updatedAt = nowIso()
  return state.doc.version
}

export async function handleDocs(
  req: Request,
  store: DocStore,
  docId: string | null,
  verb: string | null,
  subVerb: string | null = null,
): Promise<Response> {
  // POST /docs - create new doc
  if (docId === null && req.method === 'POST') {
    const body = (await req.json()) as NewDocInput
    if (!body || typeof body.source !== 'string') return fail(400, 'source required')
    const id = crypto.randomUUID()
    const token = crypto.randomUUID().replace(/-/g, '')
    const ts = nowIso()
    const hash = sha256Hex(body.source)
    const initial: SourceVersion = {
      version: 0,
      source: body.source,
      sourceHash: hash,
      cause: 'initial',
      ts,
    }
    const state: DocState = {
      doc: {
        id,
        token,
        title: body.title ?? 'Untitled',
        source: body.source,
        sourceHash: hash,
        version: 0,
        createdAt: ts,
        updatedAt: ts,
      },
      flags: {},
      suggestions: {},
      responses: {},
      comments: {},
      history: [initial],
      agentHints: {},
    }
    await store.writeState(id, state)
    return json({ id, token, sourceHash: hash, eventsUrl: `/docs/${id}/events` })
  }

  if (docId === null) return fail(405, 'method not allowed')

  const state = await store.readState(docId)
  if (!state) return notFound()
  ensureSchema(state)

  const authErr = authorize(req, state.doc.token)
  if (authErr) return authErr

  // GET /docs/:id
  if (verb === null && req.method === 'GET') {
    const flags = Object.values(state.flags)
    const open = flags.filter((f) => (f.status ?? 'open') === 'open')
    const wordCount = approximateProseWordCount(state.doc.source, extractSkipZones(state.doc.source))
    const score = scoreFromFlags(
      open.filter((f) => (f.rung ?? 1) === 1),
      wordCount,
    )
    return json({
      doc: state.doc,
      sourceHash: state.doc.sourceHash,
      counts: countsByRung(open),
      score,
      flags,
      agentHints: state.agentHints,
    })
  }

  // PUT /docs/:id/source - replace source, reconcile, snapshot
  if (verb === 'source' && subVerb === null && req.method === 'PUT') {
    const ifMatch = req.headers.get('if-match') ?? ''
    if (ifMatch && ifMatch !== state.doc.sourceHash) {
      return fail(412, 'source has moved (If-Match mismatch)')
    }
    const body = (await req.json()) as { source: string }
    if (typeof body?.source !== 'string') return fail(400, 'source required')

    pushHistory(state, 'user-edit')
    state.doc.source = body.source
    state.doc.sourceHash = sha256Hex(body.source)

    const events: ResolutionEvent[] = [
      {
        cursor: bumpCursor(state),
        type: 'source-edited',
        payload: { length: body.source.length, cause: 'user' },
        ts: nowIso(),
      },
    ]
    const recon = reconcile(state, 'source-edit', () => bumpCursor(state), nowIso)
    events.push(...recon.events)

    await store.writeState(docId, state)
    for (const e of events) {
      await store.appendEvent(docId, e)
      bus.publish(docId, e)
    }
    return json({ ok: true, version: state.doc.version, sourceHash: state.doc.sourceHash })
  }

  // POST /docs/:id/source/revert  -> rolls back to last (or specified) snapshot
  if (verb === 'source' && subVerb === 'revert' && req.method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as { toVersion?: number }
    const target = chooseRevertTarget(state, body.toVersion)
    if (!target) return fail(409, 'no prior version available')

    pushHistory(state, 'revert')
    state.doc.source = target.source
    state.doc.sourceHash = target.sourceHash

    const events: ResolutionEvent[] = [
      {
        cursor: bumpCursor(state),
        type: 'source-reverted',
        payload: { toVersion: target.version },
        ts: nowIso(),
      },
    ]
    const recon = reconcile(state, 'source-edit', () => bumpCursor(state), nowIso)
    events.push(...recon.events)

    await store.writeState(docId, state)
    for (const e of events) {
      await store.appendEvent(docId, e)
      bus.publish(docId, e)
    }
    return json({ ok: true, version: state.doc.version, sourceHash: state.doc.sourceHash })
  }

  // POST /docs/:id/run-detectors
  if (verb === 'run-detectors' && req.method === 'POST') {
    const newFlags = runDetectors(state.doc.source)
    const events: ResolutionEvent[] = []
    for (const flag of newFlags) {
      // Dedupe: if an open flag already exists with the same patternId at the same anchor span, skip.
      if (existsOpenFlag(state, flag)) continue
      const id = `mech-${crypto.randomUUID().slice(0, 8)}`
      const stored: Flag = { ...flag, id, status: 'open', rung: rungFor(flag.patternId) }
      state.flags[id] = stored
      events.push({
        cursor: bumpCursor(state),
        type: 'flag-added',
        payload: { flagId: id, patternId: stored.patternId, rung: stored.rung },
        ts: nowIso(),
      })
    }
    await store.writeState(docId, state)
    for (const e of events) {
      await store.appendEvent(docId, e)
      bus.publish(docId, e)
    }
    return json({ added: events.length, flags: Object.values(state.flags) })
  }

  // GET / PUT /docs/:id/agent-hints
  if (verb === 'agent-hints' && subVerb === null) {
    if (req.method === 'GET') return json({ agentHints: state.agentHints })
    if (req.method === 'PUT') {
      const body = (await req.json()) as Partial<AgentHints>
      state.agentHints = sanitiseHints(body)
      const event: ResolutionEvent = {
        cursor: bumpCursor(state),
        type: 'agent-hints-updated',
        payload: { hints: state.agentHints },
        ts: nowIso(),
      }
      await store.writeState(docId, state)
      await store.appendEvent(docId, event)
      bus.publish(docId, event)
      return json({ agentHints: state.agentHints })
    }
    return fail(405, 'method not allowed')
  }

  // GET /docs/:id/voice-samples
  if (verb === 'voice-samples' && req.method === 'GET') {
    const url = new URL(req.url)
    const n = Number(url.searchParams.get('n') ?? '20')
    const samples = collectVoiceSamples(state, Number.isFinite(n) ? n : 20)
    return json({ samples })
  }

  // GET /docs/:id/companion
  if (verb === 'companion' && req.method === 'GET') {
    const events = await store.readEventsSince(docId, 0)
    return json({
      version: 1 as const,
      generatedAt: nowIso(),
      doc: state.doc,
      flags: Object.values(state.flags),
      suggestions: Object.values(state.suggestions),
      responses: Object.values(state.responses),
      comments: Object.values(state.comments),
      events,
    })
  }

  // DELETE /docs/:id
  if (verb === null && req.method === 'DELETE') {
    await store.deleteDoc(docId)
    return json({ ok: true })
  }

  return fail(405, 'method not allowed')
}

function countsByRung(flags: Flag[]): { 1: number; 2: number; 3: number } {
  const out = { 1: 0, 2: 0, 3: 0 }
  for (const f of flags) out[(f.rung ?? 1) as 1 | 2 | 3] += 1
  return out
}

function rungFor(patternId: string): 1 | 2 | 3 {
  const r2 = new Set([
    'absent-actor',
    'allusive-construct',
    'staccato',
    'bidirectional-summary',
    'hedged-confidence',
    'pivot-to-balance',
    'restating-question',
    'synthesis-of-nothing',
    'performative-humility',
    'bullets-where-prose',
  ])
  const r3 = new Set(['frame-stacking', 'performative-balance', 'header-inflation'])
  if (r3.has(patternId)) return 3
  if (r2.has(patternId)) return 2
  return 1
}

function existsOpenFlag(state: DocState, candidate: Flag): boolean {
  for (const f of Object.values(state.flags)) {
    if ((f.status ?? 'open') !== 'open' && (f.status ?? 'open') !== 'awaiting-accept') continue
    if (f.patternId !== candidate.patternId) continue
    if (f.anchor.start === candidate.anchor.start && f.anchor.end === candidate.anchor.end) {
      return true
    }
  }
  return false
}

function pushHistory(state: DocState, cause: SourceVersion['cause']): void {
  const snap: SourceVersion = {
    version: state.doc.version,
    source: state.doc.source,
    sourceHash: state.doc.sourceHash,
    cause,
    ts: nowIso(),
  }
  state.history.push(snap)
  while (state.history.length > SOURCE_HISTORY_LIMIT) state.history.shift()
}

function chooseRevertTarget(state: DocState, toVersion?: number): SourceVersion | null {
  if (state.history.length === 0) return null
  if (typeof toVersion === 'number') {
    const target = state.history.find((h) => h.version === toVersion)
    return target ?? null
  }
  return state.history[state.history.length - 1] ?? null
}

function sanitiseHints(body: Partial<AgentHints>): AgentHints {
  const out: AgentHints = {}
  if (Array.isArray(body.rungs)) out.rungs = body.rungs.filter((r) => r === 1 || r === 2 || r === 3)
  if (Array.isArray(body.categories)) out.categories = body.categories
  if (Array.isArray(body.severities)) out.severities = body.severities
  if (Array.isArray(body.patternIds)) out.patternIds = body.patternIds
  if (typeof body.paused === 'boolean') out.paused = body.paused
  return out
}

interface VoiceSample {
  pre: string
  post: string
  directive: string
  patternId: string
  rung: number
}

function collectVoiceSamples(state: DocState, n: number): VoiceSample[] {
  const out: VoiceSample[] = []
  // Walk suggestions where accepted=true; pull the directive that produced it.
  const accepted = Object.values(state.suggestions).filter((s) => s.accepted)
  accepted.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) // newest first
  for (const s of accepted) {
    const flag = state.flags[s.flagId]
    if (!flag) continue
    const directive = state.responses[s.respondedTo]?.body ?? ''
    out.push({
      pre: s.pre,
      post: s.post,
      directive,
      patternId: flag.patternId,
      rung: flag.rung ?? 1,
    })
    if (out.length >= n) break
  }
  return out
}

/**
 * Backfill new fields on docs persisted before the schema was extended. Lets
 * existing test docs keep working without a manual migration.
 */
function ensureSchema(state: DocState): void {
  const s = state as Partial<DocState> & DocState
  if (!s.responses) s.responses = {}
  if (!s.history) s.history = []
  if (!s.agentHints) s.agentHints = {}
  if (typeof s.doc.sourceHash !== 'string') s.doc.sourceHash = sha256Hex(s.doc.source)
}
