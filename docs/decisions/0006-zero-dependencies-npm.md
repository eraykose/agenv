# ADR 0006: Zero runtime dependencies, distributed on npm

- Status: accepted
- Date: 2026-09-12

## Context
Every target CLI (Claude Code, Codex, Gemini CLI) is installed through npm, so Node is
present on every machine agenv targets. Supply-chain exposure of a tool that links
executable hooks into agent CLIs should be minimal.

## Decision
Plain Node (>= 20), no runtime dependencies, `node:test` for tests, published as
`agenv` on npm. Git and the vendor CLIs are shelled out to.

## Consequences
- `npm i -g agenv` or `npx agenv` everywhere, including registry CI.
- A minimal TOML editor and a checkbox prompt are hand-written (`lib/toml.js`,
  `lib/prompt.js`) rather than pulled in.
