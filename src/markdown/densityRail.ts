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
export interface AxisMeta {
  key: string
  label: string
  /** Short prose answer to "wtf is this axis?" - surfaced as a tooltip on the
   *  rail's column header so the reader doesn't have to leave the article to
   *  guess at the label. Tracked here (not in the catalogue) so the rail
   *  remains self-contained as a vendored prompt-spec library. */
  description: string
}

export const CANONICAL_AXES: ReadonlyArray<AxisMeta> = [
  {
    key: 'information',
    label: 'info',
    description:
      'Density of facts, named entities, numbers. Hand-wavy abstractions read low; concrete claims read high.',
  },
  {
    key: 'argument',
    label: 'arg',
    description:
      'Is a claim being made and supported, or is the paragraph sitting there? Inert connective tissue reads low; load-bearing reads high.',
  },
  {
    key: 'impact',
    label: 'impact',
    description:
      'Does this hit. Punchline quality, specific imagery, payoff. Filler reads low; lands reads high.',
  },
  {
    key: 'specificity',
    label: 'spec',
    description:
      'Concrete nouns vs abstractions. "Three counties" beats "many areas." Specific reads high.',
  },
  {
    key: 'voice',
    label: 'voice',
    description:
      "Does this sound like the writer (per voice samples) or like a model. Signature voice reads high; generic reads low.",
  },
]

/** Visible width of a single lane column (px). Left edge is fixed at x=0;
 *  the right edge is the wavy baseline that deflects per paragraph. */
const LANE_WIDTH_PX = 14
/** Horizontal gap between adjacent lane containers (px). Sized so a max
 *  outward bump from lane i's right edge clears lane i+1's left edge by
 *  INNER_GAP_PX: MAX_DEPTH_PX + INNER_GAP_PX = LANE_GAP_PX. */
const LANE_GAP_PX = 10
/** Max deflection depth of the right edge (px) per the v3.2 spec. Positive
 *  score=+10 bumps the right edge 8px outward; negative score=-10 dents
 *  it 8px inward (leaving a 6px sliver of lane material on the left). */
const MAX_DEPTH_PX = 8
/** Min buffer between two adjacent lanes' max-positive bumps. */
const INNER_GAP_PX = 2
/** Below this absolute score, the bump/dent isn't drawn at all - the
 *  paragraph reads as flat on this axis, anchored at the baseline. */
const SPARSITY_SCORE = 0.5
/** Bezier control multiplier so a cubic curve with control points at
 *  `peak_x` actually reaches `displacement` at the midpoint. Derived from
 *  the t=0.5 value of a cubic Bezier with P0.x=P3.x=baseline and
 *  P1.x=P2.x=peak_x:  x(0.5) = baseline + (3/4) * (peak_x - baseline). */
const BEZIER_PEAK_K = 4 / 3
/** Fade distance between a paragraph's coloured zone and the muted-gray
 *  inter-paragraph zone (px). Smooths the colour transition so the rail
 *  reads as alive within paragraphs and quiet between them. */
const TRANSITION_PX = 6

