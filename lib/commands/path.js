'use strict';
const registries = require('../registries');

function pathCmd({ name } = {}) {
  if (name) return console.log(registries.find(name).dir);
  const configured = registries.entries();
  if (configured.length === 0) throw new Error('No registries configured - `agreg add <owner/repo>` first.');
  if (configured.length === 1) return console.log(configured[0].dir);
  for (const e of configured) console.log(`${e.name}\t${e.dir}`);
}

module.exports = { pathCmd };
