<script setup lang="ts">
import { computed } from 'vue'
import { patterns } from '../catalog/patterns'
import type { Rung } from '../types'

interface RungInfo {
  id: Rung
  label: string
  tagline: string
  who: string
  detection: string
  fix: string
  workflow: string
  whatLivesHere: string
}

const rungs: RungInfo[] = [
  {
    id: 1,
    label: 'Rung 1 - mechanical',
    tagline: 'Word-and-phrase slop. Bottom rung. Free.',
    who: 'A regex finds it. A short, dumb model could suggest a replacement, but does not have to.',
    detection: 'Mechanical pre-pass. Pure pattern matching against a fixed catalogue. The whole detector ships with no model dependency.',
    fix: 'Substitute or cut. Most fixes are one or two characters. The pattern says what to do; the writer (or the agent acting on their behalf) takes the proposed replacement, edits it, or rejects it.',
    workflow: 'The simplest form of the steering loop. The agent surfaces a batch of flags with a substitution proposed for each; the author sweeps with yes / cut / edit / skip / keep, often resolving most of them in a single pass. Mechanical patterns rarely need re-direction - the substitution either lands or it does not.',
    whatLivesHere: 'The canonical AI lexicon, throat-clearing openers, closers, suffocation (stacked hedges), enthusiasm inflation, vague gravitas, and the mirror construct.',
  },
  {
    id: 2,
    label: 'Rung 2 - passage-level judgment',
    tagline: 'A careful reader can flag it. Fixing it needs options.',
    who: 'A capable LLM identifies the pattern - but proposing the right fix requires showing the writer two or three options to choose from, sometimes with a word changed by hand.',
    detection: 'An LLM read of a sentence, or a small cluster of two or three sentences, in paragraph context. Local regex misses these because the pattern is structural, not lexical: a passage whose subject is unnamed, a closer that synthesises nothing, a paragraph that walks across both sides without committing.',
    fix: 'Rewriting the passage with two or three candidate forms. The agent proposes; the writer picks one, customises, or rejects. Sometimes a single word changes; sometimes a sentence is reshaped; sometimes a small cluster is rebuilt together. Always reversible.',
    workflow: 'The canonical steering loop, batched. The agent posts one candidate per flag; the author sweeps with shape directives ("more committal", "drop the qualifier", "punchline first", "their voice not yours"); the agent re-attempts in the background; the author re-engages and re-directs until the sentence lands. Many short turns per flag, often across two or three sweeps. The agent has the keyboard; the writer has the wheel.',
    whatLivesHere: 'Absent-actor construct, allusive construct, hedged confidence, synthesis of nothing, and performative balance (the merged sentence / paragraph / register form of commitment-aversion).',
  },
  {
    id: 3,
    label: 'Rung 3 - presentation / editorial',
    tagline: 'The substance is not coming through. Substantial rewrites only.',
    who: 'No mechanical fix exists. The piece needs another reading focused on whether its arguments, values, and internal merits actually land with the reader. This is editorial work.',
    detection: 'Requires reading the piece as a piece, asking whether its content is being presented well. Frame stacking buries the thesis under preamble. Performative balance dilutes the position into nothing. Header inflation pads scaffolding where the argument should carry weight. These are the moves a chief editor catches on the second read.',
    fix: 'Substantial rewrite focused on what the piece is saying - its arguments, values, internal merits - and how clearly that comes through. The Rung 3 work is where the piece becomes the writer\'s rather than the model\'s. Tools at this rung resemble editorial pipelines: workshop and chief-edit in long-form analytical writing, with passes for voice, evidence, resonance, and vitality.',
    workflow: 'The same steering loop, applied to larger units (a section, a transition, the opening, the close). Slower cycles - the agent reads the surrounding piece between turns - but the shape is identical: the author defines what the section is supposed to do, the agent drafts the prose, the author re-directs. The eraser flags positions; the rewrite happens between writer and agent.',
    whatLivesHere: 'Frame stacking and lens-fits-everything - the structural and argumentative moves that bury whatever the piece was actually about under imported scaffolding.',
  },
]

const counts = computed(() => {
  const out = { 1: 0, 2: 0, 3: 0 } as Record<Rung, number>
  for (const p of patterns) out[p.rung] += 1
  return out
})
</script>

