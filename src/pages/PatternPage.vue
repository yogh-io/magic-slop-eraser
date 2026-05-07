<script setup lang="ts">
import { computed } from 'vue'
import { getPattern } from '../catalog/patterns'
import { getCategory } from '../catalog/categories'

const props = defineProps<{ id: string }>()

const pattern = computed(() => getPattern(props.id))
const category = computed(() => (pattern.value ? getCategory(pattern.value.category) : null))

function paragraphs(text: string | undefined): string[] {
  if (!text) return []
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
}
</script>

<template>
  <article v-if="pattern && category" class="prose">
    <nav class="crumbs">
      <router-link to="/categories">all categories</router-link>
      <span class="sep">/</span>
      <router-link :to="`/categories/${category.id}`">{{ category.name }}</router-link>
      <span class="sep">/</span>
      <span>{{ pattern.shortName ?? pattern.name }}</span>
    </nav>

    <header class="hd">
      <h1>{{ pattern.name }}</h1>
      <div class="badges">
        <router-link :to="`/rungs`" :class="['rung', `rung-${pattern.rung}`]" :title="`Rung ${pattern.rung}`">R{{ pattern.rung }} · {{ pattern.rung === 1 ? 'mechanical' : pattern.rung === 2 ? 'passage judgment' : 'presentation' }}</router-link>
        <span :class="['sev', `sev-${pattern.severity}`]">{{ pattern.severity }}</span>
        <span class="mech">{{ pattern.mechanical ? 'mechanical detector' : 'judgment detector' }}</span>
        <span class="scope">{{ pattern.scope }}-scope</span>
        <router-link :to="`/categories/${category.id}`" class="cat-tag">
          <span class="dot" :style="{ background: `var(--cat-${category.id})` }" />
          {{ category.name }}
        </router-link>
      </div>
    </header>

    <p class="lede">{{ pattern.blurb }}</p>

    <section v-if="pattern.essay" class="essay">
      <p v-for="(para, i) in paragraphs(pattern.essay)" :key="i">{{ para }}</p>
    </section>

    <section v-if="pattern.examples && pattern.examples.length > 0" class="examples-block">
      <h2>In the wild</h2>
      <div v-for="(ex, i) in pattern.examples" :key="i" class="example">
        <div class="sloppy">
          <span class="label">slop</span>
          <p>{{ ex.sloppy }}</p>
        </div>
        <div v-if="ex.better" class="better">
          <span class="label">human</span>
          <p>{{ ex.better }}</p>
        </div>
      </div>
    </section>

    <section>
      <h2>Why it&rsquo;s slop, in catalogue terms</h2>
      <p>{{ pattern.whyItsSlop }}</p>
    </section>

    <section v-if="pattern.subShapes && pattern.subShapes.length > 0">
      <h2>Sub-shapes</h2>
      <ul class="bullets">
        <li v-for="(s, i) in pattern.subShapes" :key="i">{{ s }}</li>
      </ul>
    </section>

    <section>
      <h2>Fix</h2>
      <p>{{ pattern.fix }}</p>
    </section>

    <section v-if="pattern.skipRule">
      <h2>When to leave it alone</h2>
      <p>{{ pattern.skipRule }}</p>
    </section>
  </article>
  <article v-else class="prose">
    <p>No such pattern. <router-link to="/categories">Back to the index.</router-link></p>
  </article>
</template>

<style scoped>
.prose {
  max-width: 72ch;
  margin: 2rem auto 5rem;
  padding: 0 2rem;
  color: var(--text);
  line-height: 1.6;
}
.crumbs { font-size: 0.85em; color: var(--muted); margin-bottom: 0.4rem; }
.crumbs a { color: var(--muted); text-decoration: none; border-bottom: 1px dotted var(--rule); }
.crumbs a:hover { color: var(--text); }
.crumbs .sep { margin: 0 0.4em; }

.hd h1 { font-family: var(--font-display); font-size: 2.2rem; margin: 0 0 0.6rem; }
.badges { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.2rem; }
.badges span,
.badges .cat-tag {
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  border: 1px solid var(--rule);
  color: var(--muted);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.badges .sev-primary { color: var(--accent); border-color: var(--accent); }
.badges .rung { color: #fff; }
.badges .rung-1 { background: #2f8f6a; border-color: #2f8f6a; }
.badges .rung-2 { background: #b88f3e; border-color: #b88f3e; }
.badges .rung-3 { background: #b8472d; border-color: #b8472d; }
.cat-tag .dot { width: 7px; height: 7px; border-radius: 50%; }

.lede {
  font-size: 1.1rem;
  color: var(--text);
  margin: 0 0 1.5rem;
  line-height: 1.55;
  font-style: italic;
  border-left: 3px solid var(--rule);
  padding: 0.1rem 0 0.1rem 1rem;
}

.essay {
  font-family: var(--font-prose);
  font-size: 1.08rem;
  line-height: 1.7;
  margin: 1.5rem 0 2rem;
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

.examples-block { margin: 2rem 0; }

section { margin-bottom: 2rem; }
section h2 {
  font-family: var(--font-display);
  font-size: 1.05rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  margin: 0 0 0.5rem;
}
.bullets { padding-left: 1.2rem; }
.bullets li { margin-bottom: 0.3rem; }

.example { border-left: 3px solid var(--rule); padding: 0.4rem 0 0.4rem 1rem; margin-bottom: 1rem; }
.example .label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  display: inline-block;
  margin-bottom: 0.15rem;
}
.example .sloppy { color: color-mix(in srgb, var(--accent) 80%, var(--text)); }
.example .sloppy .label { color: var(--accent); }
.example .better { margin-top: 0.4rem; color: var(--text); }
.example p { margin: 0; font-family: var(--font-prose); font-size: 1rem; line-height: 1.55; }
</style>
