import type { AgentHints, Comment, DocResponse, Flag, Suggestion } from '../src/types'

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

export interface DocState {
  doc: DocRecord
  flags: Record<string, Flag>
  suggestions: Record<string, Suggestion>
  responses: Record<string, DocResponse>
  comments: Record<string, Comment>
  /** Bounded ring buffer of prior source states for revert. Newest last. */
  history: SourceVersion[]
  agentHints: AgentHints
}

export interface NewDocInput {
  source: string
  title?: string
}

export const SOURCE_HISTORY_LIMIT = 8
