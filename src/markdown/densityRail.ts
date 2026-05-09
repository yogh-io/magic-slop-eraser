export interface ParagraphInfo {
  hash: string
  start: number
  end: number
  text: string
}

export type DensityAxes = Record<string, number>

/**
 * Canonical axis order. Axes the agent reports outside this list still
 * render - they get the fallback color and slot in after the canonical ones.
 * Score range: 0..10, mapped to 0..1 opacity.
 */
export const CANONICAL_AXES: ReadonlyArray<{ key: string; label: string; color: string }> = [
  { key: 'information', label: 'info', color: '#2f8f6a' },
  { key: 'argument', label: 'arg', color: '#3a6db8' },
  { key: 'impact', label: 'impact', color: '#b8472d' },
  { key: 'specificity', label: 'spec', color: '#b88f3e' },
  { key: 'voice', label: 'voice', color: '#7a4ab8' },
]

const FALLBACK_COLOR = '#6b6b6b'

/**
 * Walk the rendered article and prepend a density rail to each `<p>` whose
 * paragraph text matches a known paragraph hash. Idempotent: removes any
 * previously-attached rail before re-attaching.
 */
export function applyDensityRails(
  root: HTMLElement,
  paragraphs: readonly ParagraphInfo[],
  density: Record<string, DensityAxes>,
): void {
  // Clear previous rails.
  for (const el of Array.from(root.querySelectorAll('.density-rail'))) el.remove()
  for (const p of Array.from(root.querySelectorAll<HTMLElement>('p[data-density-hash]'))) {
    p.removeAttribute('data-density-hash')
    p.classList.remove('has-density-rail')
  }

  if (paragraphs.length === 0) return

  // Build a lookup: normalised text -> ParagraphInfo. Markdown renders to <p>
  // with inline formatting stripped; matching by canonical text is robust to
  // **bold** and *italic* markup as long as the inner text matches.
  const byCanonical = new Map<string, ParagraphInfo>()
  for (const p of paragraphs) {
    const key = canonical(p.text)
    if (key) byCanonical.set(key, p)
  }

  const axisUnion = unionOfAxes(density)

  for (const pEl of Array.from(root.querySelectorAll<HTMLElement>('.md-prose p'))) {
    const key = canonical(pEl.textContent ?? '')
    if (!key) continue
    const info = byCanonical.get(key)
    if (!info) continue
    const scores = density[info.hash]
    if (!scores || Object.keys(scores).length === 0) continue

    pEl.dataset.densityHash = info.hash
    pEl.classList.add('has-density-rail')
    pEl.appendChild(buildRail(scores, axisUnion))
  }
}

function buildRail(scores: DensityAxes, axes: ReadonlyArray<{ key: string; label: string; color: string }>): HTMLElement {
  const rail = document.createElement('span')
  rail.className = 'density-rail'
  rail.setAttribute('aria-hidden', 'true')
  rail.title = formatTooltip(scores, axes)
  for (const axis of axes) {
    const stripe = document.createElement('span')
    stripe.className = 'density-stripe'
    stripe.dataset.axis = axis.key
    stripe.style.setProperty('--axis-color', axis.color)
    const raw = scores[axis.key]
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      stripe.style.setProperty('--axis-score', String(clamp01(raw / 10)))
      stripe.classList.add('has-score')
    } else {
      stripe.style.setProperty('--axis-score', '0')
    }
    rail.appendChild(stripe)
  }
  return rail
}

function unionOfAxes(
  density: Record<string, DensityAxes>,
): ReadonlyArray<{ key: string; label: string; color: string }> {
  const seen = new Set<string>()
  for (const axes of Object.values(density)) {
    for (const k of Object.keys(axes)) seen.add(k)
  }
  // Canonical first, then any extras in stable order.
  const out: { key: string; label: string; color: string }[] = []
  for (const ax of CANONICAL_AXES) {
    if (seen.has(ax.key)) out.push({ ...ax })
  }
  // If no scores at all, still render the canonical axes so the rail has shape.
  if (out.length === 0) {
    for (const ax of CANONICAL_AXES) out.push({ ...ax })
  }
  for (const k of [...seen].sort()) {
    if (CANONICAL_AXES.some((ax) => ax.key === k)) continue
    out.push({ key: k, label: k.slice(0, 8), color: FALLBACK_COLOR })
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
