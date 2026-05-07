<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <article class="prose">
    <h1>Not found</h1>
    <p class="lede">
      No page at <code>{{ route.fullPath }}</code>. Probably a stale link, possibly a typo.
    </p>
    <p>
      <router-link to="/">Back to the analyser</router-link>, or
      <router-link to="/categories">browse the catalogue</router-link>.
    </p>
  </article>
</template>

<style scoped>
.prose {
  max-width: 60ch;
  margin: 4rem auto;
  padding: 0 2rem;
  color: var(--text);
  line-height: 1.65;
}
h1 {
  font-family: var(--font-display);
  font-size: 2.4rem;
  margin: 0 0 0.6rem;
  letter-spacing: var(--heading-tracking, normal);
}
.lede { font-size: 1.05rem; color: var(--text); margin: 0 0 1rem; }
code {
  font-family: var(--font-mono);
  background: var(--code-bg);
  padding: 0.05em 0.35em;
  border-radius: 3px;
  font-size: 0.9em;
}
a { color: var(--text); border-bottom: 1px dotted var(--rule); text-decoration: none; }
a:hover { border-bottom-color: var(--text); }
</style>
