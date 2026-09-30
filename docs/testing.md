# Testing

`npm test` runs `node --test`. Nothing in the suite touches the real tools or your home
directory.

`test/helpers.js` builds, per test:

- a scratch `HOME` and `AGENV_HOME`;
- fake `claude`, `codex`, and `gemini` executables on `PATH` (one Node script) that log
  their argv and reproduce the on-disk side effects observed in the real tools: Codex
  config tables, Gemini link files and enablement globs, Claude `plugin details` output;
- a scratch registry created with `agenv init` + `agenv new`, committed, pushed to a
  local bare repo, so `agenv add <bare path>` exercises the real clone/fetch path.

Assert on files written and on the shim log, never on incidental wording.

`agenv doctor` is the integration check against real tools; the registry CI runs it.
Before publishing a release, run the manual pass in `docs/release.md`.
