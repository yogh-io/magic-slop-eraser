export interface ParagraphInfo {
  hash: string
  start: number
  end: number
  text: string
}

export type DensityAxes = Record<string, number>

/**
 * Canonical axis order. Each axis renders as its own parallel lane in the
 * left gutter. Per-paragraph score is taken as raw deviation from an
 * external (internet-average) baseline at 0; the lane's silhouette bulges
 * outward for positive scores (convex bump) and caves inward for negative
 * scores (concave dent). Direction is geometric (left=baseline, right=bulge);
 * colour carries axis identity.
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

/** Visible width of a single lane column (px). The silhouette's baseline
 *  sits at this lane's natural right edge; bumps extend right past it and
 *  dents cave left into the lane interior. */
const LANE_WIDTH_PX = 14
/** Horizontal gap between adjacent lane containers (px). Big enough that
 *  a max-positive bump from lane i can extend its full depth without
 *  touching lane i+1, with INNER_GAP_PX of buffer left over. */
const LANE_GAP_PX = 10
/** Max amplitude of a bump (positive score) or a dent (negative score) in px.
 *  Symmetric: score=+10 produces an 8px outward bulge, score=-10 produces an
 *  8px inward dent. Picked so dents leave a visible sliver of lane material
 *  on the left even at the strongest negative score (14 - 8 = 6px left of
 *  the dent peak). */
const MAX_DEPTH_PX = 8
/** Min buffer kept between a bump's tip and the next lane's left edge. */
const INNER_GAP_PX = 2
/** Below this absolute score, the bump/dent isn't drawn at all - the
 *  paragraph reads as flat on this axis, anchored at the baseline. */
const SPARSITY_SCORE = 0.5
/** Bezier control multiplier so a cubic curve with control points at
 *  `peak_x` actually reaches `displacement` at the midpoint. Derived from
 *  the t=0.5 value of a cubic Bezier with P0.x=P3.x=baseline and
 *  P1.x=P2.x=peak_x:  x(0.5) = baseline + (3/4) * (peak_x - baseline). */
const BEZIER_PEAK_K = 4 / 3
/** Max effective depth (lane interior dent or outward bump) the silhouette
 *  may show even before per-axis scaling, used to size the SVG overflow box. */

/**
 * Walk the rendered article and paint a parallel set of vertical lanes in
 * the left gutter, one per axis. Each lane is a single SVG closed path: the
 * left edge is straight at x=0, the right edge is a wavy silhouette that
 * bulges outward (convex) at paragraphs scoring positive against the
 * internet-average baseline and caves inward (concave) at paragraphs
 * scoring negative. Length of bulge/dent encodes |score|/10 * MAX_DEPTH.
 *
 * The scoring range is symmetric (-10..+10) with 0 as "internet-average".
 * Server clears legacy 0..10 scores on first read after the schema bump,
 * so old data renders as a flat lane until the drafter re-scores.
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
  const trackHeight = trackBottom - trackTop

  // Per-paragraph tooltips: list each axis's score with a weak/strong
  // descriptor derived from the score's sign (not from any doc-local
  // distribution - the baseline is external).
  for (const seg of segments) {
    seg.pEl.title = formatTooltip(seg.scores, axes)
  }

  const rails = document.createElement('div')
  rails.className = 'density-rails'
  rails.setAttribute('aria-hidden', 'true')
  rails.style.top = `${trackTop}px`
  rails.style.height = `${trackHeight}px`
  rails.style.setProperty('--rail-axis-count', String(axes.length))

  rails.appendChild(buildHeaders(axes, 'top'))

  const lanesEl = document.createElement('div')
  lanesEl.className = 'density-rail-lanes'

  for (const ax of axes) {
    const lane = document.createElement('div')
    lane.className = 'density-rail'
    lane.dataset.axis = ax.key
    lane.title = ax.label
    lane.style.setProperty('--rail-color', `var(--rail-${ax.key}, var(--accent))`)

    // Quiet when an axis has no signal across the whole doc - lane renders
    // as a thin baseline column only, no silhouette path.
    if (!hasSignal(segments, ax.key)) {
      lane.dataset.noSignal = '1'
      lanesEl.appendChild(lane)
      continue
    }

    const pathD = buildLanePath(segments, trackTop, trackHeight, ax.key)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'density-rail-svg')
    svg.setAttribute('viewBox', `0 0 ${LANE_WIDTH_PX} ${trackHeight}`)
    svg.setAttribute('preserveAspectRatio', 'none')
    svg.setAttribute('width', String(LANE_WIDTH_PX))
    svg.setAttribute('height', String(trackHeight))
    svg.style.overflow = 'visible'

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', pathD)
    path.setAttribute('class', 'density-rail-silhouette')
    svg.appendChild(path)

    lane.appendChild(svg)
    lanesEl.appendChild(lane)
  }

  rails.appendChild(lanesEl)
  rails.appendChild(buildHeaders(axes, 'bottom'))
  root.appendChild(rails)
}

/**
 * Build the SVG path string for one lane's silhouette. The path is a closed
 * polygon: straight left edge at x=0, wavy right edge that hovers at the
 * baseline (x=LANE_WIDTH) and deflects through each paragraph row by a
 * cubic Bezier whose midpoint sits at baseline + (score/10)*MAX_DEPTH.
 */
