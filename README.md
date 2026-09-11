# agreg

**agreg** (agent registry) links git repositories of *roles* into the agent CLIs you
use, one role at a time. A role is a plugin: skills, MCP servers, hooks, commands, and
personas that one kind of work needs. A registry is any git repo, public or private,
that holds roles. Companies keep theirs private; individuals share across their own
devices or with everyone. GitHub decides who can see it.

Supported today: **Claude Code**, **Codex**, **Gemini CLI**, and **Cowork** (which reads
the same repo as a marketplace by URL).

## Why

- **Written once.** Every tool reads the same clone, in place where the tool allows it,
  so an edit is live without copying files around.
- **Nothing in context you didn't ask for.** Roles are off everywhere until you turn
  them on for a folder. Skill descriptions and MCP schemas only cost tokens where they
  earn them.
- **Reviewed like code.** A change is a branch and a PR in the registry repo; every
  machine pulls it with one command and sees what changed before it lands.

## Install

```bash
npm i -g agreg
agreg add eraykose/ek-skills        # or any owner/repo, git URL, or local path
```

Private repos work with whatever git already has (SSH agent, `gh auth login`, keychain).
Node 20+ is the only requirement, and every supported CLI already ships on npm.

## Use

```bash
agreg use                   # in a project: pick the roles active here, on every tool
agreg use --roles coding    # non-interactive; --global for a machine-wide default
agreg status --cost         # what's linked, what's active here, tokens each role costs
agreg update                # fetch, show what changed, fast-forward, relink
```

## Change a registry

```bash
agreg edit coding/code-review        # opens the SKILL.md in the clone ($EDITOR)
agreg doctor ek-skills               # validates manifests, skills, generated files
agreg propose -m "Tighten review"    # branch, commit, push, open the PR
```

Or ask any agent session: *"update the code-review skill to ..."*. A built-in role
teaches every agent to do the above through `agreg`, without knowing where the clone is.

Start a registry of your own with `agreg init my-agents`; it scaffolds the layout and a
CI job that runs `npx agreg doctor .`. Format: `docs/registry-format.md`.

## Commands

```
add <owner/repo | git URL | path> [--ref <ref>] [--only <tools>]
remove <registry> [--purge] [--force]
update [registry...] [--check] [--json]
list [--json]
use [--roles a,b | --all] [--dir <path>] [--global] [--only <tools>]
status [--dir <path>] [--cost] [--json]
sync [--only <tools>]
doctor [registry|path] [--json]
path [registry]
edit <role>[/<skill>] [--print]
new role <name> | new skill <role>/<name> [--registry <r>] [-d <text>]
build [registry|path] [--check]
propose -m "<why>" [--registry <r>] [--branch <b>]
init [dir] [--name <n>] [--description <d>] [--owner <o>]
uninstall [--force]
```

Every command takes `--dry-run` where it changes something. `AGREG_HOME` overrides
`~/.agreg`.

## How it attaches to each tool

| Tool | Attach | Reads | Per-folder switch |
|---|---|---|---|
| Claude Code | symlink in `~/.claude/skills/` (`<role>@skills-dir`) | in place | `.claude/settings.local.json` |
| Gemini CLI | `gemini extensions link` | in place | `gemini extensions enable --scope workspace` |
| Codex | local marketplace + `codex plugin add` | a copy, refreshed by `agreg update`/`sync` | `.codex/config.toml` (trusted folders) |
| Cowork | Add marketplace by GitHub URL | the pushed repo | in-app |

Details and the versions this was verified against: `docs/targets.md`. Design:
`docs/rfcs/0001-registry-system.md` and `docs/decisions/`.

## Limits

- macOS/Linux. Windows untested.
- Codex honours a folder's `.codex/config.toml` only after you trust the folder in Codex.
- `commands/*.md` and `hooks/` in a role reach Claude Code only.

MIT.
