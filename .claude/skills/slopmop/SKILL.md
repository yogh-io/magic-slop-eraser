---
description: Walk a markdown document through the slopmop deslop loop - pull author directives, draft candidates, post resolutions, repeat
skillVersion: 2026-05-08.5
allowed-tools: Bash, Read, Edit, Write, Monitor
---

# slopmop

A *steering loop* for fixing AI-slop in prose. The author defines shape; you (the agent) draft the prose; the author re-directs until the sentence lands. The work is the author's; you are the keyboard.

The slopmop site is the source of truth and the steering surface. You push prose, run detectors, then **pull author directives** off a queue, draft candidates, post **resolutions** back. The author sweeps directives in the browser at their own pace; you grind them in the background. The author re-engages, accepts or re-directs the candidates you posted, repeats.

## inputs

Two entry points:

- **Local file**: `slopmop ./article.md` - POST it to a fresh doc, surface the share URL, ask the author to open it.
- **Existing URL**: `slopmop https://{HOST}/d/{id}` - parse `id`, GET the doc, resume.

`HOST` defaults to whatever `SLOPMOP_HOST` is set to. Local dev: `http://localhost:8787`.

## skill version

This file declares `skillVersion: 2026-05-08.5` in its frontmatter. That literal is your version. Send it as a header on **every** API call:

```
X-Skill-Version: 2026-05-08.5
```

Every server response carries `X-Skill-Latest-Version`. If it differs from your literal, the skill is out of date - tell the author once at the start of the session:

> "The slopmop skill I have installed (v2026-05-08.5) is older than what the server expects (vX). Ask me to update it, or reinstall manually from `${HOST}/skill`."

The server may also set `X-Skill-Stale: true` on responses to a request that sent a stale version. Either signal is enough to trigger the upgrade hint - mention it once and keep working; the API stays backward-compatible with one prior version.

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

6. **Tell the author** what you did, e.g. "Updated slopmop skill from v2026-05-08.5 to vNEW at `<path>`. Reload this session to pick it up - skill files are read at session start, so the running session keeps the old behaviour until restart."

Do not try to re-parse this file mid-session - the harness loaded it once at startup and will not re-read until the next session.

## the shape of the work

Two phases. The first runs once at session start; the second runs on a loop.

**Phase A - analysis (once, at start).** You are the **drafter**: the agent the author hands the URL to. Bring-your-own-model: the slopmop server runs Rung 1 regex for you, but Rung 2 (passage-level judgment) and Rung 3 (presentation / editorial) need a model reading the prose. The drafter does not read the prose - it dispatches **passes** (subagents) that do. A voice memo pass first, then a Rung 2 pass and a Rung 3 pass, both seeded with the memo so they don't flag what the piece is doing deliberately. The drafter merges the pass outputs, dedupes, and posts a single batch of flags via `POST /flags`.

**Phase B - the steering loop (until the author says done).**

1. **Pull** open work: `GET /docs/$ID/responses?status=pending` (with whatever filters narrow the queue - rung, category, severity, patternId, limit).
2. **Process** each one: read the flag, the surrounding paragraph, the trail of prior directives + candidates on this flag. Pick a resolution path (per-flag patch or full-source push). Draft the candidate.
3. **Post** the resolution: `POST /docs/$ID/resolutions` with patches and/or fullSource. `If-Match` the current source hash.
4. **Pull** again. The author may have submitted new directives while you worked; pick them up. Loop.

You don't *have* to subscribe to events. The pull is sufficient. Subscribing to the SSE stream is a wake-up optimisation; skip it if your runtime doesn't keep long-lived connections cheap.

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

## 1. analysis (BYOM)

You are the **drafter** - the agent the author hands the steering URL to. The slopmop server holds documents and orchestrates the steering loop, but it does not do passage-level reading; that's you. Or rather, your **passes** - subagents you dispatch, each focused on one slice of the catalogue, each reading the source through one lens. The drafter merges and posts; the passes do the reading.

The shape is borrowed from `/.claude/commands/workshop.md`: a voice memo first (so every later pass knows what the piece is *doing deliberately*), then per-rung detection passes, then merge. Adapted to slopmop's catalogue and the `POST /flags` API.

**Discipline: the drafter does not read the prose during analysis.** It reads pass outputs, merges, posts. Every read of the source is delegated to a pass. This protects your context and keeps each pass focused; it is also what makes the pattern catchable - the same context that fairly evaluates a pattern is the wrong context to also draft prose against it. Workshop's word for this is "stay in your lane."

### 1a. pull the catalogue and ground yourself

```bash
curl -s "$HOST/catalogue" > /tmp/slopmop-catalogue.json
```

