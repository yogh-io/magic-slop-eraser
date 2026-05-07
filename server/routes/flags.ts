import type { DocStore } from '../store'
import type { DocState } from '../types'
import type { Comment, Flag, ResolutionEvent, Suggestion, SuggestionVerdict } from '../../src/types'
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

  // GET /docs/:id/flags?rung=N&status=open&cursor=N
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

  // /docs/:id/flags/:fid/...
  if (segs.length < 1) return fail(404, 'flag id required')
  const flagId = segs[0]
  const flag = state.flags[flagId]
  if (!flag) return notFound()

  const verb = segs[1] ?? null
  const subId = segs[2] ?? null

  // POST /flags/:fid/suggestions  - agent posts a candidate
  if (verb === 'suggestions' && subId === null && req.method === 'POST') {
    const body = (await req.json()) as { text: string; prompt?: string; modelTag?: string }
    if (typeof body?.text !== 'string') return fail(400, 'text required')
    const id = `s-${crypto.randomUUID().slice(0, 8)}`
    const sug: Suggestion = {
      id,
      flagId,
      text: body.text,
      prompt: body.prompt,
      modelTag: body.modelTag ?? 'unknown',
      verdict: null,
      isCurrentBest: false,
      createdAt: nowIso(),
    }
    state.suggestions[id] = sug
    const cursor = nextCursor(state)
    const event: ResolutionEvent = {
      cursor,
      type: 'suggestion-added',
      payload: { flagId, suggestionId: id, modelTag: sug.modelTag },
      ts: nowIso(),
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ suggestion: sug })
  }

  // POST /flags/:fid/suggestions/:sid/verdict  - human marks BETTER/WORSE/CLOSE
  if (verb === 'suggestions' && subId !== null && segs[3] === 'verdict' && req.method === 'POST') {
    const sug = state.suggestions[subId]
    if (!sug || sug.flagId !== flagId) return notFound()
    const body = (await req.json()) as { verdict: SuggestionVerdict }
    if (!['better', 'worse', 'close'].includes(body?.verdict)) return fail(400, 'verdict required')
    sug.verdict = body.verdict
    if (body.verdict === 'better') {
      // demote previous best, promote this one
      for (const s of Object.values(state.suggestions)) {
        if (s.flagId === flagId) s.isCurrentBest = false
      }
      sug.isCurrentBest = true
    }
    const cursor = nextCursor(state)
    const event: ResolutionEvent = {
      cursor,
      type: 'suggestion-verdict',
      payload: { flagId, suggestionId: subId, verdict: body.verdict },
      ts: nowIso(),
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ suggestion: sug })
  }

  // POST /flags/:fid/resolve  - apply edit, mark resolved
  if (verb === 'resolve' && req.method === 'POST') {
    const body = (await req.json()) as { suggestionId?: string; patch?: string }
    let replacement: string | null = null
    if (body?.suggestionId) {
      const s = state.suggestions[body.suggestionId]
      if (!s || s.flagId !== flagId) return fail(400, 'invalid suggestionId')
      replacement = s.text
    } else if (typeof body?.patch === 'string') {
      replacement = body.patch
    } else {
      return fail(400, 'suggestionId or patch required')
    }

    // Apply replacement to source at the (possibly relocated) flag anchor
    const r = relocateAnchor(state.doc.source, flag.anchor)
    if (!r) {
      flag.status = 'stale'
      const cursor = nextCursor(state)
      const event: ResolutionEvent = {
        cursor,
        type: 'flag-stale',
        payload: { flagId },
        ts: nowIso(),
      }
      await store.writeState(docId, state)
      await store.appendEvent(docId, event)
      bus.publish(docId, event)
      return fail(409, 'anchor stale')
    }
    state.doc.source = state.doc.source.slice(0, r.start) + replacement + state.doc.source.slice(r.end)
    flag.status = 'resolved'

    // relocate other open flags in the same document
    for (const f of Object.values(state.flags)) {
      if (f.id === flagId) continue
      if ((f.status ?? 'open') !== 'open') continue
      const rr = relocateAnchor(state.doc.source, f.anchor)
      if (!rr) {
        f.status = 'stale'
      } else {
        f.anchor = { ...f.anchor, start: rr.start, end: rr.end }
        f.excerpt = state.doc.source.slice(rr.start, rr.end)
      }
    }

    const cursor = nextCursor(state)
    const event: ResolutionEvent = {
      cursor,
      type: 'flag-resolved',
      payload: { flagId, replacement, suggestionId: body.suggestionId ?? null },
      ts: nowIso(),
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ ok: true, source: state.doc.source, version: state.doc.version })
  }

  // POST /flags/:fid/skip
  if (verb === 'skip' && req.method === 'POST') {
    flag.status = 'skipped'
    const cursor = nextCursor(state)
    const event: ResolutionEvent = {
      cursor,
      type: 'flag-skipped',
      payload: { flagId },
      ts: nowIso(),
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ ok: true })
  }

  // POST /flags/:fid/keep-deliberate
  if (verb === 'keep-deliberate' && req.method === 'POST') {
    flag.status = 'kept-deliberate'
    const cursor = nextCursor(state)
    const event: ResolutionEvent = {
      cursor,
      type: 'flag-kept',
      payload: { flagId },
      ts: nowIso(),
    }
    await store.writeState(docId, state)
    await store.appendEvent(docId, event)
    bus.publish(docId, event)
    return json({ ok: true })
  }

  // POST /flags/:fid/comments
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
    const cursor = nextCursor(state)
    const event: ResolutionEvent = {
      cursor,
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
