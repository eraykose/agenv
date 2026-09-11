'use strict';
const fs = require('fs');
const path = require('path');
const { which, userPath, q } = require('../tools');
const { readJsonFile } = require('../settings');
const { run } = require('../run');

// Gemini CLI: `gemini extensions link` records the clone path under
// ~/.gemini/extensions/<name>/ and reads the folder in place. Enablement is per user or
// per workspace (cwd), stored as path globs in extension-enablement.json. See docs/targets.md.

const id = 'gemini';
const label = 'Gemini CLI';

const pluginId = (link) => link.name;
const extensionsDir = () => userPath('.gemini', 'extensions');
const installFile = (name) => path.join(extensionsDir(), name, '.gemini-extension-install.json');
const enablementFile = () => path.join(extensionsDir(), 'extension-enablement.json');

const detected = () => which('gemini');

function linkSource(name) {
  try {
    const info = readJsonFile(installFile(name));
    return info.type === 'link' ? info.source : null;
  } catch {
    return null;
  }
}

const isLinked = (link) => linkSource(link.name) === link.path;
const linkedLinks = (links) => links.filter(isLinked);
const installed = (links) => linkedLinks(links).length > 0;

function link(links, { dryRun } = {}) {
  const fresh = [];
  for (const l of links) {
    if (isLinked(l)) continue;
    if (fs.existsSync(installFile(l.name))) run(`gemini extensions uninstall ${l.name}`, { dryRun });
    const r = run(`gemini extensions link ${q(l.path)} --consent`, { dryRun });
    if (r.ok) fresh.push(l);
  }
  return fresh;
}

function unlink(links, { dryRun } = {}) {
  for (const l of links) {
    if (!fs.existsSync(installFile(l.name)) && !dryRun) continue;
    run(`gemini extensions uninstall ${l.name}`, { dryRun });
  }
}

function refresh() {
  return { refreshed: false, notes: ['Gemini CLI: restart any open `gemini` session - extensions are read at startup.'] };
}

// entries: { <link name>: boolean }. Workspace scope is keyed on the cwd the command runs in.
function setEnabled(entries, { scope, dir, dryRun } = {}) {
  const gscope = scope === 'user' ? 'user' : 'workspace';
  for (const [name, on] of Object.entries(entries)) {
    run(`gemini extensions ${on ? 'enable' : 'disable'} --scope ${gscope} ${name}`, { dryRun, cwd: dir });
  }
  return enablementFile();
}

// Globs: "<home>/*" user on, "!<home>/*" user off, "<dir>/*" / "!<dir>/*" workspace. No entry = on.
function enabledState(link, dir) {
  let overrides = [];
  try {
    const all = readJsonFile(enablementFile());
    overrides = (all[link.name] && all[link.name].overrides) || [];
  } catch {
    overrides = [];
  }
  // Gemini keys workspaces on its own cwd, which is a realpath (/private/var on macOS);
  // accept either spelling of the folder.
  const lookup = (base) => (overrides.includes(`!${base}/*`) ? false : overrides.includes(`${base}/*`) ? true : null);
  const forms = (p) => {
    const out = [path.resolve(p)];
    try {
      const real = fs.realpathSync(p);
      if (real !== out[0]) out.push(real);
    } catch {
      /* not on disk */
    }
    return out;
  };
  const first = (bases) => bases.map(lookup).find((v) => v !== null) ?? null;
  const user = first(forms(userPath()));
  const project = dir ? first(forms(dir)) : null;
  return { user, project, effective: project !== null ? project : user !== null ? user : true };
}

module.exports = { id, label, pluginId, detected, installed, isLinked, linkedLinks, link, unlink, refresh, setEnabled, enabledState, linkSource };
