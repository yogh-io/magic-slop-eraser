# slopmop

A hosted online AI-slop detector and guided fixer. Prose in, flagged article out, walked through fix-by-fix - the writing happens in a *paired loop*: the author defines shape, the agent drafts the prose, and the author's taste enters every step. The browser is the steering surface; an agentic coding tool (Claude Code, Codex, opencode, your own scripts, or our hosted reviewer) is the keyboard.

This file is the framework definition. Read it before working on the catalogue, the detectors, the analyse view, the API, or the architecture.

## What this project is

Slopmop runs in two modes:

- **Brush (default).** The reader reads the article in the browser, highlights any passage that bothers them, and types a sentence about why. Each highlight becomes a user-sourced flag carrying the reader's complaint as `userNote`. The drafter discovers these flags, drafts ~3 candidate fixes per flag, and posts them back as a carousel. The reader picks one, accepts, source mutates. No catalogue walk required.
- **Scan (opt-in).** The drafter walks the curated catalogue against the source, posts flags by `patternId`, and runs the paired writing loop the author drives with shape directives ("more committal", "punchline first"). Scan runs when the author invokes it - terminal prompt, agent hint, or a UI button - not automatically on every session.

The two coexist on every doc; the panel surfaces brush flags ("reader concerns") separately from catalogue flags. The catalogue score is a *catalogue* score and does not reflect brush flags.

The catalogue is a generalisation of in-house deslop infrastructure first built for analytical-prose work, itself derived from the patterns one notices when one has read enough LLM output to be annoyed by it.

