# RFC 0001: agreg as a registry system

- Status: accepted
- Date: 2026-09-12
- Supersedes: the single-repo design in the `ek-skills` checkout (CLI and content in one repo, installed with `npm link`)

## Summary

Turn `agreg` into an installable tool (`npm i -g agreg`) that manages one or more
**registries**: git repositories, public or private, that contain **roles**. A role is
a self-contained plugin (skills, MCP servers, hooks, commands, agent personas). `agreg`
clones registries under `~/.agreg/`, links every role into each agent CLI's native plugin
mechanism (Claude Code, Codex, Gemini CLI), lets you switch roles on per folder, keeps
the clones up to date, and turns "edit a skill and get it reviewed" into first-class
commands so an agent never needs to know where the repo lives.

Companies keep their registry private; individuals share across their own devices, or
publicly. GitHub's visibility setting is the only access control.

## Motivation

The current design proved the mechanisms (in-place links for Claude Code and Gemini, a
local marketplace for Codex, per-folder enablement across all three) but couples the
tool to the content: every machine clones the content repo and `npm link`s it, and the
CLI cannot serve a second registry. Companies need a registry that is not the tool, and
people need more than one (personal + team + public).

## Goals

1. **Install the tool once**, from npm. No clone, no `npm link`.
2. **Registries are plain git repos.** `agreg add owner/repo` works for private repos
   using the credentials git already has. Nothing is hosted by us.
3. **Several registries per machine**, composed into one set of roles.
4. **Reviewable change.** Editing a skill, proposing it as a PR, and pulling the merge are
   commands. Every change is a git commit someone can read.
5. **Agents drive it through the CLI.** A built-in role teaches any agent to call
   `agreg`; every command has `--json`.
6. **Nothing role-specific in context until asked.** Roles are off until `agreg use`.

## Non-goals

- Discovery / a public index. Vercel's `skills` (31k stars, skills.sh) owns that; a
  registry URL is enough for the audiences above.
- A hosted service, accounts, or telemetry.
- Replacing the vendors' plugin formats. agreg generates them; it does not define a fifth.
- Windows support in v1 (links use junctions but nothing is tested there).

## Prior art

| Tool | Model | Gap for this RFC |
|---|---|---|
| Vercel `skills` | copies/symlinks SKILL.md into 80+ agents from GitHub, project or global scope | skills only, no MCP/hooks bundles, no roles, no per-folder activation, no review flow |
| skillshare | Go binary, symlinks file resources into 60+ tools | file-level, does not use native plugin systems |
| rulesync, ruler, amtiYo/agents | generate per-tool config from one project folder | project generators, not a registry operator |
| Claude Code / Codex / Cowork marketplaces | install a plugin from a GitHub URL, private included | one vendor each; no cross-tool role scoping |
| Homebrew taps, mise, Go modules | git repos *are* the registry; the tool composes them | the model this RFC adopts |

## Design

### Concepts

- **Registry**: a git repo whose root has `plugins/<role>/` folders plus the catalogue
  files the vendors expect (`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`).
  Its **name** is the `name` declared in those catalogues; Codex uses that name in
  plugin ids (`coding@ek-skills`), so agreg uses the same one everywhere.
- **Role**: `plugins/<role>/` with a portable `plugin.json` (Agent Plugins 1.0), optional
  `mcp.json`, `skills/`, `commands/`, `hooks/`, `agents/`, `scripts/`, and generated
  per-tool manifests. Unchanged from today; see `docs/registry-format.md`.
- **Qualified name**: `<registry>/<role>`. The short `<role>` is accepted when unique.
- **Link**: the tool-native attachment of a role: a symlink into `~/.claude/skills/`,
  a `gemini extensions link`, a `codex plugin add` from the registry registered as a
  local marketplace. See `docs/targets.md` for what was verified.
- **Scope**: `use` writes per-folder or per-user enablement in each tool's own format.

### Home layout

```
~/.agreg/                       ($AGREG_HOME)
  config.json                   registries, refs, pinned commits, prefixes
  registries/<name>/            git clones - the source of truth on this machine
  meta/                         the built-in "agreg" role, regenerated from the package
```

### Commands

```
agreg add <source> [--ref <ref>] [--only <tools>]                  clone + validate + link
agreg remove <registry> [--purge]                                  unlink + delete clone
agreg update [registry...] [--check] [--dry-run]                   fetch, show changes, fast-forward, relink, refresh Codex
agreg list [--json]                                                registries and their roles
agreg use [--roles a,b | --all] [--dir] [--global] [--only]        roles active here (all tools)
agreg status [--dir] [--cost] [--json]                             links, per-role state, active here
agreg sync [--dry-run]                                             make every tool match config (idempotent repair)
agreg doctor [registry] [--json]                                   validate registries, links, tools
agreg path [registry]                                              print the clone path
agreg edit <role>/<skill> | <role>                                 open in $EDITOR, or print the path
agreg propose -m <msg> [--registry <r>] [--branch <b>]             branch, commit, push, open PR
agreg new role <name> | skill <role>/<name> [--registry <r>]       scaffold inside a registry
agreg build [registry] [--check]                                   regenerate per-tool manifests
agreg init [dir]                                                   scaffold a new registry repo
agreg uninstall [--force]                                          unlink everything, delete ~/.agreg
```

