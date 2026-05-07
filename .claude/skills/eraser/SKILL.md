---
description: Walk a markdown document through the Magic Slop Eraser deslop loop, one flag at a time
allowed-tools: Bash, Read, Edit, Monitor
---

# eraser

A workshop-shaped loop for fixing AI-slop in prose. The author is in the loop for every change. The agent (you) presents one flag at a time, proposes fixes, and advances when the author says so.

The eraser site is the source of truth. You push prose, pull flags, post suggestions, and react to the author's verdicts (which can come from your terminal *or* from the eraser browser UI). The browser is a viewer onto the same state.

## inputs

Two entry points:

- **Local file**: `eraser ./article.md` - you POST the contents to a fresh document, surface the URL, ask the author to open it in the browser.
- **Existing URL**: `eraser https://{HOST}/d/{id}#t={token}` - parse `id` and `token`, GET the doc, resume.

`HOST` defaults to whatever `ERASER_HOST` is set to. Local dev: `http://localhost:8787`.

## the protocol, end-to-end

### 0. Bootstrap

If given a file path:

```bash
SOURCE=$(jq -Rs . < "$FILE")
DOC=$(curl -s -X POST "$HOST/docs" \
  -H 'content-type: application/json' \
  -d "{\"source\": $SOURCE, \"title\": \"$(basename $FILE)\"}")
ID=$(echo "$DOC" | jq -r .id)
TOKEN=$(echo "$DOC" | jq -r .token)
```

Tell the author: "Open `${HOST}/d/${ID}#t=${TOKEN}` in your browser. I'll wait."

If given a URL: parse `{id, token}` from the URL + fragment. `curl -H "Authorization: Bearer $TOKEN" $HOST/docs/$ID` to verify access.

### 1. Run mechanical detection

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" "$HOST/docs/$ID/run-detectors" | jq '.added, (.flags | group_by(.rung) | map({rung: .[0].rung, count: length}))'
```

Print the score and per-rung tallies. Decide the entry rung:
- Structurally clean draft → start at Rung 1
- Tangled / too-many-headers / argues with itself → start at Rung 3, work down

Default to Rung 1. Ask if unclear.

### 2. Subscribe to events

Open the SSE stream in the background. Each line is a state change (resolve, skip, suggestion verdict, comment, source edit). The author can act in the browser; you'll see it here.

```bash
curl -N -H "Authorization: Bearer $TOKEN" "$HOST/docs/$ID/events" 2>&1 | grep --line-buffered '^data:'
```

Use `Monitor` on this stream. The `data:` prefix is JSON; parse cursor + type + payload.

If your runtime cannot sustain a long-lived `curl`, fall back to long-poll: `GET /docs/$ID/events/poll?since=$cursor&timeout=30000` in a loop.

### 3. Walk Rung 1 (mechanical)

Loop:

```
GET /docs/$ID/flags?rung=1&status=open
```

If empty: Rung 1 is clear, prompt to climb to Rung 2.

For each flag, present:

```
[rung 1 · 3 / 14] <pattern.name>
> <2-3 sentences before>
> FLAGGED: <excerpt>
> <2-3 sentences after>

diagnosis: <flag.rationale>
proposed:  <patternId-specific suggestion>   # for tier1/tier2 lexicon, the dictionary; for closers, "cut"; etc.
```

Wait for the author's verdict. Vocabulary:

| Author says | API call |
|---|---|
| `yes`, `y`, `that's the one` | `POST /flags/{fid}/resolve` `{patch: <suggestion>}` |
| `cut it` | `POST /flags/{fid}/resolve` `{patch: ""}` |
| `edit: <text>` | `POST /flags/{fid}/resolve` `{patch: "<text>"}` |
| `skip`, `next` | `POST /flags/{fid}/skip` |
| `keep` | `POST /flags/{fid}/keep-deliberate` |
| `stop` | break the loop |

If an SSE event arrives saying *the same flag* was resolved/skipped from the browser, advance to the next flag without prompting.

### 4. Walk Rung 2 (passage-level judgment)

