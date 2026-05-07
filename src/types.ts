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

export interface PatternMeta {
  id: string
  category: CategoryId
  name: string
  shortName?: string
  severity: 'primary' | 'high' | 'medium' | 'low'
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
