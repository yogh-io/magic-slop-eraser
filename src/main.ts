import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import App from './App.vue'
import { routes } from './router'
import { patterns } from './catalog/patterns'
import { categories } from './catalog/categories'
import './styles/tokens.css'
import './styles/base.css'
import './styles/themes/normal.css'
import './styles/themes/magic.css'
import './styles/themes/scholar.css'
import { initTheme } from './state/theme'

// vite-ssg installs @unhead/vue itself and provides the head instance via the
// setup callback. Don't install our own - that wouldn't be picked up by the
// SSG render pass and head tags would never make it into the generated HTML.
export const createApp = ViteSSG(
  App,
  {
    routes,
    scrollBehavior(_to, _from, savedPosition) {
      if (savedPosition) return savedPosition
      return { top: 0 }
    },
  },
  ({ app, isClient }) => {
    app.use(createPinia())
    if (isClient) initTheme()
  },
)

/** Routes pre-rendered to static HTML at build time. Drives sitemap + crawler indexing. */
export function includedRoutes(): string[] {
  const staticRoutes = [
    '/',
    '/categories',
    '/rungs',
    '/about',
    '/skill',
  ]
  const categoryRoutes = categories.map((c) => `/categories/${c.id}`)
  const patternRoutes = patterns.map((p) => `/patterns/${p.id}`)
  return [...staticRoutes, ...categoryRoutes, ...patternRoutes]
}
