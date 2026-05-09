import { segmentSource } from './segments'

export interface Paragraph {
  /** Start offset in the source (after blank-line trim). */
  start: number
  /** End offset in the source (before trailing blank line). */
  end: number
  /** Trimmed paragraph text. */
  text: string
  /** Whitespace-collapsed canonical form used for hashing. */
  hashKey: string
}

/**
 * Block-leading sequences that mark a chunk as not-a-paragraph for density
 * scoring purposes. We keep the rail focused on prose `<p>` blocks; headings,
 * lists, blockquotes, and code render as different elements and don't need
 * the same density treatment.
 */
const SKIP_PREFIX = /^(#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s|```|~~~|    |\t)/

export function splitParagraphs(source: string): Paragraph[] {
  const out: Paragraph[] = []
  for (const seg of segmentSource(source)) {
    if (seg.kind !== 'prose') continue
    const text = seg.text
    let cursor = 0
    while (cursor < text.length) {
      while (
        cursor < text.length &&
        (text[cursor] === '\n' || text[cursor] === ' ' || text[cursor] === '\t' || text[cursor] === '\r')
      ) {
        cursor++
      }
      if (cursor >= text.length) break
      const blank = text.indexOf('\n\n', cursor)
      const end = blank === -1 ? text.length : blank
      const raw = text.slice(cursor, end)
      const trimmed = raw.trim()
      if (trimmed && !SKIP_PREFIX.test(trimmed)) {
        out.push({
          start: seg.start + cursor,
          end: seg.start + end,
          text: trimmed,
          hashKey: trimmed.replace(/\s+/g, ' '),
        })
      }
      cursor = end + 2
    }
  }
  return out
}
