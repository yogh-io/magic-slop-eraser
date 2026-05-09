---
description: Walk a markdown document through the slopmop deslop loop - pull author directives, draft candidates, post resolutions, repeat
skillVersion: 2026-05-09.5
allowed-tools: Bash, Read, Edit, Write, Monitor
---

# slopmop

A *steering loop* for fixing AI-slop in prose. The author defines shape; you (the **drafter**) draft the prose; the author re-directs until the sentence lands. The work is the author's; you are the keyboard.

The slopmop site is the source of truth and the steering surface. You push prose, find slop, draft candidates from author directives, post resolutions. The author sweeps in the browser at their own pace; you grind in the background. Written for Claude Code; the API is the same elsewhere, the subagent dispatch below assumes the Task tool.

## inputs

Two entry points:

- **Local file**: `slopmop ./article.md` - POST it to a fresh doc, surface the share URL, ask the author to open it.
- **Existing URL**: `slopmop https://{HOST}/d/{id}` - parse `id`, GET the doc, resume.

`HOST` defaults to whatever `SLOPMOP_HOST` is set to. Local dev: `http://localhost:8787`.

## skill version

This file declares `skillVersion: 2026-05-09.5` in its frontmatter. That literal is your version. Send it as a header on **every** API call:

```
X-Skill-Version: 2026-05-09.5
```

The curl examples below mostly omit this header for readability. Treat them as illustrative - the header is required on every call regardless.

Every server response carries `X-Skill-Latest-Version`. If it differs from your literal, the skill is out of date - tell the author once at the start of the session:

> "The slopmop skill I have installed (v2026-05-09.5) is older than what the server expects (vX). Ask me to update it, or reinstall manually from `${HOST}/skill`."

The server flags two failure modes via response headers:
- `X-Skill-Stale: true` - your declared version differs from the server's literal. Surface the upgrade hint above.
- `X-Skill-Version-Missing: true` - your request omitted `X-Skill-Version` entirely. The staleness check is silently broken; start sending the header on every call.

Either is enough to mention once and keep working; the API stays backward-compatible with one prior version.

## self-update

If the author asks you to check for slopmop updates ("check for updates", "is the skill current?", "pull the latest skill", "update slopmop"), or you flagged staleness above and the author wants to act on it, run this flow:

1. **Fetch the canonical skill** from the production site - always `slopmop.io`, not `${HOST}`. The canonical version is what the public deploy serves; local-dev hosts can be behind.

   ```bash
   curl -sf https://slopmop.io/slopmop.md -o /tmp/slopmop-latest.md
   ```

2. **Read the version** from the fetched file's frontmatter (the `skillVersion:` line in the leading `---` block).

3. **Compare** against your declared version (line 3 of this file). If they match, tell the author "already current (vX)" and stop.

