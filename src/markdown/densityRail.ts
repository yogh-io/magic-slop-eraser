export interface ParagraphInfo {
  hash: string
  start: number
  end: number
  text: string
}

export type DensityAxes = Record<string, number>

/**
 * Canonical axis order, retained for tooltip ordering. The rail itself is now
 * rendered as a single continuous bar whose opacity tracks the aggregate
 * paragraph score (mean across present axes), 0..10 mapped to 0..1.
 */
export const CANONICAL_AXES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'information', label: 'info' },
  { key: 'argument', label: 'arg' },
  { key: 'impact', label: 'impact' },
  { key: 'specificity', label: 'spec' },
  { key: 'voice', label: 'voice' },
]

/**
 * Walk the rendered article and paint a single continuous spine in the left
 * gutter, colored by a vertical gradient whose stops correspond to each
 * paragraph's score. Between paragraphs the gradient interpolates smoothly.
 * Idempotent: removes any prior spine before re-attaching.
 */
export function applyDensityRails(
  root: HTMLElement,
  paragraphs: readonly ParagraphInfo[],
  density: Record<string, DensityAxes>,
): void {
  // Clear previous spine + per-paragraph metadata.
  for (const el of Array.from(root.querySelectorAll('.density-spine'))) el.remove()
  for (const p of Array.from(root.querySelectorAll<HTMLElement>('p[data-density-hash]'))) {
    p.removeAttribute('data-density-hash')
    p.classList.remove('has-density-rail')
    p.removeAttribute('title')
  }

  if (paragraphs.length === 0) return

  // Match rendered <p> to source paragraphs by canonical text.
  const byCanonical = new Map<string, ParagraphInfo>()
  for (const p of paragraphs) {
    const key = canonical(p.text)
    if (key) byCanonical.set(key, p)
  }

  const axisUnion = unionOfAxes(density)
  const stops: { centerY: number; intensity: number }[] = []
  let minTop = Infinity
  let maxBottom = -Infinity

  for (const pEl of Array.from(root.querySelectorAll<HTMLElement>('.md-prose p'))) {
    const key = canonical(pEl.textContent ?? '')
    if (!key) continue
    const info = byCanonical.get(key)
    if (!info) continue
    const scores = density[info.hash]
    if (!scores || Object.keys(scores).length === 0) continue

    pEl.dataset.densityHash = info.hash
    pEl.classList.add('has-density-rail')
    pEl.title = formatTooltip(scores, axisUnion)

    const top = pEl.offsetTop
    const bottom = top + pEl.offsetHeight
    if (top < minTop) minTop = top
    if (bottom > maxBottom) maxBottom = bottom
    stops.push({ centerY: (top + bottom) / 2, intensity: aggregateIntensity(scores) })
  }

  if (stops.length === 0 || !Number.isFinite(minTop)) return

  stops.sort((a, b) => a.centerY - b.centerY)
  const spine = document.createElement('div')
  spine.className = 'density-spine'
  spine.setAttribute('aria-hidden', 'true')
  const span = Math.max(1, maxBottom - minTop)
  spine.style.top = `${minTop}px`
  spine.style.height = `${span}px`
  spine.style.background = buildGradient(stops, minTop, span)
  root.appendChild(spine)
}

function buildGradient(
  stops: ReadonlyArray<{ centerY: number; intensity: number }>,
  minTop: number,
  span: number,
): string {
  const parts: string[] = []
  // Anchor the gradient at top/bottom by repeating the first/last intensity,
  // so the column ends in the same shade as its terminal paragraph.
  parts.push(`${rgba(stops[0].intensity)} 0%`)
  for (const s of stops) {
    const pct = ((s.centerY - minTop) / span) * 100
    parts.push(`${rgba(s.intensity)} ${pct.toFixed(2)}%`)
  }
  parts.push(`${rgba(stops[stops.length - 1].intensity)} 100%`)
  return `linear-gradient(to bottom, ${parts.join(', ')})`
}

function rgba(intensity: number): string {
  const pct = Math.round(clamp01(intensity) * 100)
  return `color-mix(in srgb, var(--accent) ${pct}%, transparent)`
}

function aggregateIntensity(scores: DensityAxes): number {
  const values: number[] = []
  for (const v of Object.values(scores)) {
    if (typeof v === 'number' && Number.isFinite(v)) values.push(v)
  }
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return clamp01(mean / 10)
}

function unionOfAxes(
  density: Record<string, DensityAxes>,
): ReadonlyArray<{ key: string; label: string }> {
  const seen = new Set<string>()
  for (const axes of Object.values(density)) {
    for (const k of Object.keys(axes)) seen.add(k)
  }
  const out: { key: string; label: string }[] = []
  for (const ax of CANONICAL_AXES) {
    if (seen.has(ax.key)) out.push({ ...ax })
  }
  if (out.length === 0) {
    for (const ax of CANONICAL_AXES) out.push({ ...ax })
  }
  for (const k of [...seen].sort()) {
    if (CANONICAL_AXES.some((ax) => ax.key === k)) continue
    out.push({ key: k, label: k.slice(0, 8) })
  }
  return out
}

function formatTooltip(scores: DensityAxes, axes: ReadonlyArray<{ key: string; label: string }>): string {
  const parts: string[] = []
  for (const ax of axes) {
    const v = scores[ax.key]
    parts.push(`${ax.label}: ${typeof v === 'number' ? v.toFixed(1) : '–'}`)
  }
  return parts.join(' · ')
}

/** Whitespace-collapsed lowercase form for matching rendered <p> to source paragraphs. */
function canonical(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
