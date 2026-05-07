import type { Flag } from '../types'

interface Segment {
  node: Text
  start: number
  end: number
}

export function highlightFlagsInDom(root: HTMLElement, flags: Flag[]): void {
  for (const mark of Array.from(root.querySelectorAll('mark.slop-flag'))) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  }

  for (const flag of flags) {
    const segments = collectSegments(root)
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
}

function collectSegments(root: HTMLElement): Segment[] {
  const segments: Segment[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let cursor = 0
  let node = walker.nextNode() as Text | null
  while (node) {
    const len = node.data.length
    segments.push({ node, start: cursor, end: cursor + len })
    cursor += len
    node = walker.nextNode() as Text | null
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
