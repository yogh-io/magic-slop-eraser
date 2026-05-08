# slopmop

A hosted online AI-slop detector and guided fixer. Prose in, flagged article out, walked through fix-by-fix - the writing happens in a *paired loop*: the author defines shape, the agent drafts the prose, and the author's taste enters every step. The browser is the steering surface; an agentic coding tool (Claude Code, Codex, opencode, your own scripts, or our hosted reviewer) is the keyboard.

This file is the framework definition. Read it before working on the catalogue, the detectors, the analyse view, the API, or the architecture.

## What this project is

Slopmop identifies AI-slop patterns in prose and walks the writer through fixing them one at a time. The catalogue is a generalisation of the in-house deslop infrastructure built for `` (analytical-prose project), itself derived from the patterns one notices when one has read enough LLM output to be annoyed by it.

The project organises every catalogued pattern into one of three **rungs**, ordered by *depth*. Rung 1 is the bottom (mechanical, surface-level, free) and Rung 3 is the top (structural, whole-piece, editorial). Detection difficulty is a separate axis (the `mechanical` boolean); a pattern can be mechanical to detect but still belong to Rung 3 if its fix requires substantial rewriting. The rung is what governs the user-facing workflow.

The numbering is **layer, not order**. An agent or author picks the entry rung based on the draft's stage: a structurally clean draft starts at Rung 1 and climbs up; a tangled draft starts at Rung 3 and works down so polish does not get spent on prose about to be cut.

## The three rungs

### Rung 1 - mechanical (bottom)

- **Detection**: regex. Pure pattern matching against a fixed catalogue. Ships with no model dependency.
- **Fix**: substitution or cut. A short / dumb-model LLM can suggest a replacement but is not required.
- **Where it runs**: anywhere - in the browser, on the server, in the agent's process. No network call, no API key.
- **Workflow**: one flag at a time. The agent pulls the flag list, walks each, pushes a proposed edit, waits for the human verdict. Same shape as the workshop pipeline in `/.claude/commands/workshop.md` - one-flag-at-a-time interactive loop, applied to the regex layer.
- **Patterns currently here (11)**: `tier1-lexicon`, `tier2-lexicon`, `throat-clearing`, `closers`, `hedge-cluster`, `enthusiasm-inflation`, `vague-gravitas`, `antithesis` (mirror construct), `em-dash-density`, `false-precision`, `approval-seeking`.

This rung is the heart of the project. It ships **open-source**. The plan is to **extract Rung 1 as a portable framework** so other prose tools can adopt the same catalogue without rebuilding it.

### Rung 2 - passage-level judgment (middle)

- **Detection**: a capable LLM reading a sentence, or a small cluster of two or three sentences, in paragraph context. Local regex misses these because the pattern is structural, not lexical: a passage whose subject is unnamed, a closer that synthesises nothing, a paragraph that walks across both sides without committing.
- **Fix**: rewriting the passage with two or three candidate forms; sometimes a single word changes, sometimes the whole sentence is reshaped, sometimes a small cluster is rebuilt. Author picks one, customises, or rejects. Always reversible.
- **Where it runs**: requires an LLM call. The agent invokes the model from its own side - whatever subscription or API access it already has - and posts suggestions back to the site.
- **Workflow**: a *steering loop*, batched. The agent posts one or more candidates per flag (one when the directive is unambiguous, two or three when it admits real alternatives); the author sweeps the flag batch with shape directives ("more committal", "drop the qualifier", "punchline first", "cut to the verb"); the agent re-attempts each in the background; the author re-engages and re-directs until the sentence lands. Many short turns per flag, often across two or three sweeps. BETTER / WORSE / CLOSE is fuel for the next iteration, not a final ranking. No batch auto-fix - every accept is the author's.
- **Patterns currently here (10)**: `absent-actor`, `allusive-construct`, `staccato`, `bidirectional-summary`, `hedged-confidence`, `pivot-to-balance`, `restating-question`, `synthesis-of-nothing`, `performative-humility`, `bullets-where-prose`.

### Rung 3 - presentation / editorial (top)

