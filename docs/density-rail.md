# Density rail

The density rail is the strip in the article's left gutter that visualises
per-paragraph, per-axis prose quality scores. This document is the spec for
the rail's *intended* shape; if the implementation diverges, the
implementation is wrong, not the spec.

## What it's for

The rail is a teaching surface. A writer scanning a draft should be able to
see, at a glance:

- **Where the prose is unusually weak** on each of the catalogued density
  axes (information, argument, impact, specificity, voice), so they know
  which paragraphs to tighten, where to introduce a claim, where to make
  things concrete, where to bring their voice in, where to raise stakes.
- **Where the prose is unusually strong** on each axis, so they can learn
  from their own good paragraphs, and so they can audit the drafter's
  scoring (a strong-marker on a paragraph that doesn't feel strong is a
  signal that the model has misread).

It is not a verdict, and it is not absolute. The drafter's per-paragraph
0..10 scores are subjective and model-dependent; the rail does not assume
that any particular number means anything. It only reads relations - "this
paragraph is less / more than its peers on this axis, by this much" -
against the document's own distribution.

## What the v2 design (currently shipped) gets wrong

The implementation at `src/markdown/densityRail.ts` renders five parallel
6px tracks, one per axis. Per paragraph, each axis paints a centered sliver
whose width is `(score / 10) * 6px`. Same accent colour across all rails.

Two failures, observable on any real document:

1. **Axis scores correlate at the paragraph level.** A substantive paragraph
   tends to score mid-to-high on every axis; a thin one tends to score
   mid-to-low on every axis. The five-bar picket within a paragraph reads
   as one block of roughly-uniform thickness. The comparison the design
   assumes the eye will make - "this paragraph is fat on impact but thin on
   specificity" - never materialises because no such gap exists in the
   underlying signal.
2. **Absolute thresholds carry no meaning.** A paragraph scoring 6 across
   the board renders as "moderate everywhere," but whether 6 is good or bad
   depends entirely on the drafter, the document, the prose type. The rail
   currently shows raw scores, so a uniformly-mediocre document and a
   uniformly-strong document look identical.

The fix isn't a tweak; the encoding has to change.

## The v3 spec: divergent lanes, distribution-relative

### Geometry

One **lane** per axis, vertical, in the left gutter. Lanes are arranged in
canonical axis order (information, argument, impact, specificity, voice)
side by side, with a small gap between them.

Each lane has a **centerline** running its full height. The centerline
represents the document's *median* score on that axis.

Per paragraph, the lane draws a **horizontal bar** at the paragraph's
vertical position:

- **Below median**: bar extends **leftward** from the centerline.
- **Above median**: bar extends **rightward** from the centerline.
- **At or near median**: nothing drawn (or a faint tick - see "Sparsity").

The bar's **length** encodes magnitude. Length is proportional to the
paragraph's deviation from the median, normalised against the document's
spread on that axis (see "Statistics"), capped at the lane's half-width on
each side.

Lane half-width: roughly 6px each side, so a lane is ~14px including the
centerline. Five lanes plus gaps fit in ~80px of gutter on desktop. The
rail hides under a viewport-width breakpoint where the gutter is too tight
to be useful.

### Statistics

Per axis, computed once per render across all scored paragraphs in the doc:

- **Centre**: the median score.
- **Spread**: the **MAD** (median absolute deviation) - robust to short
  documents and to single-paragraph outliers. If MAD is zero (every
  scored paragraph has the same score on this axis), the lane renders
  empty: there's nothing to compare.
- **Normalised magnitude**: `(score - median) / (k * MAD)`, clamped to
  `[-1, +1]`. `k` is a small constant (~2) so the most-deviant paragraph
  in a normal distribution fills its lane; pathological outliers cap at
  the lane edge instead of bursting out.

Mean + SD would be wrong for this: documents are short (often 10-40
paragraphs), one extreme paragraph would skew the centre and inflate the
spread. Median + MAD stays steady.

### Sparsity

The rail is **quiet by default**. A paragraph that sits within roughly the
inner half of its axis's distribution renders no bar - just space against
the centerline. The rail should look mostly empty on a well-balanced doc;
the bars that *are* present should be the ones the writer cares about.

A faint centerline tick at every paragraph's vertical position (1px or
less, very low contrast) keeps the rail readable as a track even where
nothing's flagged. Optional - if the centerline alone reads cleanly,
drop the ticks.

### Direction encoding

Direction (weak vs. strong) is **geometric**, not colour-coded:

- Left of centerline = below median = weak on this axis in this doc.
- Right of centerline = above median = strong on this axis in this doc.

This keeps the rail monochrome (accent colour for everything) and means
the signal survives colourblindness, faded screens, dark/light themes.

Colour is *available* if a future iteration finds that geometric encoding
alone isn't enough - but it should not be the primary carrier, and any
colour split has to remain legible against all themes.

### Labels

Axis identity has to be legible. A fat bar in lane 2 is useless if the
writer can't translate "lane 2" into "argument."

- Small monospace **column headers** above the rail block: `info  arg  impact  spec  voice` (or short forms).
- Per-paragraph **hover** on the article side surfaces a tooltip:
  *"argument: weak (-1.4 MAD); impact: strong (+0.8 MAD); ..."* - the
  axis names and the relative position. Numeric MAD values aren't shown
  to the writer in normal use; they're useful for debugging the rail.
