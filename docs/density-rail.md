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
scores are subjective and model-dependent. Since v3.2 the calibration
anchor is **external** (an internet-average paragraph at score 0) rather
than the doc's own distribution - so a flat rail through a section now
means "this section reads as unremarkable vs. the broader population of
prose," not "this section is consistent with the other sections in this
specific piece."

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

## The v3 spec: divergent lanes, distribution-relative (superseded by v3.2)

The v3 design rendered each paragraph's per-axis score as a horizontal
bar whose direction and length encoded **deviation from the document's
own median**, normalised against the document's MAD on that axis. The
bar extended left of a centerline for below-median paragraphs and right
for above-median; same-side fold for sparsity-near-median.

v3.2 retired this in favour of:

1. an **external** scoring anchor (internet-average at 0, see "Scoring"
   below) - so the rail tells the writer "this paragraph is below
   typical-prose quality," not just "this paragraph is below the other
   paragraphs in this piece."
2. a per-axis **silhouette** rendered with SVG paths - convex bumps for
   positive scores, concave dents for negative ones, replacing the
   left/right bars.

The historical v3 geometry text below is preserved for context; the
implementation no longer follows it.

### Geometry (historical, v3)

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

### Statistics (superseded - see v3.2)

The original v3 design computed a per-axis median + MAD across the scored
paragraphs and rendered each bar as the paragraph's normalised deviation
from that doc-local median. v3.2 dropped this in favour of an external
(internet-average) baseline at 0 - see "Scoring (v3.2 amendment)" below.
The MAD machinery and the distribution-relative logic are no longer in
the implementation.

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

Direction (above vs. below baseline) is **geometric**, not colour-coded:

- **Right of baseline** = score positive = paragraph reads above the
  internet-average baseline on this axis (convex bump outward).
- **Left of baseline** = score negative = paragraph reads below the
  internet-average baseline on this axis (concave dent inward into
  the lane).
- **Flat at baseline** = score near zero = unremarkable on this axis.

The baseline is the lane's natural right edge; a faint vertical guide
renders behind the silhouette so the writer can see exactly where it
sits. The geometric channel is the one that must survive colourblindness,
faded screens, and theme swaps; nothing else encodes direction.

### Colour (v3.1 amendment)

Colour carries **axis identity**, not direction. Each axis renders in its
own hue (theme tokens `--rail-information`, `--rail-argument`,
`--rail-impact`, `--rail-specificity`, `--rail-voice`); the silhouette
fills with that hue at ~62% opacity and a slightly darker stroke for
definition. Reason: in practice the all-accent v3 rail forced the writer
to count lanes left-to-right against a header row that scrolls out of
view, which is the wrong cognitive load to ask for. Colour lets the
writer recognise the rail at a glance once the mapping is learned; the
colour-blind / faded-theme case is still served by the (twice-rendered,
see Labels) text headers.

Pick hues that are mid-saturation and similar in lightness so no axis
dominates visually; theme files may override per palette.

### Labels

Axis identity has to be legible. A fat silhouette in lane 2 is useless
if the writer can't translate "lane 2" into "argument."

- **Column headers**, one per lane, in vertical text (writing-mode
  `vertical-rl`) so the full short word fits inside the lane width.
  Background is a low-opacity swatch in the lane's own hue, text is the
  same hue at higher saturation - the swatch alone is enough on its
  own once colour identity is learned.
- Headers render **at the top AND at the bottom** of the rail block. A
  long article scrolls past the top set; the bottom set re-anchors
  identity when the writer reaches the end.
- Per-paragraph **hover** on the article side surfaces a tooltip:
  *"argument: 4 (strong); impact: -7 (weak); ..."* - the axis names,
  the symmetric scores, and weak/strong descriptors derived from sign.
- Eventually (not in scope here, but worth designing toward): hover
  surfaces an axis-specific *directive* - "argument is weak: what claim
  are you making here?" - so the rail teaches, not just diagnoses.

### Scoring (v3.2 amendment)

The score range is **symmetric, -10 to +10**, calibrated against an
**external** baseline. Zero is "average article on the internet" on this
axis - the prose-quality reference is the typical Atlantic paragraph,
the typical blog post, the typical AI-generated passage. The drafter
scores each paragraph against that anchor, not against the other
paragraphs in this piece:

- **+8** = very good relative to baseline.
- **+4** = noticeably above baseline.
- **0** = unremarkable, neither carrying nor sinking the paragraph.
- **-4** = noticeably below baseline.
- **-8** = very bad relative to baseline.

Why: positive-only scoring forced "average" into the middle of the range
(5 of 10), so every paragraph looked at least moderately strong - the
rail had no way to say "this paragraph is worse than typical prose." The
signal we want is deviation from baseline in either direction; symmetric
scoring carries that directly.

The drafter is still expected to use the full range across the piece -
clustering everything in `[-2, +2]` either means the agent is sandbagging
or the prose is genuinely middling on every axis. Either way the rail
flattens, and the writer reads "no signal here" rather than "noise."

Legacy 0..10 scores from before this amendment are dropped server-side
on first read (see `migrateDensitySchema` / `densitySchemaVersion`), so
the drafter is forced to re-score against the symmetric anchor rather
than letting the old data render under the new geometry.

### Geometry (v3.2 amendment)

Replaces the bar-per-paragraph design. Each lane is one SVG closed path:

- **Left edge**: straight at `x = 0` (the lane's left margin).
- **Right edge**: wavy, baseline at `x = LANE_WIDTH_PX` (the lane's
  natural right edge). Per paragraph row, the right edge deflects:
  - **Positive score**: the edge bumps **outward** (right of baseline),
    a convex bulge of depth `(score / 10) * MAX_DEPTH_PX`.
  - **Negative score**: the edge caves **inward** (left of baseline,
    into the lane interior), a concave dent of depth
    `(|score| / 10) * MAX_DEPTH_PX`.
  - **Near-zero score** (`|score| < SPARSITY_SCORE`): the edge stays at
    baseline through that paragraph row - the rail goes flat.
- **Bottom and top edges**: close the path symmetrically.

The deflection is rendered as a cubic Bezier across the paragraph row:
`M (baseline, py_start) C (peak_x, ctrl_y_top) (peak_x, ctrl_y_bot)
(baseline, py_end)` with `peak_x = baseline + (4/3) * displacement` so
the curve's midpoint actually reaches `baseline + displacement` (the
Bezier under-shoots its control points by 25% on the principal axis).

`MAX_DEPTH_PX = 8`, so a `+10` paragraph bumps 8px outward and a `-10`
paragraph dents 8px inward. With `LANE_WIDTH_PX = 14`, a `-10` dent
leaves a 6px sliver of lane material on the left - thin but visible,
which keeps the silhouette readable at the most-negative extreme.

`LANE_GAP_PX = 10` keeps the rightmost lane's max bump (8px) safely
clear of the next lane's left edge (`INNER_GAP_PX = 2` buffer). The
outermost lanes spill into the gutter / prose margin per their slack.

### Colour and labels

Unchanged from v3.1: each lane carries its own hue via theme tokens
(`--rail-information`, …, `--rail-voice`); the silhouette fills with
that hue at ~62% opacity and a slightly darker stroke for definition.
A faint vertical baseline at `x = LANE_WIDTH_PX` sits behind the
silhouette so the writer can read deflections as "to the left of the
line = dent, to the right = bump." Vertical-text headers render at the
top and bottom of the rail block.

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
