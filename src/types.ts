export type CategoryId =
  | 'lexical'
  | 'structural'
  | 'argumentative'
  | 'tonal'
  | 'format'

export interface CategoryMeta {
  id: CategoryId
  name: string
  tagline: string
  blurb: string
  essay?: string
  toneColor: string
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
  mechanical: boolean
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

export type FlagSource = 'mechanical' | 'llm' | 'user'

export type FlagStatus = 'open' | 'resolved' | 'skipped' | 'kept-deliberate' | 'stale'

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

export type SuggestionVerdict = 'better' | 'worse' | 'close'

export interface Suggestion {
  id: string
  flagId: string
  text: string
  prompt?: string
  modelTag: string
  verdict: SuggestionVerdict | null
  isCurrentBest: boolean
  createdAt: string
}

export interface Comment {
  id: string
  docId: string
  flagId?: string
  body: string
  author: 'agent' | 'human'
  createdAt: string
}

export type EventType =
  | 'flag-added'
  | 'flag-resolved'
  | 'flag-skipped'
  | 'flag-kept'
  | 'flag-stale'
  | 'suggestion-added'
  | 'suggestion-verdict'
  | 'comment-added'
  | 'source-edited'
  | 'document-replaced'

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
