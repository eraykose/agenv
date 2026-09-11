'use strict';
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const cache = new Map();

// Is a binary on PATH? Memoised per process.
function which(bin) {
  if (cache.has(bin)) return cache.get(bin);
  let found = false;
  try {
    execSync(process.platform === 'win32' ? `where ${bin}` : `command -v ${bin}`, { stdio: 'ignore' });
    found = true;
  } catch {
    found = false;
  }
  cache.set(bin, found);
  return found;
}

// os.homedir() honours $HOME, which is what lets tests run against a scratch home.
function userPath(...segments) {
  return path.join(os.homedir(), ...segments);
}

// Shell-quote one argument.
function q(arg) {
  if (process.platform === 'win32') return `"${String(arg).replace(/"/g, '\\"')}"`;
  return `'${String(arg).replace(/'/g, `'\\''`)}'`;
}

module.exports = { which, userPath, q };
