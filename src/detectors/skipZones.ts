import { embeddedRanges, segmentSource } from '../markdown/segments'

export interface Range {
  start: number
  end: number
}

export function extractSkipZones(source: string): Range[] {
  const zones: Range[] = []

  for (const r of embeddedRanges(segmentSource(source))) {
    zones.push(r)
  }

  const fence = /^```[\s\S]*?^```/gm
  for (const m of source.matchAll(fence)) {
    if (m.index === undefined) continue
    zones.push({ start: m.index, end: m.index + m[0].length })
  }

  const inline = /`[^`\n]+`/g
  for (const m of source.matchAll(inline)) {
    if (m.index === undefined) continue
    zones.push({ start: m.index, end: m.index + m[0].length })
  }

  const linkUrl = /\]\([^)]+\)/g
  for (const m of source.matchAll(linkUrl)) {
    if (m.index === undefined) continue
    zones.push({ start: m.index, end: m.index + m[0].length })
  }

  const blockquote = /^>[^\n]*$/gm
  for (const m of source.matchAll(blockquote)) {
    if (m.index === undefined) continue
    zones.push({ start: m.index, end: m.index + m[0].length })
  }

  return zones.sort((a, b) => a.start - b.start)
}

export function isInSkipZone(offset: number, zones: Range[]): boolean {
  for (const z of zones) {
    if (offset >= z.start && offset < z.end) return true
    if (z.start > offset) break
  }
  return false
}

export function approximateProseWordCount(source: string, zones: Range[]): number {
  let words = 0
  let cursor = 0
  for (const z of zones) {
    const slice = source.slice(cursor, z.start)
    words += countWords(slice)
    cursor = z.end
  }
  if (cursor < source.length) {
    words += countWords(source.slice(cursor))
  }
  return words
}

function countWords(s: string): number {
  const m = s.match(/\b[\p{L}\p{N}']+\b/gu)
  return m ? m.length : 0
}
