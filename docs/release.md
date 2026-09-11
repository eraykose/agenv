# Release checklist

1. `npm test`, then `agreg doctor` on a machine with all three CLIs.
2. Real pass on one machine: `agreg add <registry>`, `agreg use --roles <r> --dir <tmp>`,
   confirm `claude plugin list` / `codex plugin list --json` / Gemini enablement show the
   expected state, `agreg update --check`, `agreg remove <registry> --purge`, confirm the
   tool configs are byte-identical to before.
3. Bump `version` in `package.json`, update `docs/targets.md` if a tool version changed.
4. `npm publish` (public) - the package name is `agreg`.
