'use strict';
const path = require('path');
const { which, userPath, q } = require('../tools');
const toml = require('../toml');
const { run } = require('../run');

// Codex: each registry clone is registered as a local marketplace (its name comes from
// the registry's catalogue), and each role is `codex plugin add <role>@<registry>`, which
// copies into ~/.codex/plugins/cache. Enablement is a config.toml table, user-wide in
// ~/.codex or per folder in <dir>/.codex (trusted folders only). See docs/targets.md.

const id = 'codex';
const label = 'Codex';

const pluginId = (link) => `${link.role}@${link.registry.name}`;
const userConfigFile = () => userPath('.codex', 'config.toml');
const projectConfigFile = (dir) => path.join(dir, '.codex', 'config.toml');
const detected = () => which('codex');

const userConfig = () => toml.readFile(userConfigFile());
const marketplaceSource = (name) => toml.getString(userConfig(), 'marketplaces', name, 'source');
const registered = (reg) => marketplaceSource(reg.name) === reg.dir;
const enabledIn = (text, link) => toml.getBool(text, 'plugins', pluginId(link), 'enabled');

const isLinked = (link) => registered(link.registry) && enabledIn(userConfig(), link) !== undefined;
const linkedLinks = (links) => links.filter(isLinked);
const installed = (links) => linkedLinks(links).length > 0;

function register(reg, { dryRun } = {}) {
  const current = marketplaceSource(reg.name);
  if (current === reg.dir) return true;
  if (current) {
    console.log(`  marketplace "${reg.name}" points at ${current} - re-registering`);
    run(`codex plugin marketplace remove ${reg.name}`, { dryRun });
  }
  return run(`codex plugin marketplace add ${q(reg.dir)}`, { dryRun }).ok;
}

function link(links, { dryRun } = {}) {
  const fresh = [];
  const byRegistry = new Map();
  for (const l of links) byRegistry.set(l.registry.name, l.registry);
  const ready = new Set();
  for (const reg of byRegistry.values()) if (register(reg, { dryRun })) ready.add(reg.name);
  for (const l of links) {
    if (!ready.has(l.registry.name)) continue;
    const was = isLinked(l);
    if (was) continue;
    const r = run(`codex plugin add ${pluginId(l)}`, { dryRun });
    if (r.ok) fresh.push(l);
  }
  return fresh;
}

function unlink(links, { dryRun } = {}) {
  for (const l of links) {
    if (!isLinked(l) && !dryRun) continue;
    run(`codex plugin remove ${pluginId(l)}`, { dryRun });
  }
}

function unregister(reg, { dryRun } = {}) {
  if (marketplaceSource(reg.name) || dryRun) run(`codex plugin marketplace remove ${reg.name}`, { dryRun });
}

// Re-adding re-copies into Codex's cache. `codex plugin add` rewrites the user-scope
// enabled flag, so it is restored afterwards.
function refresh(links, { dryRun } = {}) {
  const linked = linkedLinks(links);
  const before = new Map(linked.map((l) => [l.name, enabledIn(userConfig(), l)]));
  for (const l of linked) run(`codex plugin add ${pluginId(l)}`, { dryRun });
  const restore = {};
  for (const l of linked) {
    const now = enabledIn(userConfig(), l);
    if (before.get(l.name) !== undefined && now !== before.get(l.name)) restore[l.name] = before.get(l.name);
  }
  if (Object.keys(restore).length) setEnabled(restore, { scope: 'user', dryRun, links });
  return { refreshed: linked.length > 0, notes: ['Codex: restart any open `codex` session to pick up the refreshed plugin copies.'] };
}

// entries: { <link name>: boolean }; `links` resolves names to plugin ids.
function setEnabled(entries, { scope, dir, dryRun, links } = {}) {
  const file = scope === 'user' ? userConfigFile() : projectConfigFile(dir);
  let text = toml.readFile(file);
  for (const [name, on] of Object.entries(entries)) {
    const l = links.find((x) => x.name === name);
    if (l) text = toml.setValue(text, 'plugins', pluginId(l), 'enabled', String(on));
  }
  if (dryRun) console.log(`  [dry-run] would write ${file}`);
  else toml.writeFile(file, text);
  return file;
}

function projectTrusted(dir) {
  return toml.getString(userConfig(), 'projects', path.resolve(dir), 'trust_level') === 'trusted';
}

function enabledState(link, dir) {
  const u = enabledIn(userConfig(), link);
  const p = dir ? enabledIn(toml.readFile(projectConfigFile(dir)), link) : undefined;
  const user = u === undefined ? null : u;
  const project = p === undefined ? null : p;
  return { user, project, effective: project !== null ? project : user !== null ? user : true };
}

module.exports = { id, label, pluginId, detected, installed, isLinked, linkedLinks, link, unlink, unregister, refresh, setEnabled, enabledState, marketplaceSource, projectTrusted };
