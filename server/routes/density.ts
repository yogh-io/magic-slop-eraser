import type { ResolutionEvent } from '../../src/types'
import type { DocStore } from '../store'
import type { DensityAxes } from '../types'
import { appendEvents } from '../types'
import { bus } from '../bus'
import { json, notFound } from '../shared'
import { fail } from '../auth'
import { computeParagraphInfo, mergeDensity, migrateDensitySchema, DENSITY_SCHEMA } from '../density'

interface PostDensityBody {
  scores?: Array<{ paragraphHash: string; axes: DensityAxes }>
  modelTag?: string
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * GET  /docs/:id/density   -> { paragraphs, density }
 * POST /docs/:id/density   { scores: [{ paragraphHash, axes }], modelTag? }
 *
 * Density is the agent's vibes signal: per-paragraph numeric scores along a
 * handful of axes (information, argument, impact, specificity - the
 * canonical default; the agent may add or drop axes, the client renders the
 * union it's seen). Scored paragraphs are keyed by their content hash, so a
 * paragraph the user hasn't touched keeps its score across edits and only
 * the changed paragraphs need re-scoring.
 */
export async function handleDensity(
  req: Request,
  store: DocStore,
  docId: string,
): Promise<Response> {
  const state = await store.readState(docId)
  if (!state) return notFound()
  // Backfill for docs persisted before the density field existed.
  if (!state.density) state.density = {}
  // Legacy 0..10 scores are dropped on first read after the schema bump so
  // the drafter re-scores against the symmetric-v1 (internet-average) anchor.
  if (migrateDensitySchema(state)) await store.writeState(docId, state)

  if (req.method === 'GET') {
    return json({
      paragraphs: computeParagraphInfo(state.doc.source),
      density: state.density,
    })
  }

  if (req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as PostDensityBody | null
    if (!body || !Array.isArray(body.scores)) {
      return fail(400, 'scores array required')
    }
    const result = mergeDensity(state, body.scores)
    if (result.applied === 0) {
      return json({ applied: 0, skipped: result.skipped, density: state.density })
    }

    state.doc.version += 1
    state.doc.updatedAt = nowIso()
    const event: ResolutionEvent = {
      cursor: state.doc.version,
      type: 'density-updated',
      payload: {
        applied: result.applied,
        skipped: result.skipped,
        modelTag: body.modelTag ?? 'unspecified',
      },
      ts: nowIso(),
    }

    appendEvents(state, event)
    await store.writeState(docId, state)
    bus.publish(docId, event)

    return json({
      applied: result.applied,
      skipped: result.skipped,
      density: state.density,
    })
  }

  return fail(405, 'method not allowed')
}
