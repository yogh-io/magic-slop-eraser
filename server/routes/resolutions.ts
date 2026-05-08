import type { DocState, SourceVersion } from '../types'
import { SOURCE_HISTORY_LIMIT } from '../types'
import type { ResolutionEvent, Suggestion } from '../../src/types'
import type { DocStore } from '../store'
import { bus } from '../bus'
import { json, notFound } from '../shared'
import { authorize, fail } from '../auth'
import { sha256Hex } from '../hash'
import { reconcile } from '../reconcile'
import { relocateAnchor } from '../../src/anchoring/textAnchor'

function nowIso(): string {
  return new Date().toISOString()
}

function bumpCursor(state: DocState): number {
  state.doc.version += 1
  state.doc.updatedAt = nowIso()
  return state.doc.version
}

interface PatchInput {
  respondedTo: string
  flagId: string
  replacementText: string
  prompt?: string
}

interface FullSourceInput {
  respondedTo: string[]
  source: string
}

interface ResolutionsBody {
  patches?: PatchInput[]
  fullSource?: FullSourceInput
  modelTag?: string
  notes?: string
}

/**
 * POST /docs/:id/resolutions
 *
 * Agent-facing batch endpoint. Carries any number of per-flag patches plus an
 * optional single fullSource push. Transactional: applies in order, persists
 * once. Requires `If-Match: <sourceHash>` for optimistic concurrency.
 *
 * Per-flag patch behaviour: creates an awaiting-accept Suggestion on the flag.
 * Source is NOT mutated. User must click accept on the flag (or re-direct) to
 * apply the candidate.
 *
 * FullSource behaviour: replaces the source entirely, runs reconciliation,
 * stashes the prior version in history for revert. The listed `respondedTo`
 * responses are marked resolved by the push.
 */
export async function handleResolutions(
  req: Request,
  store: DocStore,
  docId: string,
): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method not allowed')
  const state = await store.readState(docId)
  if (!state) return notFound()
  const authErr = authorize(req, state.doc.token)
  if (authErr) return authErr

  const ifMatch = req.headers.get('if-match') ?? ''
  if (ifMatch && ifMatch !== state.doc.sourceHash) {
    return fail(412, 'source has moved (If-Match mismatch)')
  }

  const body = (await req.json()) as ResolutionsBody
  const modelTag = body.modelTag ?? 'agent'
  const events: ResolutionEvent[] = []

  // 1. Apply per-flag patches: create awaiting-accept Suggestions, mark flags,
  //    resolve the responses they answered.
  if (body.patches) {
    for (const patch of body.patches) {
      const out = applyPatch(state, patch, modelTag, events)
      if (!out.ok) return fail(out.status ?? 422, out.reason ?? 'patch rejected')
    }
  }

  // 2. Apply fullSource push (if present): snapshot, replace, reconcile.
  if (body.fullSource) {
    const out = applyFullSource(state, body.fullSource, modelTag, events)
    if (!out.ok) return fail(out.status ?? 422, out.reason ?? 'fullSource rejected')
  }

  if (events.length === 0) return fail(400, 'empty resolution batch')

  await store.writeState(docId, state)
  for (const e of events) {
    await store.appendEvent(docId, e)
    bus.publish(docId, e)
  }
  return json({ ok: true, version: state.doc.version, sourceHash: state.doc.sourceHash })
}

interface ApplyResult {
  ok: boolean
  status?: number
  reason?: string
}

