'use strict';
const fs = require('fs');
const path = require('path');

// Every tool-specific manifest in a registry is derived from one source per role
// (plugin.json + optional mcp.json) and one per registry (agreg.json):
//   plugins/<role>/.claude-plugin/plugin.json   Claude Code + Cowork
//   plugins/<role>/gemini-extension.json        Gemini CLI (MCP servers inlined)
//   .claude-plugin/marketplace.json             catalogue for Claude Code + Cowork
//   .agents/plugins/marketplace.json            catalogue for Codex
// They are committed (ADR 0005); `build --check` reports drift.

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function author(reg, m) {
  if (m.author) return typeof m.author === 'string' ? { name: m.author } : m.author;
  const o = reg.identity.owner;
  return o ? compact({ name: o.name, email: o.email, url: o.url }) : undefined;
}

function claudeManifest(reg, role, m, mcp) {
  return compact({
    name: m.name,
    version: m.version,
    description: m.description,
    author: author(reg, m),
    // Roles are opt-in (ADR 0004); the built-in role is the one always-on exception.
    defaultEnabled: reg.builtin ? undefined : false,
    mcpServers: mcp ? './mcp.json' : undefined,
  });
}

function geminiManifest(role, m, mcp) {
  return compact({
    name: m.name,
    version: m.version,
    description: m.description,
    mcpServers: mcp && mcp.mcpServers && Object.keys(mcp.mcpServers).length ? mcp.mcpServers : undefined,
  });
}

function claudeMarketplace(reg, roles) {
  const o = reg.identity.owner;
  return compact({
    name: reg.name,
    description: reg.identity.description,
    owner: o ? compact({ name: o.name, email: o.email }) : undefined,
    plugins: roles.map((role) => {
      const m = reg.readManifest(role);
      return compact({ name: m.name, description: m.description, version: m.version, source: `./plugins/${role}` });
    }),
  });
}

function codexMarketplace(reg, roles) {
  return {
    name: reg.name,
    interface: { displayName: reg.name },
    plugins: roles.map((role) => ({
      name: role,
      source: { source: 'local', path: `./plugins/${role}` },
      policy: { installation: 'AVAILABLE' },
    })),
  };
}

function plan(reg) {
  const roles = reg.roles();
  const files = [];
  const problems = [];
  for (const role of roles) {
    const m = reg.readManifest(role);
    if (m.name !== role) problems.push(`plugins/${role}/plugin.json: "name" is "${m.name}" but the folder is "${role}"`);
    for (const f of ['version', 'description']) if (!m[f]) problems.push(`plugins/${role}/plugin.json: missing "${f}"`);
    const mcp = reg.readMcp(role);
    files.push({ file: path.join(reg.rolePath(role), '.claude-plugin', 'plugin.json'), content: claudeManifest(reg, role, m, mcp) });
    files.push({ file: path.join(reg.rolePath(role), 'gemini-extension.json'), content: geminiManifest(role, m, mcp) });
  }
  files.push({ file: path.join(reg.dir, '.claude-plugin', 'marketplace.json'), content: claudeMarketplace(reg, roles) });
  files.push({ file: path.join(reg.dir, '.agents', 'plugins', 'marketplace.json'), content: codexMarketplace(reg, roles) });
  return { files, problems };
}

// Returns { changed: [relative paths], problems: [messages] }. Check mode writes nothing.
function build(reg, { check = false, quiet = false } = {}) {
  const { files, problems } = plan(reg);
  const changed = [];
  for (const { file, content } of files) {
    const next = JSON.stringify(content, null, 2) + '\n';
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (current === next) continue;
    changed.push(path.relative(reg.dir, file));
    if (!check) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, next);
    }
  }
  if (!quiet) {
    for (const p of problems) console.error(`  ! ${p}`);
    if (changed.length === 0) console.log(`  ${reg.name}: manifests ${check ? 'in sync' : 'already up to date'}`);
    else for (const f of changed) console.log(`  ${reg.name}: ${check ? 'out of date' : 'wrote'}  ${f}`);
  }
  return { changed, problems };
}

module.exports = { build, plan };
