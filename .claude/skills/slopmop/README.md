# slopmop skill

Walks a markdown document through the slopmop deslop loop. The skill is the workflow; [slopmop.io](https://slopmop.io) is the source of truth and the steering UI.

## install

The skill drives the API through a small CLI called `slopmop` (single Bun-runnable JS file). Install both with one command:

```bash
curl -sf https://slopmop.io/cli/install.sh | sh
```

That drops `~/.local/bin/slopmop`. Bun is required at runtime; the install script bails clean with an install hint if missing.

For the SKILL.md text itself:

- Claude Code (project-local): already lives at `.claude/skills/slopmop/` in this repo
- Claude Code (global): `cp -r .claude/skills/slopmop ~/.claude/skills/`
- Or pull canonical: `curl -o ~/.claude/skills/slopmop/SKILL.md --create-dirs https://slopmop.io/slopmop.md`
- Other agentic tools (Codex, opencode, etc.): copy `SKILL.md` to wherever your runtime reads skill descriptors

Tell the running agent "check for slopmop updates" to refresh both the SKILL.md and the CLI binary in place. Reload the session to pick up the new version.

## use

```bash
export SLOPMOP_HOST=https://slopmop.io   # or http://localhost:8787 for dev

# from a local file
slopmop init ./article.md

# resume a session from the browser-shared URL
slopmop attach https://slopmop.io/d/abc123
```

The skill walks Rung 1 (lexical, word-and-phrase), Rung 2 (passage-level judgment), and Rung 3 (presentation / editorial). Detection is the drafter's job at every rung - the catalogue is the spec, the model reads the prose. Each flag is a paired writing moment: the author defines shape, the drafter writes the prose, the author re-directs until the sentence lands. Per-flag work is sequential; across flags, the drafter surfaces a batch and the author sweeps it with directives.

See [`SKILL.md`](./SKILL.md) for the protocol.
