# ADR 0008: Role names are unique across registries, or a registry is prefixed

- Status: accepted
- Date: 2026-09-12

## Context
Codex namespaces plugins by marketplace (`coding@acme`), but Claude's skills directory
and Gemini's extension names are flat, so two registries with a `coding` role collide
there. Always prefixing by registry is unambiguous but ugly for the common
single-registry case, and changing a link name after the fact breaks existing
per-folder settings.

## Decision
Tool-visible name = role name. `agreg add` refuses a registry whose role names collide
with an already configured registry and offers `--prefix <p>`, which links that
registry's roles as `<p>-<role>` and records the prefix in config, so ids never change
once chosen. The CLI always accepts the qualified form `<registry>/<role>`.

## Consequences
- Single-registry users get plain names.
- Collisions are explicit and resolved once, at add time.
