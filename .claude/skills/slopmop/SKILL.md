---
description: Walk a markdown document through the slopmop deslop loop - pull author directives, draft candidates, post resolutions, repeat
skillVersion: 2026-05-09.6
allowed-tools: Bash, Read, Edit, Write, Monitor
---

# slopmop

A *steering loop* for fixing AI-slop in prose. The author defines shape; you (the **drafter**) draft the prose; the author re-directs until the sentence lands. The work is the author's; you are the keyboard.

The slopmop site is the source of truth and the steering surface. You push prose, find slop, draft candidates from author directives, post resolutions. The author sweeps in the browser at their own pace; you grind in the background. Written for Claude Code; the CLI is the same elsewhere, the subagent dispatch below assumes the Task tool.

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

This file declares `skillVersion: 2026-05-09.6` in its frontmatter. The CLI's bundled version must match - the install script keeps them in lockstep, but if you've copied SKILL.md by hand, run the install one-liner above to refresh the binary.

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

## the shape of the work

Two phases. The first runs once at session start; the second runs on a loop.

**Phase A - analysis (once, at start).** Two beats: a quick *framing pass* (is slopmop the right tool for this piece, or does it want `/distill` or `/compress` first?), then the catalogue walk - bring-your-own-model, all detection is yours. Subagents (Task tool) parallelise the catalogue walk well; shape the dispatch as suits the prose.

**Phase B - the steering loop (until the author says done).**

1. **Pull** open work: `slopmop pull --rung 1,2 --limit 10` (with whatever filters narrow the queue).
2. **Process** each one: read the flag, the surrounding paragraph, the trail of prior directives + candidates on this flag. Pick a resolution path (per-flag patch or full-source push). Draft the candidate.
3. **Post** the resolution: `slopmop patch <rid> <fid> "<replacement>"` for the common case, or `slopmop resolve @batch.json` for batches, or `slopmop fullsource ./new.md --responded-to rid1,rid2` for Rung 3 editorial.
4. **Pull** again. The author may have submitted new directives while you worked; pick them up. Loop.

**When the queue empties, hand the loop back to the author.** Don't spin or poll silently - the author is the wheel; if they have nothing in flight, you have nothing to do. Post a short `progress` note ("queue clear; ping me when you have more directives") and stop. They re-engage by sweeping more flags in the browser, or by prompting you in the terminal to pull again. Either way, the next move is theirs.

If you're mid-sweep and a pull happens to come back empty for a moment (the author is typing the next directive), one or two short re-pulls (~5-10s apart) is fine before falling back to the handoff above. `slopmop events` is available as a wake-up optimisation if your runtime keeps long-lived connections cheap; pulling alone is sufficient.

## 0. bootstrap

If given a file path:

```bash
slopmop init "./article.md"
```

Tell the author: "Open the printed URL in your browser. I'll wait."

If given a URL:

```bash
slopmop attach "https://slopmop.io/d/abc123"
```

Either way, the session lands at `.slopmop/session.json` in cwd. Treat the doc URL as the capability - anyone with it can drive the session, that's intentional.

**Right after the bootstrap**, send a heartbeat and declare the initial task list:

```bash
slopmop heartbeat
slopmop task phase-a in-progress "Phase A: framing pass + catalogue walk"
slopmop task phase-b open "Phase B: drive steering loop"
```

Skipping this is a regression - the writer is staring at a blank pill wondering whether anything is wired.

## 1. analysis (BYOM)

You are the **drafter**. All detection - Rung 1 (lexical), Rung 2 (judgment), Rung 3 (editorial) - is yours. The server stores the catalogue, the docs, the flags, and orchestrates the steering loop, but it does not read prose. That's you.

### 1a. framing pass

Before the catalogue walk, take one read for *what kind of fix this piece needs*. Not every piece needs slopmop. Some need to be shorter. Some need a structural argument before any prose polish makes sense. Slopmop's loop is most useful on prose that is roughly the right shape and length - if the piece is bloated or in the wrong format, polishing it is sanding a board you're about to throw out.

One LLM read of the source. Note:

