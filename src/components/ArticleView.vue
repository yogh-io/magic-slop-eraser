<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { highlightFlagsInDom } from '../anchoring/domHighlight'
import { segmentSource, type Segment } from '../markdown/segments'
import { applyDensityRails, type DensityAxes, type ParagraphInfo } from '../markdown/densityRail'
import type { Flag } from '../types'

type DensityTooltipState =
  | {
      kind: 'score'
      x: number
      y: number
      axisKey: string
      axisLabel: string
      score: number | null
      descriptor: 'weak' | 'unremarkable' | 'strong' | null
    }
  | {
      kind: 'description'
      x: number
      y: number
      axisKey: string
      axisLabel: string
      description: string
    }

const props = withDefaults(
  defineProps<{
    source: string
    flags: Flag[]
    selectedFlagId: string | null
    /** flagId -> candidate post text. Marks for these flags get a `has-candidate` class; the post text only renders inline while previewFlagId points at them. */
    candidates?: Map<string, string>
    /** While set, that flag's marks render the candidate (post) text inline instead of the original. */
    previewFlagId?: string | null
    /** While set, that flag's marks get a strong full-background highlight - used for hovering an annotation card. */
    hoveredFlagId?: string | null
    /** Paragraph metadata (hash + offsets), aligned to the source. Used to attach density rails. */
    paragraphs?: ParagraphInfo[]
    /** density[paragraphHash] = { axisName -> 0..10 }. Drives the rail intensities. */
    density?: Record<string, DensityAxes>
  }>(),
  {
    candidates: undefined,
    previewFlagId: null,
    hoveredFlagId: null,
    paragraphs: () => [],
    density: () => ({}),
  },
)

const emit = defineEmits<{
  (e: 'flag-click', id: string): void
  (e: 'selection-change', sel: { start: number; end: number; text: string } | null): void
  (e: 'layout-ready'): void
}>()

const md = new MarkdownIt({ html: false, linkify: true, typographer: false })
const containerRef = ref<HTMLElement | null>(null)

const segments = computed<Segment[]>(() => segmentSource(props.source))

function renderProse(text: string): string {
  return md.render(text)
}

async function applyHighlights(): Promise<void> {
  await nextTick()
  if (!containerRef.value) return
  highlightFlagsInDom(containerRef.value, props.flags, '.md-prose', {
    candidates: props.candidates,
    previewFlagId: props.previewFlagId,
  })
  applyDensityRails(containerRef.value, props.paragraphs, props.density)
  applyHoverClass(props.hoveredFlagId)
  // Let the next frame settle so layout/measurements are accurate.
  requestAnimationFrame(() => emit('layout-ready'))
}

// --- density rail tooltip ---------------------------------------------------

const densityTooltip = ref<DensityTooltipState | null>(null)

function onDensityScoreHover(e: Event): void {
  const evt = e as CustomEvent<Omit<DensityTooltipState & { kind: 'score' }, 'kind'>>
  densityTooltip.value = { kind: 'score', ...evt.detail }
}

function onDensityHeaderHover(e: Event): void {
  const evt = e as CustomEvent<Omit<DensityTooltipState & { kind: 'description' }, 'kind'>>
  densityTooltip.value = { kind: 'description', ...evt.detail }
}

function onDensityHoverEnd(): void {
  densityTooltip.value = null
}

function formatDensityScore(score: number | null): string {
  if (score === null) return '–'
  const sign = score > 0 ? '+' : ''
  return `${sign}${score.toFixed(1)}`
}

// --- frontmatter collapsible ------------------------------------------------

const FRONTMATTER_COLLAPSED_KEY = 'mse.frontmatter.collapsed'

function readFrontmatterCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(FRONTMATTER_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

const frontmatterCollapsed = ref<boolean>(readFrontmatterCollapsed())

function toggleFrontmatter(): void {
  frontmatterCollapsed.value = !frontmatterCollapsed.value
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      FRONTMATTER_COLLAPSED_KEY,
      frontmatterCollapsed.value ? '1' : '0',
    )
  } catch {
    /* ignore quota / disabled storage */
  }
}

onMounted(() => {
  void applyHighlights()
  const el = containerRef.value
  if (!el) return
  el.addEventListener('density-rail-hover', onDensityScoreHover)
  el.addEventListener('density-rail-hover-end', onDensityHoverEnd)
  el.addEventListener('density-rail-header-hover', onDensityHeaderHover)
  el.addEventListener('density-rail-header-hover-end', onDensityHoverEnd)
})