4. **Locate your installed SKILL.md.** It is one of:

   - `~/.claude/skills/slopmop/SKILL.md` (Claude Code global install)
   - `.claude/skills/slopmop/SKILL.md` (project-local, relative to the session's cwd)
   - Whichever path the runtime loaded this skill from for non-Claude-Code agents

   Read the frontmatter of each candidate that exists; the one whose `skillVersion` matches your declared version is the file you were loaded from. If both match, update both. If neither matches, tell the author you cannot find the source file and stop.

5. **Overwrite** the file with the fetched content using `Write`. Replace the whole file so frontmatter and body stay in sync - do not edit selectively.

6. **Tell the author** what you did, e.g. "Updated slopmop skill from v2026-05-09.1 to vNEW at `<path>`. Reload this session to pick it up - skill files are read at session start, so the running session keeps the old behaviour until restart."

Do not try to re-parse this file mid-session - the harness loaded it once at startup and will not re-read until the next session.

## tell the author you are alive

The browser shows an "agent" pill that turns green the moment it hears from you. **Ping the server as the very first network call of the session** so the writer sees the pipeline is wired before any analysis arrives:

```bash
curl -s -X POST -H "X-Skill-Version: 2026-05-09.5" "$HOST/docs/$ID/agent/heartbeat"
```

That bumps `lastSeenAt` and emits an `agent-heartbeat` event. Subsequent flag posts, suggestions, notes, and task updates also bump it; the heartbeat is just the *first* sighting before there's anything to post.

You don't need to heartbeat on a fixed interval - any activity counts. Send a fresh heartbeat only after long stretches of idle work (e.g. a multi-minute subagent dispatch where nothing else hits the API).

## report tasks and observations

The author is steering from the browser; they cannot see what your subagents are doing. Two channels close that gap:

### tasks (structured, live)

Declare the shape of the work with `POST /docs/$ID/agent/tasks`. Each task carries a stable `key` (drafter-set, e.g. `phase-a`), a `title`, an optional `detail`, and a `status` (`open` / `in-progress` / `done`). Upsert by key:

```bash
curl -s -X POST -H "X-Skill-Version: 2026-05-09.5" -H 'content-type: application/json' \
  -d '{"key":"phase-a","title":"Phase A: framing pass + catalogue walk","status":"in-progress"}' \
  "$HOST/docs/$ID/agent/tasks"
```

When the task is done:

```bash
curl -s -X POST -H "X-Skill-Version: 2026-05-09.5" -H 'content-type: application/json' \
  -d '{"key":"phase-a","title":"Phase A: framing pass + catalogue walk","status":"done"}' \
  "$HOST/docs/$ID/agent/tasks"
```

Default starting set at session start: a `phase-a` task for analysis and a `phase-b` task for the steering loop, with phase-b `open` until you start it. Add finer-grained tasks during a long catalogue walk (e.g. `r1-walk`, `r2-walk`, `r3-walk`) so the author can see *which* slice you're on.

If a declared task is no longer relevant (the author said "skip Rung 2 entirely", you took a different shape than planned), pull it out with `DELETE`:

```bash
curl -s -X DELETE -H "X-Skill-Version: 2026-05-09.5" \
  "$HOST/docs/$ID/agent/tasks/r2-walk"
```

The task disappears from the live list; the `agent-task-upserted` events for it stay in the timeline as history. Don't mark abandoned work `done` - that's a lie the writer will read off the panel.

### notes (free-form, timestamped)

Drop a note when you have something the writer should hear: a finding, a concern, or a heads-up that changes how they should think about the session. `POST /docs/$ID/agent/notes`:

```bash
curl -s -X POST -H "X-Skill-Version: 2026-05-09.5" -H 'content-type: application/json' \
  -d '{"kind":"finding","body":"Walked the catalogue. The piece is unusually committal - most slop categories don'"'"'t bite. Strongest hits: allusive constructs (bare references to prior project work a cold reader cannot parse), one absent-actor, one antithesis-shaped pivot."}' \
  "$HOST/docs/$ID/agent/notes"
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

1. **Pull** open work: `GET /docs/$ID/responses?status=pending` (with whatever filters narrow the queue - rung, category, severity, patternId, limit).
2. **Process** each one: read the flag, the surrounding paragraph, the trail of prior directives + candidates on this flag. Pick a resolution path (per-flag patch or full-source push). Draft the candidate.
3. **Post** the resolution: `POST /docs/$ID/resolutions` with patches and/or fullSource. `If-Match` the current source hash.
4. **Pull** again. The author may have submitted new directives while you worked; pick them up. Loop.

**When the queue empties, hand the loop back to the author.** Don't spin or poll silently - the author is the wheel; if they have nothing in flight, you have nothing to do. Post a short `progress` note ("queue clear; ping me when you have more directives") and stop. They re-engage by sweeping more flags in the browser, or by prompting you in the terminal to pull again. Either way, the next move is theirs.

If you're mid-sweep and a pull happens to come back empty for a moment (the author is typing the next directive), one or two short re-pulls (~5-10s apart) is fine before falling back to the handoff above. SSE is the wake-up optimisation - subscribe if your runtime keeps long-lived connections cheap, skip it otherwise. Pulling alone is sufficient; don't lean on event subscription as the primary trigger.

## 0. bootstrap

If given a file path:

```bash
SOURCE=$(jq -Rs . < "$FILE")
DOC=$(curl -s -X POST "$HOST/docs" \
  -H 'content-type: application/json' \
  -d "{\"source\": $SOURCE, \"title\": \"$(basename $FILE)\"}")
ID=$(echo "$DOC" | jq -r .id)
HASH=$(echo "$DOC" | jq -r .sourceHash)
```

Tell the author: "Open `${HOST}/d/${ID}` in your browser. I'll wait."

If given a URL: parse `{id}` from the path, then:

```bash
DOC=$(curl -s "$HOST/docs/$ID")
HASH=$(echo "$DOC" | jq -r .sourceHash)
```

The doc id is the capability - anyone with the URL can drive the session, that's intentional. Treat it like any unguessable share link. Track `HASH` across the session. Every call that mutates the source returns the new hash in the response body; update your local copy each time.

**Right after the bootstrap fetch**, send a heartbeat and declare the initial task list (see "tell the author you are alive" / "report tasks and observations" below). Skipping this is a regression - the writer is staring at a blank pill wondering whether anything is wired.

```bash
curl -s -X POST -H "X-Skill-Version: 2026-05-09.5" "$HOST/docs/$ID/agent/heartbeat"
curl -s -X POST -H "X-Skill-Version: 2026-05-09.5" -H 'content-type: application/json' \
  -d '{"key":"phase-a","title":"Phase A: framing pass + catalogue walk","status":"in-progress"}' \
  "$HOST/docs/$ID/agent/tasks"
curl -s -X POST -H "X-Skill-Version: 2026-05-09.5" -H 'content-type: application/json' \
  -d '{"key":"phase-b","title":"Phase B: drive steering loop","status":"open"}' \
  "$HOST/docs/$ID/agent/tasks"
```

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
curl -s -X POST -H "X-Skill-Version: 2026-05-09.5" -H 'content-type: application/json' \
  -d '{"kind":"observation","body":"5400 words, polished. Argues at ~2500-word density - the third section restates the second. Three options before slopmop: (1) /distill - a clean ~2400-word version that loses nothing essential; (2) /compress - keep structure, trim repetition (~15%); (3) proceed and slopmop the piece as-is. /distill and /compress are Claude Code commands you run yourself from the terminal; I cannot trigger them. I default to (3) unless you tell me to wait."}' \
  "$HOST/docs/$ID/agent/notes"
```

You do not run `/distill` or `/compress` - those are sibling Claude Code commands the author invokes from the terminal. You're surfacing the option. Then proceed to the catalogue walk; the author decides whether to interrupt and take a different path first. If they do, they'll tell you to pause; otherwise, your work continues to be useful even if they later run `/compress` (anchored flags relocate against minor edits) - it's only a wholesale `/distill` that would moot the catalogue walk.

The framing pass is a one-time read at session start. Don't re-do it on subsequent passes - the author owns the structural-vs-polish decision once the session is running.

### 1b. pull the catalogue

```bash
curl -s "$HOST/catalogue" > /tmp/slopmop-catalogue.json
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

```bash
curl -s -X POST -H "If-Match: $HASH" -H 'content-type: application/json' \
  -d '{
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
  }' \
  "$HOST/docs/$ID/flags"
