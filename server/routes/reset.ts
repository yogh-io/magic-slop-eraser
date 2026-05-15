import type { DocStore } from '../store'
import type { DocState } from '../types'
import { appendEvents } from '../types'
import type { ResolutionEvent } from '../../src/types'
import { bus } from '../bus'
import { json, notFound } from '../shared'
import { fail } from '../auth'

function nowIso(): string {
  return new Date().toISOString()
}

function bumpCursor(state: DocState): number {
  state.doc.version += 1
  state.doc.updatedAt = nowIso()
  return state.doc.version
}

/**
 * Drafter-initiated soft reset. The author at the keyboard tells the drafter
 * "this is garbage, start over (with X lens)" - the drafter calls this to
 * scrap its in-flight hypotheses without nuking durable history.
 *
 * Cleared:
 *   - flags with status `open` or `awaiting-accept` (and their unaccepted
 *     suggestions, plus any comments anchored to those flags)
 *   - all `pending` responses (cancelled with cause = drafter-reset)
 *   - all agent tasks (drafter will redeclare phase-a/phase-b on re-walk)
 *   - all agent notes (drafter will repost the Phase A summary fresh)
 *
 * Preserved:
 *   - source text + history (untouched - reverts go through /source/revert)
 *   - resolved/skipped/kept-deliberate/stale flags (durable record)
 *   - accepted suggestions (anchored to resolved flags)
 *   - resolved/cancelled/stuck responses (history)
 *   - density scores (paragraph-hash keyed; still valid)
 *   - agent-hints (author preferences survive the reset)
 *
 * Single `drafter-reset` event lands on the timeline carrying the reason
 * + counts of what was dropped, so the writer sees the breadcrumb.
 *
 * No If-Match: source isn't being mutated, so there's nothing to race
 * against. The drafter calls this on the human's word and re-runs Phase A
 * after.
 */
export async function handleReset(
  req: Request,
  store: DocStore,
  docId: string,
): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method not allowed')
  const state = await store.readState(docId)
  if (!state) return notFound()

  const body = (await req.json().catch(() => ({}))) as { reason?: string }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

  // 1. Drop open / awaiting-accept flags. Track ids for suggestion + comment
  // cleanup. Resolved/skipped/kept/stale flags are durable history; they stay.
  const droppedFlagIds = new Set<string>()
  for (const [id, flag] of Object.entries(state.flags)) {
    const status = flag.status ?? 'open'
    if (status === 'open' || status === 'awaiting-accept') {
      droppedFlagIds.add(id)
      delete state.flags[id]
    }
  }

  // 2. Drop unaccepted suggestions tied to dropped flags. Keep accepted ones
  // (they're anchored to resolved flags and stay as durable history).
  let droppedSuggestions = 0
  for (const [id, sug] of Object.entries(state.suggestions)) {
    if (sug.accepted) continue
    if (droppedFlagIds.has(sug.flagId)) {
      delete state.suggestions[id]
      droppedSuggestions++
    }
  }

  // 3. Cancel pending responses. We cancel rather than delete so the trail
  // stays in /companion - the writer can see what they had asked for.
  let cancelledResponses = 0
  for (const r of Object.values(state.responses)) {
    if (r.status !== 'pending') continue
    r.status = 'cancelled'
    r.respondedBy = 'self'
    r.resolvedAt = nowIso()
    cancelledResponses++
  }

  // 4. Drop comments anchored to dropped flags. Comments on resolved flags
  // stay - they're discussion history about decisions that landed.
  let droppedComments = 0
  for (const [id, c] of Object.entries(state.comments)) {
    if (c.flagId && droppedFlagIds.has(c.flagId)) {
      delete state.comments[id]
      droppedComments++
    }
  }

  // 5. Clear agent activity. Tasks and notes are short-lived state the
  // drafter rebuilds on every walk; lastSeenAt stays so the agent pill
  // doesn't go cold mid-session.
  let droppedTasks = 0
  let droppedNotes = 0
  if (state.agentActivity) {
    droppedTasks = Object.keys(state.agentActivity.tasks ?? {}).length
    droppedNotes = Object.keys(state.agentActivity.notes ?? {}).length
    state.agentActivity.tasks = {}
    state.agentActivity.notes = {}
    state.agentActivity.lastSeenAt = nowIso()
  }

  const event: ResolutionEvent = {
    cursor: bumpCursor(state),
    type: 'drafter-reset',
    payload: {
      reason,
      droppedFlags: droppedFlagIds.size,
      droppedSuggestions,
      cancelledResponses,
      droppedTasks,
      droppedNotes,
      droppedComments,
    },
    ts: nowIso(),
  }
  appendEvents(state, event)
  await store.writeState(docId, state)
  bus.publish(docId, event)

  return json({
    ok: true,
    reason,
    counts: {
      droppedFlags: droppedFlagIds.size,
      droppedSuggestions,
      cancelledResponses,
      droppedTasks,
      droppedNotes,
      droppedComments,
    },
    sourceHash: state.doc.sourceHash,
  })
}
