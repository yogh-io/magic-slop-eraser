---
description: Walk a markdown document through the slopmop deslop loop - serve brush-mode reader concerns first; scan the catalogue with subagents when the author asks for it
skillVersion: 2026-05-15.1
allowed-tools: Bash, Read, Edit, Write, Monitor
---

# slopmop

A *steering loop* for fixing AI-slop in prose. The author defines shape; you (the **drafter**) draft the prose; the author re-directs until the sentence lands. The work is the author's; you are the keyboard.

slopmop has **two modes**, and they are not symmetric:

- **Brush is the default and the primary surface.** The reader highlights a passage and types what bothers them. You discover those user-sourced flags, draft **~3 candidate fixes per flag**, and post them back. The reader picks one. No catalogue walk required - the reader is the detector.
- **Scan is supplementary, opt-in.** When the author asks for a starting punch-list ("run a scan", "walk the catalogue"), you read the catalogue, hunt for instances with detection subagents, and post flags into a parallel track. Brush still runs; scan complements it, never replaces it.

Push prose, encourage the author to read and brush, run scan only when invited. The slopmop site is the source of truth; the author sweeps in the browser at their own pace. Written for Claude Code; the CLI works the same elsewhere, the subagent dispatch below assumes the Task tool.

## the slopmop CLI

This skill drives the API through a small CLI called `slopmop`. The CLI handles `X-Skill-Version`, `If-Match`, JSON body construction, and the cwd-scoped session for you. Every command in this document is a one-liner.

If `slopmop` is not on your PATH, install it before doing anything else:

```bash
curl -sf https://slopmop.io/cli/install.sh | sh
```

(For local dev: `curl -sf http://localhost:8787/cli/install.sh | sh -s -- --host http://localhost:8787`. The script needs Bun on the host - it bails clean with an install hint if missing.)

`SLOPMOP_HOST` defaults to whatever the install script captured; override per-session with `--host URL` or `export SLOPMOP_HOST=...`.

The CLI walks up cwd to find `.slopmop/session.json`, which holds the doc id + current sourceHash. `slopmop init` and `slopmop attach` create it; every other command reads it. You almost never pass `--id` explicitly.

A non-CLI fallback (raw curl) is documented in the **appendix** at the end of this file - that's the contract for non-Bun agents (Codex, opencode, custom scripts) and for debugging.

## inputs

Two entry points:

- **Local file**: `slopmop init ./article.md` - POST it to a fresh doc, write `.slopmop/session.json`, print the share URL.
- **Existing URL**: `slopmop attach https://{HOST}/d/{id}` - parse the id, fetch the doc, persist the session.

After either, `.slopmop/session.json` exists in cwd and every other command "just works".

## skill version

This file declares `skillVersion: 2026-05-15.1` in its frontmatter. The CLI's bundled version must match - the install script keeps them in lockstep, but if you've copied SKILL.md by hand, run the install one-liner above to refresh the binary.

The CLI sends `X-Skill-Version` on every call. The server flags two failure modes via response headers:

- `X-Skill-Stale: true` - your CLI version differs from the server's. Run the install script to refresh.
- `X-Skill-Version-Missing: true` - your client is sending requests without the header (some agents bypass the CLI). Use the CLI; if you must use raw curl, set the header yourself.

The CLI surfaces staleness once per session as a stderr warning. Don't ignore it.

## self-update

If the author asks "check for updates" / "update slopmop" / you've been flagged as stale:

```bash
curl -sf https://slopmop.io/cli/install.sh | sh
```

That refreshes both the CLI binary and (separately) the SKILL.md frontmatter signal. To pull the latest SKILL.md text for your skill loader, fetch it directly:

```bash
curl -sf https://slopmop.io/slopmop.md -o ~/.claude/skills/slopmop/SKILL.md
```

Reload the session afterwards - skill files are read at session start.

## tell the author you are alive

The browser shows an "agent" pill that turns green the moment it hears from you. **Send a heartbeat as your first network call** so the writer sees the pipeline is wired before any analysis arrives:

```bash
slopmop heartbeat
```

Subsequent flag posts, suggestions, notes, and task updates also bump `lastSeenAt`. You don't need to heartbeat on a fixed interval - any activity counts. Send a fresh heartbeat only after long stretches of idle work (e.g. a multi-minute subagent dispatch where nothing else hits the API).

## report tasks and observations

The author is steering from the browser; they cannot see what your subagents are doing. Two channels close that gap:

### tasks (structured, live)

Declare the shape of the work with `slopmop task <key> <status> [title]`. Each task carries a stable `key` (drafter-set, e.g. `phase-a`), a `title`, an optional `--detail`, and a `status` (`open` / `in-progress` / `done`). Upsert by key:

```bash
slopmop task phase-a in-progress "Phase A: framing pass + catalogue walk"
```

When the task is done, omit the title - the CLI keeps the existing one:

```bash
slopmop task phase-a done
```

Default starting set at session start: a `phase-a` task for analysis and a `phase-b` task for the steering loop, with phase-b `open` until you start it. Add finer-grained tasks during a long catalogue walk (e.g. `r1-walk`, `r2-walk`, `r3-walk`) so the author can see *which* slice you're on.

