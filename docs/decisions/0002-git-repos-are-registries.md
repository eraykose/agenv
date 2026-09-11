# ADR 0002: A registry is a git repository, not a hosted index

- Status: accepted
- Date: 2026-09-12

## Context
Companies want private registries; individuals want to share across devices, publicly
or privately. Both already have GitHub. Discovery across strangers is served by Vercel's
skills.sh.

## Decision
`agreg add <owner/repo | git URL | path>` clones the repository under `~/.agreg/registries/`.
Authentication is git's (SSH agent, credential helper, `gh auth`). The registry's
name is the one declared in its catalogue files. Pinning is a ref or commit in
`~/.agreg/config.json`.

## Consequences
- History, review, blame, CI, and access control come from git and GitHub for free.
- Nothing is hosted by agreg; no accounts, no telemetry.
- Discovery is out of scope; a URL is the unit of sharing.