Same loop shape, but:
- Generate 2-3 candidate rewrites yourself. You are an LLM. The pattern catalogue at `GET /catalogue` tells you what good rewrites of this pattern look like.
- POST each candidate as a Suggestion: `POST /flags/{fid}/suggestions` `{text, prompt, modelTag: "<your-model>"}`
- Present them side by side. Mark one as the current best (you can iterate).
- The author proposes alternatives; evaluate each against the running best:

| Verdict | Meaning |
|---|---|
| `BETTER (S/M/L)` | Proposal improves on best. `(L)` auto-resolves. |
| `WORSE (S/M)` | Proposal degrades. Keep best. |
| `CLOSE` | Neutral trade. Keep best. |

POST `/flags/{fid}/suggestions/{sid}/verdict` for each. When the author says "that's the one", POST `/flags/{fid}/resolve` with `suggestionId: <best.id>`.

### 5. Walk Rung 3 (presentation / editorial)

No autonomous rewrite. For each flag:
- Print the position and the pattern (`frame-stacking`, `performative-balance`, `header-inflation`).
- Open a comment thread: `POST /flags/{fid}/comments` `{body: "<your read>", author: "agent"}`.
- Discuss with the author in chat. When they decide, the source edits go via `PUT /docs/$ID/source` (whole-source replacement; the server relocates remaining open anchors).

The work at Rung 3 is collaborative, not mechanical. The eraser flags positions; the rewrite happens between you and the author.

### 6. Wrap up

When the author says `done` or all rungs read zero:

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/docs/$ID/companion" > companion.json
```

The companion contains the full event log, the final source, every flag's resolution, every suggestion. If invoked as `eraser ./article.md --apply`, write the final source back to `./article.md` (use `Edit` to keep a clean diff).

Otherwise, print the path and let the author copy edits over manually.

## flag presentation format (mechanical → terminal)

Be terse and exact. The author should be able to make a verdict without scrolling.

```
[R1 · 3/14] tier1-lexicon
  We must navigate the regulatory landscape carefully, as we delve into nuanced
  considerations.
                ^^^^^^^^
diagnosis: "navigate" - canonical AI lexicon. Substitute or cut.
proposed:  work through  /  read  /  cut
verdict?
```

For Rung 2, lay out the candidates:

```
[R2 · 1/3] absent-actor
  > The decision was made to revise the policy.
                       ^^^^^^^^^^

current best: (none yet - proposals follow)

  (a) "The committee revised the policy."        [agent]
  (b) "Maria's team revised the policy."         [agent]
  (c) "We revised the policy."                   [agent]

verdict? (a/b/c, or propose your own)
```

## API quick reference

| Verb | Endpoint | Purpose |
|---|---|---|
| `POST` | `/docs` | Create document |
| `GET` | `/docs/:id` | Doc + counts + score |
| `PUT` | `/docs/:id/source` | Replace source (relocates open anchors) |
| `POST` | `/docs/:id/run-detectors` | Run mechanical detectors |
| `GET` | `/docs/:id/flags?rung=N&status=open` | Walk flags |
| `POST` | `/docs/:id/flags/:fid/suggestions` | Post a candidate |
| `POST` | `/docs/:id/flags/:fid/suggestions/:sid/verdict` | BETTER/WORSE/CLOSE |
| `POST` | `/docs/:id/flags/:fid/resolve` | Apply edit, mark resolved |
| `POST` | `/docs/:id/flags/:fid/skip` | Mark skipped |
| `POST` | `/docs/:id/flags/:fid/keep-deliberate` | Keep with rationale |
| `POST` | `/docs/:id/flags/:fid/comments` | Comment thread |
| `GET` | `/docs/:id/events` | SSE event stream |
| `GET` | `/docs/:id/events/poll?since=N` | Long-poll fallback |
| `GET` | `/docs/:id/companion` | Resolution log + final source |
| `GET` | `/catalogue` | Patterns + categories |

All authenticated calls require `Authorization: Bearer <token>` from the document creation response.

## constraints

- One flag at a time. Never batch.
- Never apply an edit without an explicit author verdict (or a browser-side resolution event for the same flag).
- Never auto-rewrite a Rung 3 flag.
- The author's word in the terminal and in the browser are equivalent - if the SSE stream tells you a flag was resolved, advance, don't re-prompt.
- The score is Rung 1 only. Rung 2 / Rung 3 are reported as counts.