If a declared task is no longer relevant (the author said "skip Rung 2 entirely", you took a different shape than planned), pull it out:

```bash
slopmop task-rm r2-walk
```

The task disappears from the live list; the upsert events for it stay in the timeline as history. Don't mark abandoned work `done` - that's a lie the writer will read off the panel.

### notes (free-form, timestamped)

Drop a note when you have something the writer should hear: a finding, a concern, or a heads-up that changes how they should think about the session.

```bash
slopmop note finding "Walked the catalogue. The piece is unusually committal - most slop categories don't bite. Strongest hits: allusive constructs (bare references to prior project work a cold reader cannot parse), one absent-actor, one antithesis-shaped pivot."
```

For long notes, pipe via stdin:

```bash
slopmop note observation --stdin <<EOF
The piece reads as a working note, not a finished essay.
Three clear sections, each carrying one claim.
Voice is dry, technical, deliberately understated.
EOF
```

Or read from a file:

```bash
slopmop note finding @/tmp/phase-a-summary.md
```

Kinds (free choice; pick the one that fits):
- `observation` - "the piece reads as a working note, not a finished essay"
- `finding` - "first batch posted: 5 absent-actor, 3 throat-clearing"
- `progress` - "halfway through Rung 2; will batch the rest in the next ~30s"
- `concern` - "anchor for the second pivot is ambiguous; flagged but the offsets may slide"

When to post a note (use judgement, but these are good moments):
1. **After Phase A**, summarise what the catalogue walk turned up. The writer cares about shape: which patterns dominate, which are absent, what surprised you. The example above is the canonical shape.
2. **When you punt** something hard - explain in a note as well as on the response punt, so it shows up in the activity timeline next to other context.
3. **When something is wrong** - 412 storms, source drifting under your edits, the catalogue sending you in circles. Don't silently retry; tell the author.
4. **At the end** - one closing note ("done; companion at ...") so the author knows you stopped on purpose, not crashed.

Don't spam. One note per real beat is the right cadence. The activity panel is the writer's window into your head; aim for the cadence of a colleague pinging Slack, not a verbose log.

## brush mode (default loop)

**Brush is the default.** A fresh slopmop session lands a reader on the article with no flags. They read, they highlight passages that bother them, they type a sentence about *why*. Each highlight becomes a user-sourced flag with `source: 'user'`, `status: 'open'`, no patternId, and a `userNote` carrying the complaint. The reader's been the detector. Your job is just to write the prose.

Your brush loop:

1. **Pull** open user flags:
   ```bash
   slopmop pull --source user --status open --limit 10
   ```
   Prints one line per brush flag: `<fid>  "<excerpt>"  note=<the reader's complaint>`. Add `--json` for the structured form.

2. **For each flag**, read three things:
   - The flag's anchored span (`excerpt` / `anchor.text`) - the passage the reader pointed at.
   - The surrounding paragraph - slice it out of the source by the anchor's character positions for context.
   - The `userNote` - *what bothers them about that passage*. This is the directive. There's no separate Response in brush mode; the flag itself carries the complaint.

3. **Draft ~3 candidates** that respond to the complaint. Three is the target - give the reader real alternatives to pick from, not three minor variants of the same line. If the directive admits only one good answer, post one; if it admits two, post two. The bar is real difference, not coverage.

4. **Post the batch** as a single resolution. The wire shape is a `patches` array with `replacementTexts` (array) and **no** `respondedTo` - brush flags have no preceding Response. Build `brush.json`:
   ```json
   {
     "patches": [
       {
         "flagId": "usr-1a2b3c4d",
         "replacementTexts": [
           "first candidate",
           "second candidate",
           "third candidate"
         ]
       }
     ],
     "modelTag": "claude-opus-4-7"
   }
   ```
   Send it:
   ```bash
   slopmop resolve @brush.json
   ```
   The server attaches all three Suggestions to the flag, flips it to `awaiting-accept`, and pushes them to the reader via SSE. The browser shows a carousel with prev/next and an accept button on the currently-shown candidate.

5. **The reader picks one and accepts.** That mutates the source via the Suggestion they chose; the others stay as history (for the v2 catalogue-reflection layer to mine). Or they re-direct ("none of these - try with X in mind") - which posts a free Response on the flag, you draft another batch, and the new candidates stack onto the carousel.

6. **Loop back to pull.** New brush flags arrive whenever the reader keeps reading. When the queue empties, post a short `progress` note ("brush queue clear; pulling on the next ping") and stop. The reader re-engages by highlighting more passages.

**Brush flags exist outside the catalogue.** No patternId, no rung. They don't contribute to the headline score. They live in their own "reader concerns" track in the panel.

A brush flag whose reader complaint matches a catalogue pattern (e.g. "this is too vague" → vague-gravitas) is *still* posted as a brush flag in v1. The v2 reflection layer is what later proposes catalogue refinements; v1 just stores cleanly.

## the shape of scan work (supplementary, opt-in)

Scan is the catalogue-walk mode. **Run it only when the author asks for it** - "run a scan", "walk the catalogue", "give me a punch-list" - or when an agent hint pre-pins specific rungs/patterns. Don't auto-run scan on every session; brush is the default surface, scan is the supplementary catalogue track that runs alongside it.

