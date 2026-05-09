import type { Flag } from '../types'

interface Segment {
  node: Text
  start: number
  end: number
}

export interface HighlightOptions {
  /**
   * Map of flagId -> candidate replacement text. When a flag has a candidate,
   * its rendered mark shows the candidate text instead of the original; the
   * original is preserved on `data-pre` for hold-to-compare.
   */
  candidates?: Map<string, string>
  /**
   * If set, the flag with this id renders its `data-pre` (original) text even
   * if it has a candidate. Used for the hold-to-see-original gesture.
   */
  peekFlagId?: string | null
}

export function highlightFlagsInDom(
  root: HTMLElement,
  flags: Flag[],
  scopeSelector?: string,
  opts?: HighlightOptions,
): void {
  for (const mark of Array.from(root.querySelectorAll('mark.slop-flag'))) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  }

  const scopes: HTMLElement[] = scopeSelector
    ? Array.from(root.querySelectorAll<HTMLElement>(scopeSelector))
    : [root]
  if (scopes.length === 0) return

  for (const flag of flags) {
    const segments = collectSegments(scopes)
    const fullText = segments.map((s) => s.node.data).join('')
    const probe = flag.anchor.prefix + flag.anchor.text + flag.anchor.suffix
    let idx = -1
    if (probe.length > 0) idx = fullText.indexOf(probe)
    let textIdx: number
    if (idx >= 0) {
      textIdx = idx + flag.anchor.prefix.length
    } else {
      const fallback = fullText.indexOf(flag.anchor.text)
      if (fallback < 0) continue
      const second = fullText.indexOf(flag.anchor.text, fallback + 1)
      if (second >= 0) continue
      textIdx = fallback
    }
    wrapRange(segments, textIdx, textIdx + flag.anchor.text.length, flag)
  }

  if (opts?.candidates && opts.candidates.size > 0) {
    applyCandidateOverrides(root, opts.candidates, opts.peekFlagId ?? null)
  }
}

function collectSegments(roots: HTMLElement[]): Segment[] {
  const segments: Segment[] = []
  let cursor = 0
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode() as Text | null
    while (node) {
      const len = node.data.length
      segments.push({ node, start: cursor, end: cursor + len })
      cursor += len
      node = walker.nextNode() as Text | null
    }
  }
  return segments
}

function wrapRange(segments: Segment[], start: number, end: number, flag: Flag): void {
  const ops: { node: Text; nodeStart: number; nodeEnd: number }[] = []
  for (const seg of segments) {
    if (seg.end <= start) continue
    if (seg.start >= end) break
    ops.push({
      node: seg.node,
      nodeStart: Math.max(0, start - seg.start),
      nodeEnd: Math.min(seg.node.data.length, end - seg.start),
    })
  }
  for (const op of ops) {
    let target: Text = op.node
    if (op.nodeStart > 0) {
      target = target.splitText(op.nodeStart)
    }
    const innerLen = op.nodeEnd - op.nodeStart
    if (target.data.length > innerLen) {
      target.splitText(innerLen)
    }
    const mark = document.createElement('mark')
    mark.className = `slop-flag flag-pat-${flag.patternId}`
    mark.dataset.flagId = flag.id
    mark.dataset.patternId = flag.patternId
    mark.dataset.category = flag.category
    mark.dataset.severity = String(flag.severity)
    mark.style.setProperty('--flag-color', `var(--cat-${flag.category})`)
    target.parentNode?.insertBefore(mark, target)
    mark.appendChild(target)
  }
}

/**
 * Replace the rendered text of marks belonging to flags that have an
 * awaiting-accept candidate. Multi-segment flags collapse into the first
 * mark; the original text is preserved on data-pre so peek can restore it.
 */
function applyCandidateOverrides(
  root: HTMLElement,
  candidates: Map<string, string>,
  peekFlagId: string | null,
): void {
  const groups = new Map<string, HTMLElement[]>()
  for (const m of root.querySelectorAll<HTMLElement>('mark.slop-flag')) {
    const id = m.dataset.flagId
    if (!id) continue
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id)!.push(m)
  }
  for (const [fid, marks] of groups) {
    const post = candidates.get(fid)
    if (post === undefined) continue
    const pre = marks.map((m) => m.textContent ?? '').join('')
    const first = marks[0]
    first.dataset.pre = pre
    first.dataset.post = post
    if (peekFlagId === fid) {
      first.textContent = pre
      first.dataset.displaying = 'pre'
    } else {
      first.textContent = post
      first.dataset.displaying = 'post'
    }
    first.classList.add('has-candidate')
    for (let i = 1; i < marks.length; i++) marks[i].remove()
  }
}
