# agenv

An installable CLI that manages *registries* (git repos, public or private) of *roles*
(plugins bundling skills, MCP servers, hooks, commands, personas) and links them into
Claude Code, Codex, and Gemini CLI, switching roles on per folder.

Start here, in this order:

1. `docs/rfcs/0001-registry-system.md` - what this is and why (accepted design).
2. `docs/architecture.md` - code layout, the target adapter interface, data flow.
3. `docs/targets.md` - verified behaviour of each tool, with versions. Re-verify before
   changing an adapter if the tool version on this machine differs.
4. `docs/registry-format.md` - what a registry repo must contain.
5. `docs/decisions/` - ADRs (0009 explains the name). Read the one matching your change before arguing with it.
6. `docs/testing.md`, `docs/release.md`.

Invariants (do not break without an ADR):

- Zero runtime dependencies. Node >= 20. `node:test`.
- Nothing tool-specific outside `lib/targets/`. Commands loop over targets.
- Every external command goes through `lib/run.js` so `--dry-run` holds everywhere.
- Roles are off until `agenv use`; only the built-in `agenv` role is always on.
- Tests never touch the real tools or the real home directory.

Working here:

- `npm test` before and after. Add a test for any command behaviour you change.
- Commit messages: imperative summary under 70 chars, body says why.
- `assets/meta/skills/agenv/SKILL.md` is what every agent reads about this tool; keep
  it short and true.
