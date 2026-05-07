---
description: Walk a markdown document through the Magic Slop Eraser deslop loop, one flag at a time
allowed-tools: Bash, Read, Edit, Monitor
---

# eraser

A *steering loop* for fixing AI-slop in prose. The author defines shape, you draft the prose, the author re-directs until the sentence lands. The pairing is batched: surface many flags at once, let the author sweep them with shape directives, process the directives in the background, present the candidates back when ready, take the next round of nudges. The work is the author's; you are the keyboard.

The eraser site is the source of truth and the steering surface. You push prose, pull flags, post candidates, and react to the author's directives (which can come from your terminal *or* from the eraser browser UI). The browser is the same state, viewed differently.

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

Rung 2 is a *steering loop*: the flag rarely resolves in one turn. You post one candidate, take the author's shape directive, post another, until the sentence lands. Many short turns per flag.

Per flag, on first encounter:

1. Read the flag, the pattern catalogue (`GET /catalogue`), and the surrounding paragraph.
2. Draft **one** candidate rewrite. Not three. The pattern catalogue tells you what good rewrites of this pattern look like.
3. POST it: `POST /flags/{fid}/suggestions` `{text, prompt, modelTag: "<your-model>"}`. It becomes the running best by default.
4. Present it. Wait for the author.

The author's input is *shape*, not a verdict on a portfolio. Vocabulary:

| Author says | What you do |
|---|---|
| `more committal` / `drop the qualifier` / `punchline first` / `their voice not yours` / `cut to the verb` / etc. | Draft ONE new candidate that takes the direction. POST it. POST a `BETTER` (or `WORSE` / `CLOSE`) verdict on the new one against the previous best. The new one becomes the running best when BETTER. |
| `warmer` / `colder` | Last attempt was on the right track / drifting. Use that to bias the next candidate. |
| `yes` / `that's the one` | `POST /flags/{fid}/resolve` `{suggestionId: <best.id>}`. Move on. |
| `let me try: <text>` | The author has handed you a candidate. POST it as a Suggestion (`modelTag: "human"`). It is now the running best. |
| `skip` | `POST /flags/{fid}/skip`. |

This is a steering loop, not an evaluation loop. Do not present three options and ask the author to pick. Present one, take the author's shape directive, re-attempt. The suggestion log on the flag is the trail of attempts, with the running best held up. BETTER / WORSE / CLOSE is fuel for the next nudge, not a final ranking.

When the work is batched (many flags surfaced at once, author sweeps them with directives, you process in the background), each flag's loop runs independently. Process directives sequentially per flag, push candidates back as they're ready, the SSE stream surfaces them at their anchors. The author re-engages at their cadence and re-directs the ones that did not land.

### 5. Walk Rung 3 (presentation / editorial)

The same steering loop, applied to larger units (a section, a transition, the opening, the close). Slower cycles - you read the surrounding piece between turns - but the shape is identical: the author defines what the section is supposed to *do*, you draft the prose, the author re-directs.

For each flag:
- Print the position and the pattern (`frame-stacking`, `performative-balance`, `header-inflation`).
- Open a comment thread: `POST /flags/{fid}/comments` `{body: "<your read>", author: "agent"}`. Articulate what the section is currently doing and ask what the author wants it to do.
- Take the author's intent. Draft a rewrite. Post it via `PUT /docs/$ID/source` (whole-source replacement; the server relocates remaining open anchors), or as a comment on the flag if it is too tentative to edit yet.
- Take the next directive. Re-draft. Loop until the section lands.

No autonomous rewrite. The eraser flags positions; the rewrite happens between you and the author, in the same paired-writing loop as Rung 2.

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

For Rung 2, present one candidate (the running best) and the trail of attempts so far:

```
[R2 · 1/3] absent-actor
  > The decision was made to revise the policy.
                       ^^^^^^^^^^

current:  "The committee revised the policy."        [agent · v3]
trail:
  v1  "It was decided to revise the policy."         worse
  v2  "We revised the policy."                       close
  v3  "The committee revised the policy."            better  ← running best

direction?  (more committal / drop the qualifier / their voice / let me try: <text> / yes / skip)
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

- Per-flag work is sequential: one candidate, take the directive, re-attempt. Never present three candidates and ask the author to pick - that is evaluation, not steering.
- Across flags, work batched: surface many at once, let the author sweep with directives, process in the background, push candidates back via the SSE stream.
- Never apply an edit without an explicit author verdict (or a browser-side resolution event for the same flag).
- Never auto-rewrite a Rung 3 flag.
- Granularity is the feature. Sentence and clause level for Rung 2; section / transition level for Rung 3. Never rewrite a paragraph in one turn.
- The author's word in the terminal and in the browser are equivalent - if the SSE stream tells you a flag was resolved or re-directed from the browser, advance accordingly, don't re-prompt.
- The score is Rung 1 only. Rung 2 / Rung 3 are reported as counts.