<template>
  <article class="prose">
    <header class="hd">
      <h1>The three rungs</h1>
      <p class="lede">
        Slop is not all the same. Some of it is one dead word that a regex finds and a substitution
        replaces. Some of it is a clumsy sentence the writer cannot see in their own draft but can
        fix in two minutes if pointed at it. Some of it is the whole piece arguing with itself,
        requiring substantial rewrites. The rungs organise these by <em>depth</em>, not by
        difficulty.
      </p>
      <p class="lede">
        The numbering is layer, not order. Rung 1 is the bottom (mechanical, surface-level) and
        Rung 3 is the top (structural, whole-piece). An agent or author picks the entry rung based
        on the draft's stage - a structurally clean piece can start at Rung 1 and climb up; a
        tangled draft starts at Rung 3 and works down so polish does not get spent on prose about
        to be cut. The piece is done when all three rungs read zero.
      </p>
      <p class="lede">
        The same loop runs at every rung. The agent surfaces a batch of questions
        (<em>wtf do you want done with this?</em>), the author sweeps the batch with shape
        directives, the agent drafts candidates in the background, the author re-engages and
        re-directs until each one lands. The grain changes - clause for Rung 1, sentence for
        Rung 2, section for Rung 3 - and the cycle gets slower as you climb, but the pairing
        is constant: the work is the writer's, the agent is the keyboard.
      </p>
    </header>

    <section v-for="r in rungs" :key="r.id" class="rung" :class="`rung-${r.id}`">
      <header class="rung-head">
        <span class="badge" :class="`badge-${r.id}`">R{{ r.id }}</span>
        <div>
          <h2>{{ r.label }}</h2>
          <p class="tagline">{{ r.tagline }}</p>
        </div>
        <span class="count">{{ counts[r.id] }} patterns</span>
      </header>

      <dl>
        <dt>Who detects, who fixes</dt>
        <dd>{{ r.who }}</dd>

        <dt>Detection</dt>
        <dd>{{ r.detection }}</dd>

        <dt>Fix</dt>
        <dd>{{ r.fix }}</dd>

        <dt>Workflow</dt>
        <dd>{{ r.workflow }}</dd>

        <dt>What lives here</dt>
        <dd>{{ r.whatLivesHere }}</dd>
      </dl>
    </section>

    <p class="see-more">
      How the rungs translate into a workflow - the agent, the browser, the orchestrator - is on
      the <router-link to="/about">methodology</router-link> page.
    </p>
  </article>
</template>

<style scoped>
.prose {
  max-width: 78ch;
  margin: 2rem auto 5rem;
  padding: 0 2rem;
  color: var(--text);
  line-height: 1.65;
}

.hd { margin-bottom: 2.5rem; }
h1 {
  font-family: var(--font-display);
  font-size: 2.6rem;
  margin: 0 0 0.6rem;
  letter-spacing: var(--heading-tracking, normal);
}
.lede {
  font-size: 1.05rem;
  line-height: 1.65;
  color: var(--text);
  margin: 0 0 1rem;
}
.lede em { color: var(--text); font-style: italic; }

.rung {
  border-top: 4px solid var(--rung-color);
  padding: 1.5rem 0 1.8rem;
  margin-bottom: 0.4rem;
}
.rung-1 { --rung-color: #2f8f6a; }
.rung-2 { --rung-color: #b88f3e; }
.rung-3 { --rung-color: #b8472d; }

.rung-head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  align-items: start;
  margin-bottom: 1rem;
}
.badge {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: var(--rung-color);
  color: #fff;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.4rem;
  letter-spacing: 0.02em;
}
.rung-head h2 {
  font-family: var(--font-display);
  font-size: 1.5rem;
  margin: 0 0 0.15rem;
  color: var(--text);
}
.rung-head .tagline {
  margin: 0;
  font-style: italic;
  color: var(--muted);
  font-size: 0.96em;
}
.rung-head .count {
  align-self: center;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  border: 1px solid var(--rule);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  white-space: nowrap;
}

dl {
  display: grid;
  grid-template-columns: minmax(140px, 18%) 1fr;
  gap: 0.5rem 1.5rem;
  margin: 0;
}
dt {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.74rem;
  color: var(--muted);
  padding-top: 0.35rem;
}
dd {
  margin: 0;
  padding: 0.25rem 0 0.6rem;
  color: var(--text);
}

.see-more {
  margin-top: 2.5rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--rule);
  color: var(--muted);
  font-size: 0.95em;
}
.see-more a {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px dotted var(--rule);
}
.see-more a:hover { border-bottom-color: var(--text); }

@media (max-width: 720px) {
  dl { grid-template-columns: 1fr; gap: 0.15rem 0; }
  dt { padding-top: 0.6rem; }
  .rung-head { grid-template-columns: auto 1fr; }
  .rung-head .count { grid-column: 1 / -1; justify-self: start; margin-top: 0.4rem; }
}
</style>
