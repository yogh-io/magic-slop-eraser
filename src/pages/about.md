# Methodology

Magic Slop Eraser identifies AI-slop patterns in prose and walks the writer through fixing each one. The catalogue is a generalisation of in-house deslop infrastructure built for a long-form analytical-prose project, itself derived from the patterns one notices when one has read enough LLM output to recognise the institutional voice underneath - the HR-memo, the brand statement, the consultancy deck, the wire-service preamble - all laundered through a model and emerging as your draft.

The thing the eraser is built for is *paired writing*. Not "agent, fix this paragraph" and walk away. Each fix is a moment where the author defines the shape, the agent does the prose execution, and the author's taste enters every step. The browser is the steering surface; the agent is the keyboard.

## What counts as slop

The bar is *actually annoying*, not *AI-fingerprint*. The catalogue is curated against the test "would a careful reader find this painful or empty to read?", not "would a hostile reader clock this as a chatbot?". Many AI tells overlap with the painful-to-read set (delve, throat-clearing, the mirror construct, suffocation by stacked hedges, the synthesis-of-nothing closer); plenty of AI tells do not (em-dashes, the bullet list, the staccato run, the periodisation move). The latter are things skilled human writers do for effect. We do not flag them.

What survives in the catalogue is the set of moves the model reaches for reflexively *and* that read as braindead LLM garbage to a careful reader. When in doubt, the test is whether removing the pattern's instances from a piece would make the piece read more like it was written by someone with a position and a pulse. If yes, the pattern is in. If the answer is "it would just look less AI-shaped, but no better," the pattern stays out.

## The framework

The catalogue organises patterns by *depth* into three [Rungs](/rungs) - mechanical, passage-level judgment, and presentation / editorial. Rung 1 is the bottom (regex, surface-level, free); Rung 3 is the top (structural, whole-piece, editorial). The numbering is layer, not order: a structurally clean piece can start at Rung 1 and climb up; a tangled draft starts at Rung 3 and works down so polish does not get spent on prose about to be cut. The Rungs page has the long version.

The score is Rung 1 only. A score of 10 means no detectable mechanical slop. Rung 2 and Rung 3 are reading-comprehension work; reducing them to a number would flatter the score in ways that would feel like progress without being it. Rung 2 and Rung 3 hits are reported as counts, not folded into the headline.

## The loop

This is the core of the project. The eraser is not a delegation tool. It is a *steering surface*.

The interaction is batched. The agent surfaces a batch of questions - "wtf do you want done with this?", one per flag, ten or fifteen at a time, each pinned to its anchor in the document. The author sweeps the batch and gives a shape directive on each in seconds: *more committal*, *drop the qualifier*, *punchline first*, *their voice not yours*, *cut to the verb*, *no, swap the clauses*. Or *skip*, or *keep*, or *let me try: <text>*. The author submits the batch and goes off to do something else. The agent processes the directives in the background, one flag at a time, drafting candidates and posting them back. The author re-engages, sees the candidates pinned to their anchors, accepts the ones that landed, re-directs the ones that did not, and the next batch begins.

The trick is *time arbitrage*. The author's attention is the scarce resource, so the agent batches its questions to make a sweep efficient, and the author batches their directives so the agent can grind through them in parallel and out-of-band. The author does not wait on round-trips. The agent does not wait on the next directive once a batch is in hand. Many short turns per flag, often across two or three sweeps for the harder ones, until the sentence lands.

This is a steering loop, not an evaluation loop. The agent has the keyboard; the author has the wheel. The unit per flag is small (sentence or clause for Rung 2; a section or transition for Rung 3); the granularity per turn is large (many flags per sweep). The work is the writer's; the agent is the typist.

There is a model behind this. A single-shot generation samples from the typical centre of a fan and cannot reach the peak - it samples from the dense middle where training examples concentrate, while the best answer hides in the atypical tail. An iterated loop is different: each step still samples from a centre, but the author's nudge between steps moves *where the fan sits*. The peak is reached not by one prompt at high temperature, but by walking the agent toward it through many short turns, with the writer's taste moving the sampling distribution every time. The batching is the workflow that makes this human-scale.

## How to use it

Magic Slop Eraser is a hosted site. It stores your prose, the flags raised against it, the directives you issue, the candidates the agent drafts, and the resolution history. The browser is the steering surface. The work is driven by an agent - any agentic coding tool (Claude Code, Codex, opencode, your own scripts, or a hosted reviewer) talking to the site over an API.

The default loop: kick off your agent of choice with a document URL, watch the flags arrive in the browser, sweep them with directives, accept and re-direct the candidates as they come back. The site is the source of truth; the agent is the drafter; you are the writer. A browser-only paste-and-fix fallback exists for users without an agent, but the project is designed agent-first.

## Bring your own catalogue

Our pattern catalogue is a starting set, not a fixed contract. The framework, the steering surface, and the agent loop are designed so you can plug in your own catalogue - your own patterns, regex matchers, severity weights, and rung assignments - and walk the same batched-steering loop against your prose. The point of the project is the *interface for steering a writing model through your draft*; the catalogue is content the interface drives. We will publish the customisation surface as it stabilises.

## Where the value lives

The catalogue, the regex detectors, the scoring - all of that is a skill. It can ship as a local library, an agent command, an npm package; nothing about the patterns themselves needs a hosted site. The skill's job is to analyse the prose and surface the questions; it does not need a viewer to do that work.

What the site adds is the steering surface. A flag panel anchored to the exact sentence the agent is drafting. Fast directive entry: free text, common-case shortcuts, sweep across a batch. The candidate landing back at its anchor as soon as the agent posts it. Comment threads pinned to the offending span. Re-direction in a second click. The document, the agent's drafts, and your decisions visible at once. A way to hand a writing model editorial direction with the full context of the text already in view, in the cadence you want - concentrated bursts of decisions, not a synchronous typing session.

The value-add is not the detectors. The value-add is the surface for steering a writing model through your prose without losing the thread - the document, the flags, the directives, and the candidate rewrites all in one view; batched directives going out, candidates coming back, the writer's taste shaping the work without the writer doing the typing.

## Desloppifier or editorial tool

Honest answer: we do not know yet. Rung 1 is a desloppifier - regex, free, portable, ships without a model dependency. Rung 3 is an editorial workshop - whole-piece rewrites, slow, collaborative, requires a capable model and a writer with time. Rung 2 sits between them. The layering is on purpose; the centre of gravity - which rung the typical user actually spends time on - is not settled.

We will find out by using the tool on our own writing and watching where it pulls us. If most sessions resolve at Rung 1 and stop, the project is a desloppifier with editorial scaffolding. If the regex layer ends up being the warm-up before the real work starts above it, the project is an agent-powered editorial tool with a free front door. Both shapes are coherent. The architecture supports either, the catalogue grows under either, the same batched steering loop runs at every rung.

For now the bottom rung is the front door and the top rung is the destination, and we will have more to say once we have walked enough drafts through to know which floor people actually live on.
