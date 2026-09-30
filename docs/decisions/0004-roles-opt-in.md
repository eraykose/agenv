# ADR 0004: Roles are off everywhere until use turns them on

- Status: accepted
- Date: 2026-09-12

## Context
Skill descriptions cost tokens in every prompt; MCP schemas load in full for every
connected server. Loading every role everywhere defeats the point of roles.

## Decision
After `add`, every role except the built-in `agenv` role is disabled at user scope in
every tool. `agenv use` enables roles per folder (or per user with `--global`), writing
an explicit on/off for every role so re-running never leaves stale state.

## Consequences
- A fresh machine sees nothing role-specific until asked. The built-in role is the only
  always-on cost.
- The Claude manifest generated for a role carries `defaultEnabled: false`; Codex and
  Gemini need an explicit user-scope write, done once on first link.
