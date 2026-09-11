'use strict';
const fs = require('fs');
const path = require('path');

// Read a JSON settings file: missing -> {}, unparsable -> hard error. We never
// overwrite something we could not read.
function readJsonFile(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8');
  try {
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${file} exists but is not valid JSON - fix or remove it, then retry.`);
  }
}

// Read-modify-write that preserves every other key and leaves the bytes alone when
// nothing changed.
function updateJsonFile(file, mutate, { dryRun } = {}) {
  const data = readJsonFile(file);
  const before = JSON.stringify(data);
  mutate(data);
  if (JSON.stringify(data) === before && fs.existsSync(file)) return data;
  if (dryRun) {
    console.log(`  [dry-run] would write ${file}`);
    return data;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return data;
}

module.exports = { readJsonFile, updateJsonFile };
