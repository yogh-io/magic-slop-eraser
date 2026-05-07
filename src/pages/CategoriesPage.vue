<script setup lang="ts">
import { computed, reactive } from 'vue'
import { categories, getCategory } from '../catalog/categories'
import { patterns } from '../catalog/patterns'
import type { CategoryId, PatternMeta, Scope, Rung } from '../types'

const categoryOrder: CategoryId[] = ['lexical', 'structural', 'argumentative', 'tonal', 'format']

type DetectionFilter = 'all' | 'mechanical' | 'judgment'
type Severity = PatternMeta['severity']
const ALL_SEVERITIES: Severity[] = ['primary', 'high', 'medium', 'low']
const ALL_SCOPES: Scope[] = ['word', 'phrase', 'sentence', 'paragraph', 'piece']
const ALL_RUNGS: Rung[] = [1, 2, 3]

interface Filters {
  detection: DetectionFilter
  severities: Set<Severity>
  categories: Set<CategoryId>
  scopes: Set<Scope>
  rungs: Set<Rung>
}

const filters = reactive<Filters>({
  detection: 'all',
  severities: new Set(ALL_SEVERITIES),
  categories: new Set(categoryOrder),
  scopes: new Set(ALL_SCOPES),
  rungs: new Set(ALL_RUNGS),
})

const orderedPatterns = computed(() => {
  const out: PatternMeta[] = []
  for (const c of categoryOrder) {
    for (const p of patterns) if (p.category === c) out.push(p)
  }
  return out
})

const visiblePatterns = computed(() =>
  orderedPatterns.value.filter((p) => {
    if (filters.detection === 'mechanical' && !p.mechanical) return false
    if (filters.detection === 'judgment' && p.mechanical) return false
    if (!filters.severities.has(p.severity)) return false
    if (!filters.categories.has(p.category)) return false
    if (!filters.scopes.has(p.scope)) return false
    if (!filters.rungs.has(p.rung)) return false
    return true
  }),
)

const isFiltered = computed(() => {
  return (
    filters.detection !== 'all' ||
    filters.severities.size !== ALL_SEVERITIES.length ||
    filters.categories.size !== categoryOrder.length ||
    filters.scopes.size !== ALL_SCOPES.length ||
    filters.rungs.size !== ALL_RUNGS.length
  )
})

function setDetection(d: DetectionFilter): void {
  filters.detection = d
}

function toggleSeverity(s: Severity): void {
  // If only this severity is currently selected, treat the click as "show all" (toggle behaviour
  // for the common case where the user filtered to one then wants to clear).
  if (filters.severities.size === 1 && filters.severities.has(s)) {
    filters.severities = new Set(ALL_SEVERITIES)
    return
  }
  // Modifier-less click cycles: full -> just this; just this -> full.
  if (filters.severities.size === ALL_SEVERITIES.length) {
    filters.severities = new Set([s])
    return
  }
  // Already in a filtered subset - toggle membership.
  const next = new Set(filters.severities)
  if (next.has(s)) next.delete(s)
  else next.add(s)
  if (next.size === 0) filters.severities = new Set(ALL_SEVERITIES)
  else filters.severities = next
}

function toggleCategory(c: CategoryId): void {
  if (filters.categories.size === 1 && filters.categories.has(c)) {
    filters.categories = new Set(categoryOrder)
    return
  }
  if (filters.categories.size === categoryOrder.length) {
    filters.categories = new Set([c])
    return
  }
  const next = new Set(filters.categories)
  if (next.has(c)) next.delete(c)
  else next.add(c)
  if (next.size === 0) filters.categories = new Set(categoryOrder)
  else filters.categories = next
}

