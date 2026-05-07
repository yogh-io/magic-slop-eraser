import { ref, watch } from 'vue'
import type { ThemeId } from '../types'

const STORAGE_KEY = 'mse.theme'

export const theme = ref<ThemeId>('normal')

export function initTheme(): void {
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null
  if (saved === 'normal' || saved === 'magic' || saved === 'scholar') {
    theme.value = saved
  } else if (saved === 'germanic') {
    // legacy save key from before the rename
    theme.value = 'scholar'
  }
  applyTheme(theme.value)
  watch(theme, (v) => {
    localStorage.setItem(STORAGE_KEY, v)
    applyTheme(v)
  })
}

function applyTheme(t: ThemeId): void {
  document.documentElement.setAttribute('data-theme', t)
}

export function setTheme(t: ThemeId): void {
  theme.value = t
}
