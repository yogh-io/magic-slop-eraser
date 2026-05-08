import type { ResolutionEvent } from '../src/types'
import type { DocState } from './types'
import { relocateAnchor } from '../src/anchoring/textAnchor'

export interface ReconcileResult {
  events: ResolutionEvent[]
  flagsResolved: number
  flagsStale: number
  responsesResolved: number
  responsesCancelled: number
}

/**
 * Universal reconciliation pass. Run after any source mutation, regardless of
 * trigger (agent fullSource push, user accept of a per-flag patch that spilled,
 * user paste-edit, revert).
 *
 * For every flag with status `open` or `awaiting-accept`:
 *  - Relocate the anchor against the new source.
 *  - Same text → flag stays as-is.
 *  - Changed text → the source mutation has consumed the slop. Flag auto-resolves;
 *    any pending response on the flag is also resolved with attribution.
 *  - Anchor fails to relocate → flag goes stale. Pending responses cancelled.
 *    Awaiting candidates discarded.
 *
 * Does NOT re-run mechanical detectors. New flags are surfaced only when the
 * caller explicitly requests another detection pass via `POST /run-detectors`,
 * so the user controls when new slop appears in the queue.
 *
 * Mutates `state` in place and returns the events to append + publish. The
 * caller persists the state and ships the events.
 */
export function reconcile(
  state: DocState,
  cause: 'agent' | 'source-edit',
  allocCursor: () => number,
  ts: () => string,
): ReconcileResult {
  const out: ReconcileResult = {
    events: [],
    flagsResolved: 0,
    flagsStale: 0,
    responsesResolved: 0,
    responsesCancelled: 0,
  }

  for (const flag of Object.values(state.flags)) {
    const status = flag.status ?? 'open'
    if (status !== 'open' && status !== 'awaiting-accept') continue

    const r = relocateAnchor(state.doc.source, flag.anchor)
    if (!r) {
      flag.status = 'stale'
      out.events.push({
        cursor: allocCursor(),
        type: 'flag-stale',
        payload: { flagId: flag.id, cause },
        ts: ts(),
      })
      out.flagsStale++
      cancelPendingResponses(state, flag.id, 'flag-stale', allocCursor, ts, out)
      discardAwaitingCandidates(state, flag.id, 'flag-stale', allocCursor, ts, out)
      continue
    }

    const nextExcerpt = state.doc.source.slice(r.start, r.end)
    const wasExcerpt = flag.excerpt
    flag.anchor = { ...flag.anchor, start: r.start, end: r.end }
    flag.excerpt = nextExcerpt

    if (nextExcerpt === wasExcerpt) continue

    flag.status = 'resolved'
    out.events.push({
      cursor: allocCursor(),
      type: 'flag-resolved',
      payload: { flagId: flag.id, cause, replacementText: nextExcerpt },
      ts: ts(),
    })
    out.flagsResolved++

    const respondedBy = cause === 'agent' ? 'agent' : 'source-edit'
    for (const resp of Object.values(state.responses)) {
      if (resp.flagId !== flag.id || resp.status !== 'pending') continue
      resp.status = 'resolved'
      resp.respondedBy = respondedBy
      resp.resolvedAt = ts()
      out.events.push({
        cursor: allocCursor(),
        type: 'response-resolved',
        payload: { responseId: resp.id, flagId: flag.id, cause: respondedBy },
        ts: ts(),
      })
      out.responsesResolved++
    }

    discardAwaitingCandidates(state, flag.id, 'superseded', allocCursor, ts, out)
  }

  return out
}

function cancelPendingResponses(
  state: DocState,
  flagId: string,
  reason: string,
  allocCursor: () => number,
  ts: () => string,
  out: ReconcileResult,
): void {
  for (const resp of Object.values(state.responses)) {
    if (resp.flagId !== flagId || resp.status !== 'pending') continue
    resp.status = 'cancelled'
    resp.respondedBy = 'source-edit'
    resp.resolvedAt = ts()
    out.events.push({
      cursor: allocCursor(),
      type: 'response-cancelled',
      payload: { responseId: resp.id, flagId, reason },
      ts: ts(),
    })
    out.responsesCancelled++
  }
}

function discardAwaitingCandidates(
  state: DocState,
  flagId: string,
  reason: string,
  allocCursor: () => number,
  ts: () => string,
  out: ReconcileResult,
): void {
  for (const sug of Object.values(state.suggestions)) {
    if (sug.flagId !== flagId || sug.accepted) continue
    delete state.suggestions[sug.id]
    out.events.push({
      cursor: allocCursor(),
      type: 'suggestion-discarded',
      payload: { suggestionId: sug.id, flagId, reason },
      ts: ts(),
    })
  }
}
