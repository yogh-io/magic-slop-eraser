import { ref, watch } from 'vue'
import type { ThemeId } from '../types'
import { categories } from '../catalog/categories'

const STORAGE_KEY = 'mse.theme'
const MEDIA_QUERY = '(prefers-color-scheme: dark)'
const TRANSITION_CLASS = 'theme-transitioning'
const TRANSITION_MS = 480

export const theme = ref<ThemeId>('light')

export function initTheme(): void {
  const stored = readStored()
  const initial: ThemeId = stored ?? readSystem()
  theme.value = initial
  applyTheme(initial, { animate: false })

  // Follow OS changes only when the user hasn't picked an explicit theme.
  const mq = window.matchMedia(MEDIA_QUERY)
  mq.addEventListener('change', (e) => {
    if (readStored()) return
    theme.value = e.matches ? 'dark' : 'light'
  })

  watch(theme, (next, prev) => {
    if (next !== prev) applyTheme(next, { animate: true })
  })
}

export function setTheme(t: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, t)
  } catch {
    /* ignore */
  }
  theme.value = t
}

function readStored(): ThemeId | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function readSystem(): ThemeId {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light'
}

function applyTheme(t: ThemeId, opts: { animate: boolean }): void {
  const html = document.documentElement
  if (opts.animate) {
    html.classList.add(TRANSITION_CLASS)
    window.setTimeout(() => html.classList.remove(TRANSITION_CLASS), TRANSITION_MS)
  }
  html.setAttribute('data-theme', t)
  applyCategoryTokens(t)
}

function applyCategoryTokens(t: ThemeId): void {
  const root = document.documentElement
  for (const c of categories) {
    const color = c.themeColors[t] ?? c.themeColors.light
    root.style.setProperty(`--cat-${c.id}`, color)
  }
}