Two phases. The first runs once when scan is invoked; the second runs on a loop.

**Phase A - analysis (once, at scan start).** Catalogue walk only - bring-your-own-model, all detection is yours. You already posted the brief framing note at session start; Phase A goes straight to the dispatch. Subagents (Task tool) parallelise the catalogue walk; one per kindred-pattern cluster keeps each subagent deeply primed on a small family and blind to the rest.

**Phase B - the steering loop (until the author says done).**

1. **Pull** open work: `slopmop pull --rung 1,2 --limit 10` (with whatever filters narrow the queue). Default `pull` (no `--source`) returns pending scan Responses, not brush flags - use `pull --source user` for brush in a separate loop.
2. **Process** each one: read the flag, the surrounding paragraph, the trail of prior directives + candidates on this flag. Pick a resolution path (per-flag patch or full-source push). Draft the candidate.
3. **Post** the resolution: `slopmop patch <rid> <fid> "<replacement>"` for the common case, or `slopmop resolve @batch.json` for batches, or `slopmop fullsource ./new.md --responded-to rid1,rid2` for Rung 3 editorial.
4. **Pull** again. The author may have submitted new directives while you worked; pick them up. Loop.

**When the queue empties, hand the loop back to the author.** Don't spin or poll silently - the author is the wheel; if they have nothing in flight, you have nothing to do. Post a short `progress` note ("queue clear; ping me when you have more directives") and stop. They re-engage by sweeping more flags in the browser, or by prompting you in the terminal to pull again. Either way, the next move is theirs.

If you're mid-sweep and a pull happens to come back empty for a moment (the author is typing the next directive), one or two short re-pulls (~5-10s apart) is fine before falling back to the handoff above. `slopmop events` is available as a wake-up optimisation if your runtime keeps long-lived connections cheap; pulling alone is sufficient.

**Run both loops if both have work.** A drafter attached to a session can serve brush and scan in alternation: `pull --source user` for brush, default `pull` for scan responses. Brush is usually the lighter loop; scan only runs when invoked.

## starting a session

The opening five beats. Brush is the default - **don't auto-walk the catalogue**. Encourage the author to read and brush; offer scan as a supplementary option they can pull on.

### 1. push the doc

If given a file path:

```bash
slopmop init "./article.md"
```

If given a URL:

```bash
slopmop attach "https://slopmop.io/d/abc123"
```

The session lands at `.slopmop/session.json` in cwd. The doc URL is the capability - anyone with it can drive the session, that's intentional.

### 2. heartbeat and declare a brush task

```bash
slopmop heartbeat
slopmop task brush in-progress "serving brush-mode reader concerns"
```

Skipping the heartbeat is a regression - the writer is staring at a blank pill wondering whether anything is wired.

### 3. read the source yourself

Read the source straight, in a single pass. No subagents at this stage - the brief judgement is yours, not a synthesised committee read. Form an opinion: what is this piece, how does it sound, where do you suspect slop sits.

### 4. post a brief framing note

Post your first impression as an `observation` note so it lands on the activity panel before the author has even opened the URL:

```bash
slopmop note observation --stdin <<EOF
A working note on dual-mode editing tooling. Three sections, clear claims,
unusually committal voice for the genre. First-pass suspicions: a couple
of throat-clearing openers in section two, one antithesis-shaped pivot
near the close, vague-gravitas thick in the abstract. Brush over those
spots first if they bother you - or tell me to run a scan and I'll walk
the whole catalogue in parallel.
EOF
```

What goes in the note:

- **What the piece is.** One sentence on shape, genre, length.
- **Your honest first read.** Register, what the piece is doing, whether it lands. If it reads as slop on first pass, say so - don't soften.
- **A couple of spots that already stand out** as plausible brush targets. Concrete, anchored to phrases the reader can find. Don't pre-flag (no `flag-post` yet) - the reader is the detector in brush mode; you're just pointing.
- **The invitation.** "Brush whatever bothers you, or ask for a scan."

Don't dump the whole catalogue at the reader and don't manufacture flags pre-emptively. The framing note is the author's onboarding to the loop, not a verdict.

### 5. hand the URL to the author

Tell them in chat:

> "Open the printed URL in your browser. Read through; highlight any passage that bothers you and type a sentence about why - I'll draft fixes (~3 candidates per flag). Say *run a scan* if you want me to walk the catalogue in parallel."

Then enter the brush pull loop (next section) and wait. New brush flags arrive whenever the reader keeps reading; you process them and post resolutions back. Scan only kicks off if the author asks.

## 1. analysis (scan mode only)

You are the **drafter**. All detection is yours - Rung 1, 2, and 3. The server stores the catalogue, the docs, and the flags; it does not read prose, dedupe findings, or cluster anything. The clustering is yours too.

Phase A is four steps: read the catalogue and the source, dispatch a small set of detection subagents in parallel (each a specialist for a *kindred group* of patterns), dispatch a synthesis subagent that clusters their findings, post the consolidated flag set. ~6 subagents fan out, one synthesises, you post. Done in a couple of minutes.

