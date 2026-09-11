# Architecture

Read `rfcs/0001-registry-system.md` for the why. This file is the how.

## Layers

```
bin/agreg.js            argv parsing and dispatch only
lib/commands/*.js       one file per command (add, remove, update, list, use, status, sync, doctor,
                        path, edit, propose, new, build, init, uninstall); shared.js holds the
                        first-time defaults, registry inference, and the security preview
lib/targets/*.js        one adapter per tool (claude, codex, gemini) behind one interface
lib/registries.js       the set of configured registries (+ the built-in one) from ~/.agreg/config.json
lib/registry.js         one registry on disk: roles, manifests, skills, agents
lib/build.js            generates per-tool manifests from plugin.json + mcp.json
lib/git.js              clone / fetch / fast-forward / status / log, via the git binary
lib/meta.js             regenerates ~/.agreg/meta from assets/meta
lib/config.js, home.js  ~/.agreg paths and config.json
lib/toml.js             minimal TOML table get/set (Codex config)
lib/settings.js         JSON read-modify-write that refuses to clobber invalid files
lib/prompt.js           checkbox prompt; numbered fallback when stdin is not a TTY
lib/run.js, tools.js    shelling out (dry-run aware), PATH detection, quoting
assets/meta/            the built-in role's sources
```

Rules that keep this tidy:

- Nothing tool-specific outside `lib/targets/`. Commands loop over targets.
- Nothing that prints outside `lib/commands/` and `lib/run.js` (which echoes commands).
- State lives in three places only: `~/.agreg/config.json` (ours), the clones (git's),
  and each tool's own settings (written through the target adapter).
- Every external command goes through `run()` so `--dry-run` is honoured everywhere.

## Target adapter interface

```
id, label
detected()                                  tool present on this machine
pluginId(link)                              the id the tool uses for a linked role
isLinked(link), linkedLinks(), installed()
link(links, {dryRun}) -> fresh              idempotent; returns links made for the first time
unlink(links, {dryRun, purge})
refresh(links, {dryRun}) -> {refreshed, notes}
setEnabled({linkName: bool}, {scope, dir, dryRun, agent})
enabledState(link, dir) -> {user, project, effective}
```

A **link** is `{ registry, role, name, path }` where `name` is the tool-visible name
(the role name, unique across registries per ADR 0008) and `path` the role folder in
the clone. Links are recomputed on every call: compare them by `name`, never by identity.
Optional adapter methods: `unregister(registry)` (Codex marketplace) and `forget(links)`
(Claude user-scope keys), used by `remove --purge` and `uninstall`.

## Data flow of the main commands

- `add`: clone -> validate (`registry.open`) -> conflict check (ADR 0008) -> write config
  -> `meta.ensure()` -> for each detected target: `link(all links)`; first-time links get
  user-scope off (ADR 0004) except the built-in role.
- `update`: per registry: dirty check -> fetch -> summarise `old..new` -> fast-forward ->
  diff roles before/after -> link new, unlink gone, `refresh` -> notes.
- `use`: compute `{name: bool}` for every link (built-in always true) -> each installed
  target `setEnabled` at the chosen scope.
- `sync`: `meta.ensure()`, then for each installed target: link missing, refresh; a repair
  command that is safe to run any time.
- `doctor`: registry checks (`build --check`, frontmatter, names) + tool validators +
  link health; exit 1 on errors. With a path argument it checks only that registry (CI).
- `propose`: registry = `--registry`, else the registry cwd is inside (configured clone
  or a source checkout), else the only configured one. Branch, commit all, push, `gh pr create`.
- `uninstall`: everything `remove --purge` does, for every registry and the built-in
  role, then deletes `~/.agreg`.

## Verified facts

`docs/targets.md` lists what each tool does, and against which version it was checked.
When a tool version changes, re-verify that table before trusting the adapter.
