<script setup lang="ts">
import { theme, setTheme } from '../state/theme'
import type { ThemeId } from '../types'

interface Option {
  id: ThemeId
  label: string
  glyph: string
}

const options: Option[] = [
  { id: 'normal', label: 'normal', glyph: '◐' },     // ◐ light/dark balance
  { id: 'magic', label: 'magic', glyph: '✦' },       // ✦ sparkle
  { id: 'scholar', label: 'scholar', glyph: '❦' },   // ❦ fleuron
]
</script>

<template>
  <div class="theme-picker" role="radiogroup" aria-label="Theme">
    <button
      v-for="o in options"
      :key="o.id"
      role="radio"
      :aria-checked="theme === o.id"
      :aria-label="o.label"
      :title="o.label"
      :class="['theme-btn', `theme-${o.id}`, { active: theme === o.id }]"
      @click="setTheme(o.id)"
    >
      <span class="glyph" aria-hidden="true">{{ o.glyph }}</span>
    </button>
  </div>
</template>

<style scoped>
.theme-picker {
  display: inline-flex;
  border: 1px solid var(--rule);
  border-radius: 999px;
  overflow: hidden;
  font-size: 0.78rem;
}
.theme-btn {
  background: transparent;
  border: 0;
  color: var(--muted);
  font: inherit;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  display: inline-grid;
  place-items: center;
  min-width: 2rem;
}
.theme-btn + .theme-btn { border-left: 1px solid var(--rule); }
.theme-btn:hover { color: var(--text); }
.theme-btn.active { background: var(--text); color: var(--bg); }
.theme-btn .glyph {
  font-size: 1rem;
  line-height: 1;
  display: inline-block;
}
</style>