### 1a. read

```bash
slopmop catalogue > /tmp/slopmop-catalogue.json
slopmop doc --json | jq -r .doc.source > /tmp/slopmop-source.md
mkdir -p /tmp/slopmop-findings && rm -f /tmp/slopmop-findings/*
```

`catalogue.json` is `{ categories, patterns }`. Each pattern carries `whyItsSlop`, `fix`, `examples`, `skipRule`, and often an `essay`. That is the detection spec.

### 1b. dispatch detection subagents per kindred group (parallel)

One Task subagent per *cluster* of structurally kindred patterns. ~6 detection dispatches, all in parallel.

The clusters group patterns that share a detection skill - a subagent looking at sentence openers is also the right reader for sentence closers; a subagent reading for dead vocabulary is the right reader for inflated vocabulary. Within a cluster the subagent's intra-pattern reasoning is fine (the patterns are kindred). Across clusters, no agent has visibility - which is what prevents the "section X is protocol shape, skip everything in it" cross-pattern shielding move.

Default cluster table for the current catalogue (16 patterns → 6 subagents):

| Cluster | Patterns | What this agent is hunting |
|---|---|---|
| dead-vocabulary | tier1-lexicon, enthusiasm-inflation, vague-gravitas | Words and phrases that are inflated, abstract, or LLM-typical |
| openers-closers | throat-clearing, closers | Sentence-position empties at paragraph head and tail |
| stacked-constructions | antithesis, suffocation | Mirror constructs and stacked hedges |
| actor-reference | absent-actor, allusive-construct | Passages where the agent is hidden or the referent doesn't earn itself |
| argument-position | hedged-confidence, performative-balance, synthesis-of-nothing | Authorial stance that avoids commitment, and paragraphs that synthesise nothing |
| editorial-piece-level | frame-stacking, kicker-paraphrase, redundant-abstraction, lens-fits-everything | Rung 3 piece-level reads on the whole composition |

When new patterns land in the catalogue, slot them into the closest existing cluster, or create a new one if no existing cluster captures the detection skill. Don't let the table go stale - a pattern that isn't in any cluster won't get walked.

Each subagent gets:
- The specs for its cluster's patterns (`whyItsSlop`, `fix`, `examples`, `skipRule`, `essay`).
- The whole source.
- Brief: "walk the source for instances of any of these patterns. Return JSON to `/tmp/slopmop-findings/<cluster>.json`. Score severity per instance, 0 to 1 - passages where a pattern shape is doing legitimate work get *low* severity, never skipped."

The subagent is deeply primed on a small family of patterns, knows the edge cases from the essays, and walks blind to everything outside its cluster. It produces:

```json
{
  "cluster": "openers-closers",
  "findings": [
    {
      "patternId": "throat-clearing",
      "text": "The leverage is the question.",
      "start": 7041, "end": 7070,
      "rationale": "Announces a topic before any substance; the next sentence carries the actual claim.",
      "severity": 0.55,
      "suggestion": null
    }
  ]
}
```

The cluster table is a default; if the catalogue grows or a piece type calls for a different split, regroup - but keep the invariant: no single subagent sees the whole catalogue, and groupings stay within structural kinship. Bundling structurally-unlike patterns (e.g. `antithesis` + `absent-actor` + `synthesis-of-nothing`) re-opens cross-pattern reasoning and re-introduces the section-shielding failure.

### 1c. dispatch the synthesis subagent

Once all detection subagents return, dispatch one synthesis subagent.

The synthesis subagent gets:
- All cluster findings JSONs from `/tmp/slopmop-findings/*.json` (each carries findings tagged with `patternId`; the cluster is just routing).
- The source from `/tmp/slopmop-source.md`.
- The flag-post schema (below).
- The brief: clustering rules + the no-skip directive.

It writes `/tmp/slopmop-flags.json` ready to post. Two cluster passes:

**Pass 1 - same-anchor merge.** Group findings whose anchor spans overlap (text-substring containment, or character ranges within ~20 chars). Emit one flag per group:
- Primary `patternId` = the finding with highest severity.
- Other patternIds → `relatedPatterns`.
- Severity = max of the group.
- Rationale = one synthesised sentence covering all the pattern angles ("opens with throat-clearing *and* trails into vague-gravitas - both wrapping a sentence that says nothing").
- `suggestion` = the primary's if present; otherwise omit.

**Pass 2 - shape recurrence.** For each `patternId` with 3+ findings across distant anchors (>~500 chars apart, non-adjacent paragraphs), ask: same construction or unrelated instances of the same pattern? If same (parallel paragraph openers, repeated tic across a section), emit one flag at the first anchor with `relatedAnchors` listing the rest. Rationale names the construction once. If unsure, leave as separate flags - over-clustering is worse than under-clustering.

**Severity is the vote; posting is the contract.** Each detection subagent already scored its findings per-instance - a passage where the pattern shape is doing legitimate work comes back at *low* severity (0.1-0.3), not omitted. Synthesis preserves that signal. If the synthesis subagent finds itself dropping findings because "the section is deliberate" or "this is protocol shape, not slop", that *is* the failure mode. The author dismisses what doesn't bother them; the synthesis subagent does not get to make that call. Drop nothing. The brief to the synthesis subagent should restate this in those words.

