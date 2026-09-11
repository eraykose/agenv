---
name: agreg
description: Use this when asked to change, fix, add, or review a skill, role, MCP server, or hook that lives in an agreg registry (the shared, git-tracked source of the roles loaded in this session), or to see which roles are active. Trigger on "update the X skill", "add a skill for Y", "which roles are on", "propose this change to the registry".
---

# agreg

Roles in this session come from git registries managed by the `agreg` CLI. The clones
under `agreg path` are the only place to edit; anything under `~/.claude/plugins`,
`~/.codex/plugins/cache`, or `~/.gemini/extensions` is a link or a cache and must not be
touched. The current working directory is almost never a registry.

```bash
agreg list --json              # registries and their roles
agreg status --json            # which roles are active here, per tool
agreg path <registry>          # the clone to edit in
agreg edit <role>/<skill>      # prints the SKILL.md path (opens $EDITOR in a terminal)
agreg new skill <role>/<name>  # scaffold a skill; `agreg new role <name>` for a role
agreg build <registry>         # after editing plugin.json or mcp.json
agreg doctor <registry>        # validate before proposing
agreg propose -m "<why>"       # branch, commit, push, open the PR
agreg update                   # after the PR merges, on every machine
```

Rules:

1. Edit the source: `plugins/<role>/skills/<name>/SKILL.md`, `plugins/<role>/plugin.json`,
   `plugins/<role>/mcp.json`. Never edit `.claude-plugin/`, `gemini-extension.json`, or
   the marketplace files; run `agreg build` instead.
2. A skill's `description` is the only part in every prompt; keep it precise and short.
3. Run `agreg doctor` and fix what it reports before `agreg propose`.
4. Claude Code and Gemini read the clone in place: a saved edit is already live (Gemini
   after a restart; Claude runs `/reload-plugins` for hooks or MCP changes). Codex needs
   `agreg sync`.
5. Don't create a new role for one skill unless it truly belongs to no existing role.
