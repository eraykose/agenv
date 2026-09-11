'use strict';
const fs = require('fs');
const path = require('path');
const { which, userPath } = require('../tools');
const { readJsonFile, updateJsonFile } = require('../settings');
const { capture } = require('../run');

// Claude Code: each link is a symlink ~/.claude/skills/<name> -> the role folder in the
// clone. Claude loads it in place as `<name>@skills-dir`. Per-folder enablement is
// `enabledPlugins` in .claude/settings.local.json; user-wide in ~/.claude/settings.json.
// See docs/targets.md.

const id = 'claude';
const label = 'Claude Code';

const skillsDir = () => userPath('.claude', 'skills');
const linkPath = (link) => path.join(skillsDir(), link.name);
const pluginId = (link) => `${link.name}@skills-dir`;
const userSettingsFile = () => userPath('.claude', 'settings.json');
const projectSettingsFile = (dir) => path.join(dir, '.claude', 'settings.local.json');

function detected() {
  return which('claude') || fs.existsSync(userPath('.claude'));
}

function linkTarget(name) {
  try {
    return fs.readlinkSync(path.join(skillsDir(), name));
  } catch {
    return null;
  }
}

const isLinked = (link) => linkTarget(link.name) === link.path;
const linkedLinks = (links) => links.filter(isLinked);
const installed = (links) => linkedLinks(links).length > 0;

// Returns the links made for the first time.
function link(links, { dryRun } = {}) {
  const fresh = [];
  if (!dryRun) fs.mkdirSync(skillsDir(), { recursive: true });
  for (const l of links) {
    const dest = linkPath(l);
    const current = linkTarget(l.name);
    if (current === l.path) continue;
    if (current === null && fs.existsSync(dest)) {
      console.error(`  ! ${dest} exists and is not a symlink - move it away, then re-run`);
      continue;
    }
    console.log(`  ${dryRun ? '[dry-run] ' : ''}${dest} -> ${l.path}`);
    if (!dryRun) {
      if (current !== null) fs.unlinkSync(dest);
      fs.symlinkSync(l.path, dest, process.platform === 'win32' ? 'junction' : 'dir');
    }
    fresh.push(l);
  }
  return fresh;
}

function unlink(links, { dryRun } = {}) {
  for (const l of links) {
    if (linkTarget(l.name) === null) continue;
    console.log(`  ${dryRun ? '[dry-run] ' : ''}rm ${linkPath(l)}`);
    if (!dryRun) fs.unlinkSync(linkPath(l));
  }
}

// Drop our keys from the user-wide settings (used by remove --purge).
function forget(links, { dryRun } = {}) {
  updateJsonFile(
    userSettingsFile(),
    (s) => {
      if (!s.enabledPlugins) return;
      for (const l of links) delete s.enabledPlugins[pluginId(l)];
    },
    { dryRun }
  );
}

function refresh() {
  return { refreshed: false, notes: ['Claude Code: SKILL.md edits are live; run /reload-plugins (or start a new session) for hook, MCP, or agent changes.'] };
}

// entries: { <link name>: boolean }
function setEnabled(entries, { scope, dir, dryRun, agent } = {}) {
  const file = scope === 'user' ? userSettingsFile() : projectSettingsFile(dir);
  updateJsonFile(
    file,
    (s) => {
      s.enabledPlugins = s.enabledPlugins || {};
      for (const [name, on] of Object.entries(entries)) s.enabledPlugins[`${name}@skills-dir`] = on;
      if (scope !== 'user') {
        if (agent) s.agent = agent;
        else delete s.agent;
      }
    },
    { dryRun }
  );
  return file;
}

function readEnabled(file, link) {
  try {
    const v = readJsonFile(file).enabledPlugins;
    const x = v && v[pluginId(link)];
    return typeof x === 'boolean' ? x : null;
  } catch {
    return null;
  }
}

function enabledState(link, dir) {
  const user = readEnabled(userSettingsFile(), link);
  const project = dir ? readEnabled(projectSettingsFile(dir), link) : null;
  const fallback = link.registry.builtin; // defaultEnabled in the generated manifest
  return { user, project, effective: project !== null ? project : user !== null ? user : fallback };
}

// "Always-on: ~238 tok" from `claude plugin details`, or null.
function alwaysOnTokens(link) {
  if (!which('claude')) return null;
  const out = capture(`claude plugin details ${pluginId(link)}`);
  const m = out && out.match(/Always-on:\s+~?([\d,.]+k?)\s*tok/i);
  return m ? m[1] : null;
}

// Dangling symlinks under the skills dir that point into a given root.
function danglingUnder(root) {
  if (!fs.existsSync(skillsDir())) return [];
  return fs
    .readdirSync(skillsDir())
    .map((name) => ({ name, target: linkTarget(name) }))
    .filter((e) => e.target && e.target.startsWith(root) && !fs.existsSync(e.target))
    .map((e) => path.join(skillsDir(), e.name));
}

module.exports = { id, label, pluginId, detected, installed, isLinked, linkedLinks, link, unlink, forget, refresh, setEnabled, enabledState, alwaysOnTokens, danglingUnder, linkPath, skillsDir };