- **Detection**: requires reading the piece as a piece. The question is whether its substance - the actual arguments, values, internal merits of what is being said - is coming through to the reader. Frame stacking buries the thesis under preamble; performative balance dilutes the position into nothing; header inflation pads scaffolding where the argument should carry weight. These are the moves a chief editor catches on the second read.
- **Fix**: substantial rewrite focused on what the piece is *saying*, not just where it sits on the page. Outside the scope of an autonomous fixer. Slopmop flags positions where the presentation of the content needs reworking and gets out of the way.
- **Where it runs**: outside the in-browser detector's scope. Slopmop flags positions; the rewrite is collaborative, slow, human-driven.
- **Workflow**: the same batched steering loop, applied to larger units (a section, a transition, the opening, the close). Slower cycles - the agent reads the surrounding piece between turns - but the shape is identical: the author defines what the section is supposed to *do*, the agent drafts the prose, the author re-directs. The relevant references in `` are `.claude/commands/workshop.md` (interactive multi-pass diagnostic + author-driven rewriting) and `.claude/commands/chief-edit.md` (the ship gate / blurb / preamble drafter). Rung 3 in slopmop is positioned as the entry point to that kind of workflow.
- **Patterns currently here (3)**: `frame-stacking`, `performative-balance`, `header-inflation`.

## The loop: paired writing in batched turns

Slopmop is not a delegation tool. The author does not say "agent, fix this paragraph" and walk away. Each fix is a paired writing moment - the author defines the shape, the agent does the prose execution, and the author's taste enters every step. But the pairing is *batched*, not synchronous.

The interaction shape:

1. **The agent surfaces a batch of questions.** "Wtf do you want done with this?" - one question per flag, ten or fifteen at a time, each pinned to its anchor in the document.
2. **The author sweeps the batch.** For each flag they give a shape directive in seconds: *more committal*, *drop the qualifier*, *punchline first*, *their voice not yours*, *cut to the verb*, *no, swap the clauses*. Or: *skip*, *keep*, *let me try: <text>*. Free text where free text is needed; common-case shortcuts where they aren't.
3. **The author submits the batch and goes off.** The agent processes the directives in the background, one flag at a time, generating candidates and posting them back to the document.
4. **The author re-engages and reviews.** Each candidate is now visible at its anchor. Accept the ones that landed, re-direct the ones that did not, keep going. The directives accumulate as a steering history per flag.
5. **Loop until satisfied.** Many cycles, fewer flags per cycle as the document settles.

This is a steering loop, not an evaluation loop. The agent has the keyboard; the author has the wheel. The unit per flag is small (sentence or clause for Rung 2; section or transition for Rung 3); the granularity per *turn* is large (many flags per author sweep).

The trick is *time arbitrage*. The author's attention is the scarce resource, so the agent batches its questions to make a sweep efficient, and the author batches their directives so the agent can grind through them in parallel and out-of-band. The author does not wait on round-trips. The agent does not wait on the next directive once a batch is in hand.

