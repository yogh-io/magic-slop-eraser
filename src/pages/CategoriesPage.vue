<script setup lang="ts">
import { computed } from 'vue'
import { categories, getCategory } from '../catalog/categories'
import { patterns } from '../catalog/patterns'
import type { CategoryId, PatternMeta } from '../types'

const categoryOrder: CategoryId[] = ['lexical', 'structural', 'argumentative', 'tonal', 'format']

const orderedPatterns = computed(() => {
  const out: PatternMeta[] = []
  for (const c of categoryOrder) {
    for (const p of patterns) if (p.category === c) out.push(p)
  }
  return out
})

const placeholderGlyph: Record<CategoryId, string> = {
  lexical: '◆',        // ◆ BLACK DIAMOND
  structural: '▦',     // ▦ SQUARE WITH ORTHOGONAL CROSSHATCH FILL
  argumentative: '▲',  // ▲ BLACK UP-POINTING TRIANGLE
  tonal: '●',          // ● BLACK CIRCLE
  format: '▤',         // ▤ SQUARE WITH HORIZONTAL FILL
}

function descriptionFor(p: PatternMeta): string {
  const text = p.essay ?? p.whyItsSlop
  const sentences = text.split(/(?<=[.!?])\s+/)
  let startIdx = 0
  while (
    startIdx < sentences.length &&
    p.blurb.includes(sentences[startIdx].trim())
  ) {
    startIdx++
  }
  let result = ''
  for (let i = startIdx; i < sentences.length; i++) {
    const s = sentences[i]
    const next = result ? result + ' ' + s : s
    if (next.length > 240 && result) break
    result = next
    if (result.length > 170) break
  }
  return result || sentences.slice(-1)[0] || ''
}

function categoryName(id: CategoryId): string {
  return getCategory(id)?.name ?? id
}
</script>

<template>
  <article class="prose">
    <header class="hd">
      <h1>The slop catalogue</h1>
      <p class="lede">
        Twenty-eight named patterns across five categories. Each pane is a single move the model
        reaches for reflexively. Click for the full treatment - definition, examples in the wild,
        and how to fix it when it shows up in your own draft.
      </p>
      <p class="meta-tic">
        <strong>The meta-tic is evenness.</strong> Real writing has lumps; models sand them off.
        If a piece reads like every paragraph was equally edited, it was probably equally generated.
        These twenty-eight are the ridges the sander leaves behind.
      </p>
    </header>

    <div class="legend">
      <span class="legend-title">categories</span>
      <span v-for="c in categories" :key="c.id" class="legend-item">
        <span class="legend-icon" :style="{ background: `var(--cat-${c.id})` }">{{ placeholderGlyph[c.id] }}</span>
        {{ c.name }}
      </span>
    </div>

    <div class="grid">
      <router-link
        v-for="p in orderedPatterns"
        :key="p.id"
        :to="`/patterns/${p.id}`"
        class="pane"
        :class="`cat-${p.category}`"
      >
        <header class="pane-head">
          <span
            class="icon-slot"
            :style="{ background: `var(--cat-${p.category})` }"
            aria-hidden="true"
          >{{ placeholderGlyph[p.category] }}</span>
          <div class="head-text">
            <h3>{{ p.name }}</h3>
            <span class="cat-tag">{{ categoryName(p.category) }}</span>
          </div>
          <span v-if="p.severity === 'primary'" class="primary-mark">primary</span>
        </header>
        <p class="bold-line">{{ p.blurb }}</p>
        <p class="description">{{ descriptionFor(p) }}</p>
      </router-link>
    </div>

    <footer class="catalogue-foot">
      <p>
        Need the long-form essay for a category as a whole? Try
        <router-link
          v-for="(c, i) in categories"
          :key="c.id"
          :to="`/categories/${c.id}`"
          class="cat-link"
        >{{ c.name.toLowerCase() }}<span v-if="i < categories.length - 1">,&nbsp;</span></router-link>.
      </p>
    </footer>
  </article>
</template>

<style scoped>
.prose {
  max-width: 1180px;
  margin: 2rem auto 5rem;
  padding: 0 2rem;
  color: var(--text);
}

.hd {
  max-width: 76ch;
  margin: 0 auto 2rem;
}
h1 {
  font-family: var(--font-display);
  font-size: 2.6rem;
  letter-spacing: var(--heading-tracking, normal);
  margin: 0 0 0.6rem;
  line-height: 1.1;
}
.lede {
  font-size: 1.05rem;
  line-height: 1.65;
  color: var(--text);
  margin: 0 0 1rem;
}
.meta-tic {
  border-left: 3px solid var(--accent);
  padding: 0.4rem 0 0.4rem 1rem;
  margin: 1rem 0 0;
  color: var(--muted);
  font-size: 0.96em;
  line-height: 1.55;
}
.meta-tic strong { color: var(--text); }

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.1rem;
  align-items: center;
  margin: 0 auto 1.5rem;
  max-width: 76ch;
  padding: 0.6rem 0;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  font-size: 0.85rem;
  color: var(--muted);
}
.legend-title {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.7rem;
  color: var(--muted);
  margin-right: 0.4rem;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text);
}
.legend-icon {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  color: #ffffff;
  font-size: 0.78rem;
  text-shadow: 0 1px 1px rgba(0,0,0,0.18);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
  align-items: stretch;
}

.pane {
  display: block;
  background: var(--card-bg);
  border: 1px solid var(--rule);
  border-top: 3px solid var(--cat-color);
  border-radius: 6px;
  padding: 1rem 1.1rem 1.1rem;
  text-decoration: none;
  color: inherit;
  transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
  position: relative;
}
.pane.cat-lexical        { --cat-color: var(--cat-lexical); }
.pane.cat-structural     { --cat-color: var(--cat-structural); }
.pane.cat-argumentative  { --cat-color: var(--cat-argumentative); }
.pane.cat-tonal          { --cat-color: var(--cat-tonal); }
.pane.cat-format         { --cat-color: var(--cat-format); }

.pane:hover {
  border-color: var(--cat-color);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
}

.pane-head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.7rem;
  align-items: start;
  margin-bottom: 0.6rem;
}

.icon-slot {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  color: #ffffff;
  font-size: 1.4rem;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
  flex-shrink: 0;
}

.head-text { min-width: 0; }
.pane h3 {
  font-family: var(--font-display);
  font-size: 1.05rem;
  margin: 0 0 0.1rem;
  line-height: 1.15;
  color: var(--text);
}
.cat-tag {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.primary-mark {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  border: 1px solid var(--cat-color);
  color: var(--cat-color);
  align-self: start;
  margin-top: 0.2rem;
}

.bold-line {
  font-weight: 600;
  margin: 0 0 0.5rem;
  line-height: 1.45;
  font-size: 0.96em;
  color: var(--text);
}

.description {
  margin: 0;
  font-size: 0.9em;
  line-height: 1.55;
  color: var(--muted);
  /* Soft fade on the last line for visual rhythm at varying lengths */
}

.catalogue-foot {
  max-width: 76ch;
  margin: 2.5rem auto 0;
  padding-top: 1.2rem;
  border-top: 1px solid var(--rule);
  font-size: 0.92rem;
  color: var(--muted);
}
.cat-link {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px dotted var(--rule);
}
.cat-link:hover { border-bottom-color: var(--text); }

@media (max-width: 720px) {
  .grid { grid-template-columns: 1fr; }
  h1 { font-size: 2rem; }
}
</style>