### 1d. coverage check

Before posting, look at `/tmp/slopmop-flags.json`:
- Did every cluster subagent return a file? Crashed clusters, or clusters that returned empty on a piece where you'd expect hits (e.g. `openers-closers` empty on a polished essay, `stacked-constructions` empty on dense analytical prose) are suspicious - re-dispatch.
- Are the consolidated flags spread across the whole source, or clustered in <30% of it? That kind of clustering = sections were missed = re-dispatch the suspicious cluster(s), or re-run synthesis with a "you skipped section X" hint.
- Did a whole rung come back empty on a piece of meaningful length? Re-dispatch the relevant cluster (Rung 3 lives in `editorial-piece-level`; Rung 1/2 are spread across the others).

A small re-dispatch round is fine. Shipping a half-walk is not.

### 1e. post

```bash
slopmop flag-post @/tmp/slopmop-flags.json
```

Schema:

```json
{
  "flags": [
    {
      "patternId": "throat-clearing",
      "text": "The leverage is the question.",
      "rationale": "Opens with a topic announcement before any substance; the next sentence carries the actual claim. Also reads as vague-gravitas - an abstract noun with no concrete content.",
      "severity": 0.55,
      "suggestion": null,
      "relatedPatterns": ["vague-gravitas"],
      "relatedAnchors": [
        { "text": "The summit is the venue at which the frame either gets produced or does not." }
      ]
    }
  ],
  "modelTag": "claude-opus-4-7"
}
```

`relatedPatterns` and `relatedAnchors` are optional. Server validates patternIds (primary + related) against the catalogue, relocates the primary anchor and each related anchor by text matching, and reports `added N, skipped M`. Skipped entries print their reason. The server does **not** dedupe or merge - any clustering decisions live in the synthesis subagent. If you re-walk later and synthesis produces overlapping output, that's a synthesis bug; don't expect the server to absorb it.

After posting, send a `finding` note: what dominated, what was absent, what surprised you. Then mark `phase-a` done, flip `phase-b` to `in-progress`, and start the steering loop.

## 2. honour agent-hints

The author can pin filters that scope what work you should pick up first. Read them on each pull cycle:

```bash
slopmop hints get
# -> { "agentHints": { rungs?, categories?, severities?, patternIds?, paused? } }
```

If `paused: true`, sleep and try later. Otherwise, fold the filter values into your `slopmop pull` flags, and into your Phase A analysis (skip patterns the author has narrowed away). The author can change hints mid-session, so re-read them between pulls.

## 3. pull the queue

```bash
slopmop pull --rung 1,2 --limit 10
```

Prints one line per pending response: `<rid>  flag=<fid>  kind=<kind>  <body excerpt>`. Add `--json` if you want the structured form for scripting.

`skip`, `keep`, `let-me-try`, `accept`, `discard` are self-resolved by the server. You will only ever see `shortcut` and `free` directives in the queue.

For each response, fetch the doc state to find the flag in it:

```bash
slopmop doc --json | jq --arg fid "$FID" '.flags[] | select(.id == $fid)'
```

The flag carries `anchor` (start/end/text/prefix/suffix), `rationale`, `excerpt`, `patternId`, `rung`. Slice the surrounding paragraph from `doc.source` using the anchor positions for paragraph context the model will need.

For flags that already have a trail (re-directions on prior candidates), pull the suggestion history from the companion endpoint:

```bash
slopmop companion | jq --arg fid "$FID" '.suggestions | map(select(.flagId == $fid)) | sort_by(.createdAt)'
```

Read the rationale, the paragraph context, the directive, any prior attempts the author rejected. Draft one candidate that incorporates the directive without retreading what's already been tried.

## 4. post the resolution

Two paths. Pick per fix.

### path A: per-flag patch (Rung 1/2, the common case)

Edit fits within the flag's anchor span. Source is not mutated by your post; the candidate becomes an *awaiting-accept* overlay the author reviews and accepts (or re-directs) in the browser.

Single patch (the common case):

```bash
slopmop patch "$RID" "$FID" "work through"
```

For long replacements, pipe via stdin: `slopmop patch "$RID" "$FID" --stdin < /tmp/replacement.txt`.

Multiple patches in one batch - write a JSON file and use `slopmop resolve`:

```json
{
  "patches": [
    { "respondedTo": "r-1", "flagId": "llm-1", "replacementText": "work through" },
    { "respondedTo": "r-2", "flagId": "llm-2", "replacementText": "the committee" }
  ],
  "modelTag": "claude-opus-4-7"
}
```

```bash
slopmop resolve @batch.json
```

### path B: full-source push (Rung 3 editorial)

Edit needs to move text outside any single anchor span - paragraph rearrangement, section rewrite, structural change, dropping a paragraph entirely. You replace the *entire* source. Server reconciles every open flag against the new source: text-changed flags auto-resolve, unrelocatable flags go stale, pending directives on stale flags are cancelled.

```bash
slopmop fullsource ./new-source.md --responded-to "$RID1,$RID2"
```