- Eventually (not v3 scope, but worth designing toward): hover surfaces
  an axis-specific *directive* - "argument is weak: what claim are you
  making here?" - so the rail teaches, not just diagnoses.

### What renders

Pseudocode for the rendering pass:

```
for each axis in CANONICAL_AXES present in this doc:
    scores = [paragraph.score[axis] for paragraph in scored_paragraphs]
    median = median(scores)
    mad = median(abs(s - median) for s in scores)
    if mad == 0:
        render empty lane (centerline only)
        continue
    for each paragraph in the rendered article:
        if paragraph has no score on this axis: skip
        deviation = (score - median) / (k * mad)
        deviation = clamp(deviation, -1, +1)
        if abs(deviation) < SPARSITY_THRESHOLD:
            skip (or draw faint tick)
            continue
        bar_length = abs(deviation) * LANE_HALF_WIDTH_PX
        bar_direction = "left" if deviation < 0 else "right"
        draw bar at paragraph's vertical position
```

`SPARSITY_THRESHOLD` is a small fraction (~0.2 of normalised magnitude) so
the rail stays quiet for paragraphs close to median. Tune in practice.

## Goals

- Surface per-axis, per-paragraph signal the writer can act on.
- Stay quiet when there's nothing to say.
- Teach the writer which axes their weak paragraphs are weak on, and which
  axes their strong paragraphs are strong on.
- Let the writer audit the drafter's scoring - a marker on a paragraph
  that doesn't match the writer's judgement means the model is wrong, and
  the writer can override (or ignore the rail) accordingly.
- Read distribution-relative magnitudes only. No absolute thresholds, no
  assumption that score X means anything in particular.

## Non-goals

- A score for the whole document. (That lives in the score pill.)
- An aggregate "how dense is this paragraph overall" number. (Collapsing
  axes loses the teaching signal.)
- A diagnostic that the drafter or the writer can short-circuit ("auto-fix
  weak paragraphs"). The rail flags positions; the rewriting is the
  steering loop's job.
- Colour-coded axis identity. Labels do that work; colour stays out.
- Replacing the flags panel. The rail is about prose quality dimensions
  the drafter scored; flags are about specific catalogued patterns the
  drafter detected. Different layers.

## Data flow

Unchanged from v2, only the rendering layer is rewritten:

```
Drafter (Claude Code, etc.)
  ↓ POST /docs/:id/density
Server (server/routes/density.ts, server/density.ts)
  Stores Record<paragraphHash, Record<axisKey, score>> on the DocState.
  ↓ included in GET /docs/:id payload
Client (OnlineSession.density via state/online.ts)
  ↓ passed into ArticleView.vue as :density prop
ArticleView.vue → applyDensityRails()
  src/markdown/densityRail.ts
  - reads CANONICAL_AXES order
  - matches rendered <p> elements to source paragraphs by canonical text
  - computes per-axis median + MAD across all scored paragraphs
  - builds N lanes with centerline + per-paragraph divergent bars
  - appends rails container to article root, absolutely positioned in
    the left gutter, z-index 0, pointer-events none
```

The drafter side stays as it is. The catalogue of axes is fixed in
`densityRail.ts:CANONICAL_AXES`; new axes coming from the drafter that
aren't in the canonical list still get a lane (alphabetical after the
canonical ones), so the rail isn't a hard gate on axis evolution.

## Tradeoffs to revisit if v3 doesn't land

- **Gutter cost.** ~80px is real estate. If the gutter is too tight on the
  target viewport sizes, consider collapsing to a single signed-magnitude
  lane with axis-letter glyphs (`a`, `I`, `S`, etc.) floating left/right
  by deviation. Loses lane-wise vertical scanning but compacts to ~20px.
- **"Most-deviant fills the lane" is within-document only.** A doc that's
  uniformly mediocre still shows full-lane bars on its relative outliers.
  This is intentional - the rail teaches relative reading - but a small
  caption ("relative to this doc") may help writers who read the rail as
  absolute on first encounter.
- **MAD = 0 is a real edge case.** Short docs where every paragraph
  scores the same on an axis render that lane empty. That's correct -
  there's no comparison to draw - but the empty lane might confuse a
  writer who expected to see *something*. Optional: render the empty
  lane with a subtle "-" or hatching to signal "no spread on this axis,"
  not "rail is broken."
- **Numeric MAD values are a debug surface.** If writers ask for the
  numbers in normal use, surface them in the tooltip; otherwise keep
  them out of sight.

## Open questions for v3 implementation

1. Exact value of `k` in the magnitude normalisation. Start at 2, observe,
   tune.
2. Exact `SPARSITY_THRESHOLD`. Start at 0.2 of normalised magnitude.
3. Whether the centerline gets per-paragraph ticks or just runs as a
   continuous line.
4. Whether to keep the `data-density-hash` attribute and `cursor: help`
   on the paragraph (current behaviour) or move hover affordances purely
   to the rail. The paragraph-side hover is cheap and discoverable; keep
   unless it gets in the way.
5. Whether per-axis breakdowns belong in the score breakdown panel
   (clicking the score pill) as well as on the rail. Likely yes; same
   data, different surface, lets the writer drill in without scanning
   the gutter.