```

Server validates against the catalogue, relocates anchors if the offsets don't fit, dedupes, and returns `{ added, flags, skipped }`. Skipped entries carry a `reason`; check them.

Flags without `suggestion` go to `open` - the author sweeps and directs. Flags with `suggestion` go to `awaiting-accept` - the author takes or redirects. `POST /flags` is incremental: re-run later (after re-reading a section, after the author asks for another pass) and dedupe is automatic.

After Phase A lands, mark its task done and post a `finding` note summarising what the catalogue walk turned up - what dominates, what's absent, what surprised you. The writer reads this in the agent panel; it's the first thing that orients them. Then flip `phase-b` to `in-progress` and start the loop.

## 2. honour agent-hints

The author can pin filters that scope what work you should pick up first. Read them on each pull cycle:

```bash
curl -s "$HOST/docs/$ID/agent-hints"
# -> { "agentHints": { rungs?, categories?, severities?, patternIds?, paused? } }
```

If `paused: true`, sleep and try later. Otherwise, fold the filter values into your responses pull as query params, and into your Phase A analysis (skip patterns the author has narrowed away). The author can change hints mid-session, so re-read them between pulls.

## 3. pull the queue

```bash
curl -s "$HOST/docs/$ID/responses?status=pending&rung=1,2&limit=10"
```

Returns an array of Response objects. Each carries `id` (the `rid`), `flagId`, `kind` (`shortcut` / `free` / `let-me-try` / `skip` / `keep`), and `body` (the directive text).

`skip`, `keep`, and `let-me-try` are self-resolved by the server. You will only ever see `shortcut` and `free` directives in the queue. The other kinds resolve themselves the moment the author submits them.

For each response, fetch the doc state once per loop and find the flag in it:

```bash
curl -s "$HOST/docs/$ID" \
  | jq --arg fid "$FID" '.flags[] | select(.id == $fid)'
