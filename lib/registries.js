'use strict';
const fs = require('fs');
const path = require('path');
const config = require('./config');
const registry = require('./registry');
const meta = require('./meta');
const { registriesDir } = require('./home');

// The set of registries this machine has: the built-in one plus every configured clone.

function entries() {
  const cfg = config.read();
  return Object.entries(cfg.registries).map(([name, e]) => ({ name, ...e, dir: e.dir || path.join(registriesDir(), name) }));
}

function openConfigured() {
  const out = [];
  for (const e of entries()) {
    if (!fs.existsSync(e.dir)) {
      console.error(`  ! registry "${e.name}" is configured but ${e.dir} is missing - \`agenv remove ${e.name}\` or \`agenv add ${e.url}\``);
      continue;
    }
    const reg = registry.open(e.dir);
    reg.entry = e;
    out.push(reg);
  }
  return out;
}

function all() {
  return [meta.ensure(), ...openConfigured()];
}

function find(name) {
  const reg = all().find((r) => r.name === name);
  if (!reg) throw new Error(`Unknown registry "${name}". Configured: ${entries().map((e) => e.name).join(', ') || '(none)'}`);
  return reg;
}

function allLinks(regs = all()) {
  return regs.flatMap((r) => r.links());
}

function selectableLinks(regs = all()) {
  return allLinks(regs).filter((l) => !l.registry.builtin);
}

// "<registry>/<role>" or "<role>" (when unique) -> link.
function findLink(spec, regs = all()) {
  const links = allLinks(regs);
  const [a, b] = spec.split('/');
  const matches = b === undefined ? links.filter((l) => l.name === a) : links.filter((l) => l.registry.name === a && l.role === b);
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new Error(`Unknown role "${spec}". Roles: ${links.map(qualified).join(', ') || '(none)'}`);
  throw new Error(`"${spec}" is ambiguous: ${matches.map(qualified).join(', ')}`);
}

function qualified(link) {
  return `${link.registry.name}/${link.role}`;
}

// Registry a path belongs to, if any (used to infer --registry from cwd).
function containing(dir) {
  const abs = path.resolve(dir);
  return openConfigured().find((r) => abs === r.dir || abs.startsWith(r.dir + path.sep)) || null;
}

module.exports = { entries, openConfigured, all, find, allLinks, selectableLinks, findLink, qualified, containing };
