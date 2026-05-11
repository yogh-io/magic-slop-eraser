import { splitParagraphs, type Paragraph } from '../src/markdown/paragraphs'
import { sha256Hex } from './hash'
import type { DensityAxes, DocState } from './types'

export const DENSITY_SCHEMA = 'symmetric-v1'

/**
 * Force a re-score on any doc whose density was written under the legacy
 * 0..10 distribution-relative scheme. The symmetric-v1 schema uses an
 * external (internet-average) baseline; the two scales aren't compatible,
 * so the safe thing is to drop the cached scores and let the drafter
 * re-score against the new anchor. Returns true if state was mutated and
 * needs persisting.
 */
export function migrateDensitySchema(state: DocState): boolean {
  if (state.densitySchemaVersion === DENSITY_SCHEMA) return false
  state.density = {}
  state.densitySchemaVersion = DENSITY_SCHEMA
  return true
}

export interface ParagraphInfo {
  hash: string
  start: number
  end: number
  text: string
}

/**
 * Build the paragraph list the agent and client share. Hash is sha-256 of
 * the canonical (whitespace-collapsed) form so the two sides agree on keys
 * without re-implementing normalization.
 */
export function computeParagraphInfo(source: string): ParagraphInfo[] {
  return splitParagraphs(source).map((p: Paragraph) => ({
    hash: sha256Hex(p.hashKey),
    start: p.start,
    end: p.end,
    text: p.text,
  }))
}

/** Set of paragraph hashes currently present in the source. */
export function liveHashes(source: string): Set<string> {
  return new Set(computeParagraphInfo(source).map((p) => p.hash))
}

/**
 * Drop density entries whose paragraph hash no longer appears in the source.
 * Called from the reconcile pass after every source mutation. Returns the
 * count of dropped entries so the caller can decide whether to emit an event.
 */
export function pruneDensity(state: DocState): number {
  const live = liveHashes(state.doc.source)
  let dropped = 0
  for (const hash of Object.keys(state.density)) {
    if (!live.has(hash)) {
      delete state.density[hash]
      dropped++
    }
  }
  return dropped
}

export function mergeDensity(
  state: DocState,
  scores: Array<{ paragraphHash: string; axes: DensityAxes }>,
): { applied: number; skipped: number } {
  const live = liveHashes(state.doc.source)
  let applied = 0
  let skipped = 0
  for (const entry of scores) {
    if (typeof entry?.paragraphHash !== 'string' || !entry.axes) {
      skipped++
      continue
    }
    if (!live.has(entry.paragraphHash)) {
      // Stale or unknown hash: don't accept (otherwise GC just runs again).
      skipped++
      continue
    }
    const sanitised: DensityAxes = {}
    for (const [k, v] of Object.entries(entry.axes)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue
      if (typeof k !== 'string' || k.length === 0 || k.length > 32) continue
      sanitised[k] = clamp(v, -10, 10)
    }
    if (Object.keys(sanitised).length === 0) {
      skipped++
      continue
    }
    state.density[entry.paragraphHash] = {
      ...(state.density[entry.paragraphHash] ?? {}),
      ...sanitised,
    }
    applied++
  }
  return { applied, skipped }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
