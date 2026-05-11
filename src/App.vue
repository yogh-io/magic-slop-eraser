<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import ThemePicker from './components/ThemePicker.vue'

const gitHash = __GIT_HASH__
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <RouterLink to="/" class="brand">
        <span class="mark">&#x2756;</span>
        <span class="title">slopmop</span>
      </RouterLink>
      <nav class="nav">
        <RouterLink to="/">Analyse</RouterLink>
        <RouterLink to="/recents">Recents</RouterLink>
        <RouterLink to="/categories">Catalogue</RouterLink>
        <RouterLink to="/rungs">Rungs</RouterLink>
        <RouterLink to="/about">Methodology</RouterLink>
        <RouterLink to="/skill">Skill</RouterLink>
      </nav>
      <div class="toolbar-right">
        <ThemePicker />
      </div>
    </header>

    <main class="main">
      <RouterView />
    </main>

    <footer class="build-meta" aria-label="build version">
      <code class="git-hash" :title="`build ${gitHash}`">{{ gitHash }}</code>
    </footer>

    <div class="theme-overlay" aria-hidden="true" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
}
.topbar {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 0 1.5rem;
  height: var(--header-height);
  border-bottom: 1px solid var(--rule);
  background: var(--header-bg);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  text-decoration: none;
  color: var(--text);
  font-family: var(--font-display);
  font-size: 1.02rem;
  letter-spacing: var(--heading-tracking, normal);
}
.brand .mark { color: var(--accent); font-size: 1.2em; }
.nav { display: flex; gap: 1.25rem; }
.nav a {
  color: var(--muted);
  text-decoration: none;
  font-family: var(--font-ui);
  font-size: 0.95rem;
  border-bottom: 1px solid transparent;
  padding-bottom: 2px;
}
.nav a.router-link-active { color: var(--text); border-bottom-color: var(--accent); }
.nav a:hover { color: var(--text); }
.toolbar-right { margin-left: auto; }
.main { flex: 1; min-height: 0; }

.theme-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
}

.build-meta {
  margin-top: auto;
  padding: 0.6rem 1.25rem 0.8rem;
  display: flex;
  justify-content: flex-end;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--muted);
  opacity: 0.55;
  transition: opacity 160ms ease;
  user-select: text;
}
.build-meta:hover { opacity: 0.85; }
.build-meta .git-hash {
  background: transparent;
  padding: 0;
  letter-spacing: 0.04em;
}
</style>
