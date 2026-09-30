# ADR 0007: The tool ships its own always-on role

- Status: accepted
- Date: 2026-09-12

## Context
Agents must learn how to operate agenv from inside any session, in any folder. The
previous design made every registry ship a "meta" role for that.

## Decision
agenv packages `assets/meta/` and regenerates `~/.agenv/meta/` (a one-role registry
named `agenv`) on every `add`, `sync`, and `update`. It is linked like any registry
and is the only role enabled by default.

## Consequences
- Registries contain only content.
- Upgrading agenv upgrades the instructions agents follow.
- Codex sees it as `agenv@agenv`, Claude as `agenv@skills-dir`, Gemini as `agenv`.