```

The flag carries `anchor` (start/end/text/prefix/suffix), `rationale`, `excerpt`, `patternId`, `rung`. Slice the surrounding paragraph from `doc.source` using the anchor positions for paragraph context the model will need.

For flags that already have a trail (re-directions on prior candidates), pull the suggestion history from the companion endpoint:

```bash
curl -s "$HOST/docs/$ID/companion" \
  | jq --arg fid "$FID" '.suggestions | map(select(.flagId == $fid)) | sort_by(.createdAt)'
```

Read the rationale, the paragraph context, the directive, any prior attempts the author rejected. Draft one candidate that incorporates the directive without retreading what's already been tried.

## 4. post the resolution

Two paths. Pick per fix.

### path A: per-flag patch (Rung 1/2, the common case)

Edit fits within the flag's anchor span. Source is not mutated by your post; the candidate becomes an *awaiting-accept* overlay the author reviews and accepts (or re-directs) in the browser.

```bash
curl -s -X POST \
  -H "If-Match: $HASH" \
  -H 'content-type: application/json' \
  -d "{
    \"patches\": [{
      \"respondedTo\": \"$RID\",
      \"flagId\": \"$FID\",
      \"replacementText\": \"work through\"
    }],
    \"modelTag\": \"$MODEL_TAG\"
  }" \
  "$HOST/docs/$ID/resolutions"
```

### path B: full-source push (Rung 3 editorial)

Edit needs to move text outside any single anchor span - paragraph rearrangement, section rewrite, structural change, dropping a paragraph entirely. You replace the *entire* source. Server reconciles every open flag against the new source: text-changed flags auto-resolve, unrelocatable flags go stale, pending directives on stale flags are cancelled.

```bash
NEW_SOURCE=$(jq -Rs . < new-source.md)
curl -s -X POST \
  -H "If-Match: $HASH" \
  -H 'content-type: application/json' \
  -d "{
    \"fullSource\": {
      \"respondedTo\": [\"$RID1\", \"$RID2\"],
      \"source\": $NEW_SOURCE
    },
    \"modelTag\": \"$MODEL_TAG\"
  }" \
  "$HOST/docs/$ID/resolutions"
```

One fullSource per batch. A second would just clobber the first.

### batching

A single batch can carry many patches plus optionally one fullSource. Apply all of them in one call - server processes the batch transactionally. Patches apply first in array order, fullSource (if present) last.

### concurrency

Always pass `If-Match: <sourceHash>`. If the source has moved since you fetched (author paste-edit, another agent pushed, a revert), you get `412 Precondition Failed`. Re-fetch the doc, rebase your patch against the new state, retry. Don't panic - this is normal.

## 5. punt when stuck

Some directives won't have a clean fix. "Punchline first" on a paragraph with no clear punchline. "More committal" on a sentence that's already as direct as it can be. Don't fake a candidate to clear the queue - punt:

```bash
curl -s -X POST \
  -H 'content-type: application/json' \
  -d "{\"reason\": \"no clear punchline; the paragraph has three parallel beats already\"}" \
  "$HOST/docs/$ID/responses/$RID/punt"
```

Status flips to `stuck`. The author sees it in the panel, gives a different directive or closes the flag manually.

## start over (the reset signal)

The author may, at any point, decide your read of the piece is wrong. "This is all garbage, do it again." "Start over, look at it through the lens of an angry literary critic." "Forget all that, the real problem is the second half." When that happens, scrap your in-flight hypotheses and re-walk - don't try to patch the existing flag set into the new framing.

Call:

```bash
curl -s -X POST -H "X-Skill-Version: 2026-05-09.5" -H 'content-type: application/json' \
  -d "{\"reason\": \"angry literary critic lens; the piece sounds eager\"}" \
  "$HOST/docs/$ID/reset"
