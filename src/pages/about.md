# Methodology

Magic Slop Eraser identifies AI-slop patterns in prose and walks the writer through fixing each instance one at a time. The catalogue is a generalisation of in-house deslop infrastructure built for a long-form analytical-prose project, itself derived from the patterns one notices when one has read enough LLM output to recognise the institutional voice underneath - the HR-memo, the brand statement, the consultancy deck, the wire-service preamble - all laundered through a model and emerging as your draft.

## What counts as slop

The bar is *actually annoying*, not *AI-fingerprint*. The catalogue is curated against the test "would a careful reader find this painful or empty to read?", not "would a hostile reader clock this as a chatbot?". Many AI tells overlap with the painful-to-read set (delve, throat-clearing, the mirror construct, suffocation by stacked hedges, the synthesis-of-nothing closer); plenty of AI tells do not (em-dashes, the bullet list, the staccato run, the periodisation move). The latter are things skilled human writers do for effect. We do not flag them.

What survives in the catalogue is the set of moves the model reaches for reflexively *and* that read as braindead LLM garbage to a careful reader. When in doubt, the test is whether removing the pattern's instances from a piece would make the piece read more like it was written by someone with a position and a pulse. If yes, the pattern is in. If the answer is "it would just look less AI-shaped, but no better," the pattern stays out.

## The framework

The catalogue organises patterns by *depth* into three [Rungs](/rungs) - mechanical, passage-level judgment, and presentation / editorial. The Rungs page has the long version. In short: lighter, regex-friendly slop sits at the bottom; structural editorial moves sit at the top; an agent or author picks the entry rung based on the draft's stage.

## How to use it

Magic Slop Eraser is an online site that stores your prose, the flags raised against it, the suggestions an agent proposes, and the resolution history. The browser is a viewer. The work is driven by an agent - any agentic coding tool (Claude Code, Codex, opencode, your own scripts, or a hosted reviewer) talking to the site over an API.

The default loop: kick off your agent of choice with a document URL, watch the flags arrive in the browser, and steer the agent through accept / reject / rewrite decisions on each one. The site is the source of truth; the agent is the writer; you are the orchestrator. A browser-only paste-and-fix fallback exists for users without an agent, but the project is designed agent-first.

## Bring your own catalogue

Our pattern catalogue is a starting set, not a fixed contract. The framework, the viewer, and the agent loop are designed so you can plug in your own catalogue - your own patterns, regex matchers, severity weights, and rung assignments - and walk the same one-flag-at-a-time loop against your prose. The point of the project is the *interface for steering a writing model through your draft*; the catalogue is content the interface drives. We will publish the customisation surface as it stabilises.

## Where the value lives

The catalogue, the regex detectors, the scoring - all of that is a skill. It can ship as a local library, an agent command, an npm package; nothing about the patterns themselves needs a hosted site. The skill's job is to analyse the prose and surface options and judgements; it does not need a viewer to do that work.

What the site adds is the interactive UI for *driving* a skill of that shape against a piece of prose. A flag panel anchored to the exact sentence the model is talking about. One-click verdicts on competing rewrites. Comment threads pinned to the offending span. The document, the agent's proposals, and your decisions visible at once. A fast, convenient way to hand an LLM editorial direction with the full context of the text already in view.

The value-add is not the detectors. The value-add is the interface for steering a writing model through your prose without losing the thread - the document, the flags, and the candidate rewrites all in one view instead of scrolled through a terminal.
