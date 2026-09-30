'use strict';
const path = require('path');
const registries = require('../registries');
const targets = require('../targets');
const { checkboxPrompt } = require('../prompt');

// Decide which roles are active in a folder (default: cwd), or machine-wide with
// --global, and write that into every linked tool. Every role gets an explicit on/off.
async function use({ dir, all, roles: rolesFlag, only, global: isGlobal, dryRun } = {}) {
  const regs = registries.all();
  const links = registries.allLinks(regs);
  const selectable = registries.selectableLinks(regs);
  const targetDir = path.resolve(dir || process.cwd());
  const scope = isGlobal ? 'user' : 'project';
  const multi = new Set(selectable.map((l) => l.registry.name)).size > 1;
  const show = (l) => (multi ? registries.qualified(l) : l.role);

  let linked = targets.installedTargets(links);
  if (only) linked = targets.pickTargets(only, linked, 'linked');
  if (!linked.length) throw new Error('Nothing is linked yet - `agenv add <owner/repo>` (or `agenv sync`) first.');
  if (!selectable.length) throw new Error('No roles to choose from - `agenv add <owner/repo>` first.');

  let selected;
  if (all) selected = selectable;
  else if (rolesFlag !== undefined) {
    selected = String(rolesFlag)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((spec) => registries.findLink(spec, regs));
    if (selected.some((l) => l.registry.builtin)) throw new Error('The built-in role is always on.');
  } else {
    const on = new Set(selectable.filter((l) => linked.every((t) => t.enabledState(l, targetDir).effective)).map((l) => l.name));
    const picked = await checkboxPrompt(
      `Which roles are active ${isGlobal ? 'machine-wide' : `in ${targetDir}`}?`,
      selectable.map((l) => ({ name: l.name, label: show(l), checked: on.has(l.name) }))
    );
    selected = selectable.filter((l) => picked.includes(l.name));
  }

  const on = new Set(selected.map((l) => l.name));
  const entries = {};
  for (const l of links) entries[l.name] = l.registry.builtin || on.has(l.name);
  const agents = selected.length === 1 ? selected[0].registry.agentNames(selected[0].role) : [];
  const agent = agents.length ? `${selected[0].name}:${agents[0]}` : undefined;

  console.log(`${isGlobal ? 'Machine-wide' : targetDir}:`);
  console.log(`  on:   ${selected.map(show).join(', ') || '(only the built-in role)'}`);
  console.log(`  off:  ${selectable.filter((l) => !on.has(l.name)).map(show).join(', ') || '(none)'}`);
  for (const t of linked) {
    const file = t.setEnabled(entries, { scope, dir: targetDir, dryRun, agent, links });
    console.log(`  ${t.label}: ${file}`);
    if (t.id === 'codex' && !isGlobal && !t.projectTrusted(targetDir)) {
      console.log("    (Codex reads a folder's .codex/config.toml only after you trust the folder - run `codex` there once and accept)");
    }
  }
  if (agent) console.log(`  agent: ${agent}`);
}

module.exports = { use };