One fullSource per batch. A second would just clobber the first.

### concurrency

Every mutating CLI call sends `If-Match: <currentHash>` automatically. If the source has moved since you fetched (author paste-edit, another agent pushed, a revert), you get exit code 4 with `error: source moved (412). re-fetch the doc and rebase.` Re-pull, rebase your patch, retry. Don't panic - this is normal.

The CLI refreshes the session hash from every response that returns a new `sourceHash`, so subsequent calls see the up-to-date value automatically.

## 5. punt when stuck

Some directives won't have a clean fix. "Punchline first" on a paragraph with no clear punchline. "More committal" on a sentence that's already as direct as it can be. Don't fake a candidate to clear the queue - punt:

```bash
slopmop punt "$RID" "no clear punchline; the paragraph has three parallel beats already"
```

Status flips to `stuck`. The author sees it in the panel, gives a different directive or closes the flag manually.

## start over (the reset signal)

The author may, at any point, decide your read of the piece is wrong. "This is all garbage, do it again." "Start over, look at it through the lens of an angry literary critic." "Forget all that, the real problem is the second half." When that happens, scrap your in-flight hypotheses and re-walk - don't try to patch the existing flag set into the new framing.

```bash
slopmop reset "angry literary critic lens; the piece sounds eager"
```

Server-side this drops your `open` and `awaiting-accept` flags, the unaccepted suggestions tied to them, the comments anchored to them, all your tasks, all your notes, and cancels any pending responses. Source, accepted suggestions, resolved/skipped/kept flags, density scores, and agent-hints survive - the *durable* record of decisions the author already landed stays put. A `drafter-reset` event with the reason hits the activity timeline so the writer sees the breadcrumb.

Then re-run Phase A. Heartbeat, declare fresh `phase-a` / `phase-b` tasks, walk the catalogue with the new lens folded in, post the new flag set.

What this is *not*: a source revert. If the author wants the prose itself rolled back (undo a Rung 3 push), that's `slopmop revert` - a separate command. Reset is purely about your analysis hypothesis.

When to use it (the trigger phrases vary; the shape is the same):
- "start over", "reset", "do it again", "scrap that"
- "this is garbage, redo"
- "look at it through the lens of X" / "from Y's eyes" / "as if Z"
- "forget that, the real issue is..."

When *not*: incremental redirection on a single flag is a directive, not a reset. "More committal on this one" stays in the response loop. Reset is for "throw out the map and re-draw it".

## 6. density scoring

Slop catalogue tells the author what's *wrong* with a passage. Density is the other lens: per-paragraph numeric scores along a few axes, rendered as a wavy silhouette in the article margin - one lane per axis, convex bumps where the paragraph is above ambient noise on that axis and concave dents where it's below. **Information**, **argument**, **impact**, **specificity** are the canonical defaults; you can drop any that don't fit a piece, and you can add your own (e.g. *humour*, *tension*, *stakes*) when the work calls for it. The client renders the union it sees, with extras getting a neutral fallback color.

**When to score:**
- Once at session start, after you post flags. Most paragraphs land their scores here.
- After a fullSource push (Rung 3 editorial rewrite): every paragraph hash that doesn't already exist in the cache needs re-scoring. Per-flag patches that stay inside an anchor window don't change the paragraph hash, so existing scores carry over for free.
- Whenever the author asks ("re-score density", "the scores are stale").
- On any doc whose `slopmop density --json` returns an empty `density` map. The server clears legacy 0..10 scores on first read after the symmetric schema bump, so an empty cache on a doc that obviously needs scoring is a re-score prompt, not a fresh doc.

**The flow:**

```bash
# Pull paragraph list and current density cache. Server hashes paragraphs for you.
slopmop density --json
# -> { paragraphs: [{ hash, start, end, text }], density: { hash: { axis: score } } }
```

For each paragraph whose `hash` is missing from `density`, score it. Use a single LLM call that takes the paragraph (with surrounding paragraph context) and returns the axis scores.

**Score range: -10 to +10. The calibration anchor is external.** Zero is *not* the midpoint of the current piece - zero is "average article on the internet" on this axis. A typical Atlantic paragraph, a typical blog post, a typical AI-generated passage: those are the baseline. Score each paragraph against that external reference:

- **+8** = very good relative to the baseline. Reads like top-decile prose on this axis.
- **+4** = noticeably better than baseline. The writer is doing something here.
- **0** = unremarkable. Indistinguishable from baseline prose, neither carrying nor sinking the paragraph.
- **-4** = noticeably worse. The paragraph is underperforming on this axis.
- **-8** = very bad relative to baseline. Reads like a paragraph that gave up on this axis.

The axes themselves are unchanged:

- **information**: density of facts, named entities, numbers. Hand-wavy abstractions = negative; concrete claims = positive.
- **argument**: is a claim being made and supported here, or is the paragraph just sitting there? Inert connective tissue = negative; load-bearing = positive.
- **impact**: does this hit. Punchline-quality, specific imagery, payoff. Filler = negative; lands = positive.
- **specificity**: concrete nouns vs abstractions. "Three counties" beats "many areas." Specific = positive.

