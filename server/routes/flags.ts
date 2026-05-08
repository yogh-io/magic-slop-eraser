import type { DocStore } from '../store'
import type { DocState } from '../types'
import type { Comment, ResolutionEvent } from '../../src/types'
import { relocateAnchor } from '../../src/anchoring/textAnchor'
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

/**
 * Flag-scoped verbs. The big agent-facing flow lives in `responses.ts` (queue)
 * and `resolutions.ts` (batch resolutions); this file is the user's per-flag
 * state actions: accept, discard, skip, keep-deliberate, comments. All emit
 * events through the same bus.
 */
export async function handleFlags(
  req: Request,
  store: DocStore,
  docId: string,
  segs: string[],
): Promise<Response> {
  const state = await store.readState(docId)
  if (!state) return notFound()
  const authErr = authorize(req, state.doc.token)
  if (authErr) return authErr

  // GET /docs/:id/flags?rung=N&status=open
  if (segs.length === 0 && req.method === 'GET') {
    const url = new URL(req.url)
    const rung = url.searchParams.get('rung')
    const status = url.searchParams.get('status')
    let flags = Object.values(state.flags)
    if (rung) flags = flags.filter((f) => String(f.rung ?? 1) === rung)
    if (status) flags = flags.filter((f) => (f.status ?? 'open') === status)
    flags.sort((a, b) => a.anchor.start - b.anchor.start)
    return json({ flags })
  }

  if (segs.length < 1) return fail(404, 'flag id required')
  const flagId = segs[0]
  const flag = state.flags[flagId]
  if (!flag) return notFound()
  const verb = segs[1] ?? null

  // POST /docs/:id/flags/:fid/accept  - apply the flag's awaiting candidate
  if (verb === 'accept' && req.method === 'POST') {
    if ((flag.status ?? 'open') !== 'awaiting-accept') {
      return fail(409, 'flag has no awaiting candidate')
    }
    const candidate = pickAwaitingCandidate(state, flagId)
    if (!candidate) return fail(409, 'no candidate to accept')

    const r = relocateAnchor(state.doc.source, flag.anchor)
    if (!r) {
      flag.status = 'stale'
      const stale: ResolutionEvent = {
        cursor: bumpCursor(state),
        type: 'flag-stale',
        payload: { flagId, cause: 'source-edit' },
        ts: nowIso(),
      }
      await store.writeState(docId, state)
      await store.appendEvent(docId, stale)
      bus.publish(docId, stale)
      return fail(409, 'anchor stale at accept time')
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

    const events: ResolutionEvent[] = [
      {
        cursor: bumpCursor(state),
        type: 'flag-resolved',
        payload: {
          flagId,
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

  // POST /docs/:id/flags/:fid/discard  - drop awaiting candidate; flag returns to open
  if (verb === 'discard' && req.method === 'POST') {
    const candidate = pickAwaitingCandidate(state, flagId)
    if (!candidate) return fail(409, 'no candidate to discard')
    delete state.suggestions[candidate.id]
    flag.status = 'open'
    const event: ResolutionEvent = {
      cursor: bumpCursor(state),
      type: 'suggestion-discarded',
      payload: { suggestionId: candidate.id, flagId, reason: 'user-discard' },
      ts: nowIso(),
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ ok: true })
  }

  // POST /docs/:id/flags/:fid/skip
  if (verb === 'skip' && req.method === 'POST') {
    flag.status = 'skipped'
    const event: ResolutionEvent = {
      cursor: bumpCursor(state),
      type: 'flag-skipped',
      payload: { flagId },
      ts: nowIso(),
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ ok: true })
  }

  // POST /docs/:id/flags/:fid/keep-deliberate
  if (verb === 'keep-deliberate' && req.method === 'POST') {
    flag.status = 'kept-deliberate'
    const event: ResolutionEvent = {
      cursor: bumpCursor(state),
      type: 'flag-kept',
      payload: { flagId },
      ts: nowIso(),
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ ok: true })
  }

  // POST /docs/:id/flags/:fid/comments
  if (verb === 'comments' && req.method === 'POST') {
    const body = (await req.json()) as { body: string; author?: 'agent' | 'human' }
    if (typeof body?.body !== 'string') return fail(400, 'body required')
    const id = `c-${crypto.randomUUID().slice(0, 8)}`
    const comment: Comment = {
      id,
      docId,
      flagId,
      body: body.body,
      author: body.author ?? 'human',
      createdAt: nowIso(),
    }
    state.comments[id] = comment
    const event: ResolutionEvent = {
      cursor: bumpCursor(state),
      type: 'comment-added',
      payload: { commentId: id, flagId, author: comment.author },
      ts: nowIso(),
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ comment })
  }

  return fail(405, 'method not allowed')
}

function pickAwaitingCandidate(state: DocState, flagId: string) {
  // Most recent unaccepted suggestion is the running best.
  const list = Object.values(state.suggestions)
    .filter((s) => s.flagId === flagId && !s.accepted)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return list[0] ?? null
}