/**
 * Walk the rendered article and paint a parallel set of vertical lanes in
 * the left gutter, one per axis. Each lane is a single SVG closed path: the
 * left edge is straight at `x = 0`, the right edge is wavy at baseline
 * `x = LANE_WIDTH_PX`. Positive scores bulge the right edge outward (convex
 * bump past the baseline); negative scores cave it inward (concave dent
 * into the lane). Deflection depth is `(score / 10) * MAX_DEPTH_PX`. A
 * faint vertical baseline behind the silhouette gives the eye a fixed
 * reference against which to read deflection direction.
 *
 * The lane fill uses a per-lane vertical linearGradient that fades from the
 * axis colour inside each paragraph row to a muted gray in the gaps between
 * paragraphs and above headings - so the rail only carries colour where it
 * encodes something. Inter-paragraph zones, headings, and top/bottom margins
 * read as ambient noise.
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

  // Per-render nonce so two rails on the same page (HMR, multiple docs in a
  // future tab pane) don't clash on gradient IDs.
  const nonce = Math.random().toString(36).slice(2, 8)
  const SVG_NS = 'http://www.w3.org/2000/svg'

  for (const ax of axes) {
    const lane = document.createElement('div')
    lane.className = 'density-rail'
    lane.dataset.axis = ax.key
    lane.style.setProperty('--rail-color', `var(--rail-${ax.key}, var(--accent))`)
    if (!hasSignal(segments, ax.key)) lane.dataset.noSignal = '1'

    const pathD = buildLanePath(segments, trackTop, trackHeight, ax.key)
    const gradId = `density-rail-grad-${ax.key}-${nonce}`

    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('class', 'density-rail-svg')
    svg.setAttribute('viewBox', `0 0 ${LANE_WIDTH_PX} ${trackHeight}`)
    svg.setAttribute('preserveAspectRatio', 'none')
    svg.setAttribute('width', String(LANE_WIDTH_PX))
    svg.setAttribute('height', String(trackHeight))
    svg.style.overflow = 'visible'

    const defs = document.createElementNS(SVG_NS, 'defs')
    defs.appendChild(buildLaneGradient(segments, trackTop, trackHeight, gradId))
    svg.appendChild(defs)

    // Faint vertical baseline at x = LANE_WIDTH_PX so deflections read as
    // "right of the line = bump, left of the line = dent" (v3.2 spec).
    // Rendered behind the silhouette; the fill obscures it inside positive
    // bumps, the dent reveals it inside the lane for negative scores.
    const baseline = document.createElementNS(SVG_NS, 'line')
    baseline.setAttribute('class', 'density-rail-baseline')
    baseline.setAttribute('x1', String(LANE_WIDTH_PX))
    baseline.setAttribute('y1', '0')
    baseline.setAttribute('x2', String(LANE_WIDTH_PX))
    baseline.setAttribute('y2', String(trackHeight))
    svg.appendChild(baseline)

    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', pathD)
    path.setAttribute('class', 'density-rail-silhouette')
    path.setAttribute('fill', `url(#${gradId})`)
    path.setAttribute('stroke', `url(#${gradId})`)
    svg.appendChild(path)

    // Per-paragraph hover targets, layered on top of the silhouette. Each is
    // a transparent <rect> spanning the paragraph's full y-range and the
    // lane's full hoverable width (lane body + max bump on each side), with
    // pointer-events flipped back on so it captures mouse activity even
    // though the rails container has pointer-events: none. On move/enter,
    // dispatches a CustomEvent the host (ArticleView) listens for to drive
    // a Vue-rendered tooltip popover near the cursor.
    const hoverGroup = document.createElementNS(SVG_NS, 'g')
    hoverGroup.setAttribute('class', 'density-rail-hover-zones')
    for (const seg of segments) {
      const py_start = seg.top - trackTop
      const v = seg.scores[ax.key]
      const score = typeof v === 'number' && Number.isFinite(v) ? v : null

      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('x', '0')
      rect.setAttribute('y', py_start.toString())
      rect.setAttribute('width', String(LANE_WIDTH_PX + MAX_DEPTH_PX))
      rect.setAttribute('height', seg.height.toString())
      rect.setAttribute('fill', 'transparent')
      rect.dataset.axisKey = ax.key

      const onMove = (e: MouseEvent): void => {
        rect.dispatchEvent(
          new CustomEvent('density-rail-hover', {
            bubbles: true,
            detail: {
              x: e.clientX,
              y: e.clientY,
              axisKey: ax.key,
              axisLabel: ax.label,
              score,
              descriptor: describeScore(score),
            },
          }),
        )
      }
      const onLeave = (): void => {
        rect.dispatchEvent(new CustomEvent('density-rail-hover-end', { bubbles: true }))
      }
      rect.addEventListener('mousemove', onMove)
      rect.addEventListener('mouseenter', onMove)
      rect.addEventListener('mouseleave', onLeave)

      hoverGroup.appendChild(rect)
    }
    svg.appendChild(hoverGroup)

    lane.appendChild(svg)
    lanesEl.appendChild(lane)
  }

  rails.appendChild(lanesEl)
  rails.appendChild(buildHeaders(axes, 'bottom'))
  root.appendChild(rails)
}

/**
 * Build the SVG path string for one lane's silhouette per the v3.2 spec.
 * The path is a closed polygon: the left edge is straight at `x = 0`; the
 * right edge is the wavy baseline at `x = LANE_WIDTH_PX` that deflects
 * through each paragraph row by a cubic Bezier. Positive scores bulge the
 * right edge outward (past LANE_WIDTH_PX); negative scores cave it inward
 * (toward x = 0); near-zero scores keep it flat at baseline.
 */
