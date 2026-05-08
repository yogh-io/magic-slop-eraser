<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { highlightFlagsInDom } from '../anchoring/domHighlight'
import { segmentSource, type Segment } from '../markdown/segments'
import type { Flag } from '../types'

const props = defineProps<{
  source: string
  flags: Flag[]
  selectedFlagId: string | null
}>()

const emit = defineEmits<{
  (e: 'flag-click', id: string): void
  (e: 'selection-change', sel: { start: number; end: number; text: string } | null): void
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
  highlightFlagsInDom(containerRef.value, props.flags, '.md-prose')
}

onMounted(applyHighlights)
watch(() => [props.source, props.flags], applyHighlights, { deep: true })

watch(
  () => props.selectedFlagId,
  async (id) => {
    await nextTick()
    if (!id || !containerRef.value) return
    const el = containerRef.value.querySelector(`[data-flag-id="${id}"]`)
    if (el instanceof HTMLElement) {
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
      <aside v-if="seg.kind === 'frontmatter'" class="md-aside md-frontmatter">
        <div class="md-aside-label">frontmatter <span class="muted">· not edited</span></div>
        <pre>{{ seg.body }}</pre>
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
  transition: background 120ms;
}
.article-view :deep(mark.slop-flag:hover),
.article-view :deep(mark.slop-flag.is-selected) {
  background: color-mix(in srgb, var(--flag-color, var(--accent)) 18%, transparent);
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
