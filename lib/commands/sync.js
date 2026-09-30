'use strict';
const registries = require('../registries');
const targets = require('../targets');
const { firstTimeDefaults, printNotes } = require('./shared');

// Make every tool match config: link anything missing (including a freshly regenerated
// built-in role), refresh Codex copies. Idempotent; safe to run any time.
function sync({ dryRun, only } = {}) {
  const links = registries.allLinks();
  let selected = targets.detectedTargets();
  if (only) selected = targets.pickTargets(only, selected, 'detected');
  if (!selected.length) throw new Error('No supported agent CLI (claude, codex, gemini) found on this machine.');
  const notes = [];
  for (const t of selected) {
    console.log(`== ${t.label} ==`);
    const missing = links.filter((l) => !t.isLinked(l));
    firstTimeDefaults(t, t.link(missing, { dryRun }), links, { dryRun });
    const r = t.refresh(links, { dryRun });
    if (!missing.length && !r.refreshed) console.log('  reads the clones in place - nothing to do');
    notes.push(...r.notes);
  }
  printNotes(notes);
  if (registries.entries().length === 0) console.log('\nNo registries yet - `agenv add <owner/repo>`.');
}

module.exports = { sync };
