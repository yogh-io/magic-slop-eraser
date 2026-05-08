export type Segment =
  | { kind: 'prose'; start: number; end: number; text: string }
  | { kind: 'frontmatter'; start: number; end: number; raw: string; body: string }
  | { kind: 'html-comment'; start: number; end: number; raw: string; body: string }
  | { kind: 'html-block'; start: number; end: number; raw: string; tag: string }

/**
 * Split a markdown source into prose runs and embedded blocks.
 *
 * The eraser treats prose as the editable body and these constructs as
 * set-aside metadata: YAML frontmatter at the top, HTML comments
 * (`<!-- blurb -->`), and raw HTML blocks (`<figure>...</figure>`,
 * `<div class="..."></div>`). They render distinctly and detectors skip them.
 *
 * The segmenter is intentionally simple. HTML blocks must start at a line
 * beginning with `<tagname` and end at the next blank line, matching the
 * CommonMark type-6/7 rule. That's enough for the embeds in real prose
 * without trying to be a full HTML parser.
 */
export function segmentSource(source: string): Segment[] {
  const segments: Segment[] = []
  let i = 0
  let proseStart = 0

  function flushProse(end: number): void {
    if (end > proseStart) {
      segments.push({
        kind: 'prose',
        start: proseStart,
        end,
        text: source.slice(proseStart, end),
      })
    }
  }

  if (source.startsWith('---\n')) {
    const closing = source.indexOf('\n---', 4)
    if (closing !== -1) {
      const afterClose = closing + 4
      const ch = source[afterClose]
      if (ch === undefined || ch === '\n' || ch === '\r') {
        const end = ch === undefined ? source.length : afterClose + 1
        segments.push({
          kind: 'frontmatter',
          start: 0,
          end,
          raw: source.slice(0, end),
          body: source.slice(4, closing),
        })
        proseStart = end
        i = end
      }
    }
  }

  while (i < source.length) {
    const lineStart = i === 0 || source[i - 1] === '\n'
    if (!lineStart) {
      i++
      continue
    }

    if (source.startsWith('<!--', i)) {
      const close = source.indexOf('-->', i + 4)
      if (close !== -1) {
        let end = close + 3
        while (end < source.length && (source[end] === ' ' || source[end] === '\t')) end++
        if (source[end] === '\n') end++
        flushProse(i)
        segments.push({
          kind: 'html-comment',
          start: i,
          end,
          raw: source.slice(i, end),
          body: source.slice(i + 4, close).trim(),
        })
        proseStart = end
        i = end
        continue
      }
    }

    const tagMatch = matchHtmlBlockStart(source, i)
    if (tagMatch) {
      const end = findHtmlBlockEnd(source, i)
      flushProse(i)
      segments.push({
        kind: 'html-block',
        start: i,
        end,
        raw: source.slice(i, end).replace(/\n+$/, ''),
        tag: tagMatch,
      })
      proseStart = end
      i = end
      continue
    }

    const nl = source.indexOf('\n', i)
    if (nl === -1) break
    i = nl + 1
  }
  flushProse(source.length)
  return segments
}

function matchHtmlBlockStart(source: string, i: number): string | null {
  const slice = source.slice(i, i + 200)
  const m = slice.match(/^<([a-z][a-z0-9-]*)\b/)
  return m ? m[1] : null
}

function findHtmlBlockEnd(source: string, start: number): number {
  const blank = source.indexOf('\n\n', start)
  if (blank === -1) return source.length
  return blank + 1
}

export function embeddedRanges(segments: Segment[]): Array<{ start: number; end: number }> {
  return segments
    .filter((s) => s.kind !== 'prose')
    .map((s) => ({ start: s.start, end: s.end }))
}
