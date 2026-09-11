'use strict';
const fs = require('fs');
const path = require('path');
const registries = require('../registries');
const registry = require('../registry');

// Roles are opt-in (ADR 0004): links made for the first time are switched off at user
// scope, except the built-in role. Claude gets this from `defaultEnabled` in the manifest.
function firstTimeDefaults(target, fresh, links, { dryRun } = {}) {
  if (!fresh.length) return;
  const entries = {};
  for (const l of fresh) entries[l.name] = Boolean(l.registry.builtin);
  const off = fresh.filter((l) => !l.registry.builtin).map((l) => l.name);
  console.log(`  default: ${off.length ? `${off.join(', ')} off until \`agreg use\`` : 'nothing new to switch off'}`);
  if (target.id !== 'claude') target.setEnabled(entries, { scope: 'user', dryRun, links });
}

// `agreg build <x>` / `agreg doctor <x>`: x is a configured registry name or a path.
function openTarget(spec) {
  if (spec && fs.existsSync(spec) && fs.statSync(spec).isDirectory()) return registry.open(path.resolve(spec));
  return registries.find(spec);
}

// The registry a command should act on when none was named: the one cwd is inside, or
// the only configured one.
function inferRegistry(name) {
  if (name) return registries.find(name);
  const here = registries.containing(process.cwd());
  if (here) return here;
  const local = registry.findUp(process.cwd());
  if (local) return registry.open(local);
  const configured = registries.openConfigured();
  if (configured.length === 1) return configured[0];
  if (configured.length === 0) throw new Error('No registries configured - `agreg add <owner/repo>` first.');
  throw new Error(`Several registries are configured (${configured.map((r) => r.name).join(', ')}) - pass --registry <name>.`);
}

function printNotes(notes) {
  const unique = [...new Set(notes)];
  if (!unique.length) return;
  console.log('\nWhat this cannot do for you:');
  for (const n of unique) console.log(`  - ${n}`);
}

// A short inventory of what a registry would put in front of an agent (shown before linking).
function describe(reg) {
  const lines = [];
  for (const role of reg.roles()) {
    const skills = reg.listSkills(role).map((s) => s.dir);
    const mcp = reg.readMcp(role);
    const extras = [
      mcp && mcp.mcpServers ? `mcp: ${Object.keys(mcp.mcpServers).join(', ')}` : null,
      reg.hasHooks(role) ? 'hooks' : null,
      reg.agentNames(role).length ? `agents: ${reg.agentNames(role).join(', ')}` : null,
    ].filter(Boolean);
    lines.push(`  ${role.padEnd(14)} skills: ${skills.join(', ') || '(none)'}${extras.length ? `  [${extras.join('; ')}]` : ''}`);
  }
  return lines.join('\n');
}

module.exports = { firstTimeDefaults, openTarget, inferRegistry, printNotes, describe };
