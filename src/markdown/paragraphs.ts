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
 * scoring purposes. Headings, blockquotes, and code render as different
 * elements and don't need the same density treatment. Lists are handled
 * separately - each item is treated as its own paragraph.
 */
const SKIP_PREFIX = /^(#{1,6}\s|>\s?|```|~~~|    |\t)/
const LIST_MARKER = /^(\s*)([-*+]|\d+[.)])\s/

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
      if (trimmed) {
        if (LIST_MARKER.test(trimmed)) {
          for (const item of extractListItems(raw, seg.start + cursor)) {
            out.push(item)
          }
        } else if (!SKIP_PREFIX.test(trimmed)) {
          out.push({
            start: seg.start + cursor,
            end: seg.start + end,
            text: trimmed,
            hashKey: trimmed.replace(/\s+/g, ' '),
          })
        }
      }
      cursor = end + 2
    }
  }
  return out
}

/**
 * Split a list block into one Paragraph per top-level item. Items get their
 * marker (and any sub-list nesting underneath) stripped, then continuation
 * lines fold in so the resulting text mirrors what markdown-it renders into
 * the corresponding `<li>` element. Nested list items are absorbed into
 * their parent item rather than emitted separately - keeps the rail
 * one-row-per-top-level entry and avoids the visual mess of stamping
 * sub-items onto a separate rail row.
 */
function extractListItems(block: string, blockStart: number): Paragraph[] {
  const out: Paragraph[] = []
  const lines = block.split('\n')

  let topIndent = -1
  for (const line of lines) {
    const m = LIST_MARKER.exec(line)
    if (m) {
      topIndent = m[1].length
      break
    }
  }
  if (topIndent < 0) return out

  let charOffset = 0
  let current: { start: number; lines: string[] } | null = null

  const flush = (): void => {
    if (!current) return
    const joined = current.lines.join('\n')
    const text = joined.trim()
    if (text) {
      out.push({
        start: blockStart + current.start,
        end: blockStart + current.start + joined.length,
        text,
        hashKey: text.replace(/\s+/g, ' '),
      })
    }
    current = null
  }

  for (const line of lines) {
    const m = LIST_MARKER.exec(line)
    if (m && m[1].length === topIndent) {
      flush()
      const contentOffset = m[0].length
      current = { start: charOffset + contentOffset, lines: [line.slice(contentOffset)] }
    } else if (current) {
      current.lines.push(line)
    }
    charOffset += line.length + 1
  }
  flush()

  return out
}
