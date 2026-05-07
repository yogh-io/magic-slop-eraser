import type { CategoryId, Flag, TextAnchor } from '../types'
import { makeAnchor } from '../anchoring/textAnchor'
import { extractSkipZones, isInSkipZone, approximateProseWordCount } from './skipZones'

interface DetectorContext {
  source: string
  zones: ReturnType<typeof extractSkipZones>
  proseWordCount: number
  emit: (raw: RawFlag) => void
}

interface RawFlag {
  patternId: string
  category: CategoryId
  start: number
  end: number
  rationale: string
  severity?: number
}

type Detector = (ctx: DetectorContext) => void

const TIER1 = /\b(delve|delves|delved|delving|tapestry|tapestries|navigate|navigates|navigated|navigating|navigation|realm|realms|embark|embarks|embarked|embarking|leverage|leverages|leveraged|leveraging|foster|fosters|fostered|fostering|cultivate|cultivates|cultivated|cultivating|harness|harnesses|harnessed|harnessing)\b/gi

const ENTHUSIASM = /\b(fascinating|remarkable|profound|striking|compelling|intriguing|illuminating)\b/gi

const THROAT_CLEARING = /(?:^|(?<=[.!?]\s))(It'?s important to note|It'?s worth (?:noting|mentioning)|It'?s interesting that|Importantly|Notably|Crucially|Indeed|Of course|Naturally|Interestingly|Significantly|Ultimately|Fundamentally|Essentially|Basically|Simply put|In essence|At its core|To be clear|To be sure)\b/g

const CLOSERS = /\b(In conclusion|In summary|To summarize|To summarise|All in all|At the end of the day|When all is said and done|All things considered|Taken together)\b/gi

const ANTITHESIS_PATTERNS: RegExp[] = [
  /\b(?:isn'?t|is not)\s+(?:just|merely|only|simply)\s+[^.\n]{1,80}?[-\-]\s*it'?s\b/gi,
  /\bIt'?s not\s+(?:just|merely|only|simply)\s+[^.\n]{1,80}?[-\-]\s*it'?s\b/gi,
  /\bThe question is not\s+[^.\n]{1,80}\.\s*It'?s\b/gi,
  /\bThe question isn'?t\s+[^.\n]{1,80}\.\s*It'?s\b/gi,
  /\bWhat looks like\s+[^.\n]{1,80}\s+is\s+(?:actually|really)\s+/gi,
]

const VAGUE_GRAVITAS = /\b(raises important questions|has profound implications|speaks to deeper truths|points to a larger trend|reflects broader dynamics|underscores the complexity|highlights the tensions|captures the essence|gets at something fundamental)\b/gi

const HEDGE_WORDS = /\b(generally|typically|often|somewhat|relatively|arguably|potentially|possibly|perhaps|fairly|mostly|largely|broadly speaking)\b/gi

function emitMatches(
  ctx: DetectorContext,
  re: RegExp,
  patternId: string,
  category: CategoryId,
  rationale: (m: RegExpMatchArray) => string = () => '',
): void {
  for (const m of ctx.source.matchAll(re)) {
    if (m.index === undefined) continue
    if (isInSkipZone(m.index, ctx.zones)) continue
    ctx.emit({
      patternId,
      category,
      start: m.index,
      end: m.index + m[0].length,
      rationale: rationale(m) || `Matched: "${m[0]}"`,
    })
  }
}

const detectTier1: Detector = (ctx) =>
  emitMatches(ctx, TIER1, 'tier1-lexicon', 'lexical', (m) => `"${m[0]}" - canonical AI lexicon. Substitute or cut.`)

const detectEnthusiasm: Detector = (ctx) => {
  const hits: { idx: number; word: string }[] = []
  for (const m of ctx.source.matchAll(ENTHUSIASM)) {
    if (m.index === undefined) continue
    if (isInSkipZone(m.index, ctx.zones)) continue
    hits.push({ idx: m.index, word: m[0] })
  }
  if (hits.length >= 2) {
    for (const h of hits) {
      ctx.emit({
        patternId: 'enthusiasm-inflation',
        category: 'lexical',
        start: h.idx,
        end: h.idx + h.word.length,
        rationale: `"${h.word}" - the model is rating its own observations.`,
      })
    }
  }
}

const detectThroatClearing: Detector = (ctx) =>
  emitMatches(ctx, THROAT_CLEARING, 'throat-clearing', 'lexical', (m) => `"${m[1]}" announces the sentence rather than being one.`)

const detectClosers: Detector = (ctx) =>
  emitMatches(ctx, CLOSERS, 'closers', 'lexical', (m) => `"${m[0]}" - a real kicker does not need to announce itself.`)

const detectAntithesis: Detector = (ctx) => {
  for (const re of ANTITHESIS_PATTERNS) {
    emitMatches(ctx, re, 'antithesis', 'structural', (m) => `Mirror construct: "${m[0].slice(0, 80)}..."`)
  }
}

const detectVagueGravitas: Detector = (ctx) =>
  emitMatches(ctx, VAGUE_GRAVITAS, 'vague-gravitas', 'lexical', (m) => `"${m[0]}" - simulates insight without delivering it.`)

const detectHedgeCluster: Detector = (ctx) => {
  const sentences = splitSentences(ctx.source)
  for (const sent of sentences) {
    if (isInSkipZone(sent.start, ctx.zones)) continue
    const text = ctx.source.slice(sent.start, sent.end)
    const matches = [...text.matchAll(HEDGE_WORDS)]
    if (matches.length >= 3) {
      ctx.emit({
        patternId: 'suffocation',
        category: 'lexical',
        start: sent.start,
        end: sent.end,
        rationale: `${matches.length} hedges in one sentence (${matches.map((m) => m[0]).join(', ')}). The claim is suffocating - sharpen or cut.`,
      })
    }
  }
}

interface SentenceSpan {
  start: number
  end: number
}

function splitSentences(source: string): SentenceSpan[] {
  const out: SentenceSpan[] = []
  const sentRe = /[^.!?\n]+(?:[.!?]+(?=\s|$)|(?=\n))/g
  for (const m of source.matchAll(sentRe)) {
    if (m.index === undefined) continue
    out.push({ start: m.index, end: m.index + m[0].length })
  }
  return out
}

const ALL_DETECTORS: Detector[] = [
  detectTier1,
  detectEnthusiasm,
  detectThroatClearing,
  detectClosers,
  detectAntithesis,
  detectVagueGravitas,
  detectHedgeCluster,
]

let flagCounter = 0

export function runDetectors(source: string): Flag[] {
  const zones = extractSkipZones(source)
  const proseWordCount = approximateProseWordCount(source, zones)
  const raw: RawFlag[] = []
  const ctx: DetectorContext = {
    source,
    zones,
    proseWordCount,
    emit: (r) => raw.push(r),
  }
  for (const d of ALL_DETECTORS) d(ctx)

  raw.sort((a, b) => a.start - b.start)

  const flags: Flag[] = raw.map((r) => {
    const anchor: TextAnchor = makeAnchor(source, r.start, r.end)
    flagCounter += 1
    return {
      id: `mech-${flagCounter}`,
      patternId: r.patternId,
      category: r.category,
      source: 'mechanical',
      anchor,
      rationale: r.rationale,
      excerpt: anchor.text,
      severity: r.severity ?? severityFor(r.patternId),
      createdAt: new Date().toISOString(),
    }
  })
  return flags
}

function severityFor(patternId: string): number {
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
  if (top.length === 0) return 'No mechanical flags raised. The hard patterns (absent-actor, allusive, hedged confidence) need a careful reader, not a regex.'
  const lead = top.slice(0, 2).map((t) => `${t.patternId} (${t.count})`).join(', ')
  if (v >= 8) return `Light slop. Dominant tics: ${lead}.`
  if (v >= 6) return `Noticeable slop. Dominant tics: ${lead}.`
  if (v >= 4) return `Substantial slop. Patterns recur. Dominant tics: ${lead}.`
  return `Saturated. ${lead} repeats throughout.`
}
