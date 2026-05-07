import { ref, watch } from 'vue'
import type { ThemeId } from '../types'
import { categories } from '../catalog/categories'

const STORAGE_KEY = 'mse.theme'
const URL_PARAM = 't'
const TRANSITION_CLASS = 'theme-transitioning'
const TRANSITION_MS = 480

// Obscure stable codes used in the URL so a shared link carries the theme
// without naming it directly. Picked to be short, opaque, and unlikely to
// collide with anything else.
const THEME_TO_CODE: Record<ThemeId, string> = {
  normal: 'qe',
  magic: 'xk',
  scholar: 'jv',
}
const CODE_TO_THEME: Record<string, ThemeId> = Object.fromEntries(
  Object.entries(THEME_TO_CODE).map(([id, code]) => [code, id as ThemeId]),
) as Record<string, ThemeId>

export const theme = ref<ThemeId>('normal')

export function initTheme(): void {
  const fromUrl = readThemeFromUrl()
  const fromStorage = readThemeFromStorage()
  const initial: ThemeId = fromUrl ?? fromStorage ?? 'normal'
  theme.value = initial
  applyTheme(initial, { animate: false })
  // Make sure the URL reflects the active theme so refreshes and shares are stable.
  syncUrl(initial)

  watch(theme, (next, prev) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore storage failures */
    }
    if (next !== prev) {
      applyTheme(next, { animate: true })
      syncUrl(next)
    }
  })
}

function readThemeFromUrl(): ThemeId | null {
  if (typeof window === 'undefined') return null
  const code = new URL(window.location.href).searchParams.get(URL_PARAM)
  if (!code) return null
  return CODE_TO_THEME[code] ?? null
}

function readThemeFromStorage(): ThemeId | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'normal' || saved === 'magic' || saved === 'scholar') return saved
    if (saved === 'germanic') return 'scholar' // legacy key
  } catch {
    /* ignore */
  }
  return null
}

function syncUrl(t: ThemeId): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const code = THEME_TO_CODE[t]
  if (url.searchParams.get(URL_PARAM) === code) return
  url.searchParams.set(URL_PARAM, code)
  const next = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + url.hash
  window.history.replaceState(window.history.state, '', next)
}

function applyTheme(t: ThemeId, opts: { animate: boolean }): void {
  const html = document.documentElement
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const swap = (): void => {
    html.setAttribute('data-theme', t)
    applyCategoryTokens(t)
  }
  if (!opts.animate || reduce) {
    swap()
    return
  }
  // The View Transitions API cross-fades the entire page including discrete
  // properties CSS transitions can't animate (font-family, gradients,
  // background-image stacks). Where supported, prefer it. Otherwise fall back
  // to the class-based color-token transitions.
  const startVT = (document as Document & {
    startViewTransition?: (cb: () => void) => unknown
  }).startViewTransition
  if (typeof startVT === 'function') {
    startVT.call(document, swap)
    return
  }
  html.classList.add(TRANSITION_CLASS)
  window.setTimeout(() => html.classList.remove(TRANSITION_CLASS), TRANSITION_MS)
  swap()
}

function applyCategoryTokens(t: ThemeId): void {
  const root = document.documentElement
  for (const c of categories) {
    const color = c.themeColors[t] ?? c.themeColors.normal
    root.style.setProperty(`--cat-${c.id}`, color)
  }
}

export function setTheme(t: ThemeId): void {
  theme.value = t
}
