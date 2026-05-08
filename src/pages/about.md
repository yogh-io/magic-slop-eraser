# Methodology

Magic Slop Eraser identifies AI-slop in prose and walks the writer through fixing each instance. The thing it is built for is *paired writing*: the author defines shape, the agent drafts the prose, the author re-directs until the sentence lands.

## What counts as slop

The bar is *actually annoying*, not *AI-fingerprint*. We curate against "would a careful reader find this painful or empty to read?", not "would a hostile reader clock this as a chatbot?". Many AI tells overlap with the painful set (delve, throat-clearing, the mirror construct, synthesis-of-nothing closers); plenty do not (em-dashes, bullet lists, staccato runs - things skilled human writers do for effect). We flag the moves the model reaches for reflexively *and* that read as braindead LLM garbage to a careful reader. When in doubt, cut.

## The rungs

The catalogue organises patterns by *depth* into three [Rungs](/rungs): mechanical (regex, free), passage-level judgment (LLM-assisted), and presentation / editorial (whole-piece). The numbering is layer, not order - clean drafts climb from the bottom; tangled drafts start at the top and work down. The score is Rung 1 only.

## The loop

The interaction is batched. The agent surfaces ten or fifteen questions at once - "wtf do you want done with this?", one per flag. The author sweeps with shape directives in seconds: *more committal*, *drop the qualifier*, *punchline first*, *cut to the verb*. Or *skip*, *keep*, *let me try: <text>*. Submit and go. The agent processes in the background, posting candidates back to their anchors. The author re-engages, accepts the ones that landed, re-directs the rest. Loop until satisfied.

The trick is *time arbitrage*: the author's attention is the scarce resource; the agent's is cheap. Concentrated bursts of decisions, not synchronous typing. Each nudge between turns moves where the next sample is drawn from - the peak is reached by walking the agent toward it through many short turns, not by one prompt at high temperature. The browser is the steering surface; the agent is the keyboard; the work is the writer's.

## Bring your own agent

The site is a frontend, not the agent. You bring the agent - any Claude Code, Codex, or opencode session, your own scripts, or our hosted reviewer - and it talks to the site over an API. The catalogue, the flag panel, and the directive sweep all live here; the writing model is whatever you already have access to.

The protocol the agent runs against is published as a [skill](/skill) - a `SKILL.md` you install in your agent's skills directory. Three install paths: paste a one-line prompt into Claude Code (it fetches and saves the file), `curl` the raw `SKILL.md` into `~/.claude/skills/slopmop/`, or copy the content from the page directly. Same protocol regardless.

## Desloppifier or editorial tool

Honest answer: we do not know yet. Rung 1 is a desloppifier - regex, free, portable. Rung 3 is an editorial workshop - whole-piece rewrites, slow, collaborative. We will find out which centre of gravity wins by using the tool on our own writing. For now the bottom rung is the front door and the top rung is the destination.