function buildLanePath(
  segments: ReadonlyArray<{ top: number; height: number; scores: DensityAxes }>,
  trackTop: number,
  trackHeight: number,
  axisKey: string,
): string {
  const leftBase = 0
  const rightBase = LANE_WIDTH_PX

  // Clockwise trace: top-left -> down straight left edge -> bottom-left ->
  // bottom-right -> up wavy right edge -> top-right -> close.
  let path = `M ${leftBase} 0`
  path += ` L ${leftBase} ${trackHeight.toFixed(2)}`
  path += ` L ${rightBase} ${trackHeight.toFixed(2)}`

  // Right edge: iterate paragraphs bottom-up (reverse order) so the curve
  // matches the clockwise trace direction. Positive score -> outward (right);
  // negative -> inward (left).
  let lastY = trackHeight
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    const v = seg.scores[axisKey]
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    const py_start = seg.top - trackTop
    const py_end = py_start + seg.height
    if (py_end < lastY) path += ` L ${rightBase} ${py_end.toFixed(2)}`

    if (Math.abs(v) < SPARSITY_SCORE) {
      path += ` L ${rightBase} ${py_start.toFixed(2)}`
      lastY = py_start
      continue
    }

    const clamped = v > 10 ? 10 : v < -10 ? -10 : v
    const d = (clamped / 10) * MAX_DEPTH_PX
    const peakX = rightBase + BEZIER_PEAK_K * d
    // Going UP (from py_end to py_start), so swap the y-ordering of control points.
    const ctrlY1 = py_end - (py_end - py_start) / 3
    const ctrlY2 = py_end - (2 * (py_end - py_start)) / 3
    path += ` C ${peakX.toFixed(2)} ${ctrlY1.toFixed(2)}, ${peakX.toFixed(2)} ${ctrlY2.toFixed(2)}, ${rightBase} ${py_start.toFixed(2)}`
    lastY = py_start
  }
  if (lastY > 0) path += ` L ${rightBase} 0`

  path += ` Z`
  return path
}

/**
 * Build a vertical linearGradient that fills the silhouette with the axis
 * colour through paragraph rows and fades to muted gray in the gaps between.
 * Headings, top/bottom margins, and inter-paragraph whitespace all read as
 * "no signal here" without us having to identify them structurally - the
 * gradient simply traces the paragraph y-ranges, and everything outside
 * those ranges is the muted zone.
 *
 * Stops, per paragraph: muted (fade-in start) -> axis (paragraph start) ->
 * axis (paragraph end) -> muted (fade-out end). Fades clamp to the midpoint
 * of the gap so two adjacent paragraphs always have a stretch of muted
 * gradient between them.
 */
