---
description: Walk a markdown document through the slopmop deslop loop - pull author directives, draft candidates, post resolutions, repeat
skillVersion: 2026-05-08.4
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

This file declares `skillVersion: 2026-05-08.4` in its frontmatter. That literal is your version. Send it as a header on **every** API call:

```
X-Skill-Version: 2026-05-08.4
```

Every server response carries `X-Skill-Latest-Version`. If it differs from your literal, the skill is out of date - tell the author once at the start of the session:

> "The slopmop skill I have installed (v2026-05-08.4) is older than what the server expects (vX). Ask me to update it, or reinstall manually from `${HOST}/skill`."

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

6. **Tell the author** what you did, e.g. "Updated slopmop skill from v2026-05-08.4 to vNEW at `<path>`. Reload this session to pick it up - skill files are read at session start, so the running session keeps the old behaviour until restart."

Do not try to re-parse this file mid-session - the harness loaded it once at startup and will not re-read until the next session.

## the shape of the work

Two phases. The first runs once at session start; the second runs on a loop.

**Phase A - analysis (once, at start).** You read the catalogue, you read the source, you find slop, you post flags. This is bring-your-own-model: the slopmop server runs Rung 1 regex for you, but Rung 2 (passage-level judgment) and Rung 3 (presentation / editorial) need a model reading the prose, and that's you. Subagents over the source pay off here - one per Rung 2/3 pattern, dispatched in parallel, each a focused reader. Aggregate, dedupe, post.

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

You are the model. The catalogue is your spec. The slopmop server holds documents and orchestrates the loop, but it does not do passage-level reading - that's your job.

### 1a. pull the catalogue once

```bash
curl -s "$HOST/catalogue" > /tmp/slopmop-catalogue.json
```

You get back `{ categories, patterns }`. Each pattern carries `id`, `category`, `name`, `severity`, `scope`, `rung`, `mechanical`, `blurb`, `whyItsSlop`, `fix`, often a long-form `essay`, `examples` with `sloppy` / `better` pairs, and a `skipRule` for false-positive guidance. Read them. The `whyItsSlop` and `skipRule` fields together are your detection spec - they describe what the pattern *is* and what it *isn't*.

### 1b. trigger Rung 1 (server-side regex)

```bash
curl -s -X POST "$HOST/docs/$ID/run-detectors"
```

Cheap, deterministic, free. The server matches the catalogue's regex patterns against the source and emits Rung 1 flags. Don't redo this work; it's already done.

### 1c. do Rung 2 / Rung 3 yourself

Read `doc.source`. Walk the catalogue. For every pattern with `rung` 2 or 3 (and `mechanical: false`), find passages that match - by *reading*, not by regex. That's the whole point: these patterns are structural and contextual, and a model reading the prose is how they get caught.

**Dispatch subagents.** This is where parallel subagents earn their keep. Pick a sharding strategy:

- **One subagent per Rung 2 pattern.** Each gets the full source plus its assigned pattern's catalogue entry (`whyItsSlop`, `essay`, `examples`, `skipRule`). Returns a list of detected passages. Best when patterns are independent and the source isn't huge.
- **One subagent per category, per rung.** Each handles 2-4 related patterns over the source. Cheaper if the source is long and you'd otherwise re-read it many times.
- **One subagent per source section, walking all Rung 2/3 patterns at once.** Best when the source is long and section-coherent.

Each subagent returns, per detected passage:

- `patternId` (must match a catalogue id)
- `text` (the exact substring)
- `start`, `end` (character offsets into `doc.source`; if your subagent works in passages without offsets, just include `text` and the server will locate it)
- `rationale` (1-2 sentences; the author reads this in the UI - explain why *this* passage is *that* pattern, not just restate the pattern)
- `suggestion` (optional; an inline candidate rewrite)

Aggregate the subagent outputs. Dedupe collisions on `patternId + text`. Drop matches that the catalogue's `skipRule` exempts.

