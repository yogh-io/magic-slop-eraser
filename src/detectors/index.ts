/**
 * Scoring helpers. The regex detection layer was removed; all detection now
 * happens drafter-side via `POST /docs/:id/flags` (BYOM analysis). What
 * remains here is severity defaults (used by the agent flag-creation route
 * when the drafter omits a severity) and the score computation read by
 * `GET /docs/:id`.
 *
 * The `severityFor` mapping is a temporary holdover. Slated for replacement
 * by drafter-supplied subjective weighting informed by the voice memo.
 */
import type { Flag } from '../types'

export function severityFor(patternId: string): number {
  switch (patternId) {
    case 'antithesis':
    case 'absent-actor':
    case 'allusive-construct':
    case 'suffocation':
      return 0.95
    case 'tier1-lexicon':
    case 'closers':
    case 'throat-clearing':
    case 'vague-gravitas':
      return 0.8
    case 'enthusiasm-inflation':
      return 0.6
    default:
      return 0.6
  }
}

export interface ScoreResult {
  value: number
  rationale: string
  topContributors: { patternId: string; count: number }[]
}

/**
 * Compute a 0-10 score from a flag set + a prose word count. Currently
 * fed only Rung 1 flags by the GET /docs/:id endpoint, per the methodology
 * (Rung 2 / Rung 3 are reading-comprehension, not number-fodder). Drafter-
 * side scoring across all rungs is the next iteration.
 */
export function scoreFromFlags(flags: Flag[], proseWordCount: number): ScoreResult {
  const counts = new Map<string, number>()
  let weighted = 0
  for (const f of flags) {
    counts.set(f.patternId, (counts.get(f.patternId) ?? 0) + 1)
    weighted += f.severity
  }
  const density = proseWordCount > 0 ? weighted / (proseWordCount / 100) : 0
  let raw = 10 - density * 1.6
  const ceilings: { id: string; cap: number }[] = []
  if (counts.has('antithesis')) ceilings.push({ id: 'antithesis', cap: 7 })
  if ((counts.get('vague-gravitas') ?? 0) >= 1) ceilings.push({ id: 'vague-gravitas', cap: 7 })
  if ((counts.get('tier1-lexicon') ?? 0) >= 1) ceilings.push({ id: 'tier1-lexicon', cap: 7 })
  if (ceilings.length >= 2) raw = Math.min(raw, 6)
  if (ceilings.length >= 3) raw = Math.min(raw, 5)
  if (ceilings.length >= 4) raw = Math.min(raw, 4)
  for (const c of ceilings) raw = Math.min(raw, c.cap)
  const value = Math.max(0, Math.min(10, Math.round(raw * 10) / 10))
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([patternId, count]) => ({ patternId, count }))
  const rationale = describeScore(value, top)
  return { value, rationale, topContributors: top }
}

function describeScore(v: number, top: { patternId: string; count: number }[]): string {
  if (top.length === 0) return 'No Rung 1 flags raised yet. Hand the URL to your drafter and let it do the analysis pass.'
  const lead = top.slice(0, 2).map((t) => `${t.patternId} (${t.count})`).join(', ')
  if (v >= 8) return `Light slop. Dominant tics: ${lead}.`
  if (v >= 6) return `Noticeable slop. Dominant tics: ${lead}.`
  if (v >= 4) return `Substantial slop. Patterns recur. Dominant tics: ${lead}.`
  return `Saturated. ${lead} repeats throughout.`
}