function buildLaneGradient(
  segments: ReadonlyArray<{ top: number; height: number; scores: DensityAxes }>,
  trackTop: number,
  trackHeight: number,
  gradId: string,
): SVGLinearGradientElement {
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const grad = document.createElementNS(SVG_NS, 'linearGradient')
  grad.setAttribute('id', gradId)
  grad.setAttribute('gradientUnits', 'userSpaceOnUse')
  grad.setAttribute('x1', '0')
  grad.setAttribute('y1', '0')
  grad.setAttribute('x2', '0')
  grad.setAttribute('y2', String(trackHeight))

  type Stop = { y: number; kind: 'muted' | 'axis' }
  const stops: Stop[] = []
  stops.push({ y: 0, kind: 'muted' })

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const py_start = seg.top - trackTop
    const py_end = py_start + seg.height

    let fadeIn = TRANSITION_PX
    if (i > 0) {
      const prev = segments[i - 1]
      const prev_end = prev.top - trackTop + prev.height
      fadeIn = Math.min(fadeIn, Math.max(0, (py_start - prev_end) / 2))
    } else {
      fadeIn = Math.min(fadeIn, py_start)
    }

    let fadeOut = TRANSITION_PX
    if (i < segments.length - 1) {
      const next = segments[i + 1]
      const next_start = next.top - trackTop
      fadeOut = Math.min(fadeOut, Math.max(0, (next_start - py_end) / 2))
    } else {
      fadeOut = Math.min(fadeOut, trackHeight - py_end)
    }

    if (fadeIn > 0) stops.push({ y: py_start - fadeIn, kind: 'muted' })
    stops.push({ y: py_start, kind: 'axis' })
    stops.push({ y: py_end, kind: 'axis' })
    if (fadeOut > 0) stops.push({ y: py_end + fadeOut, kind: 'muted' })
  }

  stops.push({ y: trackHeight, kind: 'muted' })

  // Ensure offsets are monotonically increasing in [0, trackHeight].
  stops.sort((a, b) => a.y - b.y)
  let last = -1
  for (const s of stops) {
    if (s.y < last) s.y = last
    last = s.y
  }

  for (const s of stops) {
    const stop = document.createElementNS(SVG_NS, 'stop')
    const pct = trackHeight > 0 ? (s.y / trackHeight) * 100 : 0
    stop.setAttribute('offset', `${pct.toFixed(3)}%`)
    stop.setAttribute(
      'class',
      s.kind === 'muted'
        ? 'density-rail-stop density-rail-stop-muted'
        : 'density-rail-stop density-rail-stop-axis',
    )
    grad.appendChild(stop)
  }

  return grad
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
  axes: ReadonlyArray<AxisMeta>,
  position: 'top' | 'bottom',
): HTMLElement {
  const el = document.createElement('div')
  el.className = `density-rail-headers density-rail-headers-${position}`
  for (const ax of axes) {
    const h = document.createElement('div')
    h.className = 'density-rail-header'
    h.dataset.axis = ax.key
    h.style.setProperty('--rail-color', `var(--rail-${ax.key}, var(--accent))`)
    const span = document.createElement('span')
    span.textContent = ax.label
    h.appendChild(span)

    if (ax.description) {
      const onMove = (e: MouseEvent): void => {
        h.dispatchEvent(
          new CustomEvent('density-rail-header-hover', {
            bubbles: true,
            detail: {
              x: e.clientX,
              y: e.clientY,
              axisKey: ax.key,
              axisLabel: ax.label,
              description: ax.description,
            },
          }),
        )
      }
      const onLeave = (): void => {
        h.dispatchEvent(new CustomEvent('density-rail-header-hover-end', { bubbles: true }))
      }
      h.addEventListener('mousemove', onMove)
      h.addEventListener('mouseenter', onMove)
      h.addEventListener('mouseleave', onLeave)
    }

    el.appendChild(h)
  }
  return el
}

function unionOfAxes(
  density: Record<string, DensityAxes>,
): ReadonlyArray<AxisMeta> {
  const seen = new Set<string>()
  for (const axes of Object.values(density)) {
    for (const k of Object.keys(axes)) seen.add(k)
  }
  const out: AxisMeta[] = []
  for (const ax of CANONICAL_AXES) {
    if (seen.has(ax.key)) out.push({ ...ax })
  }
  if (out.length === 0) {
    for (const ax of CANONICAL_AXES) out.push({ ...ax })
  }
  for (const k of [...seen].sort()) {
    if (CANONICAL_AXES.some((ax) => ax.key === k)) continue
    out.push({ key: k, label: k.slice(0, 8), description: '' })
  }
  return out
}

function formatTooltip(
  scores: DensityAxes,
  axes: ReadonlyArray<AxisMeta>,
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

/** Sign-aware label for a score: "weak" / "unremarkable" / "strong" / null
 *  when the score is missing. SPARSITY_SCORE is the same threshold the
 *  silhouette uses to stay flat against the baseline, so the descriptor
 *  matches what the rail actually shows. */
export function describeScore(score: number | null): 'weak' | 'unremarkable' | 'strong' | null {
  if (score === null) return null
  if (Math.abs(score) < SPARSITY_SCORE) return 'unremarkable'
  return score < 0 ? 'weak' : 'strong'
}