Returns `{ categories, patterns }`. Each pattern carries the spec your passes will apply: `whyItsSlop` (what the pattern *is*), `fix` (the direction the rewrite is heading), `examples` with `sloppy` / `better` pairs, `skipRule` (the preservation rule - cases that look like the pattern but aren't), and often a long-form `essay`. The drafter reads the catalogue once, top-to-bottom; you'll feed slices of it to each pass.

### 1b. trigger Rung 1 (server-side regex)

```bash
curl -s -X POST "$HOST/docs/$ID/run-detectors"
```

Cheap, deterministic, free. The server emits Rung 1 flags from the catalogue's regex layer. Don't redo this work; it's done.

### 1c. Pass 0 - voice memo

Spawn the first subagent. It reads the source and returns a one-paragraph memo describing how the piece sounds. The memo seeds every later pass.

The pass directive (verbatim):

> You are running the voice memo pass for slopmop. Read the target source. Return ONLY the memo - no flags, no commentary, no narration outside the memo. Describe how the piece reads, not what it says.
>
> The memo MUST include:
>
> - **Register classification** - the prose's voice (austere / formal / direct / casual / hybrid), with one phrase of evidence.
> - **Dominant analytical mode** - what the piece's load-bearing material is (argument / kinetic record / explanation / lyric / hybrid).
> - **Formal devices used deliberately** - parallel constructions, anaphora, polysyndeton, named-actor repetition, accumulating long sentences, sharp short sentences, lists-as-method, etc. Anything the piece is doing on purpose that a slop detector would mistake for a bug.
> - **Where the structural argument lives** - one sentence pointing at the section or paragraph that carries the piece.
> - **Non-obvious protections** - passages that look like a slop pattern but are deliberate. Name them. The Rung 2/3 passes will read this list and NOT flag those passages.
>
> Return the memo as a single text paragraph or short markdown block. Do not edit the source.

The drafter reads the memo when it returns. Hold it for the rest of the session - the memo is your only window into the prose's voice when you merge pass outputs.

### 1d. Pass 2 - Rung 2 detection

Spawn a subagent with the source, the voice memo, and the Rung 2 patterns from the catalogue (`absent-actor`, `allusive-construct`, `staccato`, `bidirectional-summary`, `hedged-confidence`, `pivot-to-balance`, `restating-question`, `synthesis-of-nothing`, `performative-humility`, `bullets-where-prose`).

The pass directive (verbatim):

> You are the Rung 2 reader for slopmop. Apply the assigned catalogue patterns to the source. Each pattern's entry carries `whyItsSlop` (what it is), `examples` (sloppy / better pairs), `fix` (rewrite direction), and `skipRule` (cases that look like the pattern but aren't). Read every pattern's full entry before scanning.
>
> The voice memo names what the piece is doing deliberately. Apply it as a preservation rule: if the memo classifies a feature as a formal device or names a passage under "non-obvious protections", DO NOT flag it. Apply each pattern's `skipRule` the same way.
>
> Return a JSON array. For every detected passage:
>
> - `patternId` - exact catalogue id
> - `text` - the verbatim substring (no edits, no truncation marks)
> - `start`, `end` - character offsets into the source if you can compute them; omit if you can't
> - `rationale` - 2 to 3 sentences. What the passage is doing, why this pattern fires *here* (not just a restatement of the pattern), what direction the fix is heading. The author reads this in the UI; make it earn its place.
> - `suggestion` - optional inline candidate rewrite. Include only when the fix is mechanical and short (a substitute, a cut, a clear active-voice rewrite). Omit when the rewrite needs the author's voice or judgment - leave those for the steering loop.
>
> Return JSON only. No preamble. No narration. No commentary outside `rationale`.

### 1e. Pass 3 - Rung 3 detection

Same shape, scope larger. The patterns: `frame-stacking`, `performative-balance`, `header-inflation`. The unit is paragraph / section / piece, not sentence. The fix is rarely an inline replacement (Rung 3 needs paragraph-level rewrites the author has to direct), so suggestions are usually omitted - leave the candidate-drafting to the steering loop.

The pass directive is the same as Pass 2's, with these added lines:

> Rung 3 patterns operate at section-or-larger scope. Your `text` field can be a long span (a paragraph, a section, the opening). The `start`/`end` should bracket the whole offending unit, not just the trigger sentence.
>
> Default to omitting `suggestion`. Rung 3 fixes need the author's hand on the wheel; an inline suggestion would short-circuit the directive loop. Include `suggestion` only when the fix is dropping a paragraph or excising a frame stack - cuts, never rewrites.

### 1f. merge and post

The drafter receives both pass outputs. Merge by `start` (or by appearance in the source if start is missing). Dedupe collisions on `patternId + text`. The server will dedupe again against existing open flags from `/run-detectors`, so don't worry about overlap with Rung 1 - it's handled.

POST in one batch:

```bash
curl -s -X POST -H "If-Match: $HASH" -H 'content-type: application/json' \
  -d "$(jq -n --argjson flags "$MERGED_FLAGS" --arg tag "$MODEL_TAG" \
        '{flags: $flags, modelTag: $tag}')" \
  "$HOST/docs/$ID/flags"
```

The server validates each flag against the catalogue and the source, relocates anchors when offsets are off, dedupes, and returns `{ added, flags, skipped }`. Inspect `skipped` - the `reason` field (`unknown patternId`, `text not found in source`, `duplicate of existing open flag`) is your debugging signal. If a pass is consistently producing flags that don't anchor, that pass needs better instructions next time.

