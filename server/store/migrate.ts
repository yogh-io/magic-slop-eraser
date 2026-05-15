import type { DocState } from '../types'
import type { DocResponse } from '../../src/types'

/**
 * Normalise an on-disk DocState into the current in-memory shape. Stores call
 * this after JSON.parse so route handlers always see the latest schema.
 *
 * Migrations are idempotent - re-running on already-normalised state is a no-op.
 */
export function normaliseDocState(state: DocState): DocState {
  for (const r of Object.values(state.responses)) {
    migrateResolvedSuggestionIds(r)
  }
  return state
}

/**
 * Legacy: `DocResponse.resolvedSuggestionId?: string` (singular).
 * Current: `DocResponse.resolvedSuggestionIds: string[]`.
 *
 * Multi-candidate per-flag was added with brush mode (a Response resolves into
 * N Suggestions). Old records carry the singular field; promote it to a one-
 * element array and drop the legacy key.
 */
function migrateResolvedSuggestionIds(r: DocResponse & { resolvedSuggestionId?: string }): void {
  if (Array.isArray(r.resolvedSuggestionIds)) {
    // Already migrated - drop any stray legacy key.
    if ('resolvedSuggestionId' in r) delete r.resolvedSuggestionId
    return
  }
  if (typeof r.resolvedSuggestionId === 'string' && r.resolvedSuggestionId.length > 0) {
    r.resolvedSuggestionIds = [r.resolvedSuggestionId]
  } else {
    r.resolvedSuggestionIds = []
  }
  delete r.resolvedSuggestionId
}
