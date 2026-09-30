# ADR 0009: The tool is named agenv

- Status: accepted
- Date: 2026-09-30

## Context
The first name, agreg ("agent registry"), described plumbing that Microsoft's APM
also does (install from git, many harnesses). What sets this tool apart is the
per-folder role switch and the edit-propose-update loop. Every short English word
(hone, lore, equip, knack, ...) is squatted on npm or used by a tool in this space.

## Decision
`agenv`, for agent environment. It borrows the model developers already know from
`nvm use` and `pyenv local`: `agenv use coding` switches what is active in a folder.
It is free unscoped on npm and on Homebrew; the only same-name GitHub repo is small and
unrelated in purpose.

## Consequences
- Package, binary, and built-in role are all `agenv`; the home is `~/.agenv`
  (`AGENV_HOME`); a registry declares itself in `agenv.json`.
- "Registry" stays the name for a git repo of roles.
- The name `agenv` is reserved: no registry may declare a role with it.