```

Server-side this drops your `open` and `awaiting-accept` flags, the unaccepted suggestions tied to them, the comments anchored to them, all your tasks, all your notes, and cancels any pending responses. Source, accepted suggestions, resolved/skipped/kept flags, density scores, and agent-hints survive - the *durable* record of decisions the author already landed stays put. A `drafter-reset` event with the reason hits the activity timeline so the writer sees the breadcrumb.

Then re-run Phase A. Heartbeat, declare fresh `phase-a` / `phase-b` tasks, walk the catalogue with the new lens folded in, post the new flag set. The author's voice samples (from accepted rewrites) are still there - keep using them.

What this is *not*: a source revert. If the author wants the prose itself rolled back (undo a Rung 3 push), that's `POST /docs/$ID/source/revert` - a separate call. Reset is purely about your analysis hypothesis.

When to use it (the trigger phrases vary; the shape is the same):
- "start over", "reset", "do it again", "scrap that"
- "this is garbage, redo"
- "look at it through the lens of X" / "from Y's eyes" / "as if Z"
- "forget that, the real issue is..."

When *not*: incremental redirection on a single flag is a directive, not a reset. "More committal on this one" stays in the response loop. Reset is for "throw out the map and re-draw it".

## 6. voice samples

The author's accepted rewrites are the calibration samples for their voice. Pull a batch on session start, and again every dozen resolutions or so:

```bash
curl -s "$HOST/docs/$ID/voice-samples?n=20"
# -> [{ pre, post, directive, patternId, rung }, ...]
```

Pack them into your prompt as few-shot examples. Voice converges over the session if you use them; stays generic if you don't.

## 7. density scoring

Slop catalogue tells the author what's *wrong* with a passage. Density is the other lens: per-paragraph numeric scores along a few axes, rendered as a thin gradient rail in the article margin so the author can see at a glance where the prose is alive vs dead. **Information**, **argument**, **impact**, **specificity**, **voice** are the canonical defaults; you can drop any that don't fit a piece, and you can add your own (e.g. *humour*, *tension*, *stakes*) when the work calls for it. The client renders the union it sees, with extras getting a neutral fallback color.

**When to score:**
- Once at session start, after you POST flags. Most paragraphs land their scores here.
- After a fullSource push (Rung 3 editorial rewrite): every paragraph hash that doesn't already exist in the cache needs re-scoring. Per-flag patches that stay inside an anchor window don't change the paragraph hash, so existing scores carry over for free.
- Whenever the author asks ("re-score density", "the scores are stale").

**The flow:**

```bash
# Pull paragraph list and current density cache. Server hashes paragraphs for you.
curl -s "$HOST/docs/$ID/density"
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

Post the batch back:

```bash
curl -s -X POST \
  -H 'content-type: application/json' \
  -d "{
    \"modelTag\": \"$MODEL_TAG\",
    \"scores\": [
      {\"paragraphHash\": \"$H1\", \"axes\": {\"information\": 7.5, \"argument\": 4, \"impact\": 6.5, \"specificity\": 8, \"voice\": 5}},
      {\"paragraphHash\": \"$H2\", \"axes\": {\"information\": 2, \"argument\": 1, \"impact\": 1.5, \"specificity\": 2, \"voice\": 3, \"tension\": 0.5}}
    ]
  }" \
  "$HOST/docs/$ID/density"
```

Server stores by hash, so unchanged paragraphs keep their scores across edits forever - re-running density on a second pass only spends tokens on the paragraphs that drifted.

The author can read the rail to decide where prose is dying ("this whole section is dim") - that's a higher-leverage signal than nudging individual lexical flags. Don't lecture about it; just score.

## 8. wrap up

When the author says `done`, or `responses?status=pending` returns empty repeatedly, fetch the companion:

```bash
curl -s "$HOST/docs/$ID/companion" > companion.json
```

Contains the full event log, the final source, every flag's resolution, every response, every candidate. If invoked as `slopmop ./article.md --apply`, write the final source back to the file (use `Edit` to keep a clean diff). Otherwise, print the path and let the author copy edits over.

## API reference

