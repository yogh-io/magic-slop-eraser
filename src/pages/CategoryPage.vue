<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getCategory } from '../catalog/categories'
import { patternsByCategory } from '../catalog/patterns'

const route = useRoute()
const id = computed(() => String(route.params.id))
const category = computed(() => getCategory(id.value))
const patterns = computed(() => patternsByCategory(id.value))

function paragraphs(text: string | undefined): string[] {
  if (!text) return []
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
}
</script>

<template>
  <article v-if="category" class="prose">
    <nav class="crumbs">
      <router-link to="/categories">all categories</router-link>
      <span class="sep">/</span>
      <span>{{ category.name }}</span>
    </nav>

    <header class="cat-header">
      <span class="dot" :style="{ background: `var(--cat-${category.id})` }" />
      <h1>{{ category.name }}</h1>
    </header>
    <p class="tagline">{{ category.tagline }}</p>

    <section v-if="category.essay" class="essay">
      <p v-for="(para, i) in paragraphs(category.essay)" :key="i">{{ para }}</p>
    </section>

    <p class="blurb mechanical-hint">
      <span class="muted">Mechanical summary:</span> {{ category.blurb }}
    </p>

    <h2 class="section-rule">The patterns in this category</h2>

    <ol class="patterns">
      <li v-for="p in patterns" :key="p.id">
        <header>
          <h2>
            <router-link :to="`/patterns/${p.id}`">{{ p.name }}</router-link>
          </h2>
          <div class="badges">
            <span :class="['sev', `sev-${p.severity}`]">{{ p.severity }}</span>
            <span class="mech">{{ p.mechanical ? 'mechanical' : 'judgment' }}</span>
          </div>
        </header>
        <p class="blurb">{{ p.blurb }}</p>
        <p class="why"><strong>Why slop:</strong> {{ p.whyItsSlop }}</p>
      </li>
    </ol>
  </article>
  <article v-else class="prose">
    <p>No such category. <router-link to="/categories">Back to the index.</router-link></p>
  </article>
</template>

<style scoped>
.prose {
  max-width: 76ch;
  margin: 2rem auto 5rem;
  padding: 0 2rem;
  color: var(--text);
}
.crumbs { font-size: 0.85em; color: var(--muted); margin-bottom: 0.4rem; }
.crumbs a { color: var(--muted); text-decoration: none; border-bottom: 1px dotted var(--rule); }
.crumbs a:hover { color: var(--text); }
.crumbs .sep { margin: 0 0.4em; }

.cat-header { display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.3rem; }
.cat-header .dot { width: 14px; height: 14px; border-radius: 50%; }
h1 { font-family: var(--font-display); font-size: 2.2rem; margin: 0; }
.tagline { font-style: italic; font-size: 1.05rem; color: var(--text); margin: 0 0 1.2rem; }

.essay {
  font-family: var(--font-prose);
  font-size: 1.08rem;
  line-height: 1.7;
  margin: 0.6rem 0 1.5rem;
  color: var(--text);
}
.essay p { margin: 0 0 1em; }
.essay p:first-child::first-letter {
  font-family: var(--font-display);
  font-size: 2.6em;
  line-height: 0.95;
  float: left;
  padding: 0.05em 0.12em 0 0;
  color: var(--accent);
}

.blurb { color: var(--muted); margin: 0 0 2rem; line-height: 1.6; font-size: 0.92em; }
.mechanical-hint {
  border-top: 1px solid var(--rule);
  padding-top: 0.9rem;
  margin-top: 1.5rem;
}
.mechanical-hint .muted {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-right: 0.4rem;
}

.section-rule {
  font-family: var(--font-display);
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  border-top: 1px solid var(--rule);
  padding-top: 1.2rem;
  margin: 2rem 0 1rem;
}

.patterns { list-style: none; padding: 0; margin: 0; }
.patterns li {
  border-top: 1px solid var(--rule);
  padding: 1.4rem 0;
}
.patterns header { display: flex; align-items: baseline; gap: 0.6rem; margin-bottom: 0.4rem; }
.patterns h2 { font-family: var(--font-display); font-size: 1.2rem; margin: 0; }
.patterns h2 a { color: var(--text); text-decoration: none; border-bottom: 1px solid transparent; }
.patterns h2 a:hover { border-bottom-color: var(--text); }

.badges { margin-left: auto; display: flex; gap: 0.4rem; }
.badges .sev,
.badges .mech {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  border: 1px solid var(--rule);
  color: var(--muted);
}
.badges .sev-primary { color: var(--accent); border-color: var(--accent); }
.badges .sev-high { color: var(--text); border-color: var(--text); }

.why { font-size: 0.92em; color: var(--text); margin: 0.5rem 0 0; }
.why strong { color: var(--text); }
</style>