Flags without `suggestion` go to status `open`; the author sweeps them and gives a directive. Flags with `suggestion` go straight to `awaiting-accept`; the author can take the candidate as-is or push back with a directive. The split is deliberate: Rung 2 *with clear mechanical fixes* gets a suggestion; Rung 2 *with voice-dependent rewrites* and most Rung 3 are flag-only. When in doubt, omit the suggestion - the steering loop is cheap, and an unwanted candidate the author has to discard is friction.

### 1g. iterate if you want

`POST /flags` is incremental - it adds, never replaces. After the author works through a batch and asks you to "look again at Rung 3" or "scan the second half harder", spawn a fresh pass with whatever scope they specified and post the new findings. Dedupe is automatic; re-running analysis is safe.

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

## 6. voice samples

The author's accepted rewrites are the calibration samples for their voice. Pull a batch on session start, and again every dozen resolutions or so:

```bash
curl -s "$HOST/docs/$ID/voice-samples?n=20"
# -> [{ pre, post, directive, patternId, rung }, ...]
```

Pack them into your prompt as few-shot examples. Voice converges over the session if you use them; stays generic if you don't.

## 7. wrap up

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
| `POST` | `/docs/:id/run-detectors` | Run mechanical (Rung 1) detectors server-side |
| `GET` | `/catalogue` | Catalogue dump (no auth) - your detection spec |
| `POST` | `/docs/:id/flags` | Submit your LLM-detected flags (with optional inline suggestions) |
| `GET` | `/docs/:id/agent-hints` | Read author-set advisory filters |
| `GET` | `/docs/:id/responses?status=pending&rung=&category=&severity=&patternId=&limit=` | Pull author directives (the queue) |
| `POST` | `/docs/:id/responses/:rid/punt` | Agent gives up on a directive |
| `POST` | `/docs/:id/resolutions` | Batch resolution: patches + optional fullSource (If-Match) |
| `GET` | `/docs/:id/voice-samples?n=N` | Few-shot voice calibration |
| `GET` | `/docs/:id/companion` | Full state for wrap-up |
| `GET` | `/docs/:id/events` | SSE event stream (optional wake-up) |

The doc id from the URL is the capability - no separate auth header. All calls should send `X-Skill-Version: 2026-05-08.5` so the server can flag staleness.

## constraints

- **You do the analysis, not the server.** This is bring-your-own-model. Server-side regex (`/run-detectors`) handles Rung 1; everything else is you reading the source against the catalogue. Never assume the server detected what only a model could detect.
- **The drafter does not read the prose during analysis.** Subagents do. A voice memo pass first; Rung 2 / Rung 3 passes seeded with that memo. The drafter merges, dedupes, posts. Reading and merging are different jobs - keep them separated.
- **Voice memo before any pattern pass.** Without it, the passes flag intentional moves (parallel constructions, named-actor repetition, accumulating long sentences in austere prose) as bugs. The memo names what the piece is doing deliberately so the passes know what *not* to flag.
- **Rationales are read by the author.** When you post flags, write rationales the author wants to read in the UI. "Matches throat-clearing pattern" is dead weight; "the sentence opens with 'It's important to note that' before getting to the substance, asking the reader's permission to make the point" is useful.
- **The author shapes the prose; the drafter writes it.** Workshop's interactive shape (author proposes, agent attacks) is not slopmop's. Slopmop's loop is the inverse: agent drafts a candidate, author redirects with a shape directive, agent re-drafts. Suggestions you bundle at flag-detection time are the same shape - a candidate the author can take, redirect, or discard. Never ask the author to write the sentence.
- **Pull, don't push.** The author submits directives whenever they want; you pull when you have capacity. The queue holds work for you - none of it is missed if you're slow.
- **Multiple candidates are fine.** Post one if there's a clear best take; post two or three when the directive admits real alternatives the author would want to compare. The author picks one, the rest become history. Don't manufacture filler variants - the bar is real difference, not coverage.
- **Per-flag work is sequential, across flags is batched.** Pull a queue, process several in parallel, post a single resolutions batch. Then pull again.
- **Hash before you patch.** Always `If-Match`. The author or another agent can mutate the source between your pull and your push; the server tells you so via 412.
- **Granularity is the feature.** Rung 1/2 are sentence-level (or smaller) patches. Rung 3 is the only path that touches paragraph structure. Never rewrite a paragraph as a per-flag patch - it won't fit in the anchor window and the call will reject 422.
- **Punt rather than guess.** If you can't address a directive, punt with a reason. The author decides what to do.
- **Voice memory accumulates.** Pull voice samples regularly. The session converges on the writer's voice if you use them.
- **Skip / keep / let-me-try are user-side.** Self-resolve server-side. You will never see those kinds in the queue.
- **The score is Rung 1 only.** Rung 2 / Rung 3 are reported as counts, not folded into the headline. Don't try to "fix" Rung 2 hits to chase the score.
