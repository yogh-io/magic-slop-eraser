import type { DocStore } from '../store'
import type { DocState } from '../types'
import type { Comment, Flag, FlagSource, ResolutionEvent, Suggestion, TextAnchor } from '../../src/types'
import { makeAnchor, relocateAnchor } from '../../src/anchoring/textAnchor'
import { patterns } from '../../src/catalog/patterns'
import { severityFor } from '../../src/detectors'
import { bus } from '../bus'
import { json, notFound } from '../shared'
import { fail } from '../auth'
import { sha256Hex } from '../hash'
import { reconcile } from '../reconcile'

const patternMap = new Map(patterns.map((p) => [p.id, p]))

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

  // POST /docs/:id/flags - agent submits LLM-detected flags (BYOM analysis)
  // with optional inline suggestions. Each input flag carries patternId +
  // anchor (start/end/text) + rationale; the server validates the anchor
  // against current source (relocates if needed), dedupes against existing
  // open flags, and creates Flag records. If `suggestion` is present, the
  // server also creates a Suggestion (no respondedTo - agent-initial), and
  // the flag goes straight to awaiting-accept so the author can take it
  // without issuing a directive first.
  if (segs.length === 0 && req.method === 'POST') {
    const ifMatch = req.headers.get('if-match') ?? ''
    if (ifMatch && ifMatch !== state.doc.sourceHash) {
      return fail(412, 'source has moved (If-Match mismatch)')
    }
    const body = (await req.json().catch(() => null)) as {
      flags?: AgentFlagInput[]
      modelTag?: string
      source?: FlagSource
    } | null
    if (!body || !Array.isArray(body.flags)) return fail(400, 'flags array required')
    const fSource: FlagSource = body.source === 'user' ? 'user' : 'llm'
    const modelTag = body.modelTag ?? 'unspecified'

    const events: ResolutionEvent[] = []
    const created: Flag[] = []
    const skipped: Array<{ reason: string; patternId?: string; text?: string }> = []

    for (const inp of body.flags) {
      const meta = inp?.patternId ? patternMap.get(inp.patternId) : undefined
      if (!meta) {
        skipped.push({ reason: 'unknown patternId', patternId: inp?.patternId })
        continue
      }
      if (typeof inp.text !== 'string' || inp.text.length === 0) {
        skipped.push({ reason: 'text required', patternId: inp.patternId })
        continue
      }
      if (typeof inp.rationale !== 'string' || inp.rationale.trim().length === 0) {
        skipped.push({ reason: 'rationale required', patternId: inp.patternId })
        continue
      }

      const located = locateAnchor(state.doc.source, inp)
      if (!located) {
        skipped.push({ reason: 'text not found in source', patternId: inp.patternId, text: inp.text })
        continue
      }
      const anchor = makeAnchor(state.doc.source, located.start, located.end)

      if (existsOpenFlag(state, inp.patternId, anchor)) {
        skipped.push({ reason: 'duplicate of existing open flag', patternId: inp.patternId })
        continue
      }

      const flagId = `llm-${crypto.randomUUID().slice(0, 8)}`
      const stored: Flag = {
        id: flagId,
        patternId: inp.patternId,
        category: meta.category,
        source: fSource,
        anchor,
        rationale: inp.rationale.trim(),
        excerpt: anchor.text,
        severity: typeof inp.severity === 'number' ? inp.severity : severityFor(inp.patternId),
        rung: meta.rung,
        status: 'open',
        createdAt: nowIso(),
      }
      state.flags[flagId] = stored

      let suggestionEvent: ResolutionEvent | null = null
      if (typeof inp.suggestion === 'string' && inp.suggestion.length > 0) {
        const suggId = `s-${crypto.randomUUID().slice(0, 8)}`
        const suggestion: Suggestion = {
          id: suggId,
          flagId,
          pre: anchor.text,
          post: inp.suggestion,
          modelTag,
          accepted: false,
          createdAt: nowIso(),
        }
        state.suggestions[suggId] = suggestion
        stored.status = 'awaiting-accept'
        suggestionEvent = {
          cursor: bumpCursor(state),
          type: 'suggestion-added',
          payload: { suggestionId: suggId, flagId, modelTag },
          ts: nowIso(),
        }
      }

      events.push({
        cursor: bumpCursor(state),
        type: 'flag-added',
        payload: { flagId, patternId: stored.patternId, rung: stored.rung, source: fSource },
        ts: nowIso(),
      })
      if (suggestionEvent) events.push(suggestionEvent)
      created.push(stored)
    }

    await store.writeState(docId, state)
    for (const e of events) {
      await store.appendEvent(docId, e)
      bus.publish(docId, e)
    }
    return json({ added: created.length, flags: created, skipped })
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

interface AgentFlagInput {
  patternId: string
  start?: number
  end?: number
  text: string
  rationale: string
  severity?: number
  suggestion?: string
}

/**
 * Find the agent's claimed anchor in the current source. Tries the exact
 * start/end first; falls back to relocateAnchor with the prefix/suffix
 * window built around `text`. Returns null if the text can't be located
 * unambiguously.
 */
function locateAnchor(source: string, inp: AgentFlagInput): { start: number; end: number } | null {
  const text = inp.text
  if (
    typeof inp.start === 'number' &&
    typeof inp.end === 'number' &&
    inp.start >= 0 &&
    inp.end > inp.start &&
    inp.end <= source.length &&
    source.slice(inp.start, inp.end) === text
  ) {
    return { start: inp.start, end: inp.end }
  }
  // Fall back to single-occurrence search via relocateAnchor.
  const provisional: TextAnchor = {
    start: typeof inp.start === 'number' ? inp.start : 0,
    end: typeof inp.end === 'number' ? inp.end : text.length,
    text,
    prefix: '',
    suffix: '',
  }
  return relocateAnchor(source, provisional)
}

function existsOpenFlag(state: DocState, patternId: string, anchor: TextAnchor): boolean {
  for (const f of Object.values(state.flags)) {
    const status = f.status ?? 'open'
    if (status !== 'open' && status !== 'awaiting-accept') continue
    if (f.patternId !== patternId) continue
    if (f.anchor.start === anchor.start && f.anchor.end === anchor.end) return true
  }
  return false
}
