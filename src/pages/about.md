# About

Magic Slop Eraser is a markdown viewer that runs prose through an AI-slop detector and walks you through fixing each flag one at a time. The catalogue is a generalisation of the in-house deslop infrastructure built for a long-form analytical-prose project, itself derived from the patterns one notices when one has read enough LLM output to recognise the institutional voice underneath - the HR-memo, the brand statement, the consultancy deck, the wire-service preamble - all laundered through a model and emerging as your draft.

## The three rungs

Slop is not all the same. The eraser organises every catalogued pattern into one of three rungs, ordered by *depth*:

<ul class="rung-summary">
<li><strong class="r1">Rung 1 - mechanical.</strong> Regex-catchable, fixable by substitution or cut. The bottom rung: surface-level, runs anywhere, no LLM required.</li>
<li><strong class="r2">Rung 2 - passage-level judgment.</strong> A capable LLM flags a sentence (or a short cluster of sentences); the fix needs two or three options for the writer to choose from.</li>
<li><strong class="r3">Rung 3 - presentation / editorial.</strong> Whether the piece's substance - its arguments, values, internal merits - actually comes through. Frame stacking, performative balance, header inflation. Editorial work, human-driven.</li>
</ul>

The numbering is depth, not order. The agent (or you) picks the entry rung based on the draft's stage: a structurally clean draft starts at Rung 1 and works up; a tangled draft starts at Rung 3 and works down so polish does not get wasted on prose about to be cut. See the [Rungs page](/rungs) for the long version of the philosophy.

## How to use

Paste a markdown article. The detectors run in your browser; nothing is sent over the wire. The article is rendered as it would read on a page, with each detected slop instance underlined in a category colour. The companion panel on the right groups findings by category and explains why each instance matched. Rung 1 patterns light up first - those are the only ones detected purely locally.

To improve the detector by hand, select a passage in the rendered article and use *Flag selection* to mark it with a category and pattern, plus a one-sentence note on why it is slop. User flags are saved alongside the mechanical flags and exported with the companion document.

## What lives at Rung 1 (mechanical)

Eleven patterns: Tier 1 / Tier 2 lexicon, throat-clearing openers, closing phrases, the mirror construct ("not just X - it's Y"), em-dash density, false-precision authority, vague gravitas, hedge clusters, enthusiasm inflation, and approval-seeking closes. All ship as regex matchers and run server-side without invoking an LLM. The plan is to extract Rung 1 as a portable framework so other prose tools can adopt the same catalogue.

## What lives at Rung 2 (LLM-assisted)

Ten patterns where regex falls short: absent-actor construct, allusive construct, staccato slop, bidirectional summary, hedged confidence, pivot-to-balance, restating the question, synthesis of nothing, performative humility, bullets-where-prose-would-serve. These need a capable model to read the sentence in context and propose two or three rewrites. The writer picks one, edits it, or rejects all.

## What lives at Rung 3 (editorial)

Three patterns whose fix is structural rather than local: frame stacking, performative balance, header inflation. The detector flags the position; the rewrite is a collaboration between the writer and a model, in the same shape as the workshop and chief-edit pipelines used for long-form analytical prose. The eraser does not try to do this work autonomously.

## How you actually use it

Magic Slop Eraser is an online site that stores your prose, the flags, the suggestions, and the resolution history. Any agentic coding tool (Claude Code, Codex, opencode, your own scripts, or our hosted reviewer) pushes and pulls edits and analysis through an API. You watch in the browser - flags arrive, edits land, the score moves. The site is the source of truth; the agent is the writer; you are the orchestrator.

## Where the value lives

The catalogue, the regex detectors, the score - all of that is a skill. It can ship as a local library, a Claude Code command, an npm package; nothing about the patterns themselves needs a hosted site. The skill's job is to analyse the prose and surface options and judgements; it does not need a viewer to do that work.

What the site adds is the interactive UI for *driving* a skill of that shape against a piece of prose. A flag panel anchored to the exact sentence the model is talking about. One-click verdicts on competing rewrites. Comment threads pinned to the offending span. The document, the agent's proposals, and your decisions visible at once. A fast, convenient way to hand an LLM editorial direction with the full context of the text already in view.

The value-add is not the detectors. The value-add is the interface for steering a writing model through your prose without losing the thread - the document, the flags, and the candidate rewrites all in one view instead of scrolled through a terminal.

## Score

The 0&ndash;10 score is computed from Rung 1 hits only. A score of 10 means the piece has no detectable Rung 1 slop; Rung 2 and Rung 3 flags are reported separately and not folded into the number. The rationale: if the score moved when an LLM happened to flag fewer things on a particular run, it would feel like progress without being it. The score is a Rung 1 milestone, not a verdict on the piece.