onBeforeUnmount(() => {
  const el = containerRef.value
  if (!el) return
  el.removeEventListener('density-rail-hover', onDensityScoreHover)
  el.removeEventListener('density-rail-hover-end', onDensityHoverEnd)
  el.removeEventListener('density-rail-header-hover', onDensityHeaderHover)
  el.removeEventListener('density-rail-header-hover-end', onDensityHoverEnd)
})
watch(
  () => [
    props.source,
    props.flags,
    props.candidates,
    props.previewFlagId,
    props.paragraphs,
    props.density,
  ],
  applyHighlights,
  { deep: true },
)

function applyHoverClass(id: string | null): void {
  if (!containerRef.value) return
  for (const m of containerRef.value.querySelectorAll<HTMLElement>('mark.slop-flag.is-hovered')) {
    m.classList.remove('is-hovered')
  }
  if (!id) return
  for (const el of containerRef.value.querySelectorAll<HTMLElement>(
    `mark.slop-flag[data-flag-id="${id}"]`,
  )) {
    el.classList.add('is-hovered')
  }
}

watch(
  () => props.hoveredFlagId,
  async (id) => {
    await nextTick()
    applyHoverClass(id)
  },
)

defineExpose({
  /** Returns flagId -> top offset (px) relative to the article container. */
  getMarkPositions(): Map<string, number> {
    const out = new Map<string, number>()
    if (!containerRef.value) return out
    const containerTop = containerRef.value.getBoundingClientRect().top
    for (const m of containerRef.value.querySelectorAll<HTMLElement>('mark.slop-flag')) {
      const fid = m.dataset.flagId
      if (!fid || out.has(fid)) continue
      out.set(fid, m.getBoundingClientRect().top - containerTop)
    }
    return out
  },
})

