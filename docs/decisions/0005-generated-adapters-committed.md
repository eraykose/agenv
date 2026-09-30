# ADR 0005: Per-tool manifests are generated from one source and committed in the registry

- Status: accepted
- Date: 2026-09-12

## Context
Each tool wants its own manifest (`.claude-plugin/plugin.json`, `gemini-extension.json`,
two catalogue files). Hand-maintaining them drifts. Generating them locally at link time
would keep registries clean, but Cowork and the vendors' URL-based installs read the
repository directly and need the files present.

## Decision
The source per role is `plugin.json` (Agent Plugins 1.0) plus optional `mcp.json`.
`agenv build` writes every adapter deterministically; they are committed; `agenv doctor`
and the registry's CI run `build --check` so drift fails fast.

## Consequences
- One place to change metadata or MCP servers.
- A registry works with vendor tools even without agenv (Cowork, `claude plugin
  marketplace add`).