function buildLanePath(
  segments: ReadonlyArray<{ top: number; height: number; scores: DensityAxes }>,
  trackTop: number,
  trackHeight: number,
  axisKey: string,
): string {
  const baseline = LANE_WIDTH_PX
  let path = `M 0 0 L ${baseline} 0`
  let lastY = 0

  for (const seg of segments) {
    const v = seg.scores[axisKey]
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    const py_start = seg.top - trackTop
    const py_end = py_start + seg.height
    if (py_start > lastY) path += ` L ${baseline} ${py_start.toFixed(2)}`

    if (Math.abs(v) < SPARSITY_SCORE) {
      // Sparse: skip the bump, draw a flat segment through the paragraph.
      path += ` L ${baseline} ${py_end.toFixed(2)}`
      lastY = py_end
      continue
    }

    // Map score linearly onto MAX_DEPTH; clamp at +/- 10 so freak inputs
    // can't push the silhouette outside the lane's overflow allowance.
    const clamped = v > 10 ? 10 : v < -10 ? -10 : v
    const displacement = (clamped / 10) * MAX_DEPTH_PX
    const peakX = baseline + BEZIER_PEAK_K * displacement
    const ctrlY1 = py_start + (py_end - py_start) / 3
    const ctrlY2 = py_start + (2 * (py_end - py_start)) / 3
    path += ` C ${peakX.toFixed(2)} ${ctrlY1.toFixed(2)}, ${peakX.toFixed(2)} ${ctrlY2.toFixed(2)}, ${baseline} ${py_end.toFixed(2)}`
    lastY = py_end
  }

  if (lastY < trackHeight) path += ` L ${baseline} ${trackHeight.toFixed(2)}`
  path += ` L 0 ${trackHeight.toFixed(2)} Z`
  return path
}

function hasSignal(
  segments: ReadonlyArray<{ scores: DensityAxes }>,
  axisKey: string,
): boolean {
  for (const seg of segments) {
    const v = seg.scores[axisKey]
    if (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) >= SPARSITY_SCORE) {
      return true
    }
  }
  return false
}

function buildHeaders(
  axes: ReadonlyArray<{ key: string; label: string }>,
  position: 'top' | 'bottom',
): HTMLElement {
  const el = document.createElement('div')
  el.className = `density-rail-headers density-rail-headers-${position}`
  for (const ax of axes) {
    const h = document.createElement('div')
    h.className = 'density-rail-header'
    h.dataset.axis = ax.key
    h.style.setProperty('--rail-color', `var(--rail-${ax.key}, var(--accent))`)
    h.title = ax.label
    const span = document.createElement('span')
    span.textContent = ax.label
    h.appendChild(span)
    el.appendChild(h)
  }
  return el
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
): string {
  const parts: string[] = []
  for (const ax of axes) {
    const v = scores[ax.key]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      parts.push(`${ax.label}: –`)
      continue
    }
    let descriptor = ''
    if (Math.abs(v) >= SPARSITY_SCORE) descriptor = v < 0 ? ' (weak)' : ' (strong)'
    parts.push(`${ax.label}: ${v.toFixed(1)}${descriptor}`)
  }
  return parts.join(' · ')
}

function canonical(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}
