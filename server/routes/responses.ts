import type { DocState } from '../types'
import type {
  CategoryId,
  DocResponse,
  Rung,
  PatternMeta,
  ResolutionEvent,
  ResponseKind,
  Suggestion,
} from '../../src/types'
import type { DocStore } from '../store'
import { relocateAnchor } from '../../src/anchoring/textAnchor'
import { bus } from '../bus'
import { json, notFound } from '../shared'
import { fail } from '../auth'
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

const VALID_KINDS: ResponseKind[] = ['shortcut', 'free', 'let-me-try', 'skip', 'keep']

interface PostResponseBody {
  flagId: string
  body?: string
  kind: ResponseKind
}

export async function handleResponses(
  req: Request,
  store: DocStore,
  docId: string,
  segs: string[],
): Promise<Response> {
  const state = await store.readState(docId)
  if (!state) return notFound()

  // GET /docs/:id/responses?status=pending&rung=...&category=...&severity=...&patternId=...&limit=N
  if (segs.length === 0 && req.method === 'GET') {
    return json({ responses: filterResponses(state, new URL(req.url)) })
  }

  // POST /docs/:id/responses  -- single directive, fired immediately
  if (segs.length === 0 && req.method === 'POST') {
    const body = (await req.json()) as PostResponseBody
    if (!body || typeof body.flagId !== 'string') return fail(400, 'flagId required')
    if (!VALID_KINDS.includes(body.kind)) return fail(400, 'invalid kind')
    const flag = state.flags[body.flagId]
    if (!flag) return fail(400, 'unknown flag')
    if ((flag.status ?? 'open') === 'stale') return fail(409, 'flag is stale')

    const id = `r-${crypto.randomUUID().slice(0, 8)}`
    const resp: DocResponse = {
      id,
      flagId: body.flagId,
      body: body.body ?? '',
      kind: body.kind,
      status: 'pending',
      createdAt: nowIso(),
    }
    state.responses[id] = resp

    const events: ResolutionEvent[] = [
      {
        cursor: bumpCursor(state),
        type: 'response-added',
        payload: { responseId: id, flagId: resp.flagId, kind: resp.kind, body: resp.body },
        ts: nowIso(),
      },
    ]

    // Self-resolving paths bypass the agent.
    if (body.kind === 'skip' || body.kind === 'keep') {
      flag.status = body.kind === 'skip' ? 'skipped' : 'kept-deliberate'
      resp.status = 'resolved'
      resp.respondedBy = 'self'
      resp.resolvedAt = nowIso()
      events.push({
        cursor: bumpCursor(state),
        type: body.kind === 'skip' ? 'flag-skipped' : 'flag-kept',
        payload: { flagId: flag.id },
        ts: nowIso(),
      })
      events.push({
        cursor: bumpCursor(state),
        type: 'response-resolved',
        payload: { responseId: id, flagId: flag.id, cause: 'self' },
        ts: nowIso(),
      })
    } else if (body.kind === 'let-me-try') {
      if (typeof body.body !== 'string' || body.body.length === 0) {
        return fail(400, 'let-me-try requires body text')
      }
      const result = applyPerFlagPatch(state, flag.id, body.body, 'human', id)
      if (!result.ok) return fail(409, result.reason)
      resp.status = 'resolved'
      resp.respondedBy = 'self'
      resp.resolvedSuggestionId = result.suggestionId
      resp.resolvedAt = nowIso()
      events.push(
        {
          cursor: bumpCursor(state),
          type: 'suggestion-added',
          payload: {
            suggestionId: result.suggestionId,
            flagId: flag.id,
            modelTag: 'human',
            accepted: true,
          },
          ts: nowIso(),
        },
        {
          cursor: bumpCursor(state),
          type: 'flag-resolved',
          payload: { flagId: flag.id, cause: 'self', replacementText: body.body },
          ts: nowIso(),
        },
        {
          cursor: bumpCursor(state),
          type: 'response-resolved',
          payload: { responseId: id, flagId: flag.id, cause: 'self' },
          ts: nowIso(),
        },
      )
      // Re-anchor everything else
      const recon = reconcile(state, 'source-edit', () => bumpCursor(state), nowIso)
      events.push(...recon.events)
    }

    await store.writeState(docId, state)
    for (const e of events) {
      await store.appendEvent(docId, e)
      bus.publish(docId, e)
    }
    return json({ response: resp })
  }

  // /docs/:id/responses/:rid/...
  if (segs.length < 1) return fail(400, 'response id required')
  const rid = segs[0]
  const resp = state.responses[rid]
  if (!resp) return notFound()
  const verb = segs[1] ?? null

  // POST /docs/:id/responses/:rid/cancel  (user rescinds before agent acts)
  if (verb === 'cancel' && req.method === 'POST') {
    if (resp.status !== 'pending') return fail(409, 'response is not pending')
    resp.status = 'cancelled'
    resp.respondedBy = 'self'
    resp.resolvedAt = nowIso()
    const event: ResolutionEvent = {
      cursor: bumpCursor(state),
      type: 'response-cancelled',
      payload: { responseId: rid, flagId: resp.flagId, reason: 'user-rescind' },
      ts: nowIso(),
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ response: resp })
  }

  // POST /docs/:id/responses/:rid/punt  (agent gave up)
  if (verb === 'punt' && req.method === 'POST') {
    if (resp.status !== 'pending') return fail(409, 'response is not pending')
    const body = (await req.json().catch(() => ({}))) as { reason?: string }
    resp.status = 'stuck'
    resp.stuckReason = body.reason ?? ''
    resp.resolvedAt = nowIso()
    const event: ResolutionEvent = {
      cursor: bumpCursor(state),
      type: 'response-stuck',
      payload: { responseId: rid, flagId: resp.flagId, reason: resp.stuckReason },
      ts: nowIso(),
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ response: resp })
  }

  return fail(405, 'method not allowed')
}

