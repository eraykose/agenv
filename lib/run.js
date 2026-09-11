'use strict';
const { execSync } = require('child_process');

// Every state-changing external command goes through here so --dry-run is honoured
// everywhere and every real invocation is echoed. Never throws: callers read `ok`.
function run(cmd, { dryRun, cwd, quiet } = {}) {
  if (!quiet) console.log(dryRun ? `  [dry-run] $ ${cmd}` : `  $ ${cmd}`);
  if (dryRun) return { ok: true, skipped: true, out: '' };
  try {
    const out = execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    if (!quiet && out.trim()) console.log(indent(out.trim()));
    return { ok: true, out };
  } catch (err) {
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    if (!quiet) console.error(indent(`! failed: ${msg}`));
    return { ok: false, out: '', error: msg };
  }
}

// Silent query: reads state, never changes it, so it is never dry-run gated.
function capture(cmd, { cwd } = {}) {
  try {
    return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
  } catch {
    return null;
  }
}

function indent(text) {
  return text
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n');
}

module.exports = { run, capture };