watch(
  () => props.selectedFlagId,
  async (id) => {
    await nextTick()
    if (!containerRef.value) return
    for (const m of containerRef.value.querySelectorAll<HTMLElement>('mark.slop-flag.is-selected')) {
      m.classList.remove('is-selected')
    }
    if (!id) return
    const el = containerRef.value.querySelector(`[data-flag-id="${id}"]`)
    if (el instanceof HTMLElement) {
      el.classList.add('is-selected')
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
)

function onClick(e: MouseEvent): void {
  const target = (e.target as HTMLElement).closest('mark.slop-flag') as HTMLElement | null
  if (target?.dataset.flagId) {
    emit('flag-click', target.dataset.flagId)
  }
}

function onMouseUp(): void {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !containerRef.value) {
    emit('selection-change', null)
    return
  }
  const range = sel.getRangeAt(0)
  if (!containerRef.value.contains(range.commonAncestorContainer)) {
    emit('selection-change', null)
    return
  }
  const text = sel.toString()
  if (!text.trim()) {
    emit('selection-change', null)
    return
  }
  const idx = props.source.indexOf(text)
  if (idx < 0) {
    emit('selection-change', { start: -1, end: -1, text })
    return
  }
  const second = props.source.indexOf(text, idx + 1)
  if (second >= 0) {
    emit('selection-change', { start: -1, end: -1, text })
    return
  }
  emit('selection-change', { start: idx, end: idx + text.length, text })
}
</script>

<template>
  <div
    ref="containerRef"
    class="article-view"
    :class="{ 'has-selection': selectedFlagId !== null }"
    @click="onClick"
    @mouseup="onMouseUp"
  >
    <template v-for="(seg, idx) in segments" :key="idx">
      <aside
        v-if="seg.kind === 'frontmatter'"
        class="md-aside md-frontmatter"
        :class="{ collapsed: frontmatterCollapsed }"
      >
        <button
          type="button"
          class="md-aside-label md-aside-toggle"
          :aria-expanded="!frontmatterCollapsed"
          :aria-label="frontmatterCollapsed ? 'Expand frontmatter' : 'Collapse frontmatter'"
          @click="toggleFrontmatter"
        >
          <span class="md-aside-caret">{{ frontmatterCollapsed ? '▸' : '▾' }}</span>
          frontmatter <span class="muted">· not edited</span>
        </button>
        <pre v-if="!frontmatterCollapsed">{{ seg.body }}</pre>
      </aside>

      <aside v-else-if="seg.kind === 'html-comment'" class="md-aside md-comment">
        <div class="md-aside-label">comment <span class="muted">· not edited</span></div>
        <p>{{ seg.body }}</p>
      </aside>

      <aside v-else-if="seg.kind === 'html-block'" class="md-aside md-html">
        <div class="md-aside-label">
          embedded html <code class="tag">&lt;{{ seg.tag }}&gt;</code>
          <span class="muted">· not edited</span>
        </div>
        <pre>{{ seg.raw }}</pre>
      </aside>

      <div v-else class="md-prose" v-html="renderProse(seg.text)" />
    </template>

    <Teleport to="body">
      <div
        v-if="densityTooltip"
        class="density-rail-tooltip"
        :data-kind="densityTooltip.kind"
        :data-descriptor="densityTooltip.kind === 'score' ? densityTooltip.descriptor ?? 'none' : 'none'"
        :style="{
          left: densityTooltip.x + 'px',
          top: densityTooltip.y + 'px',
          '--rail-color': `var(--rail-${densityTooltip.axisKey}, var(--accent))`,
        }"
      >
        <span class="density-rail-tooltip-label">{{ densityTooltip.axisLabel }}</span>
        <template v-if="densityTooltip.kind === 'score'">
          <span class="density-rail-tooltip-score">{{
            formatDensityScore(densityTooltip.score)
          }}</span>
          <span v-if="densityTooltip.descriptor" class="density-rail-tooltip-descriptor">{{
            densityTooltip.descriptor
          }}</span>
        </template>
        <p v-else class="density-rail-tooltip-description">{{ densityTooltip.description }}</p>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.article-view {
  font-family: var(--font-prose);
  font-size: var(--prose-size);
  line-height: var(--prose-leading);
  color: var(--text);
  max-width: 68ch;
  margin: 0 auto;
  position: relative;
}
.article-view :deep(h1),
.article-view :deep(h2),
.article-view :deep(h3) {
  font-family: var(--font-display);
  color: var(--heading);
  letter-spacing: var(--heading-tracking, normal);
}
.article-view :deep(h1) { font-size: 2.1rem; margin: 1.2em 0 0.6em; line-height: 1.18; }
.article-view :deep(h2) { font-size: 1.5rem; margin: 1.4em 0 0.5em; }
.article-view :deep(h3) { font-size: 1.2rem; margin: 1.2em 0 0.4em; }
.article-view :deep(p) { margin: 0 0 1.05em; }
.article-view :deep(blockquote) {
  border-left: 3px solid var(--rule);
  padding: 0.1em 1em;
  color: var(--muted);
  margin: 1em 0;
}
.article-view :deep(code) {
  font-family: var(--font-mono);
  background: var(--code-bg);
  padding: 0.1em 0.35em;
  border-radius: 3px;
  font-size: 0.9em;
}
.article-view :deep(pre) {
  background: var(--code-bg);
  padding: 1em;
  border-radius: 4px;
  overflow-x: auto;
}
.article-view :deep(a) { color: var(--link); }
.article-view :deep(hr) { border: none; border-top: 1px solid var(--rule); margin: 2em 0; }

.article-view :deep(mark.slop-flag) {
  background: transparent;
  color: inherit;
  border-bottom: 2px solid var(--flag-color, var(--accent));
  cursor: pointer;
  padding: 0 0.05em;
  transition: background 120ms ease, color 120ms ease;
}
.article-view :deep(mark.slop-flag:hover) {
  background: color-mix(in srgb, var(--flag-color, var(--accent)) 18%, transparent);
}
/* A second underline hints that the flag has a ready replacement on offer.
 * The article itself stays the writer's prose - the candidate only renders
 * when they hover the candidate block in the panel (see is-previewing). */
