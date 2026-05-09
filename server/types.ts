import type {
  AgentActivity,
  AgentHints,
  Comment,
  DocResponse,
  Flag,
  ResolutionEvent,
  Suggestion,
} from '../src/types'

export interface DocRecord {
  id: string
  title: string
  source: string
  /** sha-256 of the current source. Used by `If-Match` for optimistic concurrency. */
  sourceHash: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface SourceVersion {
  /** Doc version at which this snapshot was the live source. */
  version: number
  source: string
  sourceHash: string
  /** Why the snapshot was taken (the mutation that superseded this state). */
  cause: 'agent-fullsource' | 'user-edit' | 'flag-accept' | 'revert' | 'initial'
  ts: string
}

/**
 * Per-paragraph density scores keyed by the paragraph's content hash. Axes
 * are arbitrary strings - the agent posts whatever set it scored against,
 * the client renders the union with known axes getting their canonical
 * color and unknowns getting a neutral fallback.
 */
export type DensityAxes = Record<string, number>

export interface DocState {
  doc: DocRecord
  flags: Record<string, Flag>
  suggestions: Record<string, Suggestion>
  responses: Record<string, DocResponse>
  comments: Record<string, Comment>
  /** Bounded ring buffer of prior source states for revert. Newest last. */
  history: SourceVersion[]
  agentHints: AgentHints
  /** density[paragraphHash] = { axisName -> score (0-10) }. Cached across edits; */
  /** entries whose hash is no longer present in the source are GC'd on reconcile. */
  density: Record<string, DensityAxes>
  /** Drafter-reported activity: heartbeat, declared tasks, free-form notes. */
  agentActivity: AgentActivity
  /** Append-only event log. Lives in-state because object stores can't append;
   *  every mutation re-PUTs the whole blob anyway. SSE catch-up + companion
   *  doc both read from here. Bounded at write time. */
  events: ResolutionEvent[]
}

/**
 * Cap on `state.events`. The newest N events are kept; older entries fall off.
 * Sized so a 72-hour session of normal activity stays well under cap, while
 * keeping the per-doc blob comfortably small for re-PUT on every mutation.
 */
export const EVENT_LOG_LIMIT = 2000

/**
 * Push events onto `state.events`, trimming the oldest if the cap is reached.
 * Routes use this in place of the old `store.appendEvent` so all the events
 * for a request ride along with the single `writeState` that follows.
 */
export function appendEvents(state: DocState, ...events: ResolutionEvent[]): void {
  if (events.length === 0) return
  state.events.push(...events)
  if (state.events.length > EVENT_LOG_LIMIT) {
    state.events.splice(0, state.events.length - EVENT_LOG_LIMIT)
  }
}

export interface NewDocInput {
  source: string
  title?: string
}

export const SOURCE_HISTORY_LIMIT = 8
