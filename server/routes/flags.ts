import type { DocStore } from '../store'
import type { DocState } from '../types'
import { appendEvents } from '../types'
import type { Comment, Flag, FlagSource, ResolutionEvent, Suggestion, TextAnchor } from '../../src/types'
import { makeAnchor, relocateAnchor } from '../../src/anchoring/textAnchor'
import { patterns } from '../../src/catalog/patterns'
import { severityFor } from '../../src/detectors'
import { bus } from '../bus'
import { json, notFound } from '../shared'
import { fail } from '../auth'

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
 * Flag endpoints. The big agent-facing flow lives in `responses.ts` (queue,
 * accept/discard/skip/keep, transitions) and `resolutions.ts` (batch
 * resolutions). This file is now just two routes:
 *  - GET / POST /docs/:id/flags  (list + drafter detection)
 *  - POST /docs/:id/flags/:fid/comments  (free-form thread)
 *
 * The old per-flag verbs (accept, discard, skip, keep-deliberate) folded into
 * `POST /responses { flagId, kind: 'accept' | ... }` so the response subsystem
 * is the single home for user state-transitions on a flag.
 */
export async function handleFlags(
  req: Request,
  store: DocStore,
  docId: string,
  segs: string[],
): Promise<Response> {
  const state = await store.readState(docId)
  if (!state) return notFound()

  // GET /docs/:id/flags?rung=N&status=open&source=user|llm
  if (segs.length === 0 && req.method === 'GET') {
    const url = new URL(req.url)
    const rung = url.searchParams.get('rung')
    const status = url.searchParams.get('status')
    const sourceParam = url.searchParams.get('source')
    let flags = Object.values(state.flags)
    if (rung) flags = flags.filter((f) => String(f.rung ?? 1) === rung)
    if (status) flags = flags.filter((f) => (f.status ?? 'open') === status)
    if (sourceParam === 'user' || sourceParam === 'llm') {
      flags = flags.filter((f) => f.source === sourceParam)
    }
    flags.sort((a, b) => a.anchor.start - b.anchor.start)
    return json({ flags })
  }

  // POST /docs/:id/flags - agent submits LLM-detected flags (BYOM analysis)
  // with optional inline suggestions. Each input flag carries patternId +
  // anchor (start/end/text) + rationale; the server validates the patternId
  // against the catalogue, relocates the anchor against the current source,
  // optionally validates / relocates relatedPatterns and relatedAnchors, and
  // creates a Flag record. The server does NOT dedupe or cluster - those are
  // drafter-side decisions made in the synthesis subagent before posting. If
  // `suggestion` is present, the server also creates a Suggestion (no
  // respondedTo - agent-initial), and the flag goes straight to
  // awaiting-accept so the author can take it without a directive first.
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
      // Common: text is required for both modes (the anchored span).
      if (typeof inp?.text !== 'string' || inp.text.length === 0) {
        skipped.push({ reason: 'text required', patternId: inp?.patternId })
        continue
      }

      const located = locateAnchor(state.doc.source, inp)
      if (!located) {
        skipped.push({ reason: 'text not found in source', patternId: inp.patternId, text: inp.text })
        continue
      }
      const anchor = makeAnchor(state.doc.source, located.start, located.end)
      const flagPrefix = fSource === 'user' ? 'usr' : 'llm'
      const flagId = `${flagPrefix}-${crypto.randomUUID().slice(0, 8)}`

      let stored: Flag
      if (fSource === 'user') {
        // Brush flag - reader is venting, not classifying. Reject inputs that
        // try to set catalogue fields (patternId/category/rung): the v2
        // reflection loop is what maps brush flags back into the catalogue.
        if (typeof inp.userNote !== 'string' || inp.userNote.trim().length === 0) {
          skipped.push({ reason: 'userNote required for brush flag' })
          continue
        }
        if (inp.patternId) {
          skipped.push({ reason: 'brush flag must not set patternId' })
          continue
        }
        stored = {
          id: flagId,
          source: 'user',
          anchor,
          rationale: inp.userNote.trim(),
          excerpt: anchor.text,
          severity: typeof inp.severity === 'number' ? inp.severity : 0.6,
          userNote: inp.userNote.trim(),
          status: 'open',
          createdAt: nowIso(),
        }
      } else {
        // Scan flag - catalogue-matched. patternId + rationale required;
        // optional inline suggestion lands the flag in awaiting-accept.
        const patternId = inp.patternId
        const meta = patternId ? patternMap.get(patternId) : undefined
        if (!meta || !patternId) {
          skipped.push({ reason: 'unknown patternId', patternId })
          continue
        }
        if (typeof inp.rationale !== 'string' || inp.rationale.trim().length === 0) {
          skipped.push({ reason: 'rationale required', patternId })
          continue
        }

        const relatedPatterns = Array.isArray(inp.relatedPatterns)
          ? inp.relatedPatterns.filter((id) => typeof id === 'string' && id !== patternId && patternMap.has(id))
          : undefined

        const relatedAnchors = Array.isArray(inp.relatedAnchors)
          ? inp.relatedAnchors
              .map((r) => {
                if (!r || typeof r.text !== 'string' || r.text.length === 0) return null
                const loc = locateAnchor(state.doc.source, { text: r.text, start: r.start, end: r.end })
                if (!loc) return null
                return makeAnchor(state.doc.source, loc.start, loc.end)
              })
              .filter((a): a is TextAnchor => a !== null)
          : undefined

        stored = {
          id: flagId,
          patternId,
          category: meta.category,
          source: 'llm',
          anchor,
          rationale: inp.rationale.trim(),
          excerpt: anchor.text,
          severity: typeof inp.severity === 'number' ? inp.severity : severityFor(patternId),
          rung: meta.rung,
          status: 'open',
          createdAt: nowIso(),
          ...(relatedPatterns && relatedPatterns.length > 0 ? { relatedPatterns } : {}),
          ...(relatedAnchors && relatedAnchors.length > 0 ? { relatedAnchors } : {}),
        }
      }
      state.flags[flagId] = stored

      let suggestionEvent: ResolutionEvent | null = null
      // Inline-suggestion path is scan-only - brush flags wait for the drafter
      // to post candidate fixes via resolutions.
      if (fSource === 'llm' && typeof inp.suggestion === 'string' && inp.suggestion.length > 0) {
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

    appendEvents(state, ...events)
    await store.writeState(docId, state)
    for (const e of events) bus.publish(docId, e)
    return json({ added: created.length, flags: created, skipped, sourceHash: state.doc.sourceHash })
  }

  if (segs.length < 1) return fail(404, 'flag id required')
  const flagId = segs[0]
  const flag = state.flags[flagId]
  if (!flag) return notFound()
  const verb = segs[1] ?? null

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
    appendEvents(state, event)
    await store.writeState(docId, state)
    bus.publish(docId, event)
    return json({ comment })
  }

  // accept / discard / skip / keep-deliberate moved to POST /responses with
  // the matching kind. We deliberately drop them here rather than aliasing,
  // so any client still hitting them gets a clear 404 in the timeline.
  return fail(405, 'method not allowed')
}

