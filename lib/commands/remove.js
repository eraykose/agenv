'use strict';
const fs = require('fs');
const git = require('../git');
const config = require('../config');
const registries = require('../registries');
const targets = require('../targets');

// Unlink a registry's roles from every tool and delete its clone. --purge also drops the
// Codex marketplace registration and our user-scope Claude keys.
function remove({ name, purge, force, dryRun } = {}) {
  if (!name) throw new Error('Usage: agreg remove <registry> [--purge] [--force]');
  const reg = registries.find(name);
  if (reg.builtin) throw new Error('The built-in "agreg" role cannot be removed.');
  if (git.isDirty(reg.dir) && !force) throw new Error(`${reg.dir} has uncommitted changes - \`agreg propose\` them, or pass --force to discard.`);

  const links = registries.allLinks();
  const mine = links.filter((l) => l.registry.name === reg.name);
  console.log(`Removing ${reg.name} (${mine.map((l) => l.role).join(', ') || 'no roles'})${purge ? ' with purge' : ''}`);
  for (const t of targets.installedTargets(links)) {
    console.log(`== ${t.label} ==`);
    t.unlink(mine, { dryRun });
    if (purge && t.unregister) t.unregister(reg, { dryRun });
    if (purge && t.forget) t.forget(mine, { dryRun });
  }
  if (dryRun) {
    console.log(`  [dry-run] would delete ${reg.dir} and drop it from config`);
    return;
  }
  fs.rmSync(reg.dir, { recursive: true, force: true });
  config.update((cfg) => {
    delete cfg.registries[reg.name];
  });
  console.log(`Deleted ${reg.dir}`);
}

module.exports = { remove };
