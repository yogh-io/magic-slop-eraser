<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownIt from 'markdown-it'
import aboutSrc from './about.md?raw'
import { useOgHead } from '../composables/useOgHead'

const md = new MarkdownIt({ html: true, linkify: true, typographer: false })
const html = computed(() => md.render(aboutSrc))

useOgHead(() => ({
  title: 'Methodology',
  description:
    'How slopmop works: the three rungs (lexical, passage-level judgment, presentation), the paired-writing steering loop, and the catalogue curation principle.',
  path: '/about',
  ogType: 'article',
}))

const router = useRouter()

function onClick(e: MouseEvent): void {
  const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
  if (!a) return
  const href = a.getAttribute('href')
  if (!href) return
  if (href.startsWith('/') && !href.startsWith('//')) {
    e.preventDefault()
    router.push(href)
  }
}
</script>

<template>
  <article class="prose" v-html="html" @click="onClick" />
</template>

<style scoped>
.prose {
  max-width: 72ch;
  margin: 2rem auto 5rem;
  padding: 0 2rem;
  color: var(--text);
  line-height: 1.65;
}
.prose :deep(h1) {
  font-family: var(--font-display);
  font-size: 2.4rem;
  margin: 0 0 1rem;
  letter-spacing: var(--heading-tracking, normal);
}
.prose :deep(h1 + p) {
  font-size: 1.08rem;
  color: var(--text);
  margin: 0 0 1.2rem;
}
.prose :deep(em) { font-style: italic; }

.prose :deep(h2) {
  font-family: var(--font-display);
  font-size: 1.15rem;
  margin: 2rem 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.prose :deep(a) { color: var(--text); border-bottom: 1px dotted var(--rule); text-decoration: none; }
.prose :deep(a:hover) { border-bottom-color: var(--text); }

.prose :deep(ul.rung-summary) {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
  display: grid;
  gap: 0.4rem;
}
.prose :deep(ul.rung-summary li) {
  border-left: 3px solid var(--rule);
  padding: 0.3rem 0 0.3rem 0.9rem;
}
.prose :deep(ul.rung-summary strong) { font-weight: 600; }
.prose :deep(.r1) { color: #2f8f6a; }
.prose :deep(.r2) { color: #b88f3e; }
.prose :deep(.r3) { color: #b8472d; }
</style>
