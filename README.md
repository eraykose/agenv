# agenv

**nvm for your agents.** One setup, in every agent CLI you use and on every machine,
with the right role switched on in every folder, and it gets better with every PR.

A *role* is a plugin: the skills, MCP servers, hooks, commands, and personas one kind
of work needs. A *registry* is any git repo, public or private, that holds roles.
Companies keep theirs private; individuals share across their own devices or with
everyone. GitHub decides who can see it.

```bash
npm i -g agenv
agenv add acme/agent-skills      # clone once, link into every agent CLI, all roles off
cd ~/code/api && agenv use coding   # like `nvm use`: only the coding role loads here
agenv edit coding/review         # edit the skill; Claude Code and Gemini see it live
agenv propose -m "Stricter review"  # branch, commit, push, open the PR
agenv update                     # every other machine: see what changed, pull it
```

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
npm i -g agenv
agenv add eraykose/ek-skills        # or any owner/repo, git URL, or local path
```

Private repos work with whatever git already has (SSH agent, `gh auth login`, keychain).
Node 20+ is the only requirement, and every supported CLI already ships on npm.

## Use

```bash
agenv use                   # in a project: pick the roles active here, on every tool
agenv use --roles coding    # non-interactive; --global for a machine-wide default
agenv status --cost         # what's linked, what's active here, tokens each role costs
agenv update                # fetch, show what changed, fast-forward, relink
```

## Change a registry

```bash
agenv edit coding/code-review        # opens the SKILL.md in the clone ($EDITOR)
agenv doctor ek-skills               # validates manifests, skills, generated files
agenv propose -m "Tighten review"    # branch, commit, push, open the PR
```

Or ask any agent session: *"update the code-review skill to ..."*. A built-in role
teaches every agent to do the above through `agenv`, without knowing where the clone is.

Start a registry of your own with `agenv init my-agents`; it scaffolds the layout and a
CI job that runs `npx agenv doctor .`. Format: `docs/registry-format.md`.

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

Every command takes `--dry-run` where it changes something. `AGENV_HOME` overrides
`~/.agenv`.

## How it attaches to each tool

| Tool | Attach | Reads | Per-folder switch |
|---|---|---|---|
| Claude Code | symlink in `~/.claude/skills/` (`<role>@skills-dir`) | in place | `.claude/settings.local.json` |
| Gemini CLI | `gemini extensions link` | in place | `gemini extensions enable --scope workspace` |
| Codex | local marketplace + `codex plugin add` | a copy, refreshed by `agenv update`/`sync` | `.codex/config.toml` (trusted folders) |
| Cowork | Add marketplace by GitHub URL | the pushed repo | in-app |

Details and the versions this was verified against: `docs/targets.md`. Design:
`docs/rfcs/0001-registry-system.md` and `docs/decisions/`.

## agenv and APM

Microsoft's [APM](https://github.com/microsoft/apm) is a package manager for a
*project's* agent dependencies: pinned in the repo, copied into it, governed by org
policy. agenv is for *your* agent setup across every project: it links in place instead
of copying, switches roles per folder instead of installing everything, and treats the
registry as something you improve from any session rather than a dependency to freeze.
If you need compliance-grade lockfiles and org policy across nine harnesses, use APM.

## Limits

- macOS/Linux. Windows untested.
- Codex honours a folder's `.codex/config.toml` only after you trust the folder in Codex.
- `commands/*.md` and `hooks/` in a role reach Claude Code only.

MIT.