.article-view :deep(mark.slop-flag.has-candidate) {
  border-bottom-style: double;
  border-bottom-width: 4px;
}
.article-view :deep(mark.slop-flag.is-previewing) {
  background: color-mix(in srgb, #2f8f6a 18%, transparent);
  border-bottom-color: #2f8f6a;
  border-bottom-style: solid;
  border-bottom-width: 2px;
}
/* Secondary marks of a multi-segment flag fold into the first mark during a
 * preview - hidden, not removed, so the original prose can be restored when
 * the preview ends. */
.article-view :deep(mark.slop-flag.is-preview-hidden) {
  display: none;
}
/* Hover-from-card: full opaque highlight in the flag's category color so the
 * writer can immediately see which span the annotation refers to. */
.article-view :deep(mark.slop-flag.is-hovered) {
  background: var(--flag-color, var(--accent));
  color: var(--bg);
  border-bottom-color: var(--flag-color, var(--accent));
  border-radius: 2px;
}
.article-view :deep(mark.slop-flag.is-hovered.is-previewing) {
  background: #2f8f6a;
  color: #fff;
  border-bottom-color: #2f8f6a;
}
.article-view :deep(mark.slop-flag.is-selected) {
  background: color-mix(in srgb, var(--flag-color, var(--accent)) 18%, transparent);
  outline: 2px solid color-mix(in srgb, var(--flag-color, var(--accent)) 50%, transparent);
  outline-offset: 1px;
  border-radius: 2px;
}

/* Density rails: N parallel vertical lanes in the left gutter, one per     */
/* axis. Each lane is an SVG silhouette with BOTH edges wavy and mirrored */
/* around the lane centerline: positive scores push both edges outward    */
/* (lane widens symmetrically, convex bulge); negative scores pull both   */
/* edges inward (lane pinches symmetrically, concave dent). The fill is a */
/* per-lane vertical linearGradient that fades from the axis colour       */
/* inside each paragraph row to a muted gray in the gaps between, so the  */
/* rail only carries colour where the score is actually measuring         */
/* something. Inter-paragraph zones, headings, and top/bottom margins     */
/* read as ambient noise. See docs/density-rail.md for the spec.          */
.article-view :deep(.density-rails) {
  position: absolute;
  left: -8rem;
  pointer-events: none;
  z-index: 0;
}
.article-view :deep(.density-rail-headers) {
  position: absolute;
  left: 0;
  display: flex;
  gap: 10px;
  pointer-events: auto;
}
.article-view :deep(.density-rail-headers-top) {
  bottom: 100%;
  margin-bottom: 8px;
}
.article-view :deep(.density-rail-headers-bottom) {
  top: 100%;
  margin-top: 8px;
}
.article-view :deep(.density-rail-header) {
  width: 14px;
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  background: color-mix(in srgb, var(--rail-color, var(--accent)) 14%, transparent);
  transition: background 160ms ease, transform 160ms ease;
}
.article-view :deep(.density-rail-header:hover) {
  background: color-mix(in srgb, var(--rail-color, var(--accent)) 26%, transparent);
  transform: translateY(-1px);
}
.article-view :deep(.density-rail-header > span) {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  color: color-mix(in srgb, var(--rail-color, var(--accent)) 88%, var(--text));
  writing-mode: vertical-rl;
  white-space: nowrap;
  user-select: none;
}
.article-view :deep(.density-rail-lanes) {
  display: flex;
  gap: 10px;
  height: 100%;
}
.article-view :deep(.density-rail) {
  position: relative;
  width: 14px;
  height: 100%;
  flex-shrink: 0;
  overflow: visible;
}
/* Baseline guides: two faint vertical lines at the lane's left and right
 * edges (both edges deflect now, so the writer needs both lines to read
 * symmetric bulges/dents). Drawn behind the silhouette via z-stacking. */
.article-view :deep(.density-rail::before),
.article-view :deep(.density-rail::after) {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: color-mix(in srgb, var(--rail-color, var(--accent)) 14%, transparent);
  z-index: 0;
}
.article-view :deep(.density-rail::before) { left: 0; }
.article-view :deep(.density-rail::after) { right: 0; }
.article-view :deep(.density-rail[data-no-signal="1"]::before),
.article-view :deep(.density-rail[data-no-signal="1"]::after) {
  background: color-mix(in srgb, var(--muted) 14%, transparent);
}
.article-view :deep(.density-rail-svg) {
  position: relative;
  z-index: 1;
  pointer-events: none;
}
.article-view :deep(.density-rail-silhouette) {
  stroke-width: 0.8;
  stroke-linejoin: round;
}
/* Gradient stops: the SVG <stop> elements inherit --rail-color from the
 * lane container (set per-axis by JS), so each lane fades to its own hue
 * inside paragraph rows and to the theme's muted colour in between. */
.article-view :deep(.density-rail-stop-axis) {
  stop-color: var(--rail-color, var(--accent));
  stop-opacity: 0.7;
}
.article-view :deep(.density-rail-stop-muted) {
  stop-color: var(--muted, #888);
  stop-opacity: 0.18;
}
.article-view :deep(p.has-density-rail) {
  cursor: help;
}
/* Hover targets sit on top of the silhouette and re-enable pointer events so
 * the cursor can drive the tooltip popover. The cursor turns to a help marker
 * to advertise the affordance. */
.article-view :deep(.density-rail-hover-zones rect) {
  pointer-events: all;
  cursor: help;
}
@media (max-width: 900px) {
  .article-view :deep(.density-rails) { display: none; }
}

/* Density-rail tooltip popover. Teleported to <body> so its position:fixed
 * coordinates are viewport-relative and it isn't clipped by overflow:auto
 * ancestors. Themed per-axis via --rail-color set inline by the listener;
 * descriptor (weak/unremarkable/strong) lights up to mirror the silhouette. */
.density-rail-tooltip {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  transform: translate(16px, -50%);
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.45rem 0.7rem;
  border-radius: 6px;
  background: var(--card-bg, #fff);
  border: 1px solid color-mix(in srgb, var(--rail-color, var(--accent)) 38%, var(--rule));
  box-shadow:
    0 1px 0 color-mix(in srgb, var(--rail-color, var(--accent)) 15%, transparent) inset,
    0 8px 24px -8px color-mix(in srgb, var(--rail-color, var(--accent)) 35%, transparent),
    0 2px 8px rgba(0, 0, 0, 0.08);
  font-family: var(--font-ui);
  white-space: nowrap;
  user-select: none;
}
.density-rail-tooltip-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: lowercase;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--rail-color, var(--accent)) 95%, var(--text));
}
.density-rail-tooltip-score {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.density-rail-tooltip-descriptor {
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-style: italic;
  color: var(--muted);
}
.density-rail-tooltip[data-descriptor="strong"] .density-rail-tooltip-descriptor {
  color: color-mix(in srgb, var(--rail-color, var(--accent)) 80%, var(--text));
}
.density-rail-tooltip[data-descriptor="weak"] .density-rail-tooltip-descriptor {
  color: color-mix(in srgb, var(--rail-color, var(--accent)) 70%, var(--text));
  opacity: 0.85;
}
.density-rail-tooltip[data-descriptor="unremarkable"] .density-rail-tooltip-descriptor {
  color: var(--muted);
  opacity: 0.7;
}
/* Description variant: triggered by hovering a column header (info, arg, …).
 * Wider, multi-line, paragraph-shaped so the explanation has room to breathe. */
.density-rail-tooltip[data-kind="description"] {
  display: block;
  max-width: 260px;
  padding: 0.55rem 0.75rem 0.6rem;
  white-space: normal;
}
.density-rail-tooltip[data-kind="description"] .density-rail-tooltip-label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.74rem;
}
.density-rail-tooltip-description {
  margin: 0;
  font-family: var(--font-prose);
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--text);
}

