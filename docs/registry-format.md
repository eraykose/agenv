# Registry format

A registry is a git repository with this shape. `agreg init` scaffolds it; `agreg
doctor` validates it; `agreg build` regenerates every file marked *generated*.

```
<registry>/
├── plugins/
│   └── <role>/
│       ├── plugin.json                  SOURCE  Agent Plugins 1.0 manifest: $schema, name, version, description[, author]
│       ├── mcp.json                     SOURCE  optional { "mcpServers": { <name>: {command,args,env | url} } }
│       ├── skills/<skill>/SKILL.md      SOURCE  frontmatter name + description, then the instructions
│       ├── commands/*.md                Claude Code slash commands (Claude-only)
│       ├── hooks/hooks.json, scripts/   Claude Code hooks (Claude-only)
│       ├── agents/*.md                  personas; `use` sets Claude's agent when exactly one role is active
│       ├── .claude-plugin/plugin.json   generated  (Claude Code + Cowork)
│       └── gemini-extension.json        generated  (Gemini CLI; MCP servers inlined)
├── .claude-plugin/marketplace.json      generated  catalogue for Claude Code + Cowork
├── .agents/plugins/marketplace.json     generated  catalogue for Codex (its canonical path)
├── agreg.json                           registry name, description, owner (feeds the catalogues)
├── README.md
└── .github/workflows/ci.yml             runs `npx agreg doctor .`
```

Rules:

- `plugin.json` `name` must equal the folder name; role names are kebab-case.
- The registry **name** in `agreg.json` is what Codex uses as the marketplace name, so
  plugin ids are `<role>@<registry>`. It must be unique among the registries a machine
  configures.
- A role with no skills and no `mcp.json` is flagged by `doctor`.
- `commands/*.md` reach Claude Code only. Gemini wants TOML commands; Codex invokes
  skills directly. Hooks in `hooks/hooks.json` are Claude Code's format.
- Never hand-edit generated files; CI runs `build --check`.

`agreg.json`:

```json
{ "name": "ek-skills", "description": "…", "owner": { "name": "…", "email": "…" } }
```
