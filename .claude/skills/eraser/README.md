# eraser skill

Walks a markdown document through the Magic Slop Eraser deslop loop. The skill is the workflow; the [eraser site](https://github.com/yogh-io/slopmop) is the source of truth and the steering UI.

## install

Copy this directory to wherever your agent looks for skills:

- Claude Code (project-local): already lives at `.claude/skills/eraser/` in this repo
- Claude Code (global): `cp -r .claude/skills/eraser ~/.claude/skills/`
- Other agentic tools (Codex, opencode, etc.): copy `SKILL.md` to wherever your runtime reads skill descriptors

## use

```bash
ERASER_HOST=https://eraser.example.com  # or http://localhost:8787 for dev

# from a local file
eraser ./article.md

# resume a session from the browser-shared URL
eraser https://eraser.example.com/d/abc123#t=xyz
```

The skill walks you through Rung 1 (mechanical, regex), Rung 2 (passage-level judgment, LLM-assisted), and Rung 3 (presentation / editorial, human-driven) one flag at a time.

See [`SKILL.md`](./SKILL.md) for the protocol.
