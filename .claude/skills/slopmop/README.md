# slopmop skill

Walks a markdown document through the Magic Slop Eraser deslop loop. The skill is the workflow; [slopmop.io](https://slopmop.io) is the source of truth and the steering UI.

## install

Copy this directory to wherever your agent looks for skills:

- Claude Code (project-local): already lives at `.claude/skills/slopmop/` in this repo
- Claude Code (global): `cp -r .claude/skills/slopmop ~/.claude/skills/`
- Or fetch the canonical SKILL.md directly: `curl -o ~/.claude/skills/slopmop/SKILL.md --create-dirs https://slopmop.io/slopmop.md`
- Other agentic tools (Codex, opencode, etc.): copy `SKILL.md` to wherever your runtime reads skill descriptors

## use

```bash
ERASER_HOST=https://slopmop.io   # or http://localhost:8787 for dev

# from a local file
slopmop ./article.md

# resume a session from the browser-shared URL
slopmop https://slopmop.io/d/abc123#t=xyz
```

The skill walks you through Rung 1 (mechanical, regex), Rung 2 (passage-level judgment, LLM-assisted), and Rung 3 (presentation / editorial, human-driven). Each flag is a paired writing moment: the author defines shape, the agent drafts the prose, the author re-directs until the sentence lands. Per-flag work is sequential; across flags, the agent surfaces a batch and the author sweeps it with directives.

See [`SKILL.md`](./SKILL.md) for the protocol.
