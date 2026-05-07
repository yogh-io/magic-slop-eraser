import type { TextAnchor } from '../types'

const ANCHOR_CONTEXT = 24

export function makeAnchor(source: string, start: number, end: number): TextAnchor {
  return {
    start,
    end,
    text: source.slice(start, end),
    prefix: source.slice(Math.max(0, start - ANCHOR_CONTEXT), start),
    suffix: source.slice(end, Math.min(source.length, end + ANCHOR_CONTEXT)),
  }
}

export function relocateAnchor(source: string, anchor: TextAnchor): { start: number; end: number } | null {
  const exact = anchor.prefix + anchor.text + anchor.suffix
  const exactIdx = source.indexOf(exact)
  if (exactIdx >= 0) {
    const start = exactIdx + anchor.prefix.length
    return { start, end: start + anchor.text.length }
  }
  if (anchor.start >= 0 && source.slice(anchor.start, anchor.end) === anchor.text) {
    return { start: anchor.start, end: anchor.end }
  }
  let cursor = 0
  let firstMatch: { start: number; end: number } | null = null
  let count = 0
  while (cursor < source.length) {
    const idx = source.indexOf(anchor.text, cursor)
    if (idx < 0) break
    if (!firstMatch) firstMatch = { start: idx, end: idx + anchor.text.length }
    count += 1
    if (count > 1) break
    cursor = idx + 1
  }
  return count === 1 ? firstMatch : null
}

export function lineAt(source: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) line += 1
  }
  return line
}
