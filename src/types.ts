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

export interface Flag {
  id: string
  patternId: string
  category: CategoryId
  source: FlagSource
  anchor: TextAnchor
  rationale: string
  excerpt: string
  severity: number
  userNote?: string
  createdAt: string
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
