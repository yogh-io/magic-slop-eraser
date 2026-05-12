import type { Flag, TextAnchor } from '../types'

interface Segment {
  node: Text
  start: number
  end: number
}

export interface HighlightOptions {
  /**
   * Map of flagId -> candidate replacement text. By default the article shows
   * the original anchored text; the candidate only renders inline while the
   * user is actively previewing one (see `previewFlagId`). Marks for any flag
   * that has a candidate available get a `has-candidate` class regardless, so
   * the UI can hint that a replacement is on offer.
   */
  candidates?: Map<string, string>
  /**
   * If set, the flag with this id renders its candidate (post) text inline
   * instead of the original. Drives the hover-to-preview gesture from the
   * annotation panel: hover the candidate block, see how the replacement
   * flows in context.
   */
  previewFlagId?: string | null
}

export function highlightFlagsInDom(
  root: HTMLElement,
  flags: Flag[],
  scopeSelector?: string,
  opts?: HighlightOptions,
): void {
  for (const mark of Array.from(root.querySelectorAll<HTMLElement>('mark.slop-flag'))) {
    const parent = mark.parentNode
    if (!parent) continue
    // A preview swap stashes the mark's original text on dataset.pre and
    // replaces textContent with the candidate. Restore the original before
    // unwrapping so the source-of-truth DOM never carries candidate text
    // beyond the preview gesture - otherwise the next mark-application pass
    // can't find the anchor and the gutter card loses its position.
    if (mark.dataset.pre !== undefined) {
      mark.textContent = mark.dataset.pre
    }
    if (mark.classList.contains('is-preview-hidden')) {
      mark.classList.remove('is-preview-hidden')
    }
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  }

  const scopes: HTMLElement[] = scopeSelector
    ? Array.from(root.querySelectorAll<HTMLElement>(scopeSelector))
    : [root]
  if (scopes.length === 0) return

  for (const flag of flags) {
    paintAnchor(scopes, flag, flag.anchor, false)
    if (flag.relatedAnchors && flag.relatedAnchors.length > 0) {
      for (const rel of flag.relatedAnchors) {
        paintAnchor(scopes, flag, rel, true)
      }
    }
  }

  if (opts?.candidates && opts.candidates.size > 0) {
    applyCandidateOverrides(root, opts.candidates, opts.previewFlagId ?? null)
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

function paintAnchor(scopes: HTMLElement[], flag: Flag, anchor: TextAnchor, isRelated: boolean): void {
  const segments = collectSegments(scopes)
  const fullText = segments.map((s) => s.node.data).join('')
  const probe = anchor.prefix + anchor.text + anchor.suffix
  let idx = -1
  if (probe.length > 0) idx = fullText.indexOf(probe)
  let textIdx: number
  if (idx >= 0) {
    textIdx = idx + anchor.prefix.length
  } else {
    const fallback = fullText.indexOf(anchor.text)
    if (fallback < 0) return
    const second = fullText.indexOf(anchor.text, fallback + 1)
    if (second >= 0) return
    textIdx = fallback
  }
  wrapRange(segments, textIdx, textIdx + anchor.text.length, flag, isRelated)
}

function wrapRange(segments: Segment[], start: number, end: number, flag: Flag, isRelated: boolean): void {
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
    mark.className = `slop-flag flag-pat-${flag.patternId}${isRelated ? ' is-related' : ''}`
    mark.dataset.flagId = flag.id
    mark.dataset.patternId = flag.patternId
    mark.dataset.category = flag.category
    mark.dataset.severity = String(flag.severity)
    if (isRelated) mark.dataset.related = '1'
    mark.style.setProperty('--flag-color', `var(--cat-${flag.category})`)
    target.parentNode?.insertBefore(mark, target)
    mark.appendChild(target)
  }
}

/**
 * Tag marks that have a candidate available, and (only when actively
 * previewing one) swap the mark's rendered text to the candidate. Multi-
 * segment flags collapse into the first mark while previewing; the rest
 * are hidden (not removed) so the original prose stays intact in the DOM
 * and the cleanup pass on preview-end can rebuild positions from it. The
 * default is original-text-in-place, so the article never shows agent-
 * proposed replacements until the writer hovers a candidate to preview it.
 */
function applyCandidateOverrides(
  root: HTMLElement,
  candidates: Map<string, string>,
  previewFlagId: string | null,
): void {
  const groups = new Map<string, HTMLElement[]>()
  for (const m of root.querySelectorAll<HTMLElement>('mark.slop-flag')) {
    const id = m.dataset.flagId
    if (!id) continue
    if (m.dataset.related === '1') continue
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id)!.push(m)
  }
  for (const [fid, marks] of groups) {
    const post = candidates.get(fid)
    if (post === undefined) continue
    for (const m of marks) m.classList.add('has-candidate')
    if (previewFlagId !== fid) continue
    const first = marks[0]
    first.dataset.pre = first.textContent ?? ''
    first.textContent = post
    first.classList.add('is-previewing')
    for (let i = 1; i < marks.length; i++) marks[i].classList.add('is-preview-hidden')
  }
}
