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

const TIER2 = /\b(landscape|journey|robust|nuanced|multifaceted|intricate|vibrant|bustling|testament|underscore|underscores|underpin|underpins|ecosystem|profound|remarkable|fascinating|compelling|intriguing|striking|hallmark)\b/gi

const ENTHUSIASM = /\b(fascinating|remarkable|profound|striking|compelling|intriguing|illuminating)\b/gi

const THROAT_CLEARING = /(?:^|(?<=[.!?]\s))(It'?s important to note|It'?s worth (?:noting|mentioning)|It'?s interesting that|Importantly|Notably|Crucially|Indeed|Of course|Naturally|Interestingly|Significantly|Ultimately|Fundamentally|Essentially|Basically|Simply put|In essence|At its core|To be clear|To be sure)\b/g

const CLOSERS = /\b(In conclusion|In summary|To summarize|To summarise|All in all|At the end of the day|When all is said and done|All things considered|Taken together|I hope this helps)\b/gi

const ANTITHESIS_PATTERNS: RegExp[] = [
  /\b(?:isn'?t|is not)\s+(?:just|merely|only|simply)\s+[^.\n]{1,80}?[-\-]\s*it'?s\b/gi,
  /\bIt'?s not\s+(?:just|merely|only|simply)\s+[^.\n]{1,80}?[-\-]\s*it'?s\b/gi,
  /\bThe question is not\s+[^.\n]{1,80}\.\s*It'?s\b/gi,
  /\bThe question isn'?t\s+[^.\n]{1,80}\.\s*It'?s\b/gi,
  /\bWhat looks like\s+[^.\n]{1,80}\s+is\s+(?:actually|really)\s+/gi,
]

const FALSE_PRECISION = /\b(Studies have shown|Experts agree|Research indicates|Research has shown|It is widely accepted|Most scholars believe|Studies suggest|Experts say)\b/gi

const VAGUE_GRAVITAS = /\b(raises important questions|has profound implications|speaks to deeper truths|points to a larger trend|reflects broader dynamics|underscores the complexity|highlights the tensions|captures the essence|gets at something fundamental)\b/gi

const APPROVAL_SEEKING = /\b(I hope this helps|let me know if you'?d like|hopefully this gives you|hope this is useful|If readers take one thing away|The hope is that)\b/gi

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

const detectTier2: Detector = (ctx) => {
  const hits: { idx: number; word: string }[] = []
  for (const m of ctx.source.matchAll(TIER2)) {
    if (m.index === undefined) continue
    if (isInSkipZone(m.index, ctx.zones)) continue
    hits.push({ idx: m.index, word: m[0] })
  }
  const allowed = Math.max(2, Math.floor((ctx.proseWordCount / 1000) * 2))
  if (hits.length > allowed) {
    for (const h of hits) {
      ctx.emit({
        patternId: 'tier2-lexicon',
        category: 'lexical',
        start: h.idx,
        end: h.idx + h.word.length,
        rationale: `"${h.word}" - Tier 2 cluster (${hits.length} hits in ~${ctx.proseWordCount} words; threshold ${allowed}).`,
      })
    }
  }
}

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

const detectFalsePrecision: Detector = (ctx) =>
  emitMatches(ctx, FALSE_PRECISION, 'false-precision', 'argumentative', (m) => `"${m[0]}" - manufactured authority. Name a source or drop it.`)

const detectVagueGravitas: Detector = (ctx) =>
  emitMatches(ctx, VAGUE_GRAVITAS, 'vague-gravitas', 'lexical', (m) => `"${m[0]}" - simulates insight without delivering it.`)

const detectApprovalSeeking: Detector = (ctx) =>
  emitMatches(ctx, APPROVAL_SEEKING, 'approval-seeking', 'tonal', (m) => `"${m[0]}" - chatbot register; the piece either helps or it does not.`)

const detectEmDashDensity: Detector = (ctx) => {
  const re = / [-\-] /g
  const hits: number[] = []
  for (const m of ctx.source.matchAll(re)) {
    if (m.index === undefined) continue
    if (isInSkipZone(m.index, ctx.zones)) continue
    hits.push(m.index)
  }
  const threshold = Math.max(1, Math.floor(ctx.proseWordCount / 200))
  if (hits.length > threshold) {
    for (const idx of hits) {
      ctx.emit({
        patternId: 'em-dash-density',
        category: 'structural',
        start: idx + 1,
        end: idx + 2,
        rationale: `Em-dash density ${hits.length} in ~${ctx.proseWordCount} words (threshold ${threshold}).`,
      })
    }
  }
}

const detectHedgeCluster: Detector = (ctx) => {
  const sentences = splitSentences(ctx.source)
  for (const sent of sentences) {
    if (isInSkipZone(sent.start, ctx.zones)) continue
    const text = ctx.source.slice(sent.start, sent.end)
    const matches = [...text.matchAll(HEDGE_WORDS)]
    if (matches.length >= 3) {
      ctx.emit({
        patternId: 'hedge-cluster',
        category: 'lexical',
        start: sent.start,
        end: sent.end,
        rationale: `${matches.length} hedges in one sentence (${matches.map((m) => m[0]).join(', ')}). Sharpen or cut.`,
      })
    }
  }
}

const detectStaccato: Detector = (ctx) => {
  const sentences = splitSentences(ctx.source)
  let runStart = -1
  let runIndices: { start: number; end: number }[] = []
  const flush = () => {
    if (runIndices.length >= 3) {
      const start = runIndices[0].start
      const end = runIndices[runIndices.length - 1].end
      ctx.emit({
        patternId: 'staccato',
        category: 'structural',
        start,
        end,
        rationale: `${runIndices.length} consecutive short sentences (under ~8 words each). Combine or vary.`,
      })
    }
    runStart = -1
    runIndices = []
  }
  for (const sent of sentences) {
    if (isInSkipZone(sent.start, ctx.zones)) {
      flush()
      continue
    }
    const text = ctx.source.slice(sent.start, sent.end).trim()
    const wc = (text.match(/\b[\p{L}\p{N}']+\b/gu) ?? []).length
    if (wc > 0 && wc <= 8) {
      if (runStart < 0) runStart = sent.start
      runIndices.push(sent)
    } else {
      flush()
    }
  }
  flush()
}

const detectAnaphoricCascade: Detector = (ctx) => {
  const sentences = splitSentences(ctx.source).filter((s) => !isInSkipZone(s.start, ctx.zones))
  let run: { start: number; end: number; opener: string }[] = []
  const flush = () => {
    if (run.length >= 3) {
      ctx.emit({
        patternId: 'anaphoric-cascade',
        category: 'structural',
        start: run[0].start,
        end: run[run.length - 1].end,
        rationale: `${run.length} consecutive sentences open with "${run[0].opener}...".`,
      })
    }
    run = []
  }
  for (const s of sentences) {
    const text = ctx.source.slice(s.start, s.end).trim()
    const opener = firstTwoWords(text).toLowerCase()
    if (!opener) {
      flush()
      continue
    }
    if (run.length === 0 || run[run.length - 1].opener === opener) {
      run.push({ start: s.start, end: s.end, opener })
    } else {
      flush()
      run.push({ start: s.start, end: s.end, opener })
    }
  }
  flush()
}

const detectHeaderInflation: Detector = (ctx) => {
  const headerRe = /^(#{2,6})\s+([^\n]+)$/gm
  const headers: { level: number; idx: number; end: number }[] = []
  for (const m of ctx.source.matchAll(headerRe)) {
    if (m.index === undefined) continue
    headers.push({ level: m[1].length, idx: m.index, end: m.index + m[0].length })
  }
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    const next = headers[i + 1]
    const sectionEnd = next ? next.idx : ctx.source.length
    const body = ctx.source.slice(h.end, sectionEnd).trim()
    const paragraphs = body.split(/\n{2,}/).filter((p) => p.trim().length > 0)
    const wc = (body.match(/\b[\p{L}\p{N}']+\b/gu) ?? []).length
    if (paragraphs.length <= 1 && wc < 80 && h.level >= 3) {
      ctx.emit({
        patternId: 'header-inflation',
        category: 'format',
        start: h.idx,
        end: h.end,
        rationale: `Header for ${wc} words / ${paragraphs.length} paragraph. Collapse or merge upstream.`,
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

function firstTwoWords(text: string): string {
  const m = text.match(/^[\s>*\-_#]*([\p{L}']+(?:\s+[\p{L}']+)?)/u)
  return m ? m[1] : ''
}

const ALL_DETECTORS: Detector[] = [
  detectTier1,
  detectTier2,
  detectEnthusiasm,
  detectThroatClearing,
  detectClosers,
  detectAntithesis,
  detectFalsePrecision,
  detectVagueGravitas,
  detectApprovalSeeking,
  detectEmDashDensity,
  detectHedgeCluster,
  detectStaccato,
  detectAnaphoricCascade,
  detectHeaderInflation,
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
    case 'tier1-lexicon':
    case 'antithesis':
    case 'absent-actor':
    case 'allusive-construct':
      return 0.95
    case 'closers':
    case 'throat-clearing':
    case 'vague-gravitas':
    case 'staccato':
    case 'anaphoric-cascade':
    case 'false-precision':
      return 0.8
    case 'tier2-lexicon':
    case 'enthusiasm-inflation':
    case 'em-dash-density':
    case 'hedge-cluster':
    case 'approval-seeking':
      return 0.6
    case 'header-inflation':
      return 0.4
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
  if ((counts.get('staccato') ?? 0) >= 1) ceilings.push({ id: 'staccato', cap: 7 })
  if ((counts.get('anaphoric-cascade') ?? 0) >= 1) ceilings.push({ id: 'anaphoric-cascade', cap: 7 })
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
