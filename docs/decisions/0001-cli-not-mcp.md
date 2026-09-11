# ADR 0001: The agent interface is a CLI with --json, not an MCP server

- Status: accepted
- Date: 2026-09-12

## Context
Agents need to inspect, edit, and propose registry changes. Two options: expose that as
MCP tools, or as shell commands plus a small skill that explains them.

## Decision
CLI. Every command that an agent might parse takes `--json`. A built-in role ships one
skill (~100 tokens always-on) that says how to call `agreg`.

## Consequences
- No MCP schemas in every prompt; the context-cost goal of the whole tool is respected.
- Works identically in Claude Code, Codex, Gemini CLI, CI, and a human terminal.
- Surfaces without a shell would need an MCP facade over `lib/`; none of the targets
  need it today.
