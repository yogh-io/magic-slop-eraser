export type CategoryId =
  | 'lexical'
  | 'structural'
  | 'argumentative'

export interface CategoryMeta {
  id: CategoryId
  name: string
  tagline: string
  blurb: string
  essay?: string
  /** Single character or short string used as the category's badge / glyph. */
  glyph: string
  /** Per-theme accent colour. Drives the `--cat-<id>` CSS variable applied at
   *  runtime by state/theme.ts. Add a key per ThemeId; missing keys fall back
   *  to the value for `normal`. */
  themeColors: Record<ThemeId, string>
}

export type Scope = 'word' | 'phrase' | 'sentence' | 'paragraph' | 'piece'

/**
 * Three rungs of attention organising patterns by depth/leverage. The numbering
 * reflects layer, not chronological order - an agent (or author) can attack any
 * rung first based on the draft's stage.
 *
 * - Rung 1 (bottom): mechanical. Regex-catchable, fix is substitute or cut.
 *                    Runs anywhere; no LLM required for detection or fix.
 * - Rung 2 (middle): passage-level judgment. Detection needs an LLM read in
 *                    paragraph context; fix is rewriting a sentence (or a small
 *                    cluster of sentences) with two or three candidate options.
 * - Rung 3 (top):    presentation / editorial. The fix touches whether the
 *                    piece's substance - the actual arguments, values, internal
 *                    merits of what is being said - is coming through. Same
 *                    operation as `chief-edit` and `workshop` in editorial
 *                    pipelines.
 */
export type Rung = 1 | 2 | 3

export interface PatternMeta {
  id: string
  category: CategoryId
  name: string
  shortName?: string
  severity: 'primary' | 'high' | 'medium' | 'low'
  scope: Scope
  rung: Rung
  blurb: string
  essay?: string
  whyItsSlop: string
  fix: string
  examples?: { sloppy: string; better?: string }[]
  skipRule?: string
  subShapes?: string[]
}

export interface TextAnchor {
  start: number
  end: number
  text: string
  prefix: string
  suffix: string
}

export type FlagSource = 'llm' | 'user'

export type FlagStatus =
  | 'open'
  | 'awaiting-accept'
  | 'resolved'
  | 'skipped'
  | 'kept-deliberate'
  | 'stale'

export interface Flag {
  id: string
  patternId: string
  category: CategoryId
  source: FlagSource
  anchor: TextAnchor
  rationale: string
  excerpt: string
  severity: number
  rung?: Rung
  status?: FlagStatus
  userNote?: string
  createdAt: string
}

export interface Suggestion {
  id: string
  flagId: string
  /** The originally-anchored text this candidate replaces. Captured at suggestion
   *  creation so the side-by-side UI and hold-to-toggle gesture have both texts
   *  available without rehydrating from the source. */
  pre: string
  /** The agent's candidate text. Replaces `pre` within the flag's anchor span
   *  when the user clicks accept. Until then it lives only as a render overlay. */
  post: string
  /** The Response (directive) this candidate answers. Absent for agent-initial
   *  suggestions submitted alongside flag detection (BYOM analysis), where the
   *  candidate exists before any author directive. */
  respondedTo?: string
  prompt?: string
  modelTag: string
  /** True once the user clicks accept and the source mutates; false while the
   *  candidate is in awaiting-accept overlay state. */
  accepted: boolean
  createdAt: string
}

export type ResponseStatus = 'pending' | 'resolved' | 'stuck' | 'cancelled'

export type ResponseKind = 'shortcut' | 'free' | 'let-me-try' | 'skip' | 'keep'

/**
 * An author-issued directive on a flag. Each user choice persists immediately;
 * the trail per flag is the steering history. Shortcut + free directives queue
 * for agent processing; let-me-try / skip / keep self-resolve without agent
 * involvement.
 */
export interface DocResponse {
  id: string
  flagId: string
  body: string
  kind: ResponseKind
  status: ResponseStatus
  /** Resulting suggestion ID once status flips to 'resolved' via agent path. */
  resolvedSuggestionId?: string
  /** Free-form reason if status is 'stuck' (agent punted). */
  stuckReason?: string
  /** When auto-resolved by a source mutation (user paste-edit, full-source push
   *  that changed the anchored text), records the cause. */
  respondedBy?: 'agent' | 'source-edit' | 'self'
  createdAt: string
  resolvedAt?: string
}

export interface Comment {
  id: string
  docId: string
  flagId?: string
  body: string
  author: 'agent' | 'human'
  createdAt: string
}

/**
 * Server-side hints describing what the user wants the agent to prioritise.
 * Advisory; honoured by convention via the agent's pull filters. Fields are
 * inclusive filters - omitting a field means "any value".
 */
export interface AgentHints {
  rungs?: Rung[]
  categories?: CategoryId[]
  severities?: PatternMeta['severity'][]
  patternIds?: string[]
  paused?: boolean
}

export type EventType =
  | 'flag-added'
  | 'flag-awaiting-accept'
  | 'flag-resolved'
  | 'flag-skipped'
  | 'flag-kept'
  | 'flag-stale'
  | 'suggestion-added'
  | 'suggestion-discarded'
  | 'response-added'
  | 'response-resolved'
  | 'response-stuck'
  | 'response-cancelled'
  | 'comment-added'
  | 'source-edited'
  | 'source-reverted'
  | 'agent-hints-updated'
  | 'document-replaced'
  | 'density-updated'
  | 'agent-heartbeat'
  | 'agent-note-added'
  | 'agent-task-upserted'
  | 'agent-task-removed'
  | 'drafter-reset'

/**
 * Drafter-declared task. Stable across the session via `key` (drafter-set
 * identifier like "phase-a"). Status moves open -> in-progress -> done.
 * The latest upsert wins; the server emits an `agent-task-upserted` event
 * for any change so the UI can re-render the task list and timeline.
 */
export type AgentTaskStatus = 'open' | 'in-progress' | 'done'
export interface AgentTask {
  key: string
  title: string
  detail?: string
  status: AgentTaskStatus
  createdAt: string
  updatedAt: string
}

/**
 * Free-form heads-up from the drafter. Surfaces in the agent-activity panel
 * as a timestamped note; the kind drives a small visual badge.
 *  - observation: "the piece is unusually committal..."
 *  - finding:     "first batch posted: 5 absent-actor, 3 throat-clearing"
 *  - progress:    "halfway through the catalogue walk"
 *  - concern:     "I can't locate the anchor for X; skipping"
 */
export type AgentNoteKind = 'observation' | 'finding' | 'progress' | 'concern'
export interface AgentNote {
  id: string
  body: string
  kind: AgentNoteKind
  createdAt: string
}

export interface AgentActivity {
  /** ISO timestamp of the most recent drafter ping (any kind: heartbeat, note, task, flag, suggestion, resolution). */
  lastSeenAt?: string
  tasks: Record<string, AgentTask>
  notes: Record<string, AgentNote>
}

export interface ResolutionEvent {
  cursor: number
  type: EventType
  payload: Record<string, unknown>
  ts: string
}

export interface CompanionDoc {
  version: 1
  sourceHash: string
  generatedAt: string
  source: string
  flags: Flag[]
  score?: { value: number; rationale: string }
}

export type ThemeId = 'normal' | 'magic' | 'scholar'
