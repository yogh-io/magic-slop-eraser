import type { DocStore } from '../store'
import type { DocState, NewDocInput } from '../types'
import type { Flag, ResolutionEvent } from '../../src/types'
import { runDetectors, scoreFromFlags } from '../../src/detectors'
import { extractSkipZones, approximateProseWordCount } from '../../src/detectors/skipZones'
import { relocateAnchor } from '../../src/anchoring/textAnchor'
import { bus } from '../bus'
import { json, notFound } from '../shared'
import { authorize, fail } from '../auth'

function nowIso(): string {
  return new Date().toISOString()
}

function nextCursor(state: DocState): number {
  state.doc.version += 1
  state.doc.updatedAt = nowIso()
  return state.doc.version
}

export async function handleDocs(
  req: Request,
  store: DocStore,
  docId: string | null,
  verb: string | null,
): Promise<Response> {
  // POST /docs - create new doc
  if (docId === null && req.method === 'POST') {
    const body = (await req.json()) as NewDocInput
    if (!body || typeof body.source !== 'string') return fail(400, 'source required')
    const id = crypto.randomUUID()
    const token = crypto.randomUUID().replace(/-/g, '')
    const ts = nowIso()
    const state: DocState = {
      doc: {
        id,
        token,
        title: body.title ?? 'Untitled',
        source: body.source,
        version: 0,
        createdAt: ts,
        updatedAt: ts,
      },
      flags: {},
      suggestions: {},
      comments: {},
    }
    await store.writeState(id, state)
    return json({ id, token, eventsUrl: `/docs/${id}/events` })
  }

  if (docId === null) return fail(405, 'method not allowed')

  const state = await store.readState(docId)
  if (!state) return notFound()

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
      counts: countsByRung(open),
      score,
      flags,
    })
  }

  // PUT /docs/:id/source - replace source, relocate anchors
  if (verb === 'source' && req.method === 'PUT') {
    const body = (await req.json()) as { source: string }
    if (typeof body?.source !== 'string') return fail(400, 'source required')
    state.doc.source = body.source
    relocateOpenAnchors(state)
    const cursor = nextCursor(state)
    const event: ResolutionEvent = {
      cursor,
      type: 'source-edited',
      payload: { length: body.source.length },
      ts: nowIso(),
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ ok: true, version: state.doc.version })
  }

  // POST /docs/:id/run-detectors
  if (verb === 'run-detectors' && req.method === 'POST') {
    const newFlags = runDetectors(state.doc.source)
    const events: ResolutionEvent[] = []
    for (const flag of newFlags) {
      const id = `mech-${crypto.randomUUID().slice(0, 8)}`
      const stored: Flag = { ...flag, id, status: 'open', rung: rungFor(flag.patternId) }
      state.flags[id] = stored
      const cursor = nextCursor(state)
      events.push({
        cursor,
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
    return json({ added: newFlags.length, flags: Object.values(state.flags) })
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

function relocateOpenAnchors(state: DocState): void {
  for (const flag of Object.values(state.flags)) {
    if ((flag.status ?? 'open') !== 'open') continue
    const r = relocateAnchor(state.doc.source, flag.anchor)
    if (!r) {
      flag.status = 'stale'
      continue
    }
    flag.anchor = {
      ...flag.anchor,
      start: r.start,
      end: r.end,
    }
    flag.excerpt = state.doc.source.slice(r.start, r.end)
  }
}

function countsByRung(flags: Flag[]): { 1: number; 2: number; 3: number } {
  const out = { 1: 0, 2: 0, 3: 0 }
  for (const f of flags) out[(f.rung ?? 1) as 1 | 2 | 3] += 1
  return out
}

function rungFor(patternId: string): 1 | 2 | 3 {
  // mirrors the catalogue; conservative default = 1
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
