<script setup lang="ts">
</script>

<template>
  <article class="prose">
    <h1>About</h1>
    <p class="lede">
      Magic Slop Eraser is a markdown viewer that runs prose through an AI-slop detector and
      produces a companion document of flags, ratings, and rationales. The catalogue is a
      generalisation of the in-house deslop infrastructure built for an analytical-prose project,
      itself derived from the patterns one notices when one has read enough LLM output to be
      annoyed by it.
    </p>

    <h2>How to use</h2>
    <p>
      Paste a markdown article. The detectors run in your browser; nothing is sent over the wire.
      The article is rendered as it would read on a page, with each detected slop instance underlined
      in a category colour. The companion panel on the right groups findings by category and explains
      why each instance matched.
    </p>
    <p>
      To improve the detector by hand, select a passage in the rendered article and use
      <em>Flag selection</em> to mark it with a category and pattern, plus a one-sentence note on why
      it is slop. User flags are saved alongside the mechanical flags and exported with the companion
      document.
    </p>

    <h2>What is detected mechanically and what is not</h2>
    <p>
      The mechanical detectors cover the regex-friendly patterns: Tier 1 / Tier 2 lexicon, throat-clearing
      openers, closing phrases, the &ldquo;not just X &mdash; it&rsquo;s Y&rdquo; antithesis, em-dash density,
      false-precision authority appeals, vague gravitas, hedge clusters, staccato runs, anaphoric cascades,
      header inflation. The high-judgment patterns (absent-actor construct, allusive construct, hedged
      confidence, performative balance, frame stacking, recap paragraphs) require a careful reader and are
      the next addition once an LLM call is wired in.
    </p>

    <h2>Score</h2>
    <p>
      The 0&ndash;10 score is a heuristic over the mechanical flags with hard ceilings borrowed from the
      reference scoring rubric: a mirror-construct antithesis, a staccato run, an anaphoric cascade, a
      Tier 1 lexicon hit, or a vague-gravitas line each cap the score at 7. Two such ceilings stack to
      cap 6, three to 5, four to 4. Use deltas across passes, not absolute values.
    </p>

    <h2>Local first</h2>
    <p>
      Everything you paste is stored only in this browser&rsquo;s local storage. No analytics, no
      backend. Two further deployment shapes are planned: a bring-your-own-key mode for sending
      passages to an LLM for the high-judgment patterns, and a hosted version that handles billing and
      key management.
    </p>
  </article>
</template>

<style scoped>
.prose {
  max-width: 70ch;
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
.lede { font-size: 1.1rem; color: var(--text); }
h2 {
  font-family: var(--font-display);
  font-size: 1.15rem;
  margin: 2rem 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}
</style>
