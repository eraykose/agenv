'use strict';
const fs = require('fs');
const path = require('path');

// One registry on disk. See docs/registry-format.md.

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// agenv.json is the source of the registry's identity; a Claude marketplace file is
// accepted as a fallback so registries built for Claude Code alone still work.
function readIdentity(dir) {
  const own = path.join(dir, 'agenv.json');
  if (fs.existsSync(own)) return readJson(own);
  const mp = path.join(dir, '.claude-plugin', 'marketplace.json');
  if (fs.existsSync(mp)) {
    const m = readJson(mp);
    return { name: m.name, description: m.description || (m.metadata && m.metadata.description), owner: m.owner };
  }
  return {};
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function open(dir, { builtin = false } = {}) {
  dir = path.resolve(dir);
  const pluginsDir = path.join(dir, 'plugins');
  if (!fs.existsSync(pluginsDir)) throw new Error(`${dir} is not a registry: no plugins/ folder`);
  const identity = readIdentity(dir);
  if (!identity.name) throw new Error(`${dir} is not a registry: no agenv.json with a "name"`);
  if (!KEBAB.test(identity.name)) throw new Error(`${dir}: registry name "${identity.name}" must be kebab-case`);

  const reg = {
    name: identity.name,
    dir,
    builtin,
    identity,
    pluginsDir,
    rolePath: (role) => path.join(pluginsDir, role),
    roles() {
      return fs
        .readdirSync(pluginsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(pluginsDir, d.name, 'plugin.json')))
        .map((d) => d.name)
        .sort();
    },
    // A link is what targets attach: the role folder under a tool-visible name.
    links() {
      return reg.roles().map((role) => ({ registry: reg, role, name: role, path: reg.rolePath(role) }));
    },
    hasRole: (role) => fs.existsSync(path.join(pluginsDir, role, 'plugin.json')),
    assertRole(role) {
      if (!reg.hasRole(role)) throw new Error(`Unknown role "${role}" in ${reg.name}. Roles: ${reg.roles().join(', ') || '(none)'}`);
    },
    readManifest: (role) => readJson(path.join(pluginsDir, role, 'plugin.json')),
    readMcp(role) {
      const file = path.join(pluginsDir, role, 'mcp.json');
      return fs.existsSync(file) ? readJson(file) : null;
    },
    listSkills(role) {
      const skillsDir = path.join(pluginsDir, role, 'skills');
      if (!fs.existsSync(skillsDir)) return [];
      return fs
        .readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')))
        .map((d) => {
          const file = path.join(skillsDir, d.name, 'SKILL.md');
          return { dir: d.name, file, frontmatter: parseFrontmatter(fs.readFileSync(file, 'utf8')) };
        });
    },
    agentNames(role) {
      const agentsDir = path.join(pluginsDir, role, 'agents');
      if (!fs.existsSync(agentsDir)) return [];
      return fs
        .readdirSync(agentsDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace(/\.md$/, ''))
        .sort();
    },
    hasHooks: (role) => fs.existsSync(path.join(pluginsDir, role, 'hooks', 'hooks.json')),
  };
  return reg;
}

// Walk up from `start` to the nearest folder that looks like a registry, or null.
function findUp(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'plugins')) && (fs.existsSync(path.join(dir, 'agenv.json')) || fs.existsSync(path.join(dir, '.claude-plugin', 'marketplace.json')))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

module.exports = { open, findUp, parseFrontmatter, KEBAB };