- **Word count** (raw - source split on whitespace).
- **Stage** - rough draft (argument still settling), polished (argument settled, prose loose), near-ship (would survive light edits and you're looking for the last 10%).
- **Length-fit** - is the piece earning its words? A 5400-word piece arguing at 2500-word density should be 2500. If you can name the cuts, name them.
- **Format-fit** - is the shape right? Essay-as-bullets, reference-as-essay, a thread that should be three pieces.

Post one `observation` note. If the framing assessment is mild (length is earned, shape is right), say so briefly and proceed to 1b. If it surfaces something - bloat, structural drift, wrong shape - lay out the options:

```bash
slopmop note observation "5400 words, polished. Argues at ~2500-word density - the third section restates the second. Three options before slopmop: (1) /distill - a clean ~2400-word version that loses nothing essential; (2) /compress - keep structure, trim repetition (~15%); (3) proceed and slopmop the piece as-is. /distill and /compress are Claude Code commands you run yourself from the terminal; I cannot trigger them. I default to (3) unless you tell me to wait."
```

You do not run `/distill` or `/compress` - those are sibling Claude Code commands the author invokes from the terminal. You're surfacing the option. Then proceed to the catalogue walk; the author decides whether to interrupt and take a different path first. If they do, they'll tell you to pause; otherwise, your work continues to be useful even if they later run `/compress` (anchored flags relocate against minor edits) - it's only a wholesale `/distill` that would moot the catalogue walk.

The framing pass is a one-time read at session start. Don't re-do it on subsequent passes - the author owns the structural-vs-polish decision once the session is running.

### 1b. pull the catalogue

```bash
slopmop catalogue > /tmp/slopmop-catalogue.json
```

`{ categories, patterns }`. Each pattern carries `whyItsSlop`, `fix`, `examples` (sloppy / better pairs), `skipRule`, and often a long-form `essay`. That's your detection spec; the `skipRule` is your preservation rule.

### 1c. detect

Walk the catalogue against the source. Subagents parallelise this - shape the dispatch as fits the prose. A useful pattern: a quick voice-memo subagent first (register, formal devices the piece is using deliberately, passages that look like slop but aren't), then a detection subagent per rung seeded with the memo. But the dispatch is yours to choose; the prose tells you what shape works.

**When Phase A is done.** Walk the catalogue *once* - every pattern considered against the source at least once, even when the verdict is "doesn't bite here." Flag the matches; for non-matches the *decision* is what counts (don't quietly drop patterns from the walk and don't post no-op flags either - it's a private completeness check). Per-rung subagent dispatch is the sweet spot for most pieces: three or four calls (voice memo + one per rung) of ~8-10 patterns each, source loaded once per call. Per-pattern dispatch is overkill; single-call whole-catalogue walks only fit for short pieces (under ~1000 words) where source + catalogue + reasoning fit comfortably in one context. You're done when each rung has been walked once and the Phase A summary `finding` note is posted - then flip `phase-b` to in-progress and start the loop. Don't re-walk to second-guess yourself; the catalogue is incremental, and if the author wants another pass on a section they'll ask.

What each detected flag should carry:

- `patternId` from the catalogue
- `text` - the verbatim substring
- `start`, `end` - character offsets if you have them; omit if you don't and the server will locate the text
- `rationale` - why *this* passage is *that* pattern. The author reads it in the UI. "Matches throat-clearing" is dead weight; "the sentence opens with 'It's important to note that' before the substance, asking the reader's permission to make the point" is useful.
- `severity` - **your subjective weight, 0 to 1.** This is the scoring mechanism: the server aggregates per-flag severity into the overall score and per-rung breakdown. The catalogue's `severity` (`primary` / `high` / `medium` / `low`) is a starting point, not a verdict. Adjust per instance: a deliberate move named in the voice memo gets a low number even if it matches a pattern; an egregious instance of a usually-mild pattern gets a high one. Voice memo informs every weight. Omit only if you genuinely can't weigh - the server falls back to a per-pattern default.
- `suggestion` - optional inline candidate. Include when the fix is mechanical and short (a substitute, a cut, a clear active-voice rewrite). Omit when the rewrite needs the author's voice or judgment, and leave those for the steering loop.

### 1d. submit

Build a `flags.json` (typically by writing it from a subagent's output) and post it:

```bash
slopmop flag-post @flags.json
```

Schema (the file the CLI passes to `POST /flags`):

```json
{
  "flags": [
    {
      "patternId": "absent-actor",
      "text": "It was decided that the framework would be revised",
      "rationale": "Passive plus \"it was decided\" hides who decided. The actor is unnamed.",
      "severity": 0.85,
      "suggestion": "The committee revised the framework on Tuesday."
    }
  ],
  "modelTag": "claude-opus-4-7"
}
```

Server validates against the catalogue, relocates anchors if the offsets don't fit, dedupes, and reports `added N, skipped M`. Skipped entries print their `reason`; check them.

Flags without `suggestion` go to `open` - the author sweeps and directs. Flags with `suggestion` go to `awaiting-accept` - the author takes or redirects. `flag-post` is incremental: re-run later (after re-reading a section, after the author asks for another pass) and dedupe is automatic.

After Phase A lands, mark its task done and post a `finding` note summarising what the catalogue walk turned up - what dominates, what's absent, what surprised you. Then flip `phase-b` to `in-progress` and start the loop.

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

Then re-run Phase A. Heartbeat, declare fresh `phase-a` / `phase-b` tasks, walk the catalogue with the new lens folded in, post the new flag set. The author's voice samples (from accepted rewrites) are still there - keep using them.

What this is *not*: a source revert. If the author wants the prose itself rolled back (undo a Rung 3 push), that's `slopmop revert` - a separate command. Reset is purely about your analysis hypothesis.

When to use it (the trigger phrases vary; the shape is the same):
- "start over", "reset", "do it again", "scrap that"
- "this is garbage, redo"
- "look at it through the lens of X" / "from Y's eyes" / "as if Z"
- "forget that, the real issue is..."

When *not*: incremental redirection on a single flag is a directive, not a reset. "More committal on this one" stays in the response loop. Reset is for "throw out the map and re-draw it".

## 6. voice samples

The author's accepted rewrites are the calibration samples for their voice. Pull a batch on session start, and again every dozen resolutions or so:

```bash
slopmop voice -n 20
# -> { samples: [{ pre, post, directive, patternId, rung }, ...] }
```

Pack them into your prompt as few-shot examples. Voice converges over the session if you use them; stays generic if you don't.

## 7. density scoring

Slop catalogue tells the author what's *wrong* with a passage. Density is the other lens: per-paragraph numeric scores along a few axes, rendered as a thin gradient rail in the article margin so the author can see at a glance where the prose is alive vs dead. **Information**, **argument**, **impact**, **specificity**, **voice** are the canonical defaults; you can drop any that don't fit a piece, and you can add your own (e.g. *humour*, *tension*, *stakes*) when the work calls for it. The client renders the union it sees, with extras getting a neutral fallback color.

**When to score:**
- Once at session start, after you post flags. Most paragraphs land their scores here.
- After a fullSource push (Rung 3 editorial rewrite): every paragraph hash that doesn't already exist in the cache needs re-scoring. Per-flag patches that stay inside an anchor window don't change the paragraph hash, so existing scores carry over for free.
- Whenever the author asks ("re-score density", "the scores are stale").

**The flow:**

```bash
# Pull paragraph list and current density cache. Server hashes paragraphs for you.
slopmop density --json
# -> { paragraphs: [{ hash, start, end, text }], density: { hash: { axis: score } } }
```

For each paragraph whose `hash` is missing from `density`, score it. Use a single LLM call that takes the paragraph (with surrounding paragraph context for voice judgement) and returns the axis scores. Score 0..10:

- **information**: density of facts, named entities, numbers. Hand-wavy abstractions = low; concrete claims = high.
- **argument**: is a claim being made and supported here, or is the paragraph just sitting there? Inert connective tissue = low; load-bearing = high.
- **impact**: does this hit. Punchline-quality, specific imagery, payoff. Filler = low; lands = high.
- **specificity**: concrete nouns vs abstractions. "Three counties" beats "many areas." Specific = high.
- **voice**: does this sound like the writer (per voice samples) or like a model. Signature voice = high; generic = low.

Drop any axis that genuinely doesn't apply (e.g. voice=N/A on a piece with no voice samples yet). Add an axis if you've got a strong take ("Tension - is something at stake here").

**Score for contrast, not calibration.** There is no objectively correct number for "information=6.5" - the scale is subjective and that's fine. The signal the author wants is *relative*: which paragraphs are alive vs dim along each axis, where the prose dies and where it carries weight. Use the full 0-10 range across the piece. If your scores all cluster between 6 and 8, the rail looks uniform and tells the author nothing - rescore with sharper contrast: pin the weakest paragraph low and the strongest high, then place the rest between them. Embrace the subjectivity; the rail is a *visual diff* against the writer's own piece, not an absolute grade.

Build a `scores.json`:

```json
{
  "modelTag": "claude-opus-4-7",
  "scores": [
    { "paragraphHash": "h1", "axes": { "information": 7.5, "argument": 4, "impact": 6.5, "specificity": 8, "voice": 5 } },
    { "paragraphHash": "h2", "axes": { "information": 2, "argument": 1, "impact": 1.5, "specificity": 2, "voice": 3, "tension": 0.5 } }
  ]
}
```

Post it:

```bash
slopmop density-post @scores.json
```

Server stores by hash, so unchanged paragraphs keep their scores across edits forever - re-running density on a second pass only spends tokens on the paragraphs that drifted.

The author can read the rail to decide where prose is dying ("this whole section is dim") - that's a higher-leverage signal than nudging individual lexical flags. Don't lecture about it; just score.

## 8. wrap up

When the author says `done`, or `slopmop pull` returns empty repeatedly, fetch the companion:

```bash
slopmop companion --out companion.json
```

Contains the full event log, the final source, every flag's resolution, every response, every candidate. If invoked with `--apply` (in your wrapping script), write the final source back to the original file via `Edit` to keep a clean diff. Otherwise, print the path and let the author copy edits over.

For the full command list run `slopmop --help`. Body conventions for write commands: positional text, `--stdin`, `-`, or `@path` - pick whichever fits the call site.

## constraints

- **All detection is yours.** Rung 1, 2, and 3 - the server doesn't read prose. The catalogue is the spec; you walk it.
- **Severity is your scoring vote.** Per-flag `severity` is the score. The voice memo informs the weight - a deliberate move scores low even if it matches a catalogued pattern. Don't autopilot the catalogue's nominal severity through; adjust per instance.
- **The author shapes; you write.** Slopmop's loop is: you draft, author redirects via shape directives. Never ask the author to write the sentence.
- **Pull, don't push.** The author submits directives whenever they want; you pull when you have capacity. The queue holds work for you - none of it is missed if you're slow.
- **Multiple candidates are fine.** Post one if there's a clear best take; post two or three when the directive admits real alternatives the author would want to compare. The author picks one, the rest become history. Don't manufacture filler variants - the bar is real difference, not coverage.
- **Per-flag work is sequential, across flags is batched.** Pull a queue, process several in parallel, post a single resolutions batch. Then pull again.
- **Hash is automatic.** The CLI tracks `If-Match` for you. On 412 (`exit 4`), re-pull and rebase - don't try to silently retry.
- **Granularity is the feature.** Rung 1/2 are sentence-level (or smaller) patches. Rung 3 is the only path that touches paragraph structure. Never rewrite a paragraph as a per-flag patch - it won't fit in the anchor window and the call rejects 422.
- **Punt rather than guess.** If you can't address a directive, punt with a reason. The author decides what to do.
- **Voice memory accumulates.** Pull voice samples regularly. The session converges on the writer's voice if you use them.
- **Skip / keep / let-me-try / accept / discard are user-side.** Self-resolve server-side. You will never see those kinds in the queue.
- **The score is Rung 1 only.** Rung 2 / Rung 3 are reported as counts, not folded into the headline. Don't try to "fix" Rung 2 hits to chase the score.
- **Density is keyed by paragraph hash, not flag id.** Don't re-score paragraphs whose hash is already in the density cache - they haven't changed. Your token budget goes to the new and the drifted.

## appendix: raw HTTP

The CLI is a thin layer over the HTTP API. If you can't install Bun (Codex, opencode, custom scripts), drive it directly. The doc id from the URL is the capability - no separate auth header. Every state-changing call requires `X-Skill-Version: 2026-05-09.6`; source-mutating calls (`POST /flags`, `POST /resolutions`, `PUT /source`, `POST /source/revert`) require `If-Match: <currentHash>` and return the new `sourceHash` in the response. 412 means the source moved - re-fetch and retry.

Routes (full schemas: read the CLI source at `cli/client.ts` + `cli/commands/*.ts`, or `slopmop --help`):

- `POST /docs` / `GET /docs/:id` / `PUT /docs/:id/source` / `POST /docs/:id/source/revert`
- `GET /catalogue`
- `POST /docs/:id/flags`, `POST /docs/:id/flags/:fid/comments`
- `GET /docs/:id/responses?...`, `POST /docs/:id/responses`, `POST /docs/:id/responses/:rid/transition`
- `POST /docs/:id/resolutions`
- `GET /docs/:id/voice-samples`, `GET /docs/:id/companion`
- `GET /docs/:id/density`, `POST /docs/:id/density`
- `GET /docs/:id/events` (SSE)
- `POST /docs/:id/agent/heartbeat`, `POST /docs/:id/agent/notes`, `POST /docs/:id/agent/tasks`, `DELETE /docs/:id/agent/tasks/:key`
- `GET /docs/:id/agent-hints`, `PUT /docs/:id/agent-hints`
- `POST /docs/:id/reset`

Breaking changes from prior versions (skill v2026-05-09.5 and earlier):
- `POST /flags/:fid/{accept,discard,skip,keep-deliberate}` -> `POST /responses { flagId, kind: 'accept' | 'discard' | 'skip' | 'keep' }`
- `POST /responses/:rid/punt` and `/cancel` -> `POST /responses/:rid/transition { to: 'stuck' | 'cancelled', reason? }`
- `GET /events/poll` -> dropped; use the SSE stream
