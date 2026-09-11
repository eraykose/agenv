# ADR 0003: Link the clone into each tool's native plugin system; never copy skills around

- Status: accepted
- Date: 2026-09-12

## Context
Two families of tools exist: file syncers that copy or symlink SKILL.md into each agent's
folders (skillshare, Vercel skills), and the vendors' own plugin systems that bundle
skills with MCP servers, hooks, commands, and agents.

## Decision
Use the native plugin systems, and attach the clone in place wherever the vendor allows:
Claude Code's skills directory (symlink), Gemini's `extensions link`, Codex's local
marketplace (a copy Codex maintains; agreg refreshes it).

## Consequences
- Hooks, MCP servers, commands, and agents come along; vendors' enable/disable and
  cost reporting work on our roles.
- Edits in the clone are live in Claude Code and Gemini; Codex needs a refresh step.
- Each vendor mechanism is an adapter that must be re-verified when the tool changes;
  `docs/targets.md` records what was verified and against which versions.