Drop any axis that genuinely doesn't apply on a given piece. Add an axis if you've got a strong take ("Tension - is something at stake here").

**Score for contrast, AND keep the baseline calibrated.** The author wants two signals from the rail at once: (1) where this piece is above vs below the typical internet paragraph (the baseline anchors that read), and (2) where the piece's own peaks and troughs sit (contrast across paragraphs makes that visible). Don't cluster everything in the middle "to be safe"; use the full range. A piece where every paragraph scores between +1 and +3 is telling the author either "the agent is sandbagging" or "this prose is genuinely middling on every axis" - if the second is true, that itself is the signal.

Build a `scores.json`:

```json
{
  "modelTag": "claude-opus-4-7",
  "scores": [
    { "paragraphHash": "h1", "axes": { "information":  6, "argument":  3, "impact":  7, "specificity":  8 } },
    { "paragraphHash": "h2", "axes": { "information": -7, "argument": -4, "impact": -8, "specificity": -6, "tension": -5 } },
    { "paragraphHash": "h3", "axes": { "information":  0, "argument":  1, "impact": -1, "specificity":  0 } }
  ]
}
```

The first paragraph reads as solidly above baseline on most axes (a paragraph carrying its weight); the second is broadly below baseline (a paragraph the author probably wants to rebuild); the third is unremarkable in either direction (the rail goes flat against the centerline at this row).

Post it:

```bash
slopmop density-post @scores.json
```

Server stores by hash, so unchanged paragraphs keep their scores across edits forever - re-running density on a second pass only spends tokens on the paragraphs that drifted. Scores are clamped to [-10, +10] server-side.

The author can read the rail to decide where prose is dying ("this whole section is denting in") or carrying weight ("the silhouette bulges through here") - that's a higher-leverage signal than nudging individual lexical flags. Don't lecture about it; just score.

## 7. wrap up

When the author says `done`, or `slopmop pull` returns empty repeatedly, fetch the companion:

```bash
slopmop companion --out companion.json
```

Contains the full event log, the final source, every flag's resolution, every response, every candidate. If invoked with `--apply` (in your wrapping script), write the final source back to the original file via `Edit` to keep a clean diff. Otherwise, print the path and let the author copy edits over.

For the full command list run `slopmop --help`. Body conventions for write commands: positional text, `--stdin`, `-`, or `@path` - pick whichever fits the call site.

## constraints

- **Brush is the default; scan is supplementary.** Don't auto-walk the catalogue on session start. Post the framing note, encourage the reader to brush, run scan only when the author asks for it.
- **All detection is yours.** Rung 1, 2, and 3 - the server doesn't read prose. The catalogue is the spec; you walk it. In brush mode the reader has already done the detection - you only draft. In scan mode the detection subagents do the walk.
- **Detection walks blind in kindred clusters; synthesis only clusters.** No single detection subagent sees the whole catalogue - each gets one structural family of patterns. The synthesis subagent merges anchor-overlap and shape-recurrence; it does not re-judge severity or drop findings.
- **Server stores; drafter clusters.** Same-anchor merge and shape-recurrence rollup happen in the synthesis subagent before `flag-post`. The server doesn't dedupe or merge - it just validates patternIds against the catalogue, relocates anchors, stores. If overlapping flags land, that's a synthesis bug to fix client-side.
- **Shields lower severity, they don't drop the flag.** `skipRule` describes when a pattern shape is doing legitimate work - that's a *low* number, not a missing flag. The author dismisses what doesn't bother them; you don't get to make that call. Zero flags across a whole rung, or flags clustered in <30% of the source, is a failure signal, not a clean verdict - the shields swallowed the walk.
- **Severity is your scoring vote.** Per-flag `severity` is the score, set by the detection subagent per instance. A deliberate move scores low even if it matches a catalogued pattern (and the flag still posts). Don't autopilot the catalogue's nominal severity through; adjust per instance.
- **The author shapes; you write.** Slopmop's loop is: you draft, author redirects via shape directives. Never ask the author to write the sentence.
- **Pull, don't push.** The author submits directives whenever they want; you pull when you have capacity. The queue holds work for you - none of it is missed if you're slow.
- **Multiple candidates are fine.** Post one if there's a clear best take; post two or three when the directive admits real alternatives the author would want to compare. The author picks one, the rest become history. Don't manufacture filler variants - the bar is real difference, not coverage.
- **Per-flag work is sequential, across flags is batched.** Pull a queue, process several in parallel, post a single resolutions batch. Then pull again.
- **Hash is automatic.** The CLI tracks `If-Match` for you. On 412 (`exit 4`), re-pull and rebase - don't try to silently retry.
- **Granularity is the feature.** Rung 1/2 are sentence-level (or smaller) patches. Rung 3 is the only path that touches paragraph structure. Never rewrite a paragraph as a per-flag patch - it won't fit in the anchor window and the call rejects 422.
- **Punt rather than guess.** If you can't address a directive, punt with a reason. The author decides what to do.
- **Skip / keep / let-me-try / accept / discard are user-side.** Self-resolve server-side. You will never see those kinds in the queue.
- **The score is the catalogue score, all rungs.** Severity-weighted slop density across Rung 1, 2, and 3 - what the headline pill shows. Brush flags don't count toward it (they're a separate "reader concerns" track). Don't try to "fix" individual Rung-2 hits in isolation to chase the score; the byRung breakdown is what guides where to dig.
- **Density is keyed by paragraph hash, not flag id.** Don't re-score paragraphs whose hash is already in the density cache - they haven't changed. Your token budget goes to the new and the drifted.