interface PerFlagPatchResult {
  ok: boolean
  reason?: string
  suggestionId?: string
}

/**
 * Apply a per-flag patch: replace the flag's anchored span with `replacement`.
 * Mutates source, creates an accepted Suggestion, marks the flag resolved.
 *
 * Used by let-me-try directives and by the per-flag accept verb. The caller
 * runs reconcile() afterwards to relocate other open anchors.
 */
function applyPerFlagPatch(
  state: DocState,
  flagId: string,
  replacement: string,
  modelTag: string,
  respondedTo: string,
): PerFlagPatchResult {
  const flag = state.flags[flagId]
  if (!flag) return { ok: false, reason: 'unknown flag' }
  const r = relocateAnchor(state.doc.source, flag.anchor)
  if (!r) {
    flag.status = 'stale'
    return { ok: false, reason: 'anchor stale' }
  }
  const pre = state.doc.source.slice(r.start, r.end)
  state.doc.source =
    state.doc.source.slice(0, r.start) + replacement + state.doc.source.slice(r.end)
  state.doc.sourceHash = sha256Hex(state.doc.source)
  const suggestionId = `s-${crypto.randomUUID().slice(0, 8)}`
  const sug: Suggestion = {
    id: suggestionId,
    flagId,
    pre,
    post: replacement,
    respondedTo,
    modelTag,
    accepted: true,
    createdAt: nowIso(),
  }
  state.suggestions[suggestionId] = sug
  flag.status = 'resolved'
  flag.anchor = {
    ...flag.anchor,
    start: r.start,
    end: r.start + replacement.length,
    text: replacement,
  }
  flag.excerpt = replacement
  return { ok: true, suggestionId }
}

function filterResponses(state: DocState, url: URL): DocResponse[] {
  const params = url.searchParams
  const status = params.get('status')
  const rungs = parseList<Rung>(params.get('rung'), (s) => Number(s) as Rung)
  const categories = parseList<CategoryId>(params.get('category'), (s) => s as CategoryId)
  const severities = parseList<PatternMeta['severity']>(
    params.get('severity'),
    (s) => s as PatternMeta['severity'],
  )
  const patternIds = parseList<string>(params.get('patternId'), (s) => s)
  const limitParam = params.get('limit')
  const limit = limitParam ? Math.max(1, Number(limitParam)) : Infinity

  const out: DocResponse[] = []
  for (const r of Object.values(state.responses)) {
    if (status && r.status !== status) continue
    const flag = state.flags[r.flagId]
    if (!flag) continue
    if (rungs && !rungs.includes((flag.rung ?? 1) as Rung)) continue
    if (categories && !categories.includes(flag.category)) continue
    if (severities && !severities.includes(severityBucket(flag.severity))) continue
    if (patternIds && !patternIds.includes(flag.patternId)) continue
    out.push(r)
    if (out.length >= limit) break
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  return out
}

function parseList<T>(raw: string | null, parse: (s: string) => T): T[] | null {
  if (!raw) return null
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parse)
}

/**
 * Flags carry numeric severity (per scoring weights). Hint filters use the
 * categorical buckets from PatternMeta. Translate.
 */
function severityBucket(numeric: number): PatternMeta['severity'] {
  if (numeric >= 9) return 'primary'
  if (numeric >= 6) return 'high'
  if (numeric >= 3) return 'medium'
  return 'low'
}
