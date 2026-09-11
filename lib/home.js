'use strict';
const os = require('os');
const path = require('path');

// Everything agreg owns lives under one folder: config, the registry clones, and the
// built-in role. AGREG_HOME overrides it (tests, or a shared machine).
function home() {
  return process.env.AGREG_HOME ? path.resolve(process.env.AGREG_HOME) : path.join(os.homedir(), '.agreg');
}

function configFile() {
  return path.join(home(), 'config.json');
}

function registriesDir() {
  return path.join(home(), 'registries');
}

function metaDir() {
  return path.join(home(), 'meta');
}

module.exports = { home, configFile, registriesDir, metaDir };