The catalogue organises every pattern into one of three **rungs**, ordered by *depth* (the *fix-shape* the pattern requires). Rung 1 is the bottom (lexical, word-and-phrase swap) and Rung 3 is the top (structural, whole-piece editorial rewrite). The rung governs the user-facing scan workflow; brush flags live outside the rung structure (the reader doesn't classify).

The numbering is **layer, not order**. In scan mode, an agent or author picks the entry rung based on the draft's stage: a structurally clean draft starts at Rung 1 and climbs up; a tangled draft starts at Rung 3 and works down so polish does not get spent on prose about to be cut.

**Detection is the drafter's job at every rung in scan mode.** All slopmop *catalogue* patterns are LLM-detected. The catalogue is the spec; the drafter (a Claude Code session, primarily) walks it against the source, applies each pattern's `skipRule` for context, and posts flags via `POST /docs/:id/flags`. In brush mode, the *reader* is the detector - the drafter just drafts candidates that respond to the reader's complaint. The server stores documents, flags, and the steering-loop state. It does not read prose.

## The three rungs

### Rung 1 - lexical (bottom)

- **Scope**: word and phrase. The dead AI vocabulary, throat-clearing openers, vague-gravitas closers, the mirror construct as a syntactic shape.
- **Fix**: substitution or cut. Most fixes are one or two characters. The pattern says what to do; the drafter proposes the substitution; the author takes it, edits it, or rejects it.
- **Workflow**: the simplest form of the steering loop. The drafter surfaces a batch of flags with substitutions proposed for each (inline `suggestion` field on the flag); the author sweeps with yes / cut / edit / skip / keep, often resolving most in a single pass. Lexical patterns rarely need re-direction - the substitution either lands or it does not.
- **Patterns currently here**: `tier1-lexicon`, `throat-clearing`, `closers`, `enthusiasm-inflation`, `vague-gravitas`, `suffocation` (stacked hedges), `antithesis` (mirror construct), plus the Rung 1 `craft` patterns `redundancy`, `latinate`, `terminal-preposition`.

### Rung 2 - passage-level judgment (middle)

- **Scope**: a sentence, or a small cluster of two or three sentences, in paragraph context. The patterns here are structural, not lexical: a passage whose subject is unnamed, a closer that synthesises nothing, a paragraph that walks across both sides without committing.
- **Fix**: rewriting the passage with one or more candidate forms. Sometimes a single word changes, sometimes the whole sentence is reshaped, sometimes a small cluster is rebuilt. Author picks one, customises, or rejects. Always reversible.
- **Workflow**: a *steering loop*, batched. The drafter posts one or more candidates per flag (one when the directive is unambiguous, two or three when it admits real alternatives); the author sweeps with shape directives ("more committal", "drop the qualifier", "punchline first", "cut to the verb"); the drafter re-attempts each in the background; the author re-engages and re-directs until the sentence lands. BETTER / WORSE / CLOSE is fuel for the next iteration, not a final ranking. No batch auto-fix - every accept is the author's.
- **Patterns currently here**: `absent-actor`, `allusive-construct`, `staccato` (clipped asyndeton - dropped conjunctions and fragment-punches), `hedged-confidence`, `synthesis-of-nothing`, `performative-balance`, plus the Rung 2 `craft` pattern `passive-voice`.

### Rung 3 - presentation / editorial (top)

- **Scope**: the piece as a piece. The question is whether its substance - the actual arguments, values, internal merits of what is being said - is coming through to the reader. Frame stacking buries the thesis under preamble; performative balance dilutes the position into nothing; header inflation pads scaffolding where the argument should carry weight. These are the moves a chief editor catches on the second read.
- **Fix**: substantial rewrite focused on what the piece is *saying*, not just where it sits on the page. Outside the scope of an autonomous fixer. Slopmop flags positions where the presentation of the content needs reworking and gets out of the way.
- **Workflow**: the same batched steering loop, applied to larger units (a section, a transition, the opening, the close). Slower cycles - the drafter reads the surrounding piece between turns - but the shape is identical: the author defines what the section is supposed to *do*, the drafter drafts the prose, the author re-directs. Rung 3 in slopmop is positioned as the entry point to that kind of workflow (interactive multi-pass diagnostics + author-driven rewriting; a separate chief-edit / ship-gate pass for the close and the preamble).
- **Patterns currently here**: `frame-stacking`, `kicker-paraphrase`, `redundant-abstraction`, `lens-fits-everything`.

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
- **BETTER / WORSE / CLOSE is a steering wheel, not a scorecard.** Per flag, the candidate trail records *direction of travel*, not a final ranking. A verdict on the latest candidate is fuel for the next nudge.

Rung 1 is the simplest form (one substitution, one verdict, often resolvable in the same sweep). Rung 2 is the canonical form (multiple shape-nudges per flag until the sentence lands, sometimes across two or three sweeps). Rung 3 is the loop applied to whole sections, with the agent reading the surrounding piece between turns.

## Architecture: the hosted site + agent loop

Slopmop is **an online site, not a local app**. It stores prose, comments, suggestions, anchors, and resolution history. It exposes an API for agents to push and pull edits and analysis.

The shape:

- **Site (server)** is the source of truth. It owns documents, flags, comment threads, suggestion candidates, resolution states, version history, and the queue of pending directives.
- **Drafter** is an agentic coding tool (Claude Code primarily; Codex, opencode, your own scripts also qualify) carrying the slopmop skill. Two loops: a **brush loop** (pull user-sourced flags via `GET /flags?source=user&status=open`, draft ~3 candidates per flag, post via `POST /resolutions` with `replacementTexts: [...]` and no `respondedTo`), and a **scan loop** (catalogue analysis + author-directive resolution - what slopmop did before brush).
- **Browser (steering surface)** is where the writing happens *as steering*. The reader brushes (highlight + complain) by default; the author also sweeps catalogue flags when scan has run, gives shape directives, reviews returning candidates, accepts or re-directs. Accept / reject / edit / mark-deliberate / sweep-batch / submit-directives all live here.
- **Writer (human)** holds the wheel. They define shape, react to drafts, decide what ships. The work is theirs; the agent is the keyboard. The author can also drive from the terminal via the agent directly when convenient - the browser and the terminal are equivalent surfaces onto the same state.

There is no server-side detection. Brush flags come from the reader; scan flags come from the drafter walking the catalogue. The browser without a drafter attached lets the reader brush all day - those flags queue at `status: 'open'` until a drafter shows up; the page communicates that neutrally ("queued - attach a drafter to draft fixes"). Scan happens only when invoked.

The catalogue is intentionally portable: a curated list of pattern entries with `whyItsSlop` / `fix` / `examples` / `skipRule` plus the rung classification. Other prose tools can vendor it as a prompt-spec library; the implementation that matters is whatever drafter walks the catalogue against the source. Commercial / pricing model is not yet decided and is intentionally left out of this document; do not encode tier assumptions into the architecture.

## Data model (planned for the hosted side)

Source-of-truth entities the API exposes:

- **Document**: source markdown, title, owner, word count, source hash (sha-256), version counter, created/updated timestamps. Source state has a small ring buffer of prior versions so revert is cheap.
- **Flag**: an anchored point of attention. Two shapes:
  - *Scan flag* (`source: 'llm'`): an instance of a catalogued pattern. Carries `patternId`, `category`, `rung`, `severity`, `rationale`, `anchor` (start+end+prefix+suffix for relocation), `status`.
  - *Brush flag* (`source: 'user'`): a reader-raised concern. Carries `anchor`, `userNote` (the complaint), `severity` (defaulted), `status`. `patternId`, `category`, `rung` are absent - brush flags live outside the catalogue.
  - Common status values: open / awaiting-accept / resolved / skipped / kept-deliberate / stale.
- **Response**: an author-issued directive on a flag (free text or a common-case shortcut: *more committal*, *drop the qualifier*, *punchline first*, *cut to the verb*, *let me try: <text>*, *skip*, *keep*, *accept*, *discard*). Each user choice persists immediately - no batch submit. Status: `pending` (waiting for agent) / `resolved` (agent posted candidate(s)) / `stuck` (agent gave up via punt) / `cancelled` (user rescinded). Carries `resolvedSuggestionIds: string[]` once resolved - multi-element when the drafter posted >1 candidate per flag. Scan flows always create a Response; brush flows skip Responses entirely (the flag's `userNote` *is* the directive) and the drafter resolves the flag directly via `POST /resolutions`.
- **Suggestion**: a candidate edit attached to a flag. Multiple Suggestions per flag is normal (brush always; scan when the directive admits real alternatives). Two origin paths: in response to a directive (`respondedTo` set, scan mode), or attached directly to a brush flag (`respondedTo` absent). Carries `pre` (the originally-anchored text), `post` (the candidate), the model tag, optional prompt context. Per-flag candidates do not mutate the source - the browser renders them as a carousel over the anchor span. The reader accepts a specific one (`POST /responses { kind: 'accept', flagId, suggestionId }`), which mutates the source; sibling candidates stay as history.
- **Comment**: free-form thread on a flag (or on a document). Used for human-to-agent coordination and for capturing why a flag was kept deliberately or why the agent punted.
- **Resolution event**: append-only log of state transitions on flags, responses, and source. The companion document at session end is rendered from this log.

The existing client-side `doc.ts` reactive store and `textAnchor.ts` anchor scheme are the prototypes for the document/flag/anchor parts of this model. The server reuses `src/anchoring/textAnchor.ts` directly so client and server share the same anchor relocation logic.

## API surface

Bun-based HTTP server in `server/`. Persistence is one JSON blob per doc holding the entire `DocState` (source, flags, suggestions, responses, comments, history, agent activity, event log). Two interchangeable backends: `DiskStore` for local dev (writes to `STORAGE_DIR`) and `S3Store` for production (any S3-compatible store - DigitalOcean Spaces, Cloudflare R2, Backblaze B2, AWS - selected when `S3_BUCKET` is set). Sessions expire purely via the bucket's own lifecycle policy: configure "delete objects untouched for 72 hours". No sweeper code. The doc UUID is the capability - anyone with the URL can drive the session, no separate auth header. SSE primary listen channel; long-poll fallback.

```
# document lifecycle
POST   /docs                          { source, title? } -> { id, sourceHash, eventsUrl }
GET    /docs/:id                      -> { doc, counts, score, flags, sourceHash }
PUT    /docs/:id/source               { source }   # If-Match: <hash>; runs reconcile
POST   /docs/:id/source/revert        { toVersion? }   # rolls back to a stored prior version
DELETE /docs/:id

# flag creation - two shapes via `source` discriminator
# scan (drafter posts catalogue-matched flags, BYOM detection):
POST   /docs/:id/flags                { source: 'llm', modelTag, flags: [{
                                          patternId, text, start?, end?,
                                          rationale, severity?, suggestion? }] }
# brush (reader posts a complaint about a highlighted passage):
POST   /docs/:id/flags                { source: 'user', modelTag: 'reader', flags: [{
                                          text, start?, end?,
                                          userNote, severity? }] }
                                      # If-Match: <hash>; relocates anchors.
                                      # Scan: patternId required, validated against
                                      # catalogue. Optional `suggestion` lands flag
                                      # in awaiting-accept.
                                      # Brush: patternId rejected, userNote required.
                                      # Flag goes to status:open; drafter responds
                                      # later via /resolutions.

# flag discovery
GET    /docs/:id/flags                # filters: rung, status, source=user|llm

# user side: every choice is a Response, fired immediately
POST   /docs/:id/responses            { flagId, body, kind, suggestionId? }
                                      # kind: 'shortcut' | 'free' | 'let-me-try' |
                                      #       'skip' | 'keep' | 'accept' | 'discard'
                                      # Server self-resolves skip/keep/let-me-try/
                                      # accept/discard without agent involvement.
                                      # suggestionId: required on `accept`/`discard`
                                      # when flag has >1 unaccepted candidates;
                                      # optional otherwise (single-candidate auto-picks).
POST   /docs/:id/responses/:rid/transition  { to: 'stuck' | 'cancelled', reason? }
GET    /docs/:id/responses            # agent pulls scan work; filters:
                                      ?status=pending
                                      &rung=1[,2,3]
                                      &category=lexical[,structural,argumentative]
                                      &severity=primary[,high,medium,low]
                                      &patternId=tier1-lexicon[,...]
                                      &limit=N

# user-set agent direction (advisory; agent honours by convention)
GET    /docs/:id/agent-hints          -> { rungs?, categories?, severities?, patternIds?, paused? }
PUT    /docs/:id/agent-hints          { rungs?, categories?, severities?, patternIds?, paused? }

# agent side: post resolutions (one of the two paths per fix)
POST   /docs/:id/resolutions          { patches: [...], fullSource?: {...}, modelTag, notes? }
                                      # If-Match: <hash>; transactional batch.
                                      # Per-flag patch fields: { flagId, replacementTexts: string[],
                                      #   respondedTo?, prompt? }.
                                      # `replacementTexts` length >= 1 (brush always ~3,
                                      # scan typically 1, sometimes more). Legacy
                                      # `replacementText: string` is accepted and
                                      # normalised to a one-element array.
                                      # `respondedTo` is required for scan flags
                                      # (answers a Response), absent for brush flags
                                      # (no preceding Response).
                                      # FullSource fields: { source, respondedTo: [rid,...] }.
                                      # Single fullSource per batch.

POST   /docs/:id/flags/:fid/comments  { body, author? }  # only flag-scoped verb that remains
                                      # accept/discard/skip/keep moved to POST /responses with
                                      # the matching `kind`; legacy per-flag verbs return 405.

# read-only / context
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

The 0-10 score is computed from **all live catalogue flags across all three rungs** (`source: 'llm'`, status open + awaiting-accept). Brush flags don't feed the score - it's a *catalogue* score, not a "stuff readers dislike" tally. The panel header surfaces brush flag count separately as "N reader concerns".

Per-flag `severity` is the load-bearing input - the drafter sets it at flag-detection time, weighted subjectively per instance by the detection subagent (a deliberate move scores low even if it matches a catalogued pattern). The server aggregates: density-based math, with pattern-specific ceilings for the worst offenders.

`scoreFromFlags` in `src/detectors/index.ts` returns:
- `value` - the 0-10 number
- `rationale` - one-sentence summary ("Noticeable slop. (R1 4 / R2 2). Dominant tics: throat-clearing (3), ...")
- `byRung` - per-rung `{ count, weighted }` so the UI can show where the slop is
- `topContributors` - per-pattern `{ patternId, count, weighted }`, weight-sorted, all of them

`GET /docs/:id` returns the full structure. The session-page UI shows the score as a clickable pill; click it for the breakdown panel (per-rung cells, per-pattern bars). Resolved flags drop out; the score updates as the author sweeps.

## Cross-cutting metadata

Every pattern carries four super-category tags. They are independent axes; a pattern can be filtered by any combination.

| Tag | Values | What it means |
|---|---|---|
| `rung` | 1 / 2 / 3 | Depth of the fix (lexical / sentence / structural). Drives the workflow. |
| `scope` | word / phrase / sentence / paragraph / piece | Operating scope on the prose. |
| `category` | lexical / structural / argumentative / craft | The first three are AI tells (the original DESLOP-GUIDE axes). `craft` is the one relaxed-bar category: plain-English faults that aren't distinctly-AI but a human editor still cuts (padding, fancy words, passive voice, limp closes). |
| `severity` | primary / high / medium / low | A nominal weight; overridable per-flag at detection time by drafter judgement. |

The catalogue UI (`/categories`) lets users filter on all four.

## Voice / writing style across the project

When writing prose for this project (essays in `patterns.ts` and `categories.ts`, copy on the pages, the about page, this CLAUDE.md):

- **Direct without being cruel.** Insult the *pattern* and the model that produces it; not the writer who fell into it. Phrases like "this happens to anyone with enough exposure to corporate writing" land better than "you should be ashamed."
- **Plain words, varied sentence length.** The meta-tic is evenness; sand it down deliberately.
- **Funny where the pattern is funny.** "A fortune cookie that lost its ticker." "An uncle's kitchen drawer full of dashes." "The literary equivalent of a politician saying we need to have a conversation."
- **Always useful.** Every essay should land what the pattern is, why the model produces it, and what the fix looks like.

The reference voice lives in the DESLOP-GUIDE this project generalises from. When examples are sourced from real prose (the way several Rung 2 examples were), generalise so the source is unidentifiable.

## What does NOT belong here

- **No batch auto-fixing.** Every change is the author's. Even Rung 1 fixes are confirmed one at a time.
- **No server-side detection.** The drafter does all detection. The server stores documents, flags, and orchestrates the steering loop.
- **No autonomous Rung 3 rewriting.** Slopmop flags positions; the rewrite is collaborative, by design.
- **No bypass of the API.** The browser UI and any drafter skill are all clients of the same API surface. If something works in one but not the other, the API is incomplete.

## File layout

```
src/
  catalog/
    categories.ts       # 4 categories with essays (lexical, structural, argumentative, craft)
    patterns.ts         # 21 patterns with full metadata + essays
  detectors/
    index.ts            # scoring helpers (severityFor, scoreFromFlags); detection itself is drafter-side
    skipZones.ts        # code-block / blockquote exclusions (used for word-count and as drafter context)
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
    ArticleView.vue     # markdown render + highlight overlay; emits @selection-change for brush
    BrushComposer.vue   # floating composer that appears near the reader's selection - captures a userNote and posts a brush flag
    FlagsPanel.vue      # (legacy / unused) category-grouped flag list; OnlineDocPage renders flags in its own gutter
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
  auth.ts               # fail() helper (no auth - doc UUID is the capability)
  bus.ts                # in-memory per-doc pub/sub for SSE
  types.ts              # DocState, DocRecord, NewDocInput, appendEvents helper
  store/
    index.ts            # DocStore interface + factory (S3 if S3_BUCKET, else Disk)
    disk.ts             # DiskStore: one state.json blob per doc on local fs
    s3.ts               # S3Store: one JSON blob per doc on any S3-compatible bucket
  routes/
    docs.ts             # /docs, /docs/:id, source, companion, agent-hints
    flags.ts            # /docs/:id/flags (POST: drafter-side detection) + per-flag actions
    events.ts           # SSE + long-poll
    catalogue.ts        # read-only catalogue dump (the drafter's detection spec)

.claude/skills/slopmop/  # the workshop loop as an agent skill
  SKILL.md              # protocol document
  README.md             # install/use

fixtures/
  deslop-demo/          # a worked example - the slopmop loop performed by hand
    source.md           # anonymised slop specimen (the "before")
    walkthrough.md      # the brush loop: each flag's complaint -> pattern -> rewrite, plus the "after"

.do/app.yaml            # DigitalOcean App Platform spec (basic-xxs)
Dockerfile              # multi-stage: Node frontend build + Bun runtime
```

## Adding a pattern

1. Decide the rung. Use fix-shape: if the fix is "substitute or cut a word/phrase", it's Rung 1. If the fix is "rewrite the sentence with options", Rung 2. If the fix touches the whole piece, Rung 3.
2. Pick a category from the existing four (`lexical`, `structural`, `argumentative`, `craft`). If an AI tell doesn't fit the first three, push back rather than create a new one; a pure-craft fault goes in `craft`.
3. Add the entry to `src/catalog/patterns.ts` with all required fields: `id`, `category`, `name`, `severity`, `scope`, `rung`, `blurb`, `whyItsSlop`, `fix`, `examples`. Optional: `essay`, `subShapes`, `skipRule`, `shortName`. Make `whyItsSlop` and `skipRule` strong - those are what the drafter reads as its detection spec.
4. Add a severity weight in `src/detectors/index.ts:severityFor` if the pattern is severe enough to deserve more than the 0.6 default. Consider whether the pattern deserves a score ceiling in `scoreFromFlags`.
5. Verify in the browser: navigate to `/patterns/<id>` and check the page renders. Check the catalogue grid. Check the filter chips count correctly.

## Removing a pattern

The catalogue is curated, not exhaustive. A pattern earns its place by being **distinctly produced by current LLM training** and **distinctly annoying** when it appears. Real human rhetorical devices that the model overuses (tricolons, anaphora, orphan punchlines, tables of contents) do not belong here even though the model abuses them. The criterion is "would a hostile reader clock this as AI?", not "is this bad writing?".

When in doubt: cut.

**The one exception is the `craft` category.** It deliberately relaxes the AI-clockable bar to house plain-English faults - padding, fancy words, passive voice, a limp close - the things a human editor cuts whoever wrote the draft. The bar there is "would a plain-English editor cross this out?", and the category essay says so out loud. Keep the relaxation quarantined: a new pattern that is just "bad writing" belongs in `craft` or nowhere. The other three categories stay pure AI tells. If a fault is *both* a craft fault and a distinct AI tell (e.g. `staccato`), file it by its sharper edge - `staccato` is a structural AI tell, not craft, because the clipped asyndetic rhythm is itself a giveaway.

## Inspirations

- A prior DESLOP-GUIDE from in-house analytical-prose work - the canonical pattern catalogue this project generalises from.
- An interactive one-flag-at-a-time author-driven editing loop carried over from the same source - Rung 1 borrows the shape, Rung 2 borrows the BETTER/WORSE/CLOSE evaluation, Rung 3 is that workshop, basically.
- A chief-edit / ship-gate pass - Rung 3 patterns are roughly what such a pass catches.
- Several anonymised real-world sentences sourced from public ruminations and generalised so the source is unidentifiable.