## appendix: raw HTTP

The CLI is a thin layer over the HTTP API. If you can't install Bun (Codex, opencode, custom scripts), drive it directly. The doc id from the URL is the capability - no separate auth header. Every state-changing call requires `X-Skill-Version: 2026-05-15.1`; source-mutating calls (`POST /flags`, `POST /resolutions`, `PUT /source`, `POST /source/revert`) require `If-Match: <currentHash>` and return the new `sourceHash` in the response. 412 means the source moved - re-fetch and retry.

Routes (full schemas: read the CLI source at `cli/client.ts` + `cli/commands/*.ts`, or `slopmop --help`):

- `POST /docs` / `GET /docs/:id` / `PUT /docs/:id/source` / `POST /docs/:id/source/revert`
- `GET /catalogue`
- `POST /docs/:id/flags`, `POST /docs/:id/flags/:fid/comments`
- `GET /docs/:id/responses?...`, `POST /docs/:id/responses`, `POST /docs/:id/responses/:rid/transition`
- `POST /docs/:id/resolutions`
- `GET /docs/:id/companion`
- `GET /docs/:id/density`, `POST /docs/:id/density`
- `GET /docs/:id/events` (SSE)
- `POST /docs/:id/agent/heartbeat`, `POST /docs/:id/agent/notes`, `POST /docs/:id/agent/tasks`, `DELETE /docs/:id/agent/tasks/:key`
- `GET /docs/:id/agent-hints`, `PUT /docs/:id/agent-hints`
- `POST /docs/:id/reset`

Breaking changes from prior versions (skill v2026-05-09.5 and earlier):
- `POST /flags/:fid/{accept,discard,skip,keep-deliberate}` -> `POST /responses { flagId, kind: 'accept' | 'discard' | 'skip' | 'keep' }`
- `POST /responses/:rid/punt` and `/cancel` -> `POST /responses/:rid/transition { to: 'stuck' | 'cancelled', reason? }`
- `GET /events/poll` -> dropped; use the SSE stream

Changes in skill v2026-05-12.1 (from v2026-05-09.6; not breaking on the wire):
- Phase A reorganised: per-rung dispatch replaced by **clustered detection subagents** (kindred-pattern groups, ~6 for the current catalogue) and a dedicated **synthesis subagent** that produces the consolidated flag set before `flag-post`.
- Flag schema gained two optional fields: `relatedPatterns: string[]` (other patternIds the synthesis pass folded into this flag) and `relatedAnchors: TextAnchor[]` (other places the same construction recurs). Old clients and old flags work unchanged.
- `POST /flags` no longer dedupes server-side. Drafter clusters before posting.

Changes in skill v2026-05-14.1 (from v2026-05-12.1; not breaking on the wire):
- **Brush mode** added as the default loop. New endpoint shape on `POST /docs/:id/flags` (`source: 'user'`, no `patternId`, carries `userNote`); new filter `GET /docs/:id/flags?source=user`; new CLI flag `slopmop pull --source user`. Old scan-only drafters keep working; the staleness header nudges users to re-install for brush.
- **Multi-candidate per flag is universal**. `POST /docs/:id/resolutions` per-flag patches now take `replacementTexts: string[]` (length ≥ 1). Legacy `replacementText: string` is accepted for back-compat. Scan-mode drafters can now post 2–3 candidates per directive when the directive admits real alternatives; brush mode always posts ~3.
- **`respondedTo` is optional** on per-flag patches. Brush flags have no preceding Response - the flag itself is the directive (`userNote`).
- **Accept with explicit `suggestionId`**. `POST /responses { kind: 'accept', flagId, suggestionId? }` now requires `suggestionId` when the flag has >1 unaccepted candidates (replaces silent newest-wins behaviour). For single-candidate flags, `suggestionId` is optional.
- **`DocResponse.resolvedSuggestionId`** (singular) → **`resolvedSuggestionIds: string[]`** (plural). Legacy single-id records normalise to a one-element array on read.
- The catalogue score documentation now matches the implementation: severity-weighted across **all rungs** (not Rung 1 only).

Changes in skill v2026-05-15.1 (from v2026-05-14.1):
- **Brush is the canonical opening**. New "starting a session" section codifies the bootstrap flow: push doc → heartbeat → read source yourself → post a brief framing `observation` note → invite the author to brush. Scan is explicitly supplementary, run only when the author asks.
- **Voice memo / voice samples removed.** The `voice-memo` detection subagent is gone; the synthesis subagent no longer folds a memo into severity (each detection subagent already scores per instance). `GET /docs/:id/voice-samples` and `slopmop voice` are dropped. The `voice` density axis is dropped from the canonical default set. Drafters that pulled voice samples or scored a `voice` axis should stop; old samples on disk are ignored.
