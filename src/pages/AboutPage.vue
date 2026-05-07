<script setup lang="ts">
</script>

<template>
  <article class="prose">
    <h1>About</h1>
    <p class="lede">
      Magic Slop Eraser is a markdown viewer that runs prose through an AI-slop detector and
      walks you through fixing each flag one at a time. The catalogue is a generalisation of the
      in-house deslop infrastructure built for a long-form analytical-prose project, itself derived
      from the patterns one notices when one has read enough LLM output to be annoyed by it.
    </p>

    <h2>The three rungs</h2>
    <p>
      Slop is not all the same. The eraser organises every catalogued pattern into one of three
      rungs, ordered by <em>depth</em>:
    </p>
    <ul class="rung-summary">
      <li><strong class="r1">Rung 1 - mechanical.</strong> Regex-catchable, fixable by substitution or cut. The bottom rung: surface-level, runs anywhere, no LLM required.</li>
      <li><strong class="r2">Rung 2 - passage-level judgment.</strong> A capable LLM flags a sentence (or a short cluster of sentences); the fix needs two or three options for the writer to choose from.</li>
      <li><strong class="r3">Rung 3 - presentation / editorial.</strong> Whether the piece's substance - its arguments, values, internal merits - actually comes through. Frame stacking, performative balance, header inflation. Editorial work, human-driven.</li>
    </ul>
    <p>
      The numbering is depth, not order. The agent (or you) picks the entry rung based on the
      draft's stage: a structurally clean draft starts at Rung 1 and works up; a tangled draft
      starts at Rung 3 and works down so polish does not get wasted on prose about to be cut.
      See the <router-link to="/rungs">Rungs page</router-link> for the long version of the
      philosophy.
    </p>

    <h2>How to use</h2>
    <p>
      Paste a markdown article. The detectors run in your browser; nothing is sent over the wire.
      The article is rendered as it would read on a page, with each detected slop instance
      underlined in a category colour. The companion panel on the right groups findings by category
      and explains why each instance matched. Rung 1 patterns light up first - those are the only
      ones detected purely locally.
    </p>
    <p>
      To improve the detector by hand, select a passage in the rendered article and use
      <em>Flag selection</em> to mark it with a category and pattern, plus a one-sentence note on
      why it is slop. User flags are saved alongside the mechanical flags and exported with the
      companion document.
    </p>

    <h2>What lives at Rung 1 (mechanical)</h2>
    <p>
      Eleven patterns: Tier 1 / Tier 2 lexicon, throat-clearing openers, closing phrases, the
      mirror construct ("not just X - it's Y"), em-dash density, false-precision authority,
      vague gravitas, hedge clusters, enthusiasm inflation, and approval-seeking closes. All
      ship as regex matchers and run server-side without invoking an LLM. The plan is to
      extract Rung 1 as a portable framework so other prose tools can adopt the same catalogue.
    </p>

    <h2>What lives at Rung 2 (LLM-assisted)</h2>
    <p>
      Ten patterns where regex falls short: absent-actor construct, allusive construct, staccato
      slop, bidirectional summary, hedged confidence, pivot-to-balance, restating the question,
      synthesis of nothing, performative humility, bullets-where-prose-would-serve. These need a
      capable model to read the sentence in context and propose two or three rewrites. The writer
      picks one, edits it, or rejects all.
    </p>

    <h2>What lives at Rung 3 (editorial)</h2>
    <p>
      Three patterns whose fix is structural rather than local: frame stacking, performative
      balance, header inflation. The detector flags the position; the rewrite is a collaboration
      between the writer and a model, in the same shape as the workshop and chief-edit pipelines
      used for long-form analytical prose. The eraser does not try to do this work autonomously.
    </p>

    <h2>How you actually use it</h2>
    <p>
      Magic Slop Eraser is an online site that stores your prose, the flags, the suggestions, and
      the resolution history. Any agentic coding tool (Claude Code, Codex, opencode, your own
      scripts, or our hosted reviewer) pushes and pulls edits and analysis through an API. You
      watch in the browser - flags arrive, edits land, the score moves. The site is the source
      of truth; the agent is the writer; you are the orchestrator.
    </p>
    <p>
      Rung 1 (mechanical) ships open-source: the catalogue, the regex detectors, the score, the
      API surface. The plan is to extract it as a standalone library so other prose tools can
      adopt it without rebuilding it from scratch. Rung 2 needs an LLM call; the agent runs
      that on its own side. Rung 3 is editorial and human-driven.
    </p>

    <h2>Score</h2>
    <p>
      The 0&ndash;10 score is computed from Rung 1 hits only. A score of 10 means the piece has no
      detectable Rung 1 slop; Rung 2 and Rung 3 flags are reported separately and not folded into
      the number. The rationale: if the score moved when an LLM happened to flag fewer things on a
      particular run, it would feel like progress without being it. The score is a Rung 1
      milestone, not a verdict on the piece.
    </p>
  </article>
</template>

<style scoped>
.prose {
  max-width: 72ch;
  margin: 2rem auto 5rem;
  padding: 0 2rem;
  color: var(--text);
  line-height: 1.65;
}
h1 {
  font-family: var(--font-display);
  font-size: 2.4rem;
  margin: 0 0 1rem;
  letter-spacing: var(--heading-tracking, normal);
}
.lede { font-size: 1.08rem; color: var(--text); margin: 0 0 1.2rem; }
.lede em { font-style: italic; }

h2 {
  font-family: var(--font-display);
  font-size: 1.15rem;
  margin: 2rem 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

a { color: var(--text); border-bottom: 1px dotted var(--rule); text-decoration: none; }
a:hover { border-bottom-color: var(--text); }

ul.rung-summary {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
  display: grid;
  gap: 0.4rem;
}
ul.rung-summary li {
  border-left: 3px solid var(--rule);
  padding: 0.3rem 0 0.3rem 0.9rem;
}
ul.rung-summary strong { font-weight: 600; }
ul.rung-summary .r1 { color: #2f8f6a; }
ul.rung-summary .r2 { color: #b88f3e; }
ul.rung-summary .r3 { color: #b8472d; }
</style>