/* Embedded, set-aside blocks: hidden in plain sight, not edit targets. */
.md-aside {
  border-left: 3px solid var(--rule);
  background: color-mix(in srgb, var(--muted) 6%, transparent);
  color: var(--muted);
  margin: 1.1em 0;
  padding: 0.55em 1em 0.65em;
  border-radius: 0 4px 4px 0;
  font-size: 0.92em;
  user-select: text;
}
.md-aside-label {
  font-family: var(--font-mono);
  font-size: 0.75em;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 0.4em;
  display: flex;
  align-items: center;
  gap: 0.4em;
}
.md-aside-label .muted { opacity: 0.7; text-transform: none; letter-spacing: 0; }
.md-aside-label .tag {
  background: transparent;
  padding: 0;
  font-size: 1em;
  color: var(--muted);
}
/* Frontmatter toggle: same visual presence as the static label, but acts as
 * a button. Caret rotates the visual cue between collapsed and expanded. */
.md-aside-toggle {
  appearance: none;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  width: 100%;
  text-align: left;
}
.md-aside-toggle:hover { color: var(--text); }
.md-aside-toggle .md-aside-caret {
  display: inline-block;
  width: 0.9em;
  font-size: 0.85em;
  color: color-mix(in srgb, var(--muted) 70%, var(--text));
  transition: transform 120ms ease;
}
.md-frontmatter.collapsed {
  padding-top: 0.4em;
  padding-bottom: 0.45em;
}
.md-frontmatter.collapsed .md-aside-toggle { margin-bottom: 0; }
.md-aside pre {
  margin: 0;
  background: transparent;
  padding: 0;
  font-family: var(--font-mono);
  font-size: 0.86em;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--muted);
  overflow-x: auto;
}
.md-aside p {
  margin: 0;
  font-style: italic;
  color: var(--muted);
}
.md-comment p::before { content: '- '; opacity: 0.6; }
</style>