function toggleScope(s: Scope): void {
  if (filters.scopes.size === 1 && filters.scopes.has(s)) {
    filters.scopes = new Set(ALL_SCOPES)
    return
  }
  if (filters.scopes.size === ALL_SCOPES.length) {
    filters.scopes = new Set([s])
    return
  }
  const next = new Set(filters.scopes)
  if (next.has(s)) next.delete(s)
  else next.add(s)
  if (next.size === 0) filters.scopes = new Set(ALL_SCOPES)
  else filters.scopes = next
}

function toggleRung(r: Rung): void {
  if (filters.rungs.size === 1 && filters.rungs.has(r)) {
    filters.rungs = new Set(ALL_RUNGS)
    return
  }
  if (filters.rungs.size === ALL_RUNGS.length) {
    filters.rungs = new Set([r])
    return
  }
  const next = new Set(filters.rungs)
  if (next.has(r)) next.delete(r)
  else next.add(r)
  if (next.size === 0) filters.rungs = new Set(ALL_RUNGS)
  else filters.rungs = next
}

function resetFilters(): void {
  filters.detection = 'all'
  filters.severities = new Set(ALL_SEVERITIES)
  filters.categories = new Set(categoryOrder)
  filters.scopes = new Set(ALL_SCOPES)
  filters.rungs = new Set(ALL_RUNGS)
}

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
        Twenty-four named patterns across five categories. Each pane is a single move the model
        reaches for reflexively - not a generic writing complaint, but something distinctly produced
        by current LLM training. Click for the full treatment.
      </p>
      <p class="meta-tic">
        <strong>The meta-tic is evenness.</strong> Real writing has lumps; models sand them off.
        If a piece reads like every paragraph was equally edited, it was probably equally generated.
        These twenty-four are the ridges the sander leaves behind.
      </p>
    </header>

    <div class="filter-bar">
      <div class="filter-row">
        <span class="filter-label">rung</span>
        <div class="chips">
          <button
            v-for="r in ALL_RUNGS"
            :key="r"
            :class="['chip', 'rung-chip', `rung-${r}`, { active: filters.rungs.has(r) }]"
            :title="`Rung ${r}`"
            @click="toggleRung(r)"
          >
            <span class="rung-mark">R{{ r }}</span>
            <span>{{ r === 1 ? 'mechanical' : r === 2 ? 'passage judgment' : 'presentation' }}</span>
          </button>
          <router-link to="/rungs" class="filter-link">what are rungs?</router-link>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-label">detection</span>
        <div class="seg" role="group" aria-label="Detection method">
          <button
            v-for="d in (['all','mechanical','judgment'] as const)"
            :key="d"
            :class="{ active: filters.detection === d }"
            @click="setDetection(d)"
          >{{ d }}</button>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-label">severity</span>
        <div class="chips">
          <button
            v-for="s in ALL_SEVERITIES"
            :key="s"
            :class="['chip', { active: filters.severities.has(s) }]"
            @click="toggleSeverity(s)"
          >{{ s }}</button>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-label">category</span>
        <div class="chips">
          <button
            v-for="c in categories"
            :key="c.id"
            :class="['chip', 'cat-chip', { active: filters.categories.has(c.id) }]"
            @click="toggleCategory(c.id)"
          >
            <span class="chip-icon" :style="{ background: `var(--cat-${c.id})` }">{{ placeholderGlyph[c.id] }}</span>
            {{ c.name }}
          </button>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-label">scope</span>
        <div class="chips">
          <button
            v-for="s in ALL_SCOPES"
            :key="s"
            :class="['chip', { active: filters.scopes.has(s) }]"
            @click="toggleScope(s)"
          >{{ s }}</button>
        </div>
      </div>

      <div class="filter-meta">
        <span class="count">
          {{ visiblePatterns.length }}
          <span class="muted">of {{ orderedPatterns.length }}</span>
        </span>
        <button v-if="isFiltered" class="reset" @click="resetFilters">reset filters</button>
      </div>
    </div>

    <p v-if="visiblePatterns.length === 0" class="empty-state">
      No patterns match these filters. <button class="link-button" @click="resetFilters">Reset</button> to see them all.
    </p>

    <div class="grid">
      <router-link
        v-for="p in visiblePatterns"
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
          <div class="pane-marks">
            <span :class="['rung-badge', `rung-${p.rung}`]" :title="`Rung ${p.rung}`">R{{ p.rung }}</span>
            <span v-if="p.severity === 'primary'" class="primary-mark">primary</span>
          </div>
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