interface AgentFlagInput {
  /** Required for scan (`source: 'llm'`); rejected for brush (`source: 'user'`). */
  patternId?: string
  start?: number
  end?: number
  text: string
  /** Required for scan flags; ignored for brush (the user's complaint lives
   *  in `userNote` instead). */
  rationale?: string
  /** Required for brush flags (`source: 'user'`); rejected for scan. The
   *  reader's complaint about the anchored span. */
  userNote?: string
  severity?: number
  /** Scan-only. Optional inline candidate landed alongside detection - flag
   *  goes straight to `awaiting-accept`. Brush flags wait for the drafter
   *  to post candidates via resolutions. */
  suggestion?: string
  /** Other patternIds the drafter's synthesis pass merged into this flag at the
   *  same anchor. Server validates each against the catalogue; unknown ids are
   *  dropped silently. */
  relatedPatterns?: string[]
  /** Other anchors where the same construction recurs. Each is relocated by
   *  text match against the current source; anchors that can't be located
   *  are dropped, the flag stands. */
  relatedAnchors?: Array<{ text: string; start?: number; end?: number }>
}

/**
 * Find the agent's claimed anchor in the current source. Tries the exact
 * start/end first; falls back to relocateAnchor with the prefix/suffix
 * window built around `text`. Returns null if the text can't be located
 * unambiguously.
 */
function locateAnchor(source: string, inp: AgentFlagInput | { text: string; start?: number; end?: number }): { start: number; end: number } | null {
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

