'use strict';
const registries = require('../registries');
const { build } = require('../build');
const { openTarget } = require('./shared');

// agreg build [registry|path] [--check]
function buildCmd({ target, check } = {}) {
  const regs = target ? [openTarget(target)] : registries.all();
  let healthy = true;
  for (const reg of regs) {
    const { changed, problems } = build(reg, { check });
    if (problems.length || (check && changed.length)) healthy = false;
  }
  return healthy;
}

module.exports = { buildCmd };
