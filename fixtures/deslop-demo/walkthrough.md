# Walkthrough: the slopmop loop, performed by hand

`source.md` in this folder is a slop specimen - a short opinion post about the word
"slop." It is anonymised and lightly genericised from a public writing-critique
session in which an editor walked the piece line by line, said what bothered him
about each passage, proposed a rewrite, and took suggestions from a live chat
before settling on a final version.

That session **is the slopmop loop**, run by a human at a whiteboard:

- He **reads top to bottom** - that is the brush reader.
- He **stops on a passage and says, in a sentence, what bothers him** - that is a
  brush flag with a `userNote`.
- He **proposes a rewrite (often two or three) and picks one** - that is the drafter
  posting candidates and the reader accepting.
- The **chat nudges him** ("`don't value`, not `don't want`"; "`quitting` sounds
  American") - those are shape directives.
- He **iterates until the line lands**.

Brush mode automates exactly this. What follows is the session re-expressed in
slopmop's idiom: each flag, the complaint behind it, the catalogue pattern it maps
to, and the rewrite that was accepted. Note how few of these are the "classic" AI
tells - most are `craft` faults (the relaxed-bar category) plus a couple of
structural ones. That is the whole reason the craft lens exists: the reader feels
the fault without the vocabulary, and the catalogue supplies the vocabulary.

Load it yourself and drive the loop:

```bash
slopmop init fixtures/deslop-demo/source.md
```

---

## The flags

### 1. "out loud in public"

> *...a man who said he came to eat his words **out loud in public**.*

- **Complaint:** Redundant. If he said his words, they were out loud; if he posted, it was already public. Paying twice for one idea.
- **Pattern:** `redundancy` (craft, R1)
- **Accepted rewrite:** *This morning, I read a post by a man who regretted one he had written a year ago.* (the whole opening collapses)

### 2. "writing ... writing ... writing"

> *AI will not kill **writing** because companies will always pay for good quality **writing**.*

- **Complaint:** "Writing" twice in one breath, and the cause and effect are back to front - the reason should lead.
- **Pattern:** `redundancy` (craft, R1), economy
- **Accepted rewrite:** *Companies will always pay for good quality writing, so AI will not kill it.*

### 3. "It's got a ton of views."

> *...because companies will always pay for good quality writing." **It's got a ton of views.**

- **Complaint:** Too thin to be its own sentence - it is an aside about the post, not a claim that stands alone.
- **Pattern:** `staccato` (structural, R2) - fragment / clause that should be folded
- **Accepted rewrite:** folded into the lead-in ("a viral post") rather than left as a standalone beat.

### 4. "This isn't about AI."

> ***This** isn't about AI. It's about calling it slop and it's about human writing.*

- **Complaint:** What is "this"? The referent was never established. The sentence dangles off a pronoun pointing at nothing, and the whole line tells us nothing.
- **Pattern:** `allusive-construct` (structural, R2) - bare-demonstrative sub-shape; also `staccato`
- **Accepted rewrite:** deleted entirely. ("When all said and done, we could just lose that - it's faffing about.")

### 5. dropped conjunction

> *Companies don't want good writing. They're fine with slop.*

- **Complaint:** The two facts are causally linked, but the "because" has been deleted, so they read as two unrelated statements. (As he put it: *AI slop loves to take out conjunctions.*)
- **Pattern:** `staccato` (structural, R2) - dropped-conjunction sub-shape
- **Accepted rewrite:** *Companies don't value good writing because they're fine with slop.* ("`value`" and the restored "`because`" both came from the loop.)

### 6. "every time they pick a word of the year"

> *Every time **they** pick a word of the year, **they** explain why they picked it. So **they** said...*

- **Complaint:** Who is "they"? No antecedent. The actor doing the explaining is never named.
- **Pattern:** `absent-actor` (structural, R2) - the unnamed-actor case
- **Accepted rewrite:** *The dictionary's editors justified the choice by saying...* (naming the actor also lets the redundant "every time they pick / they explain" scaffolding go)

### 7. "Not good."

> *...when it comes to replacing human creativity, it's not that intelligent. **Not good.**

- **Complaint:** Not a sentence. A two-word fragment stuck on the end, and you can't tell what it refers to - the message being sent, or the state of affairs.
- **Pattern:** `staccato` (structural, R2) - fragment-punch sub-shape
- **Accepted rewrite:** deleted; the thought folded into the sentence before it: *...it is as if we are sending a signal to AI which says you are not yet so intelligent that you can replace human creativity.*

### 8. "the truth is ... I'm sorry to say it, but it's true"

> *But **the truth is** a lot of human writing isn't very good. **And I'm sorry to say that, but it's true.**

- **Complaint:** The second sentence says "it's true" right after the first said "the truth is." It just repeats the claim in new clothes.
- **Pattern:** `redundancy` (craft, R1) - restating-sentence case
- **Accepted rewrite:** *But the truth is that a lot of human writing isn't very good.* (the second sentence cut)

---

## Patterns this specimen exercises

| Pattern | Category | Rung | Flags |
|---|---|---|---|
| `redundancy` | craft | 1 | 1, 2, 8 |
| `staccato` | structural | 2 | 3, 5, 7 |
| `allusive-construct` (bare demonstrative) | structural | 2 | 4 |
| `absent-actor` (unnamed actor) | structural | 2 | 6 |

`passive-voice`, `latinate`, and `terminal-preposition` do not bite on this
particular piece - the specimen's faults are padding, clipped rhythm, and dropped
referents. A different specimen would light up the other craft patterns; that is
what the catalogue breadth is for.

---

## The "after"

The version the session converged on, for before/after comparison:

> This morning, I read a post by a man who regretted one he had written a year ago.
> It said, "Companies will always pay for good quality writing, so AI will not kill
> it." That man has just lost his job to AI, so he's giving up writing and returning
> to programming. He admitted he was wrong. Companies don't value good writing
> because they're fine with slop.
>
> Slop was the dictionary's word of the year last year. The dictionary's editors
> justified the choice by saying, "Amid all the talk about AI threats, slop set a
> tone that's less fearful, more mocking." If we are honest with ourselves, we not
> only mock AI, but also the people who use it for churning out slop. Then we can
> justify getting on with "human" writing.
>
> The editors went on to say that in the 1700s, slop used to mean soft mud. Then it
> meant food waste such as pig slop. Today it's a generalization for something that
> has little or no value. Finally, they said that when we use the word slop, it is as
> if we are sending a signal to AI which says you are not yet so intelligent that you
> can replace human creativity.
>
> Wow. Don't we just love our moral high ground? The problem with calling AI slop is
> that it creates a subconscious divide that says AI is bad and therefore human is
> good. But the truth is that a lot of human writing isn't very good.

Shorter, plainer, every sentence carrying its weight - and not one fix required the
author to leave the wheel.