| Verb | Endpoint | Purpose |
|---|---|---|
| `POST` | `/docs` | Create document |
| `GET` | `/docs/:id` | Doc + counts + score + sourceHash + flags |
| `PUT` | `/docs/:id/source` | Replace entire source (If-Match required) |
| `POST` | `/docs/:id/source/revert` | Roll back to a prior version |
| `GET` | `/catalogue` | Catalogue dump (no auth) - your detection spec |
| `POST` | `/docs/:id/flags` | Submit your detected flags (with optional inline suggestions) |
| `GET` | `/docs/:id/agent-hints` | Read author-set advisory filters |
| `GET` | `/docs/:id/responses?status=pending&rung=&category=&severity=&patternId=&limit=` | Pull author directives (the queue) |
| `POST` | `/docs/:id/responses/:rid/punt` | Agent gives up on a directive |
| `POST` | `/docs/:id/resolutions` | Batch resolution: patches + optional fullSource (If-Match) |
| `GET` | `/docs/:id/voice-samples?n=N` | Few-shot voice calibration |
| `GET` | `/docs/:id/density` | Paragraph list + current density score cache |
| `POST` | `/docs/:id/density` | Submit per-paragraph density scores (canonical axes or your own) |
| `GET` | `/docs/:id/companion` | Full state for wrap-up |
| `GET` | `/docs/:id/events` | SSE event stream (optional wake-up) |
| `POST` | `/docs/:id/agent/heartbeat` | "Pipeline works" ping; emit at session start |
| `POST` | `/docs/:id/agent/tasks` | Upsert a structured task by `key` (status: open / in-progress / done) |
| `DELETE` | `/docs/:id/agent/tasks/:key` | Remove a task that's no longer relevant (history events stay in timeline) |
| `POST` | `/docs/:id/agent/notes` | Free-form heads-up note (kind: observation / finding / progress / concern) |
| `POST` | `/docs/:id/reset` | Drafter-initiated soft reset: clear in-flight flags/suggestions/responses/tasks/notes; source untouched |

The doc id from the URL is the capability - no separate auth header. All calls should send `X-Skill-Version: 2026-05-09.5` so the server can flag staleness; if you forget, the response carries `X-Skill-Version-Missing: true` to remind you.

## constraints

- **All detection is yours.** Rung 1, 2, and 3 - the server doesn't read prose. The catalogue is the spec; you walk it.
- **Severity is your scoring vote.** Per-flag `severity` is the score. The voice memo informs the weight - a deliberate move scores low even if it matches a catalogued pattern. Don't autopilot the catalogue's nominal severity through; adjust per instance.
- **The author shapes; you write.** Slopmop's loop is: you draft, author redirects via shape directives. Never ask the author to write the sentence.
- **Pull, don't push.** The author submits directives whenever they want; you pull when you have capacity. The queue holds work for you - none of it is missed if you're slow.
- **Multiple candidates are fine.** Post one if there's a clear best take; post two or three when the directive admits real alternatives the author would want to compare. The author picks one, the rest become history. Don't manufacture filler variants - the bar is real difference, not coverage.
- **Per-flag work is sequential, across flags is batched.** Pull a queue, process several in parallel, post a single resolutions batch. Then pull again.
- **Hash before you patch.** Always `If-Match`. The author or another agent can mutate the source between your pull and your push; the server tells you so via 412.
- **Granularity is the feature.** Rung 1/2 are sentence-level (or smaller) patches. Rung 3 is the only path that touches paragraph structure. Never rewrite a paragraph as a per-flag patch - it won't fit in the anchor window and the call will reject 422.
- **Punt rather than guess.** If you can't address a directive, punt with a reason. The author decides what to do.
- **Voice memory accumulates.** Pull voice samples regularly. The session converges on the writer's voice if you use them.
- **Skip / keep / let-me-try are user-side.** Self-resolve server-side. You will never see those kinds in the queue.
- **The score is Rung 1 only.** Rung 2 / Rung 3 are reported as counts, not folded into the headline. Don't try to "fix" Rung 2 hits to chase the score.
- **Density is keyed by paragraph hash, not flag id.** Don't re-score paragraphs whose hash is already in the density cache - they haven't changed. Your token budget goes to the new and the drifted.
