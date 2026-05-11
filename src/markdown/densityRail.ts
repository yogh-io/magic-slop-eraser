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

/** Half-width of a lane in px at |dev|=1 (one normalised unit of deviation).
 *  A paragraph one normalised unit from the median sits this far from the
 *  centerline; smaller magnitudes scale proportionally below, larger
 *  magnitudes can extend further (see LANE_MAX_DEV + the explosion pass). */
const LANE_HALF_PX = 6
/** Cap on |dev| used for bar length. Magnitudes above this clip at the same
 *  visible length, so a freak outlier doesn't shoot past everything. With
 *  LANE_HALF_PX=6 and LANE_MAX_DEV=3, the longest a bar wants to be is 18px
 *  (before the neighbour-aware explosion pass trims it to fit the actual
 *  available space). */
const LANE_MAX_DEV = 3
/** Multiplier on MAD when normalising deviation. (score - median) is
 *  divided by (K_MAD * MAD); k = 2 puts a 2-MAD-from-median paragraph at
 *  one normalised unit (= one LANE_HALF_PX). */
const K_MAD = 2
/** Below this normalised |deviation|, the bar isn't drawn - the paragraph
 *  reads as "near median on this axis" and the lane stays empty there. */
const SPARSITY_THRESHOLD = 0.2
/** Visible width of a single lane column (px). The centerline runs down its
 *  middle. Inner gap between lanes governs how much room a bar has to
 *  "explode" past its own lane edge into a neighbour's empty half. */
const LANE_WIDTH_PX = 13
const LANE_GAP_PX = 3
const LANE_SPACING_PX = LANE_WIDTH_PX + LANE_GAP_PX
/** Buffer kept between two bars in adjacent lanes so they never touch even
 *  when both lanes go full-throttle in opposing directions. */
const INNER_GAP_PX = 2
const AVAILABLE_BETWEEN_CENTERS = LANE_SPACING_PX - INNER_GAP_PX
/** Slack the outermost lanes get to spill into. The left side of the
 *  leftmost lane faces the page gutter (lots of room); the right side of
 *  the rightmost lane faces the prose (just a thin breathing margin). */
const OUTER_LEFT_MAX_PX = 28
const OUTER_RIGHT_MAX_PX = 10

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

  // Per-segment raw demand on each lane: how long the bar would want to be
  // if it could stretch freely, and which direction it extends. Then resolve
  // pairs (lane i, lane i+1) so adjacent bars never collide. Lanes with no
  // neighbour at all (leftmost left side, rightmost right side) spill into
  // the outer slack instead.
  type LaneDemand = { raw: number; dir: 'left' | 'right' | null; dev: number }
  const N = axes.length
  const demandBySeg: LaneDemand[][] = segments.map((seg) =>
    axes.map((ax) => {
      const stat = stats.get(ax.key)
      if (!stat || stat.mad <= 0) return { raw: 0, dir: null, dev: 0 }
      const v = seg.scores[ax.key]
      if (typeof v !== 'number' || !Number.isFinite(v)) return { raw: 0, dir: null, dev: 0 }
      let dev = (v - stat.median) / (K_MAD * stat.mad)
      if (dev > LANE_MAX_DEV) dev = LANE_MAX_DEV
      else if (dev < -LANE_MAX_DEV) dev = -LANE_MAX_DEV
      const mag = Math.abs(dev)
      if (mag < SPARSITY_THRESHOLD) return { raw: 0, dir: null, dev }
      return { raw: mag * LANE_HALF_PX, dir: dev < 0 ? 'left' : 'right', dev }
    }),
  )

  // For each (segment, lane), trim the raw demand using neighbouring lanes'
  // demand at the same row. Two bars facing each other across a gap share
  // the available between-centerline space proportionally; a bar facing an
  // empty neighbour gets the whole gap. Outermost edges (lane 0 left,
  // lane N-1 right) clip to the outer slack budgets.
  const lengthBySeg: number[][] = demandBySeg.map((row) => {
    const out = new Array<number>(N).fill(0)
    for (let i = 0; i < N; i++) {
      const me = row[i]
      if (me.dir === null || me.raw === 0) continue
      if (me.dir === 'left') {
        if (i === 0) {
          out[i] = Math.min(me.raw, OUTER_LEFT_MAX_PX)
        } else {
          const neighbour = row[i - 1]
          const neighbourPush = neighbour.dir === 'right' ? neighbour.raw : 0
          const total = me.raw + neighbourPush
          out[i] = total <= AVAILABLE_BETWEEN_CENTERS
            ? me.raw
            : (me.raw * AVAILABLE_BETWEEN_CENTERS) / total
        }
      } else {
        if (i === N - 1) {
          out[i] = Math.min(me.raw, OUTER_RIGHT_MAX_PX)
        } else {
          const neighbour = row[i + 1]
          const neighbourPush = neighbour.dir === 'left' ? neighbour.raw : 0
          const total = me.raw + neighbourPush
          out[i] = total <= AVAILABLE_BETWEEN_CENTERS
            ? me.raw
            : (me.raw * AVAILABLE_BETWEEN_CENTERS) / total
        }
      }
    }
    return out
  })

  const rails = document.createElement('div')
  rails.className = 'density-rails'
  rails.setAttribute('aria-hidden', 'true')
  rails.style.top = `${trackTop}px`
  rails.style.height = `${trackBottom - trackTop}px`
  rails.style.setProperty('--rail-axis-count', String(axes.length))

  // Column headers, rendered once at the top and once at the bottom. A long
  // article scrolls past the top labels - the bottom set re-anchors identity
  // when the writer is at the end. Each header carries its axis's hue so the
  // colour mapping survives even when both label rows are off-screen.
  rails.appendChild(buildHeaders(axes, 'top'))

  const lanesEl = document.createElement('div')
  lanesEl.className = 'density-rail-lanes'

  for (let i = 0; i < N; i++) {
    const ax = axes[i]
    const lane = document.createElement('div')
    lane.className = 'density-rail'
    lane.dataset.axis = ax.key
    lane.title = ax.label
    lane.style.setProperty('--rail-color', `var(--rail-${ax.key}, var(--accent))`)

    const stat = stats.get(ax.key)
    if (!stat || stat.mad <= 0) {
      lane.dataset.noSpread = '1'
      lanesEl.appendChild(lane)
      continue
    }

    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s]
      const d = demandBySeg[s][i]
      if (d.dir === null) continue
      const px = lengthBySeg[s][i]
      if (px <= 0) continue

      const sliver = document.createElement('div')
      sliver.className = 'density-rail-seg'
      sliver.dataset.dir = d.dir === 'left' ? 'weak' : 'strong'
      // A bar that exceeds the base half-width has "exploded" into the
      // neighbour's empty half - flag it so the CSS can lift its opacity
      // to read as the outlier it is.
      if (px > LANE_HALF_PX + 0.5) sliver.dataset.exploded = '1'
      sliver.style.top = `${seg.top - trackTop}px`
      sliver.style.height = `${seg.height}px`
      sliver.style.width = `${px}px`
      if (d.dir === 'left') sliver.style.right = '50%'
      else sliver.style.left = '50%'
      lane.appendChild(sliver)
    }

    lanesEl.appendChild(lane)
  }

  rails.appendChild(lanesEl)
  rails.appendChild(buildHeaders(axes, 'bottom'))
  root.appendChild(rails)
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

function canonical(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}
