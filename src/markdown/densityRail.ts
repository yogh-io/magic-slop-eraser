export interface ParagraphInfo {
  hash: string
  start: number
  end: number
  text: string
}

export type DensityAxes = Record<string, number>

/**
 * Canonical axis order. Each axis renders as its own parallel rail in the
 * left gutter. Per-paragraph score (0..10) drives the rail's thickness on
 * that paragraph, not its color - color is constant (the accent) so the
 * eye reads thickness comparatively across rails.
 */
export const CANONICAL_AXES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'information', label: 'info' },
  { key: 'argument', label: 'arg' },
  { key: 'impact', label: 'impact' },
  { key: 'specificity', label: 'spec' },
  { key: 'voice', label: 'voice' },
]

/** Track width per rail (px). Score 10 fills the track; lower scores draw a
 *  centered sliver. Tweak with both rail visibility and gutter cost in mind. */
const RAIL_TRACK_PX = 6
/** Hairline width drawn for very-low-but-non-zero scores so the writer sees
 *  the rail is present rather than mistaking it for missing data. */
const RAIL_MIN_PX = 0.75
/** Below this normalised score (0..1) the segment renders nothing - "scored
 *  zero" reads as an intentional gap. */
const RAIL_ZERO_THRESHOLD = 0.04

/**
 * Walk the rendered article and paint a parallel set of vertical rails in
 * the left gutter, one per axis. Each paragraph contributes one segment per
 * axis whose width is proportional to that axis's 0..10 score. All rails
 * share the same accent color; thickness alone carries the signal.
 *
 * The rails span from the first to the last `<p>` in the prose, regardless
 * of whether each paragraph carries density data, so unscored paragraphs
 * read as gaps within a continuous track instead of truncating the rail.
 *
 * Idempotent: removes any prior rails container before re-attaching.
 */
export function applyDensityRails(
  root: HTMLElement,
  paragraphs: readonly ParagraphInfo[],
  density: Record<string, DensityAxes>,
): void {
  // Clear previous rails + per-paragraph metadata.
  for (const el of Array.from(root.querySelectorAll('.density-rails'))) el.remove()
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

  const axes = unionOfAxes(density)
  if (axes.length === 0) return

  // Span the rail container across every <p> in the prose. Unscored ones
  // produce no segments but still extend the track, so the writer doesn't
  // see the rail truncate at the last scored paragraph.
  let trackTop = Infinity
  let trackBottom = -Infinity
  interface Seg { top: number; height: number; scores: DensityAxes }
  const segments: Seg[] = []

  for (const pEl of Array.from(root.querySelectorAll<HTMLElement>('.md-prose p'))) {
    const top = pEl.offsetTop
    const bottom = top + pEl.offsetHeight
    if (top < trackTop) trackTop = top
    if (bottom > trackBottom) trackBottom = bottom

    const key = canonical(pEl.textContent ?? '')
    if (!key) continue
    const info = byCanonical.get(key)
    if (!info) continue
    const scores = density[info.hash]
    if (!scores || Object.keys(scores).length === 0) continue

    pEl.dataset.densityHash = info.hash
    pEl.classList.add('has-density-rail')
    pEl.title = formatTooltip(scores, axes)
    segments.push({ top, height: pEl.offsetHeight, scores })
  }

  if (!Number.isFinite(trackTop) || segments.length === 0) return

  const rails = document.createElement('div')
  rails.className = 'density-rails'
  rails.setAttribute('aria-hidden', 'true')
  rails.style.top = `${trackTop}px`
  rails.style.height = `${trackBottom - trackTop}px`
  rails.style.setProperty('--rail-axis-count', String(axes.length))

  for (const ax of axes) {
    const rail = document.createElement('div')
    rail.className = 'density-rail'
    rail.dataset.axis = ax.key
    rail.title = ax.label
    for (const seg of segments) {
      const v = seg.scores[ax.key]
      if (typeof v !== 'number' || !Number.isFinite(v)) continue
      const t = clamp01(v / 10)
      if (t < RAIL_ZERO_THRESHOLD) continue
      const widthPx = Math.max(RAIL_MIN_PX, t * RAIL_TRACK_PX)
      const sliver = document.createElement('div')
      sliver.className = 'density-rail-seg'
      sliver.style.top = `${seg.top - trackTop}px`
      sliver.style.height = `${seg.height}px`
      sliver.style.width = `${widthPx}px`
      rail.appendChild(sliver)
    }
    rails.appendChild(rail)
  }

  root.appendChild(rails)
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

function canonical(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