### 1d. submit your flags

One batch, the source hash you have, agent-tagged.

```bash
curl -s -X POST -H "If-Match: $HASH" -H 'content-type: application/json' \
  -d '{
    "flags": [
      {
        "patternId": "absent-actor",
        "start": 142,
        "end": 198,
        "text": "It was decided that the framework would be revised",
        "rationale": "Passive plus \"it was decided\" hides who decided. The actor is unnamed; the sentence reads as policy by no one.",
        "suggestion": "The committee revised the framework on Tuesday."
      },
      {
        "patternId": "synthesis-of-nothing",
        "text": "All of these threads point to a deeper question about how we should think about progress.",
        "rationale": "The closer announces synthesis but synthesises nothing - it's a fortune-cookie ending pretending to be one. Drop it or replace with the actual takeaway.",
        "suggestion": "We will not get better policy until the agencies start measuring what they ship."
      }
    ],
    "modelTag": "claude-sonnet-4-6"
  }' \
  "$HOST/docs/$ID/flags"
```

The server validates each flag, relocates the anchor if the offsets don't line up exactly, dedupes against existing open flags, and returns `{ added, flags, skipped }`. Skipped entries carry a `reason` (`unknown patternId`, `text not found in source`, `duplicate of existing open flag`); use them to debug your detection.

Flags without a `suggestion` go to status `open` - the author will sweep them and give a directive. Flags **with** a `suggestion` go straight to `awaiting-accept`: the author can take your candidate as-is, or push back with a directive. Either way they show up at their anchor in the UI.

`If-Match` is optional but recommended. If the source moved between your read and your post (rare during analysis, more common during the steering loop), you get 412 - refetch the source, re-anchor, retry.

### 1e. iterate if you want

You can post more flags later (mid-loop, after re-reading sections, after the author asks you to look harder). Each `POST /flags` is incremental - you don't replace, you add. Dedupe is automatic, so re-running analysis is safe.

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

The doc id from the URL is the capability - no separate auth header. All calls should send `X-Skill-Version: 2026-05-08.4` so the server can flag staleness.

## constraints

- **You do the analysis, not the server.** This is bring-your-own-model. Server-side regex (`/run-detectors`) handles Rung 1; everything else is you reading the source against the catalogue, ideally with subagents in parallel. Never assume the server detected what only a model could detect.
- **Rationales are read by the author.** When you post flags, write rationales the author wants to read in the UI. "Matches throat-clearing pattern" is dead weight; "the sentence opens with 'It's important to note that' before getting to the substance" is useful.
- **Pull, don't push.** The author submits directives whenever they want; you pull when you have capacity. The queue holds work for you - none of it is missed if you're slow.
- **Multiple candidates are fine.** Post one if there's a clear best take; post two or three when the directive admits real alternatives the author would want to compare. The author picks one, the rest become history. Don't manufacture filler variants - the bar is real difference, not coverage.
- **Per-flag work is sequential, across flags is batched.** Pull a queue, process several in parallel, post a single resolutions batch. Then pull again.
- **Hash before you patch.** Always `If-Match`. The author or another agent can mutate the source between your pull and your push; the server tells you so via 412.
- **Granularity is the feature.** Rung 1/2 are sentence-level (or smaller) patches. Rung 3 is the only path that touches paragraph structure. Never rewrite a paragraph as a per-flag patch - it won't fit in the anchor window and the call will reject 422.
- **Punt rather than guess.** If you can't address a directive, punt with a reason. The author decides what to do.
- **Voice memory accumulates.** Pull voice samples regularly. The session converges on the writer's voice if you use them.
- **Skip / keep / let-me-try are user-side.** Self-resolve server-side. You will never see those kinds in the queue.
- **The score is Rung 1 only.** Rung 2 / Rung 3 are reported as counts, not folded into the headline. Don't try to "fix" Rung 2 hits to chase the score.
