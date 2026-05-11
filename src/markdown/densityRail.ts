export interface ParagraphInfo {
  hash: string
  start: number
  end: number
  text: string
}

export type DensityAxes = Record<string, number>

/**
 * Canonical axis order. Each axis renders as its own parallel lane in the
 * left gutter. Per-paragraph score is converted to a position relative to
 * the document's distribution on that axis (median + MAD); the lane draws
 * a horizontal bar that extends left of the centerline for below-median
 * paragraphs (weak) and right for above-median (strong). Length encodes
 * magnitude. Colour is constant (the accent); direction is geometric.
 *
 * See docs/density-rail.md for the full spec.
 */
export const CANONICAL_AXES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'information', label: 'info' },
  { key: 'argument', label: 'arg' },
  { key: 'impact', label: 'impact' },
  { key: 'specificity', label: 'spec' },
  { key: 'voice', label: 'voice' },
]

/** Half-width of a lane in px. A paragraph at the lane edge sits this far
 *  from the centerline; smaller magnitudes scale proportionally. */
const LANE_HALF_PX = 6
/** Multiplier on MAD when normalising deviation. (score - median) is
 *  divided by (K_MAD * MAD); k = 2 puts a 2-MAD-from-median paragraph at
 *  the lane edge before clamping. */
const K_MAD = 2
/** Below this normalised |deviation|, the bar isn't drawn - the paragraph
 *  reads as "near median on this axis" and the lane stays empty there. */
const SPARSITY_THRESHOLD = 0.2

/**
 * Walk the rendered article and paint a parallel set of vertical lanes
 * in the left gutter, one per axis. Each lane runs a faint centerline
 * (the doc's median on that axis); each paragraph contributes one bar
 * per axis whose direction and length encode how far that paragraph
 * deviates from the doc's median, normalised against the doc's MAD on
 * that axis.
 *
 * Lanes for axes with zero spread (MAD = 0) render empty: there is no
 * comparison to draw, so the rail stays quiet.
 *
 * Idempotent: removes any prior rails container before re-attaching.
 */
export function applyDensityRails(
  root: HTMLElement,
  paragraphs: readonly ParagraphInfo[],
  density: Record<string, DensityAxes>,
): void {
  for (const el of Array.from(root.querySelectorAll('.density-rails'))) el.remove()
  for (const p of Array.from(root.querySelectorAll<HTMLElement>('p[data-density-hash]'))) {
    p.removeAttribute('data-density-hash')
    p.classList.remove('has-density-rail')
    p.removeAttribute('title')
  }

  if (paragraphs.length === 0) return

  const byCanonical = new Map<string, ParagraphInfo>()
  for (const p of paragraphs) {
    const key = canonical(p.text)
    if (key) byCanonical.set(key, p)
  }

  const axes = unionOfAxes(density)
  if (axes.length === 0) return

  let trackTop = Infinity
  let trackBottom = -Infinity
  interface Seg { top: number; height: number; scores: DensityAxes; pEl: HTMLElement; hash: string }
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
    segments.push({ top, height: pEl.offsetHeight, scores, pEl, hash: info.hash })
  }

  if (!Number.isFinite(trackTop) || segments.length === 0) return

  // Per-axis statistics across this doc's scored paragraphs. Median + MAD
  // is robust to short docs and to single outliers - mean + SD would
  // misbehave on the typical 10-40 paragraph range.
  const stats = new Map<string, { median: number; mad: number }>()
  for (const ax of axes) {
    const values: number[] = []
    for (const seg of segments) {
      const v = seg.scores[ax.key]
      if (typeof v === 'number' && Number.isFinite(v)) values.push(v)
    }
    if (values.length === 0) {
      stats.set(ax.key, { median: 0, mad: 0 })
      continue
    }
    const median = medianOf(values)
    const mad = medianOf(values.map((v) => Math.abs(v - median)))
    stats.set(ax.key, { median, mad })
  }

  // Now that we have stats, attach per-paragraph tooltips with direction.
  for (const seg of segments) {
    seg.pEl.title = formatTooltip(seg.scores, axes, stats)
  }

  const rails = document.createElement('div')
  rails.className = 'density-rails'
  rails.setAttribute('aria-hidden', 'true')
  rails.style.top = `${trackTop}px`
  rails.style.height = `${trackBottom - trackTop}px`
  rails.style.setProperty('--rail-axis-count', String(axes.length))

  // Column headers above the rail block, one per lane. Full axis name lives
  // in the title attribute; visible text is a short form so a lane stays
  // ~13px wide. The CSS truncates with ellipsis if the label still overflows.
  const headers = document.createElement('div')
  headers.className = 'density-rail-headers'
  for (const ax of axes) {
    const h = document.createElement('div')
    h.className = 'density-rail-header'
    h.textContent = shortLabel(ax.label)
    h.title = ax.label
    headers.appendChild(h)
  }
  rails.appendChild(headers)

  const lanesEl = document.createElement('div')
  lanesEl.className = 'density-rail-lanes'

  for (const ax of axes) {
    const lane = document.createElement('div')
    lane.className = 'density-rail'
    lane.dataset.axis = ax.key
    lane.title = ax.label

    const stat = stats.get(ax.key)
    if (!stat || stat.mad <= 0) {
      // No spread - nothing to compare. Lane renders as centerline only.
      lane.dataset.noSpread = '1'
      lanesEl.appendChild(lane)
      continue
    }

    for (const seg of segments) {
      const v = seg.scores[ax.key]
      if (typeof v !== 'number' || !Number.isFinite(v)) continue
      let dev = (v - stat.median) / (K_MAD * stat.mad)
      if (dev > 1) dev = 1
      else if (dev < -1) dev = -1
      if (Math.abs(dev) < SPARSITY_THRESHOLD) continue

      const barPx = Math.abs(dev) * LANE_HALF_PX
      const sliver = document.createElement('div')
      sliver.className = 'density-rail-seg'
      sliver.dataset.dir = dev < 0 ? 'weak' : 'strong'
      sliver.style.top = `${seg.top - trackTop}px`
      sliver.style.height = `${seg.height}px`
      sliver.style.width = `${barPx}px`
      if (dev < 0) sliver.style.right = '50%'
      else sliver.style.left = '50%'
      lane.appendChild(sliver)
    }

    lanesEl.appendChild(lane)
  }

  rails.appendChild(lanesEl)
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

function formatTooltip(
  scores: DensityAxes,
  axes: ReadonlyArray<{ key: string; label: string }>,
  stats: Map<string, { median: number; mad: number }>,
): string {
  const parts: string[] = []
  for (const ax of axes) {
    const v = scores[ax.key]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      parts.push(`${ax.label}: –`)
      continue
    }
    const stat = stats.get(ax.key)
    let descriptor = ''
    if (stat && stat.mad > 0) {
      let dev = (v - stat.median) / (K_MAD * stat.mad)
      if (dev > 1) dev = 1
      else if (dev < -1) dev = -1
      if (Math.abs(dev) >= SPARSITY_THRESHOLD) {
        descriptor = dev < 0 ? ' (weak)' : ' (strong)'
      }
    }
    parts.push(`${ax.label}: ${v.toFixed(1)}${descriptor}`)
  }
  return parts.join(' · ')
}

function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function shortLabel(label: string): string {
  return label.slice(0, 3)
}

function canonical(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}
