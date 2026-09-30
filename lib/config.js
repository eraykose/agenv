'use strict';
const fs = require('fs');
const path = require('path');
const { configFile } = require('./home');

// ~/.agenv/config.json: { version, registries: { <name>: { url, ref, commit, addedAt } } }

function read() {
  const file = configFile();
  if (!fs.existsSync(file)) return { version: 1, registries: {} };
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`${file} is not valid JSON - fix or remove it.`);
  }
  cfg.registries = cfg.registries || {};
  return cfg;
}

function write(cfg) {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2) + '\n');
}

function update(mutate) {
  const cfg = read();
  mutate(cfg);
  write(cfg);
  return cfg;
}

module.exports = { read, write, update };
