import type { DocState } from '../types'
import { appendEvents } from '../types'
import type {
  CategoryId,
  DocResponse,
  Flag,
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

const VALID_KINDS: ResponseKind[] = [
  'shortcut',
  'free',
  'let-me-try',
  'skip',
  'keep',
  'accept',
  'discard',
]

const VALID_TRANSITIONS = ['stuck', 'cancelled'] as const
type TransitionTo = (typeof VALID_TRANSITIONS)[number]

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
      const replacement = body.body
      if (typeof replacement !== 'string' || replacement.length === 0) {
        return fail(400, 'let-me-try requires body text')
      }
      const result = applyPerFlagPatch(state, flag.id, replacement, 'human', id)
      if (!result.ok) return fail(409, result.reason ?? 'patch rejected')
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
          payload: { flagId: flag.id, cause: 'self', replacementText: replacement },
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
    } else if (body.kind === 'accept') {
      // Apply the flag's awaiting-accept candidate; mutates source, marks flag
      // resolved, reconciles other anchors. The browser hits this path; the
      // drafter never does (accept is user-side).
      const candidate = pickAwaitingCandidate(state, flag.id)
      if (!candidate) return fail(409, 'no candidate to accept')
      const result = applyAcceptedCandidate(state, flag, candidate)
      if (!result.ok) {
        // Anchor stale: emit the stale event so the timeline reflects it,
        // then surface 409 so the client knows.
        events.push({
          cursor: bumpCursor(state),
          type: 'flag-stale',
          payload: { flagId: flag.id, cause: 'source-edit' },
          ts: nowIso(),
        })
        appendEvents(state, ...events)
        await store.writeState(docId, state)
        for (const e of events) bus.publish(docId, e)
        return fail(409, result.reason ?? 'anchor stale at accept time')
      }
      resp.status = 'resolved'
      resp.respondedBy = 'self'
      resp.resolvedSuggestionId = candidate.id
      resp.resolvedAt = nowIso()
      events.push(
        {
          cursor: bumpCursor(state),
          type: 'flag-resolved',
          payload: {
            flagId: flag.id,
            cause: 'self',
            replacementText: candidate.post,
            suggestionId: candidate.id,
          },
          ts: nowIso(),
        },
        {
          cursor: bumpCursor(state),
          type: 'source-edited',
          payload: { length: state.doc.source.length, cause: 'flag-accept' },
          ts: nowIso(),
        },
        {
          cursor: bumpCursor(state),
          type: 'response-resolved',
          payload: { responseId: id, flagId: flag.id, cause: 'self', suggestionId: candidate.id },
          ts: nowIso(),
        },
      )
      const recon = reconcile(state, 'source-edit', () => bumpCursor(state), nowIso)
      events.push(...recon.events)
    } else if (body.kind === 'discard') {
      // Drop the awaiting-accept candidate; flag returns to open for redirection.
      const candidate = pickAwaitingCandidate(state, flag.id)
      if (!candidate) return fail(409, 'no candidate to discard')
      delete state.suggestions[candidate.id]
      flag.status = 'open'
      resp.status = 'resolved'
      resp.respondedBy = 'self'
      resp.resolvedAt = nowIso()
      events.push(
        {
          cursor: bumpCursor(state),
          type: 'suggestion-discarded',
          payload: { suggestionId: candidate.id, flagId: flag.id, reason: 'user-discard' },
          ts: nowIso(),
        },
        {
          cursor: bumpCursor(state),
          type: 'response-resolved',
          payload: { responseId: id, flagId: flag.id, cause: 'self' },
          ts: nowIso(),
        },
      )
    }

    appendEvents(state, ...events)
    await store.writeState(docId, state)
    for (const e of events) bus.publish(docId, e)
    return json({ response: resp, sourceHash: state.doc.sourceHash })
  }

  // /docs/:id/responses/:rid/...
  if (segs.length < 1) return fail(400, 'response id required')
  const rid = segs[0]
  const resp = state.responses[rid]
  if (!resp) return notFound()
  const verb = segs[1] ?? null

  // POST /docs/:id/responses/:rid/transition  { to: 'stuck' | 'cancelled', reason? }
  // Replaces the old /punt and /cancel sub-routes. `stuck` = drafter punted;
  // `cancelled` = user rescinded.
  if (verb === 'transition' && req.method === 'POST') {
    if (resp.status !== 'pending') return fail(409, 'response is not pending')
    const body = (await req.json().catch(() => ({}))) as { to?: string; reason?: string }
    const to = body.to as TransitionTo | undefined
    if (!to || !VALID_TRANSITIONS.includes(to)) {
      return fail(400, "transition `to` must be 'stuck' or 'cancelled'")
    }
    const reason = typeof body.reason === 'string' ? body.reason : ''
    resp.status = to
    resp.respondedBy = 'self'
    resp.resolvedAt = nowIso()
    if (to === 'stuck') resp.stuckReason = reason

    const event: ResolutionEvent = {
      cursor: bumpCursor(state),
      type: to === 'stuck' ? 'response-stuck' : 'response-cancelled',
      payload:
        to === 'stuck'
          ? { responseId: rid, flagId: resp.flagId, reason }
          : { responseId: rid, flagId: resp.flagId, reason: reason || 'user-rescind' },
      ts: nowIso(),
    }
    appendEvents(state, event)
    await store.writeState(docId, state)
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
 * Used by let-me-try directives. The caller runs reconcile() afterwards to
 * relocate other open anchors.
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

/**
 * Apply an existing awaiting-accept Suggestion: relocate the flag's anchor,
 * splice the candidate text into source, mark candidate accepted + flag
 * resolved. Used by `kind: 'accept'` responses.
 */
function applyAcceptedCandidate(
  state: DocState,
  flag: Flag,
  candidate: Suggestion,
): PerFlagPatchResult {
  const r = relocateAnchor(state.doc.source, flag.anchor)
  if (!r) {
    flag.status = 'stale'
    return { ok: false, reason: 'anchor stale at accept time' }
  }
  state.doc.source =
    state.doc.source.slice(0, r.start) + candidate.post + state.doc.source.slice(r.end)
  state.doc.sourceHash = sha256Hex(state.doc.source)
  candidate.accepted = true
  flag.status = 'resolved'
  flag.anchor = {
    ...flag.anchor,
    start: r.start,
    end: r.start + candidate.post.length,
    text: candidate.post,
  }
  flag.excerpt = candidate.post
  return { ok: true, suggestionId: candidate.id }
}

function pickAwaitingCandidate(state: DocState, flagId: string): Suggestion | null {
  const list = Object.values(state.suggestions)
    .filter((s) => s.flagId === flagId && !s.accepted)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return list[0] ?? null
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
