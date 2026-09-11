# Targets: what each tool does, and what was verified

Every row below was checked by running the real command on macOS. Re-verify when the
version changes.

| Tool | Version verified | Attach | Reads | Enable per folder | Enable per user | After a source edit |
|---|---|---|---|---|---|---|
| Claude Code | 2.1.268 | symlink `~/.claude/skills/<name>` -> role folder; loads as `<name>@skills-dir` when `.claude-plugin/plugin.json` exists | in place | `.claude/settings.local.json` `enabledPlugins` | `~/.claude/settings.json`; `defaultEnabled:false` in the manifest is honoured | SKILL.md live; `/reload-plugins` for hooks/MCP/agents |
| Codex | 0.154.0 | `codex plugin marketplace add <clone>` (local, recorded in `~/.codex/config.toml` `[marketplaces.<name>]`), then `codex plugin add <role>@<name>` copies to `~/.codex/plugins/cache/<name>/<role>/<ver>/` | the copy | `<dir>/.codex/config.toml` `[plugins."<role>@<name>"] enabled` (trusted folders only; folder wins over user both ways) | `~/.codex/config.toml` same table | re-run `codex plugin add` (re-copies; rewrites the user-scope flag, which agreg restores) |
| Gemini CLI | 0.37.0 | `gemini extensions link <path> --consent` writes `~/.gemini/extensions/<name>/.gemini-extension-install.json` `{type:"link"}` | in place | `gemini extensions enable\|disable --scope workspace <name>` run with cwd = folder | `--scope user` | restart the session |
| Cowork / claude.ai | web, Sept 2026 | Customize > Plugins > Add marketplace > GitHub URL; reads `.claude-plugin/marketplace.json` | the pushed repo | in-app | in-app | push, then Update on the marketplace |

Other verified details:

- Codex reads the canonical `.agents/plugins/marketplace.json` (schema: `source:
  {source:"local", path}`) and a root `plugin.json` (Agent Plugins 1.0) with no
  `.codex-plugin` overlay.
- Gemini stores enablement as path globs in `extension-enablement.json`: `"<home>/*"`,
  `"!<home>/*"`, `"<dir>/*"`, `"!<dir>/*"`. No entry means enabled.
- Gemini's `extensions list` prints nothing without a TTY in 0.37; agreg reads the
  files instead.
- `claude plugin details <id>` prints an always-on token estimate; `agreg status --cost`
  surfaces it.
- Claude Code plugins synced from claude.ai load as `<name>@synced` and lose to a same-named
  skills-dir plugin, so Cowork installs do not clash with agreg links.
