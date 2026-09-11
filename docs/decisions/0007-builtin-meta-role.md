# ADR 0007: The tool ships its own always-on role

- Status: accepted
- Date: 2026-09-12

## Context
Agents must learn how to operate agreg from inside any session, in any folder. The
previous design made every registry ship a "meta" role for that.

## Decision
agreg packages `assets/meta/` and regenerates `~/.agreg/meta/` (a one-role registry
named `agreg`) on every `add`, `sync`, and `update`. It is linked like any registry
and is the only role enabled by default.

## Consequences
- Registries contain only content.
- Upgrading agreg upgrades the instructions agents follow.
- Codex sees it as `agreg@agreg`, Claude as `agreg@skills-dir`, Gemini as `agreg`.
