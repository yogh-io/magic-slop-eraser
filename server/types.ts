import type { Flag, ResolutionEvent, Suggestion, Comment } from '../src/types'

export interface DocRecord {
  id: string
  token: string
  title: string
  source: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface DocState {
  doc: DocRecord
  flags: Record<string, Flag>
  suggestions: Record<string, Suggestion>
  comments: Record<string, Comment>
}

export interface NewDocInput {
  source: string
  title?: string
}
