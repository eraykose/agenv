'use strict';
const path = require('path');
const registries = require('../registries');
const targets = require('../targets');
const claude = require('../targets/claude');

const mark = (v) => (v === true ? 'on ' : v === false ? 'off' : ' - ');

// What is linked where, and which roles are active in a folder.
function status({ dir, cost, json } = {}) {
  const here = path.resolve(dir || process.cwd());
  const regs = registries.all();
  const links = registries.allLinks(regs);
  const linked = targets.installedTargets(links);
  const multi = new Set(links.filter((l) => !l.registry.builtin).map((l) => l.registry.name)).size > 1;

  const rows = links.map((l) => {
    const per = {};
    for (const t of linked) per[t.id] = t.enabledState(l, here);
    return {
      registry: l.registry.name,
      role: l.role,
      builtin: l.registry.builtin,
      skills: l.registry.listSkills(l.role).map((s) => s.dir),
      tools: per,
      active: linked.some((t) => per[t.id].effective),
      alwaysOnTokens: cost && claude.isLinked(l) ? claude.alwaysOnTokens(l) : undefined,
    };
  });
  const tools = targets.ALL.map((t) => ({ id: t.id, label: t.label, detected: t.detected(), linked: t.linkedLinks(links).length, total: links.length }));
  if (json) return console.log(JSON.stringify({ folder: here, tools, roles: rows, active: rows.filter((r) => r.active && !r.builtin).map((r) => `${r.registry}/${r.role}`) }, null, 2));

  console.log(`Folder: ${here}\n`);
  console.log('Tools:');
  for (const t of tools) {
    const state = !t.detected ? 'not detected' : t.linked ? `linked (${t.linked}/${t.total} roles)` : 'detected, not linked - run `agenv sync`';
    console.log(`  ${t.label.padEnd(12)} ${state}`);
  }
  console.log(`\nRoles${linked.length ? '  (per tool: machine-wide / this folder / effective)' : ''}:`);
  for (const r of rows) {
    const name = (multi || r.builtin ? `${r.registry}/${r.role}` : r.role).padEnd(multi ? 24 : 14);
    let line = `  ${name}`;
    for (const t of linked) line += ` ${t.id}: ${mark(r.tools[t.id].user)}/${mark(r.tools[t.id].project)}/${r.tools[t.id].effective ? 'ON ' : 'off'} `;
    if (r.alwaysOnTokens) line += ` ~${r.alwaysOnTokens} tok always-on`;
    console.log(line);
    console.log(`  ${''.padEnd(multi ? 24 : 14)} skills: ${r.skills.join(', ') || '(none)'}`);
  }
  if (linked.length) console.log(`\nActive here: ${rows.filter((r) => r.active && !r.builtin).map((r) => (multi ? `${r.registry}/${r.role}` : r.role)).join(', ') || '(none)'}`);
  if (registries.entries().length === 0) console.log('\nNo registries yet - `agenv add <owner/repo>`.');
}

module.exports = { status };
