/**
 * Scoring helpers. Detection happens drafter-side via `POST /docs/:id/flags`;
 * the drafter sets `severity` per flag (subjectively, informed by the voice
 * memo) and that severity is what feeds the score. The server's job is to
 * aggregate, not to judge.
 *
 * `severityFor` is a fallback for drafters that omit `severity` in their
 * flag submissions. Real scoring quality comes from the drafter setting
 * weights deliberately.
 */
import type { Flag, Rung } from '../types'

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

export interface RungBreakdown {
  count: number
  weighted: number
}

export interface ScoreResult {
  value: number
  rationale: string
  topContributors: { patternId: string; count: number; weighted: number }[]
  byRung: Record<Rung, RungBreakdown>
}

/**
 * Compute the 0-10 score from a flag set across all three rungs. The drafter's
 * per-flag `severity` is the load-bearing input - if the drafter has voice-
 * memo-informed weights, they show up here. The math is density-based with
 * a few pattern-specific ceilings for the worst offenders.
 *
 * Returns the overall score plus per-rung and per-pattern breakdowns so the
 * UI can surface "where the slop is" without a second pass.
 */
export function scoreFromFlags(flags: Flag[], proseWordCount: number): ScoreResult {
  const counts = new Map<string, number>()
  const weightedByPattern = new Map<string, number>()
  const byRung: Record<Rung, RungBreakdown> = {
    1: { count: 0, weighted: 0 },
    2: { count: 0, weighted: 0 },
    3: { count: 0, weighted: 0 },
  }
  let totalWeighted = 0
  for (const f of flags) {
    counts.set(f.patternId, (counts.get(f.patternId) ?? 0) + 1)
    weightedByPattern.set(f.patternId, (weightedByPattern.get(f.patternId) ?? 0) + f.severity)
    totalWeighted += f.severity
    const rung = (f.rung ?? 1) as Rung
    byRung[rung].count += 1
    byRung[rung].weighted += f.severity
  }
  const density = proseWordCount > 0 ? totalWeighted / (proseWordCount / 100) : 0
  let raw = 10 - density * 1.6
  const ceilings: { id: string; cap: number }[] = []
  if (counts.has('antithesis')) ceilings.push({ id: 'antithesis', cap: 7 })
  if ((counts.get('vague-gravitas') ?? 0) >= 1) ceilings.push({ id: 'vague-gravitas', cap: 7 })
  if ((counts.get('tier1-lexicon') ?? 0) >= 1) ceilings.push({ id: 'tier1-lexicon', cap: 7 })
  if ((counts.get('frame-stacking') ?? 0) >= 1) ceilings.push({ id: 'frame-stacking', cap: 7 })
  if (ceilings.length >= 2) raw = Math.min(raw, 6)
  if (ceilings.length >= 3) raw = Math.min(raw, 5)
  if (ceilings.length >= 4) raw = Math.min(raw, 4)
  for (const c of ceilings) raw = Math.min(raw, c.cap)
  const value = Math.max(0, Math.min(10, Math.round(raw * 10) / 10))
  const topContributors = [...counts.entries()]
    .map(([patternId, count]) => ({
      patternId,
      count,
      weighted: weightedByPattern.get(patternId) ?? 0,
    }))
    .sort((a, b) => b.weighted - a.weighted)
  const rationale = describeScore(value, topContributors, byRung)
  return { value, rationale, topContributors, byRung }
}

function describeScore(
  v: number,
  top: { patternId: string; count: number }[],
  byRung: Record<Rung, RungBreakdown>,
): string {
  if (top.length === 0) {
    return 'No flags raised yet. Hand the URL to your drafter and let it do the analysis pass.'
  }
  const lead = top
    .slice(0, 2)
    .map((t) => `${t.patternId} (${t.count})`)
    .join(', ')
  const rungLine = describeRungs(byRung)
  const head =
    v >= 8 ? 'Light slop' :
    v >= 6 ? 'Noticeable slop' :
    v >= 4 ? 'Substantial slop. Patterns recur' :
    'Saturated'
  return `${head}. ${rungLine ? rungLine + ' ' : ''}Dominant tics: ${lead}.`
}

function describeRungs(byRung: Record<Rung, RungBreakdown>): string {
  const parts: string[] = []
  if (byRung[1].count > 0) parts.push(`R1 ${byRung[1].count}`)
  if (byRung[2].count > 0) parts.push(`R2 ${byRung[2].count}`)
  if (byRung[3].count > 0) parts.push(`R3 ${byRung[3].count}`)
  if (parts.length === 0) return ''
  return `(${parts.join(' / ')}).`
}
