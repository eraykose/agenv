# ADR 0008: Role names are unique across the registries a machine configures

- Status: accepted
- Date: 2026-09-12

## Context
Codex namespaces plugins by marketplace (`coding@acme`), but Claude's skills directory
and Gemini's extension names are flat, so two registries with a `coding` role collide
there. A per-machine prefix (`acme-coding`) would work for Claude's symlink but not for
Gemini, which reads the extension name from the committed `gemini-extension.json`.
Changing a link name after the fact would also break existing per-folder settings.

## Decision
Tool-visible name = role name. `agreg add` refuses a registry whose role names collide
with an already configured registry (or with the built-in `agreg` role) and names the
clash; the fix is to rename the role in one registry. The CLI always accepts the
qualified form `<registry>/<role>`. `agreg new role` applies the same check when the
registry is configured on this machine.

## Consequences
- Single-registry users get plain names.
- Collisions are explicit and resolved once, in the registry, where every machine
  benefits.
- A future `--prefix` needs Gemini to support linking under an alias first.
