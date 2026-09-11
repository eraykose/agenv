'use strict';
const fs = require('fs');
const path = require('path');

// Just enough TOML to manage Codex's config.toml without a dependency: locate a
// `[table."quoted.key"]` header, read or set one `key = value` line inside it, and
// leave every other byte of the file exactly as it was.

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Header regex for e.g. ('plugins', 'coding@agreg') -> [plugins."coding@agreg"]. Codex writes
// bare keys when it can ([marketplaces.agreg]) and quoted ones otherwise, so accept both.
function headerRe(table, key) {
  const k = `(?:"${escapeRe(key)}"|'${escapeRe(key)}'|${escapeRe(key)})`;
  return new RegExp(`^\\s*\\[\\s*${escapeRe(table)}\\s*\\.\\s*${k}\\s*\\]\\s*(#.*)?$`);
}

function findTable(lines, table, key) {
  const re = headerRe(table, key);
  const start = lines.findIndex((l) => re.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function keyRe(name) {
  return new RegExp(`^(\\s*)${escapeRe(name)}\\s*=\\s*(.*?)\\s*(#.*)?$`);
}

// Raw value string of `name` inside [table."key"], or undefined.
function getValue(text, table, key, name) {
  const lines = text.split(/\r?\n/);
  const t = findTable(lines, table, key);
  if (!t) return undefined;
  const re = keyRe(name);
  for (let i = t.start + 1; i < t.end; i++) {
    const m = lines[i].match(re);
    if (m) return m[2];
  }
  return undefined;
}

function getBool(text, table, key, name) {
  const v = getValue(text, table, key, name);
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

function getString(text, table, key, name) {
  const v = getValue(text, table, key, name);
  if (v === undefined) return undefined;
  const m = v.match(/^"(.*)"$|^'(.*)'$/);
  return m ? (m[1] !== undefined ? m[1] : m[2]) : v;
}

// Set `name = value` inside [table."key"], creating the table at the end if needed.
function setValue(text, table, key, name, rawValue) {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const t = findTable(lines, table, key);
  if (!t) {
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    if (lines.length) lines.push('');
    lines.push(`[${table}."${key}"]`, `${name} = ${rawValue}`, '');
    return lines.join(nl);
  }
  const re = keyRe(name);
  for (let i = t.start + 1; i < t.end; i++) {
    const m = lines[i].match(re);
    if (m) {
      lines[i] = `${m[1]}${name} = ${rawValue}${m[3] ? ` ${m[3]}` : ''}`;
      return lines.join(nl);
    }
  }
  lines.splice(t.start + 1, 0, `${name} = ${rawValue}`);
  return lines.join(nl);
}

function removeTable(text, table, key) {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const t = findTable(lines, table, key);
  if (!t) return text;
  let start = t.start;
  // Take the blank line that precedes the header with it, so we don't leave gaps.
  if (start > 0 && lines[start - 1].trim() === '') start--;
  lines.splice(start, t.end - start);
  return lines.join(nl);
}

function readFile(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.endsWith('\n') ? text : text + '\n');
}

module.exports = { getValue, getBool, getString, setValue, removeTable, readFile, writeFile };
