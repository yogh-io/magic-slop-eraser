# slopmop

A hosted AI-slop detector and guided fixer. Paste prose in, get a flagged
article out, walk through the fixes one at a time. The writing happens in
a *paired loop* - the author defines shape, an agent drafts the prose,
the author's taste enters every step.

The browser is the steering surface. An agentic coding tool (Claude
Code, Codex, opencode, your own scripts) is the keyboard.

Live at **[slop.rip](https://slop.rip)**.

## What it does

Slopmop has a curated catalogue of patterns that current LLMs distinctly
over-produce: the dead vocabulary (`delve`, `tapestry`, `landscape`),
throat-clearing openers, vague-gravitas closers, the mirror-construct
sentence shape, absent-actor passive constructions, paragraphs that walk
across both sides without committing, frame-stacking before the thesis.
The criterion is "would a hostile reader clock this as AI?", not "is
this bad writing?" - human rhetorical devices that the model abuses
(tricolons, anaphora) do not belong here even when they're overused.

Every catalogued pattern lives at one of three rungs, ordered by the
depth of the fix it requires:

- **Rung 1 - lexical.** Word and phrase. The fix is substitution or
  cut, usually a few characters. The drafter proposes; the author
  accepts, edits, or rejects in a single pass.
- **Rung 2 - passage-level.** A sentence or a small cluster, in
  paragraph context. The fix is rewriting with one or more candidates.
  The author redirects with shape directives ("more committal", "drop
  the qualifier", "cut to the verb"); the drafter iterates.
- **Rung 3 - editorial.** The piece as a piece. Frame stacking,
  kicker-paraphrase, performative balance. The fix is substantial
  rewriting; slopmop flags positions and gets out of the way.

The numbering is **layer, not order**. A structurally clean draft
starts at Rung 1 and climbs up. A tangled draft starts at Rung 3 and
works down so polish does not get spent on prose about to be cut.

Alongside the catalogue, a **density rail** in the article's left
gutter shows per-paragraph scores along four axes (information,
argument, impact, specificity) as wavy silhouettes - convex
bumps where the paragraph is above the internet-average baseline,
concave dents where it's below. See [docs/density-rail.md](docs/density-rail.md).

## How a session runs

1. **Paste prose.** Browser hits `POST /docs`, gets a session URL.
2. **Hand the URL to an agent.** The agent installs the slopmop skill
   (a single `curl -fsSL https://slop.rip/slopmop.md` does it), walks
   the catalogue against the source, and posts flags via the API.
3. **Sweep flags in the browser.** For each flag, the author either
   accepts the candidate, dismisses it, or fires a shape directive at
   the agent. Free text where free text is needed; common-case
   shortcuts where it isn't.
4. **Walk away.** The agent processes directives in the background and
   posts candidates back. The author re-engages at their cadence.
5. **Loop until the rail flattens.** Many cycles, fewer flags per
   cycle as the document settles.

The agent has the keyboard, the author has the wheel. The unit per
flag is small (sentence-or-clause for Rung 2, section-or-transition
for Rung 3); the granularity per *turn* is large (many flags per
author sweep). This is the trick - the author's attention is the
scarce resource, so the agent batches its questions and the author
batches their directives.

The full agent protocol lives at
[`.claude/skills/slopmop/SKILL.md`](.claude/skills/slopmop/SKILL.md);
the framework definition lives at [`CLAUDE.md`](CLAUDE.md).

## Architecture

- **Browser** (Vue 3 + Vite, `src/`) - paste view, session view with
  flag panel and density rail, catalogue browser. State is local;
  truth lives on the server.
- **Server** (Bun, `server/`) - HTTP API, one JSON blob per document
  (`DocState`) with flags, suggestions, responses, agent activity,
  events. Two interchangeable backends: disk for dev, any S3-compatible
  object store for production (DigitalOcean Spaces in deployed form).
  SSE primary event stream; long-poll fallback.
- **CLI** (`cli/`, Bun-bundled) - thin wrapper around the API for the
  agent side. `slopmop pull`, `slopmop resolve`, `slopmop flag-post`,
  `slopmop density-post`, …
- **Skill** (`.claude/skills/slopmop/SKILL.md`) - the agent's protocol
  document. Detection walks blind in kindred-pattern clusters, one
  subagent per cluster; a synthesis subagent merges anchor-overlap
  and shape-recurrence before posting. Shields lower severity, never
  drop the flag.

The catalogue is intentionally portable. `src/catalog/patterns.ts` and
`src/catalog/categories.ts` are a curated list of pattern entries with
`whyItsSlop` / `fix` / `examples` / `skipRule` plus the rung
classification. Other prose tools can vendor it as a prompt-spec
library; the implementation that matters is whatever drafter walks the
catalogue against the source.

## Running locally

```bash
# install
bun install

# in one terminal: the API server (disk-backed)
bun run server:dev

# in another: the browser
bun run dev
```

The Vite dev server proxies `/docs`, `/catalogue`, and `/health` to the
Bun server at `localhost:8787`. Default storage is `./data/`.

To run against a real S3-compatible store, set `S3_BUCKET`,
`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
and skip `STORAGE_DIR`.

### CLI

```bash
bun run build:cli   # produces dist/slopmop
./dist/slopmop --help
```

## Deployment

DigitalOcean App Platform spec lives at
[`.do/app.yaml`](.do/app.yaml). The deployed instance persists session
state to DigitalOcean Spaces (S3-compatible) under a 72-hour lifecycle
rule - active sessions keep resetting the timer because every mutation
re-PUTs the whole `DocState` blob. The App Platform filesystem is
ephemeral; this is the only path that survives redeploys.

Sessions expire purely via the bucket's own lifecycle policy. No
sweeper.

## License

To be added.
