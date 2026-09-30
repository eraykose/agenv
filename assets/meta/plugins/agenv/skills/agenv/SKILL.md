---
name: agenv
description: Use this when asked to change, fix, add, or review a skill, role, MCP server, or hook that lives in an agenv registry (the shared, git-tracked source of the roles loaded in this session), or to see which roles are active. Trigger on "update the X skill", "add a skill for Y", "which roles are on", "propose this change to the registry".
---

# agenv

Roles in this session come from git registries managed by the `agenv` CLI. The clones
under `agenv path` are the only place to edit; anything under `~/.claude/plugins`,
`~/.codex/plugins/cache`, or `~/.gemini/extensions` is a link or a cache and must not be
touched. The current working directory is almost never a registry.

```bash
agenv list --json              # registries and their roles
agenv status --json            # which roles are active here, per tool
agenv path <registry>          # the clone to edit in
agenv edit <role>/<skill>      # prints the SKILL.md path (opens $EDITOR in a terminal)
agenv new skill <role>/<name>  # scaffold a skill; `agenv new role <name>` for a role
agenv build <registry>         # after editing plugin.json or mcp.json
agenv doctor <registry>        # validate before proposing
agenv propose -m "<why>"       # branch, commit, push, open the PR
agenv update                   # after the PR merges, on every machine
```

Rules:

1. Edit the source: `plugins/<role>/skills/<name>/SKILL.md`, `plugins/<role>/plugin.json`,
   `plugins/<role>/mcp.json`. Never edit `.claude-plugin/`, `gemini-extension.json`, or
   the marketplace files; run `agenv build` instead.
2. A skill's `description` is the only part in every prompt; keep it precise and short.
3. Run `agenv doctor` and fix what it reports before `agenv propose`.
4. Claude Code and Gemini read the clone in place: a saved edit is already live (Gemini
   after a restart; Claude runs `/reload-plugins` for hooks or MCP changes). Codex needs
   `agenv sync`.
5. Don't create a new role for one skill unless it truly belongs to no existing role.