The model behind it: a single-shot generation samples from the typical centre of a fan and cannot reach the peak (Falco's *fan-out* argument). An iterated loop is different - each step samples from a centre, but the **author's nudge between steps moves where the fan sits**. The peak is reached by walking the agent toward it through many short steps, with the writer's taste moving the sampling distribution every turn. The *batching* is the workflow that makes this human-scale: the author concentrates their thinking, the agent amortises its work, and the steering still happens.

What this means for the surfaces and the API:

- **Granularity is the feature.** Anchors are sentence-level for Rung 2, section-level for Rung 3. Rewrite affordances should match. Never rewrite a paragraph in one turn.
- **The directive vocabulary matters.** Free text where free text is needed; common-case shortcuts ("more committal", "drop the qualifier", "punchline first", "cut to the verb", "their voice not yours") for the moves the author reaches for repeatedly. Sweep-speed.
- **Batched submission, async resolution.** The API and the UI must let the author sweep a flag list, post directives, and walk away. The agent processes asynchronously and pushes results back via the event stream. The author re-engages at their cadence, not the agent's. This is a first-class API primitive, not a client-side optimisation.
- **Voice memory accumulates over the session.** Every accepted rewrite is a calibration sample. The agent's candidates should converge on *this writer's* voice as the document goes on, not stay generic.
- **BETTER / WORSE / CLOSE is a steering wheel, not a scorecard.** Per flag, the candidate trail records *direction of travel*, not a final ranking. A verdict on the latest candidate is fuel for the next nudge.

Rung 1 is the simplest form (one substitution, one verdict, often resolvable in the same sweep). Rung 2 is the canonical form (multiple shape-nudges per flag until the sentence lands, sometimes across two or three sweeps). Rung 3 is the loop applied to whole sections, with the agent reading the surrounding piece between turns.

## Architecture: the hosted site + agent loop

Slopmop is **an online site, not a local app**. It stores prose, comments, suggestions, anchors, and resolution history. It exposes an API for agents to push and pull edits and analysis.

The shape:

- **Site (server)** is the source of truth. It owns documents, flags, comment threads, suggestion candidates, resolution states, version history, and the queue of pending directives.
- **Agent (drafter)** is an agentic coding tool (Claude Code, Codex, opencode, etc.) carrying the slopmop skill, your own scripts, or our hosted reviewer. Whatever speaks the API qualifies. The agent runs detectors, surfaces flag batches, dequeues author directives, drafts candidates, posts them back, advances state.
- **Browser (steering surface)** is where the writing happens *as steering*. The author sweeps batches of flags, gives shape directives, reviews returning candidates, accepts or re-directs. Accept / reject / edit / mark-deliberate / sweep-batch / submit-directives all live here.
- **Writer (human)** holds the wheel. They define shape, react to drafts, decide what ships. The work is theirs; the agent is the keyboard. The author can also drive from the terminal via the agent directly when convenient - the browser and the terminal are equivalent surfaces onto the same state.

This is the default flow. The browser-only paste-and-fix interface still exists as a fallback for users without an agent, but the project is designed agent-first.

The Rung 1 layer is intentionally portable: the catalogue + regex detectors + scoring will be extractable as a standalone library other prose tools can vendor. Commercial / pricing model is not yet decided and is intentionally left out of this document; do not encode tier assumptions into the architecture.

## Data model (planned for the hosted side)

Source-of-truth entities the API exposes:

- **Document**: source markdown, title, owner, word count, source hash (sha-256), version counter, created/updated timestamps. Source state has a small ring buffer of prior versions so revert is cheap.
- **Flag**: an instance of a catalogued pattern at a specific anchor in a document. Carries `patternId`, `anchor` (start+end+prefix+suffix for relocation), `rung`, `severity`, `rationale`, current `status` (open / awaiting-accept / resolved / skipped / kept-deliberate / stale), and `source` (`mechanical` for server regex hits, `llm` for agent-detected via `POST /docs/:id/flags`, `user` for human-contributed).
- **Response**: an author-issued directive on a flag (free text or a common-case shortcut: *more committal*, *drop the qualifier*, *punchline first*, *cut to the verb*, *let me try: <text>*, *skip*, *keep*). Each user choice persists immediately - no batch submit. Status: `pending` (waiting for agent) / `resolved` (agent posted a candidate) / `stuck` (agent gave up via punt) / `cancelled` (user rescinded). The trail of responses per flag is the steering history.
- **Suggestion**: a candidate edit attached to a flag. Two origin paths: in response to a directive (`respondedTo` set), or as an inline candidate the agent bundles with a flag at detection time (`respondedTo` absent - the flag goes straight to `awaiting-accept`). Carries `pre` (the originally-anchored text), `post` (the candidate), the model tag, optional prompt context. Per-flag candidates do not mutate the source - the browser renders them as overlays over the anchor span. They land in the source only when the user explicitly clicks accept.
- **Comment**: free-form thread on a flag (or on a document). Used for human-to-agent coordination and for capturing why a flag was kept deliberately or why the agent punted.
- **Resolution event**: append-only log of state transitions on flags, responses, and source. The companion document at session end is rendered from this log.

The existing client-side `doc.ts` reactive store and `textAnchor.ts` anchor scheme are the prototypes for the document/flag/anchor parts of this model. The server reuses `src/anchoring/textAnchor.ts` and `src/detectors/index.ts` directly so client and server share the same anchor relocation and detection logic.

## API surface

Bun-based HTTP server in `server/`. File-based persistence via `DiskStore` (per-doc `state.json` + `events.ndjson`). The doc UUID is the capability - anyone with the URL can drive the session, no separate auth header. SSE primary listen channel; long-poll fallback.

```
# document lifecycle
POST   /docs                          { source, title? } -> { id, sourceHash, eventsUrl }
GET    /docs/:id                      -> { doc, counts, score, flags, sourceHash }
PUT    /docs/:id/source               { source }   # If-Match: <hash>; runs reconcile
POST   /docs/:id/source/revert        { toVersion? }   # rolls back to a stored prior version
DELETE /docs/:id

# detection
POST   /docs/:id/run-detectors        # Rung 1 server-side regex
                                      -> emits flag-added events; returns flag list
POST   /docs/:id/flags                # agent-side LLM detection (BYOM)
                                      { flags: [{ patternId, start?, end?, text,
                                                  rationale, severity?,
                                                  suggestion? }],
                                        modelTag, source? }
                                      # If-Match: <hash>; relocates anchors;
                                      # dedupes; flags with `suggestion` go
                                      # straight to awaiting-accept.

# user side: every choice is a Response, fired immediately
POST   /docs/:id/responses            { flagId, body, kind: 'shortcut'|'free'|'let-me-try'|'skip'|'keep' }
                                      -> Response (status=pending). Server self-resolves
                                      skip/keep/let-me-try without agent involvement.
POST   /docs/:id/responses/:rid/cancel
GET    /docs/:id/responses            # agent pulls work, with catalogue filters
                                      ?status=pending
                                      &rung=1[,2,3]
                                      &category=lexical[,structural,argumentative]
                                      &severity=primary[,high,medium,low]
                                      &patternId=tier1-lexicon[,...]
                                      &limit=N
POST   /docs/:id/responses/:rid/punt  { reason }     # agent gave up; status=stuck

# user-set agent direction (advisory; agent honours by convention)
GET    /docs/:id/agent-hints          -> { rungs?, categories?, severities?, patternIds?, paused? }
PUT    /docs/:id/agent-hints          { rungs?, categories?, severities?, patternIds?, paused? }

# agent side: post resolutions (one of the two paths per fix)
POST   /docs/:id/resolutions          { patches: [...], fullSource?: {...}, modelTag, notes? }
                                      # If-Match: <hash>; transactional batch.
                                      # Per-flag patch fields: { respondedTo, flagId,
                                      #   anchor: {start, end, replacementText} }.
                                      # FullSource fields: { respondedTo: [rid,...], source }.
                                      # Single fullSource per batch (multiples redundant).
                                      # Patches must lie within their flag's anchor window
                                      # or the call rejects 422.

# user side: act on awaiting-accept candidates
POST   /docs/:id/flags/:fid/accept    # apply the per-flag patch, mutate source, close flag
POST   /docs/:id/flags/:fid/discard   # drop the awaiting-accept candidate, flag stays open
POST   /docs/:id/flags/:fid/skip
POST   /docs/:id/flags/:fid/keep-deliberate
POST   /docs/:id/flags/:fid/comments  { body, author? }

# read-only / context
GET    /docs/:id/voice-samples?n=20   # derived from accepted suggestions; agent fetches as
                                      # few-shot voice calibration on each work cycle
GET    /docs/:id/companion            # resolution log + final source
GET    /catalogue                     # patterns + categories (no auth)
GET    /health

# event stream
GET    /docs/:id/events               # SSE; supports Last-Event-ID / ?since=N
GET    /docs/:id/events/poll?since=N&timeout=30000
```

Every state-changing endpoint appends a `ResolutionEvent` to the doc's events log and bumps `doc.version`. Subscribers on the SSE stream get the event in <100ms (in-memory pub/sub via `server/bus.ts`).

**Hash-based concurrency.** Every source-mutating call (`PUT /source`, `POST /resolutions`) requires `If-Match: <sha-256-of-current-source>`. Server returns 412 if the hash has moved. Standard ETag pattern; prevents agents from clobbering user edits made in the interim.

**Reconciliation is uniform.** Every source mutation, regardless of trigger (agent fullSource push, user accept of a per-flag patch, user paste-edit, revert), runs the same pass: re-anchor every open flag; mark relocated-with-changed-text flags as resolved (auto-resolves any pending response on them with `respondedBy: source-edit`); mark unrelocatable flags stale (cancels pending responses on them); re-run Rung 1 detectors on changed regions to emit any new flags.

**The two resolution paths.** The agent picks per fix:
- *Per-flag patch* (Rung 1/2, common case): edit fits within the flag's anchor window. Server stores the candidate as a Suggestion, flag goes to `awaiting-accept`, source is unchanged. Browser renders as inline overlay; user accepts or re-directs.
- *Full-source push* (Rung 3 editorial): edit needs to span beyond a single anchor. Agent pushes the full updated markdown. Source mutates immediately, reconcile runs, prior version retained for revert. Browser surfaces the new doc with a "revert last push" affordance.

**API is indifferent on multi-agent.** The recommended workflow is one agent at a time, but the API doesn't enforce it. Two agents racing on resolutions just lose to each other on the `If-Match` check; the loser refetches and tries again.

The API is the contract; the browser UI and any agent skill (Claude Code, Codex, opencode, custom scripts) are all clients of it. Anything one can do, the other can do.

## The score

The 0-10 score is computed from **Rung 1 hits only**. A score of 10 means the piece has no detectable Rung 1 slop. Rationale: Rung 2 and Rung 3 are reading-comprehension work; reducing them to a number would flatter the score in ways that would feel like progress without being it. The score is a Rung 1 milestone, not a verdict on the piece. Rung 2 and Rung 3 counts are reported separately on the analyse view.

## Cross-cutting metadata

Every pattern carries five super-category tags. They are independent axes; a pattern can be filtered by any combination.

| Tag | Values | What it means |
|---|---|---|
| `rung` | 1 / 2 / 3 | Depth of the pattern (mechanical / sentence / structural). Drives the workflow. |
| `mechanical` | boolean | Detection difficulty. True = regex-friendly. |
| `scope` | word / phrase / sentence / paragraph / piece | Operating scope on the prose. |
| `category` | lexical / structural / argumentative / tonal / format | The five high-level categories from the original DESLOP-GUIDE. |
| `severity` | primary / high / medium / low | How hard it pulls down the score and how aggressively to flag it. |

The catalogue UI (`/categories`) lets users filter on all five.

## Voice / writing style across the project

When writing prose for this project (essays in `patterns.ts` and `categories.ts`, copy on the pages, the about page, this CLAUDE.md):

- **Direct without being cruel.** Insult the *pattern* and the model that produces it; not the writer who fell into it. Phrases like "this happens to anyone with enough exposure to corporate writing" land better than "you should be ashamed."
- **Plain words, varied sentence length.** The meta-tic is evenness; sand it down deliberately.
- **Funny where the pattern is funny.** "A fortune cookie that lost its ticker." "An uncle's kitchen drawer full of dashes." "The literary equivalent of a politician saying we need to have a conversation."
- **Always useful.** Every essay should land what the pattern is, why the model produces it, and what the fix looks like.

The reference voice is the DESLOP-GUIDE itself in ``, plus the early ruminations on ``. When examples are sourced from real prose (the way several Rung 2 examples were), generalise so the source is unidentifiable.

## Guard

Live deploys ship the catalogue, the rungs page, and the about page open. The interactive surfaces - `/` (analyse) and `/d/:id` (online doc) - are gated behind a guard while the product is unfinished.

`src/state/guard.ts` exposes `isUnlocked()`, true when:
- The hostname is `localhost` / `127.0.0.1` / `*.localhost`, or
- `sessionStorage.slopmop.work === '1'` (set the first time the user visits with `?work` in the URL; the param is stripped on bootstrap so it doesn't stick around in shared links)

Gated pages (`AnalyzePage`, `OnlineDocPage`) render `LockedNotice` when locked and the full UI otherwise. Adding new gated surfaces: import `isUnlocked` and `LockedNotice`, render the notice on `!isUnlocked()`. Do not gate the catalogue, rungs, or about - those carry the methodology and stay public.

## What does NOT belong here

- **No batch auto-fixing.** Every change is the author's. Even Rung 1 fixes are confirmed one at a time.
- **No score for Rung 2 / Rung 3.** They are reported as counts, not folded into the 0-10.
- **No autonomous Rung 3 rewriting.** Slopmop flags positions; the rewrite is collaborative, by design.
- **No bypass of the API.** The browser UI and any agent skill are all clients of the same API surface. If something works in one but not the other, the API is incomplete.

## File layout

```
src/
  catalog/
    categories.ts       # 5 categories with essays
    patterns.ts         # 24 patterns with full metadata + essays
  detectors/
    index.ts            # all Rung 1 mechanical detectors
    skipZones.ts        # code-block / blockquote exclusions
  anchoring/
    textAnchor.ts       # robust text anchors (prefix+suffix)
    domHighlight.ts     # DOM walker for injecting <mark> spans
  pages/
    AnalyzePage.vue     # paste-and-fix interface
    CategoriesPage.vue  # poster-grid catalogue with filters
    CategoryPage.vue    # per-category long-form
    PatternPage.vue     # per-pattern detail
    RungsPage.vue       # the framework explainer
    AboutPage.vue       # how to use, what lives where
    NotFoundPage.vue
  components/
    ArticleView.vue     # markdown render + highlight overlay
    FlagsPanel.vue      # right-side panel grouped by category
    UserHighlightDialog.vue
    ThemePicker.vue
  state/
    doc.ts              # source + flags reactive store
    theme.ts
  styles/
    tokens.css          # CSS variable contract
    base.css
    themes/
      normal.css        # clean modern
      magic.css         # fairyland: pastel sunshine, sky-castles, sparkles
      scholar.css       # antique monograph: parchment, Fraktur drop cap
  router.ts
  types.ts              # PatternMeta, CategoryMeta, Rung, Scope, Flag, Suggestion, etc.
  main.ts

server/                 # Bun-based API. Imports src/anchoring + src/detectors directly.
  main.ts               # Bun.serve entry, route dispatch, static file serving
  shared.ts             # json/notFound helpers
  auth.ts               # Bearer-token check
  bus.ts                # in-memory per-doc pub/sub for SSE
  types.ts              # DocState, DocRecord, NewDocInput
  store/
    index.ts            # DocStore interface + factory
    disk.ts             # DiskStore: state.json + events.ndjson
  routes/
    docs.ts             # /docs, /docs/:id, source, run-detectors, companion
    flags.ts            # /docs/:id/flags + per-flag actions
    events.ts           # SSE + long-poll
    catalogue.ts        # read-only catalogue dump

.claude/skills/slopmop/  # the workshop loop as an agent skill
  SKILL.md              # protocol document
  README.md             # install/use

.do/app.yaml            # DigitalOcean App Platform spec (basic-xxs)
Dockerfile              # multi-stage: Node frontend build + Bun runtime
```

## Adding a pattern

1. Decide the rung. Use depth, not detection difficulty: if the fix is "substitute or cut", it's Rung 1. If the fix is "rewrite the sentence with options", Rung 2. If the fix touches the whole piece, Rung 3.
2. Pick a category from the existing five. If a pattern doesn't fit, push back rather than create a sixth.
3. Add the entry to `src/catalog/patterns.ts` with all required fields: `id`, `category`, `name`, `severity`, `scope`, `rung`, `mechanical`, `blurb`, `whyItsSlop`, `fix`, `examples`. Optional: `essay`, `subShapes`, `skipRule`, `shortName`.
4. If `mechanical: true`, add a detector function in `src/detectors/index.ts` and register it in `ALL_DETECTORS`. Add a severity weight in `severityFor`. Consider whether the pattern deserves a score ceiling.
5. Verify in the browser: navigate to `/patterns/<id>` and check the page renders. Check the catalogue grid. Check the filter chips count correctly.

## Removing a pattern

The catalogue is curated, not exhaustive. A pattern earns its place by being **distinctly produced by current LLM training** and **distinctly annoying** when it appears. Real human rhetorical devices that the model overuses (tricolons, anaphora, orphan punchlines, tables of contents) do not belong here even though the model abuses them. The criterion is "would a hostile reader clock this as AI?", not "is this bad writing?".

When in doubt: cut.

## Inspirations

- `/DESLOP-GUIDE.md` - the canonical pattern catalogue this project generalises from.
- `/.claude/commands/workshop.md` - the interactive one-flag-at-a-time author-driven editing loop. Rung 1 borrows the shape; Rung 2 borrows the BETTER/WORSE/CLOSE evaluation; Rung 3 is the workshop, basically.
- `/.claude/commands/chief-edit.md` - the ship gate. Rung 3 patterns are roughly what chief-edit catches.
- `` - source for several anonymised real-world Rung 2 example sentences.
