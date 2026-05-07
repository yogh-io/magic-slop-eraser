<script setup lang="ts">
import { computed } from 'vue'
import type { Flag, CategoryId } from '../types'
import { categories } from '../catalog/categories'
import { getPattern } from '../catalog/patterns'

const props = defineProps<{
  flags: Flag[]
  selectedFlagId: string | null
  activeCategories: Set<string>
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'toggle-category', cat: string): void
  (e: 'remove-user-flag', id: string): void
}>()

const grouped = computed(() => {
  const out = new Map<CategoryId, Flag[]>()
  for (const c of categories) out.set(c.id, [])
  for (const f of props.flags) {
    out.get(f.category as CategoryId)?.push(f)
  }
  return out
})

function patternName(id: string): string {
  return getPattern(id)?.shortName ?? getPattern(id)?.name ?? id
}
</script>

<template>
  <aside class="flags-panel">
    <div class="filters">
      <button
        v-for="c in categories"
        :key="c.id"
        :class="['cat-chip', `chip-${c.id}`, { active: activeCategories.has(c.id) || activeCategories.size === 0 }]"
        @click="emit('toggle-category', c.id)"
      >
        <span class="dot" :style="{ background: `var(--cat-${c.id})` }" />
        {{ c.name }}
        <span class="count">{{ grouped.get(c.id)?.length ?? 0 }}</span>
      </button>
    </div>

    <div class="groups">
      <section v-for="c in categories" :key="c.id" v-show="(grouped.get(c.id)?.length ?? 0) > 0">
        <header class="group-header">
          <span class="dot" :style="{ background: `var(--cat-${c.id})` }" />
          <h3>{{ c.name }}</h3>
          <span class="muted">{{ grouped.get(c.id)?.length }}</span>
        </header>
        <ul>
          <li
            v-for="f in grouped.get(c.id)"
            :key="f.id"
            :class="{ selected: f.id === selectedFlagId, 'src-user': f.source === 'user' }"
            @click="emit('select', f.id)"
          >
            <div class="row">
              <span class="pattern-name">{{ patternName(f.patternId) }}</span>
              <span v-if="f.source === 'user'" class="src-tag">user</span>
              <span class="severity" :style="{ '--sev': f.severity }" />
            </div>
            <div class="excerpt">"{{ truncate(f.excerpt, 90) }}"</div>
            <div class="rationale">{{ f.rationale }}</div>
            <button v-if="f.source === 'user'" class="remove" @click.stop="emit('remove-user-flag', f.id)">remove</button>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="flags.length === 0" class="empty">
      <p>No flags raised yet. Paste a piece of prose into the editor to begin.</p>
      <p class="muted">Mechanical detectors cover the lexical tier-1 vocabulary, throat-clearing openers, closers, vague-gravitas mood-music, the mirror construct, and suffocation by stacked hedges. The judgment patterns (absent-actor, allusive construct, hedged confidence, performative balance, lens-fits-everything, frame-stacking, synthesis-of-nothing) need a careful reader - select text to flag those by hand.</p>
    </div>
  </aside>
</template>

<script lang="ts">
function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}
</script>

<style scoped>
.flags-panel {
  background: var(--panel-bg);
  border-left: 1px solid var(--rule);
  padding: 1.25rem 1.25rem 4rem;
  height: 100%;
  overflow-y: auto;
  font-size: 0.92rem;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1.25rem;
}
.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: transparent;
  border: 1px solid var(--rule);
  color: var(--muted);
  font: inherit;
  cursor: pointer;
}
.cat-chip.active {
  color: var(--text);
  border-color: var(--text);
}
.cat-chip .dot { width: 8px; height: 8px; border-radius: 50%; }
.cat-chip .count { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 0.8em; }

.groups section + section { margin-top: 1.25rem; }

.group-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.group-header h3 {
  font-size: 0.95rem;
  margin: 0;
  color: var(--text);
  font-family: var(--font-display);
}
.group-header .dot { width: 10px; height: 10px; border-radius: 50%; }
.group-header .muted { color: var(--muted); margin-left: auto; font-variant-numeric: tabular-nums; }

ul { list-style: none; padding: 0; margin: 0; }
li {
  border: 1px solid var(--rule);
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  margin-bottom: 0.45rem;
  cursor: pointer;
  position: relative;
  background: var(--card-bg);
}
li:hover { border-color: var(--text); }
li.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
li.src-user { border-style: dashed; }

.row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
.pattern-name { font-weight: 600; color: var(--text); }
.src-tag {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  border: 1px solid var(--rule);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
}
.severity {
  margin-left: auto;
  width: 28px;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(to right, var(--accent) calc(var(--sev) * 100%), var(--rule) calc(var(--sev) * 100%));
}
.excerpt {
  color: var(--muted);
  font-style: italic;
  margin-bottom: 0.25rem;
  font-size: 0.88em;
}
.rationale { color: var(--text); font-size: 0.86em; }
.remove {
  position: absolute;
  top: 0.4rem;
  right: 0.5rem;
  background: transparent;
  border: 0;
  color: var(--muted);
  font: inherit;
  font-size: 0.78em;
  cursor: pointer;
}
.remove:hover { color: var(--text); }

.empty {
  margin-top: 2rem;
  color: var(--muted);
  font-size: 0.9rem;
}
.empty .muted { color: var(--muted); margin-top: 0.5rem; opacity: 0.85; }
</style>
