declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

/** Short git hash injected at build time by vite.config.ts. */
declare const __GIT_HASH__: string
