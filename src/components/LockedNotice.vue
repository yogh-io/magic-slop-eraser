<script setup lang="ts">
defineProps<{
  what?: string
}>()
</script>

<template>
  <article class="prose locked">
    <header class="hd">
      <p class="kicker">not live yet</p>
      <h1>{{ what ?? 'The analyse view' }} is still being built.</h1>
    </header>

    <p>
      The catalogue, the methodology, and the philosophy are - read those. The interactive piece
      ships when it ships.
    </p>

    <ul class="links">
      <li><router-link to="/categories">the slop catalogue</router-link> &middot; the starting set of named patterns</li>
      <li><router-link to="/rungs">the three rungs</router-link> &middot; how the framework organises depth</li>
      <li><router-link to="/about">methodology</router-link> &middot; what the project is and how to use it</li>
    </ul>
  </article>
</template>

<style scoped>
.prose {
  max-width: 64ch;
  margin: 4rem auto;
  padding: 0 2rem;
  color: var(--text);
  line-height: 1.6;
}
.kicker {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.7rem;
  color: var(--muted);
  margin: 0;
}
.hd h1 {
  font-family: var(--font-display);
  font-size: 1.8rem;
  margin: 0.3rem 0 1.2rem;
  letter-spacing: var(--heading-tracking, normal);
}
ul.links {
  list-style: none;
  padding: 0;
  margin: 1.4rem 0;
  display: grid;
  gap: 0.5rem;
}
ul.links li {
  border-left: 3px solid var(--rule);
  padding: 0.3rem 0 0.3rem 0.9rem;
}
ul.links a {
  color: var(--text);
  border-bottom: 1px dotted var(--rule);
  text-decoration: none;
}
ul.links a:hover {
  border-bottom-color: var(--text);
}
</style>