function applyPatch(
  state: DocState,
  patch: PatchInput,
  modelTag: string,
  events: ResolutionEvent[],
): ApplyResult {
  if (!patch.flagId || !patch.respondedTo) {
    return { ok: false, status: 400, reason: 'patch.flagId and patch.respondedTo required' }
  }
  if (typeof patch.replacementText !== 'string') {
    return { ok: false, status: 400, reason: 'patch.replacementText required' }
  }
  const flag = state.flags[patch.flagId]
  if (!flag) return { ok: false, status: 404, reason: 'unknown flag' }
  if ((flag.status ?? 'open') === 'stale') {
    return { ok: false, status: 409, reason: 'flag is stale' }
  }
  if ((flag.status ?? 'open') === 'resolved') {
    return { ok: false, status: 409, reason: 'flag is already resolved' }
  }
  const resp = state.responses[patch.respondedTo]
  if (!resp) return { ok: false, status: 404, reason: 'unknown response' }
  if (resp.flagId !== flag.id) {
    return { ok: false, status: 400, reason: 'response does not belong to flag' }
  }
  if (resp.status !== 'pending') {
    return { ok: false, status: 409, reason: 'response is not pending' }
  }
  // Sanity: the flag's anchor must still relocate. If the source has drifted
  // since the agent fetched, the anchor still being valid is what matters.
  const r = relocateAnchor(state.doc.source, flag.anchor)
  if (!r) {
    flag.status = 'stale'
    events.push({
      cursor: bumpCursor(state),
      type: 'flag-stale',
      payload: { flagId: flag.id, cause: 'agent' },
      ts: nowIso(),
    })
    return { ok: false, status: 409, reason: 'anchor stale at apply time' }
  }
  const pre = state.doc.source.slice(r.start, r.end)
  flag.anchor = { ...flag.anchor, start: r.start, end: r.end }
  flag.excerpt = pre

  const suggestionId = `s-${crypto.randomUUID().slice(0, 8)}`
  const sug: Suggestion = {
    id: suggestionId,
    flagId: flag.id,
    pre,
    post: patch.replacementText,
    respondedTo: patch.respondedTo,
    prompt: patch.prompt,
    modelTag,
    accepted: false,
    createdAt: nowIso(),
  }
  state.suggestions[suggestionId] = sug
  flag.status = 'awaiting-accept'

  resp.status = 'resolved'
  resp.respondedBy = 'agent'
  resp.resolvedSuggestionId = suggestionId
  resp.resolvedAt = nowIso()

  events.push(
    {
      cursor: bumpCursor(state),
      type: 'suggestion-added',
      payload: {
        suggestionId,
        flagId: flag.id,
        modelTag,
        accepted: false,
        respondedTo: patch.respondedTo,
      },
      ts: nowIso(),
    },
    {
      cursor: bumpCursor(state),
      type: 'flag-awaiting-accept',
      payload: { flagId: flag.id, suggestionId },
      ts: nowIso(),
    },
    {
      cursor: bumpCursor(state),
      type: 'response-resolved',
      payload: { responseId: resp.id, flagId: flag.id, cause: 'agent', suggestionId },
      ts: nowIso(),
    },
  )
  return { ok: true }
}

function applyFullSource(
  state: DocState,
  full: FullSourceInput,
  modelTag: string,
  events: ResolutionEvent[],
): ApplyResult {
  if (typeof full.source !== 'string') {
    return { ok: false, status: 400, reason: 'fullSource.source required' }
  }
  if (!Array.isArray(full.respondedTo)) {
    return { ok: false, status: 400, reason: 'fullSource.respondedTo must be array' }
  }

  // Snapshot the prior source for revert.
  pushHistory(state, 'agent-fullsource')

  state.doc.source = full.source
  state.doc.sourceHash = sha256Hex(full.source)

  events.push({
    cursor: bumpCursor(state),
    type: 'source-edited',
    payload: { length: full.source.length, cause: 'agent', modelTag },
    ts: nowIso(),
  })

  // Reconcile flags + auto-resolve any responses whose flags' text changed.
  const recon = reconcile(state, 'agent', () => bumpCursor(state), nowIso)
  events.push(...recon.events)

  // Mark the explicitly-claimed responses as resolved (if not already auto-resolved).
  for (const rid of full.respondedTo) {
    const resp = state.responses[rid]
    if (!resp || resp.status !== 'pending') continue
    resp.status = 'resolved'
    resp.respondedBy = 'agent'
    resp.resolvedAt = nowIso()
    events.push({
      cursor: bumpCursor(state),
      type: 'response-resolved',
      payload: { responseId: rid, flagId: resp.flagId, cause: 'agent' },
      ts: nowIso(),
    })
  }
  return { ok: true }
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
