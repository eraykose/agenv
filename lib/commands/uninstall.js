'use strict';
const fs = require('fs');
const git = require('../git');
const registries = require('../registries');
const targets = require('../targets');
const { home } = require('../home');

// Take agreg off this machine: unlink every registry and the built-in role from every
// tool, drop marketplace registrations and our user-scope keys, delete ~/.agreg.
// Refuses while a clone has uncommitted changes unless --force.
function uninstall({ force, dryRun } = {}) {
  const regs = registries.all();
  const dirty = regs.filter((r) => !r.builtin && git.isDirty(r.dir));
  if (dirty.length && !force) throw new Error(`Uncommitted changes in ${dirty.map((r) => r.dir).join(', ')} - \`agreg propose\` them, or pass --force to discard.`);
  const links = registries.allLinks(regs);
  for (const t of targets.installedTargets(links)) {
    console.log(`== ${t.label} ==`);
    t.unlink(links, { dryRun });
    for (const reg of regs) if (t.unregister) t.unregister(reg, { dryRun });
    if (t.forget) t.forget(links, { dryRun });
  }
  if (dryRun) {
    console.log(`  [dry-run] would delete ${home()}`);
    return;
  }
  fs.rmSync(home(), { recursive: true, force: true });
  console.log(`Deleted ${home()}. To come back: \`agreg add <owner/repo>\`.`);
}

module.exports = { uninstall };
