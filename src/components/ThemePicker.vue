<script setup lang="ts">
import { theme, setTheme } from '../state/theme'
import type { ThemeId } from '../types'

const options: { id: ThemeId; label: string }[] = [
  { id: 'normal', label: 'normal' },
  { id: 'magic', label: 'magic' },
  { id: 'scholar', label: 'scholar' },
]
</script>

<template>
  <div class="theme-picker" role="radiogroup" aria-label="Theme">
    <button
      v-for="o in options"
      :key="o.id"
      role="radio"
      :aria-checked="theme === o.id"
      :class="{ active: theme === o.id }"
      @click="setTheme(o.id)"
    >{{ o.label }}</button>
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
button {
  background: transparent;
  border: 0;
  color: var(--muted);
  font: inherit;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  text-transform: lowercase;
}
button + button { border-left: 1px solid var(--rule); }
button.active { background: var(--text); color: var(--bg); }
</style>