`<source>` is `owner/repo`, an HTTPS or SSH git URL, or a local path. Private repos use
whatever git already has (SSH agent, `gh auth`, keychain).

### The built-in role

The package ships `assets/meta/`: one skill that tells an agent how to inspect, edit,
and propose changes through `agreg` (find the checkout with `agreg path`, never edit
cached copies, `agreg build` after manifest edits, `agreg doctor`, `agreg propose`).
On every `add`/`sync`/`update`, agreg regenerates `~/.agreg/meta/` as a tiny registry
named `agreg` with the single role `agreg`, links it, and keeps it always on. Registries
therefore do not need to ship a meta role, and upgrading agreg upgrades the skill.

### Updates and pinning

`config.json` records the ref and the commit each registry is on. `agreg update`:

1. refuses if the clone has uncommitted changes (tell the user to `propose` or clean up);
2. fetches, prints `git log --oneline <old>..<new>` and which roles/skills changed;
3. fast-forwards (or checks out the pinned ref), regenerates nothing (adapters are
   committed in the registry; CI there enforces `build --check`);
4. links roles that are new (off by default), unlinks roles that disappeared, re-adds
   Codex copies, prints the manual steps (Gemini restart, Claude `/reload-plugins`, Cowork Update).

`--check` only reports. A registry can be pinned with `--ref v1.2.0` or a commit.

### Naming across registries

Codex namespaces plugins by marketplace, so `coding@acme` and `coding@ek-skills`
coexist. Claude's skills dir and Gemini's extension names are flat, and Gemini takes
the name from the committed manifest, so a per-machine prefix cannot fix a clash there.
Rule for v1: a role's tool-visible name is `<role>`, and role names must be unique
across the registries a machine configures; `add` refuses a clash and names it. The
name `agreg` is reserved for the built-in role. (The Homebrew rule: names are unique
or you qualify them; qualification is `<registry>/<role>` in the CLI.)

### Change flow

```
agreg edit coding/code-review       # opens the SKILL.md in the clone (Claude/Gemini see it live)
agreg doctor ek-skills              # validates
agreg propose -m "Tighten the review checklist"
                                    # git checkout -b agreg/<slug>, commit, push -u, gh pr create
agreg update                        # after merge, on every machine
```

Draft branches are live in Claude Code and Gemini the moment the file is saved, because
those tools read the clone in place. Codex needs `agreg sync` to re-copy.

### Security

- Registries are trusted code: skills steer the agent, hooks run scripts. `add` prints the
  registry's roles, hooks, and MCP servers before linking; `update` shows the diff summary
  before fast-forwarding. Snyk's 2026 audit found a third of public skills flawed; the
  answer here is "read the change before it lands", not a scanner.
- Pinning to a tag or commit is supported for teams that want reproducible machines.
- agreg never stores credentials; git does the authentication.

### Distribution

- npm: `npm i -g agreg` (zero runtime dependencies, Node >= 20). Every target CLI is
  itself an npm package, so Node is already present for this audience.
- `npx agreg ...` for one-off use and CI (`npx agreg doctor` in a registry's workflow).
- A curl installer and a Homebrew formula can wrap the npm install later.

### AI-native repository

`AGENTS.md` at the root of the tool repo (the agents.md convention, read natively by
Codex, Cursor, Copilot; imported by `CLAUDE.md` for Claude Code) is the map: purpose,
invariants, and pointers into `docs/` (`architecture.md`, `registry-format.md`,
`targets.md`, `testing.md`, `decisions/` ADRs, `rfcs/`). Facts that were verified
against real tool versions are dated and versioned so a future agent knows what to
re-verify.

## Alternatives considered

- **MCP server instead of a CLI.** Rejected: MCP tool schemas sit in every prompt, which
  contradicts the context-cost goal; all targets can run shell; humans and CI need the
  CLI anyway. An MCP facade over the same library remains possible (ADR 0001).
- **Hosted index.** Rejected for now: discovery is solved elsewhere; git already gives
  history, review, and access control (ADR 0002).
- **Copy files into each tool's folders** (skillshare/Vercel model). Rejected: loses
  hooks/MCP bundling and the vendors' own enable/disable and cost reporting (ADR 0003).
- **Generate adapters locally instead of committing them.** Rejected: Cowork and vendor
  marketplaces read the repo by URL and need the files present (ADR 0005).
- **Prefix role names by registry** (always, or on demand with `--prefix`). Rejected
  for v1: ugly for the common single-registry case, and Gemini reads the extension name
  from the committed manifest, so a local prefix would not apply there (see Naming).

## Migration

1. New repo `agreg` (this one) holds the CLI, tests, docs, and the built-in role.
2. `ek-skills` becomes a pure registry: `plugins/`, catalogues, README, CI running
   `npx agreg doctor`. Its CLI code is removed.
3. Machines: `npm i -g agreg && agreg add eraykose/ek-skills`. The old `npm link` install
   is removed with `npm unlink -g ek-skills`.

## Open questions

- Windows: junctions for Claude, Codex and Gemini paths - untested.
- Codex per-folder enablement needs the folder trusted in Codex; agreg only warns.
- Whether `agreg` should offer `discard` (reset a dirty clone). Left to `git` for v1.