.filter-bar {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
  align-items: center;
  margin: 0 auto 1.5rem;
  padding: 0.9rem 1rem;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  font-size: 0.88rem;
}

.filter-row {
  display: contents;
}
.filter-row > .filter-label {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.7rem;
  color: var(--muted);
  align-self: center;
}
.filter-row > .seg,
.filter-row > .chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
  min-width: 0;
}

.seg {
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 2px;
  width: max-content;
  gap: 0 !important;
}
.seg button {
  background: transparent;
  border: 0;
  color: var(--muted);
  font: inherit;
  font-size: 0.86em;
  padding: 0.25rem 0.85rem;
  border-radius: 999px;
  cursor: pointer;
  text-transform: lowercase;
}
.seg button.active {
  background: var(--text);
  color: var(--bg);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: 1px solid var(--rule);
  color: var(--muted);
  font: inherit;
  font-size: 0.84em;
  padding: 0.22rem 0.65rem;
  border-radius: 999px;
  cursor: pointer;
  text-transform: lowercase;
}
.chip:hover { color: var(--text); border-color: var(--text); }
.chip.active {
  color: var(--text);
  border-color: var(--text);
  background: color-mix(in srgb, var(--text) 6%, transparent);
}
.chip:not(.active) { opacity: 0.55; }

.cat-chip .chip-icon {
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  color: #ffffff;
  font-size: 0.62rem;
  text-shadow: 0 1px 1px rgba(0,0,0,0.18);
}

.rung-chip {
  --rung-color: var(--rule);
  gap: 0.45rem !important;
}
.rung-chip.rung-1 { --rung-color: #2f8f6a; }
.rung-chip.rung-2 { --rung-color: #b88f3e; }
.rung-chip.rung-3 { --rung-color: #b8472d; }
.rung-chip .rung-mark {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 18px;
  padding: 0 0.3rem;
  border-radius: 4px;
  background: var(--rung-color);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.rung-chip.active {
  border-color: var(--rung-color);
  color: var(--text);
}

.filter-link {
  margin-left: 0.4rem;
  font-size: 0.78rem;
  color: var(--muted);
  text-decoration: none;
  border-bottom: 1px dotted var(--rule);
  padding-bottom: 1px;
}
.filter-link:hover { color: var(--text); border-bottom-color: var(--text); }

.filter-meta {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 0.4rem;
  border-top: 1px dashed var(--rule);
  font-size: 0.82rem;
}
.filter-meta .count {
  color: var(--text);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.filter-meta .count .muted { color: var(--muted); font-weight: 400; margin-left: 0.25rem; }
.filter-meta .reset {
  background: transparent;
  border: 0;
  color: var(--muted);
  font: inherit;
  font-size: 0.84em;
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
.filter-meta .reset:hover { color: var(--text); }

.empty-state {
  text-align: center;
  color: var(--muted);
  margin: 3rem 0;
}
.empty-state .link-button {
  background: transparent;
  border: 0;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  padding: 0;
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

.pane-marks {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  align-items: flex-end;
}

.rung-badge {
  display: inline-grid;
  place-items: center;
  min-width: 26px;
  height: 22px;
  padding: 0 0.35rem;
  border-radius: 4px;
  background: var(--rung-bg);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.rung-badge.rung-1 { --rung-bg: #2f8f6a; }
.rung-badge.rung-2 { --rung-bg: #b88f3e; }
.rung-badge.rung-3 { --rung-bg: #b8472d; }

.primary-mark {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  border: 1px solid var(--cat-color);
  color: var(--cat-color);
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
