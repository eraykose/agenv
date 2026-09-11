'use strict';
const fs = require('fs');
const path = require('path');
const { metaDir } = require('./home');
const registry = require('./registry');
const { build } = require('./build');
const pkg = require('../package.json');

// The built-in role (ADR 0007): agreg ships assets/meta and regenerates ~/.agreg/meta
// from it, so upgrading the package upgrades what agents read about it.

const ASSETS = path.join(__dirname, '..', 'assets', 'meta');
const NAME = 'agreg';

function ensure() {
  const dir = metaDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(ASSETS, dir, { recursive: true });
  const manifestFile = path.join(dir, 'plugins', NAME, 'plugin.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (manifest.version !== pkg.version) {
    manifest.version = pkg.version;
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  }
  const reg = registry.open(dir, { builtin: true });
  build(reg, { quiet: true });
  return reg;
}

module.exports = { ensure, NAME };
