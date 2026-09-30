'use strict';
const registries = require('../registries');

function list({ json } = {}) {
  const regs = registries.all();
  const data = regs.map((r) => ({
    name: r.name,
    builtin: r.builtin,
    dir: r.dir,
    url: r.entry ? r.entry.url : null,
    ref: r.entry ? r.entry.ref : null,
    commit: r.entry ? r.entry.commit : null,
    roles: r.roles().map((role) => ({ name: role, skills: r.listSkills(role).map((s) => s.dir), mcp: Boolean(r.readMcp(role)), hooks: r.hasHooks(role), agents: r.agentNames(role) })),
  }));
  if (json) return console.log(JSON.stringify(data, null, 2));
  for (const r of data) {
    const where = r.builtin ? 'built-in' : `${r.url}${r.ref ? ` @ ${r.ref}` : ''}  (${(r.commit || '').slice(0, 7)})`;
    console.log(`${r.name}  ${where}`);
    for (const role of r.roles) {
      const extras = [role.mcp ? 'mcp' : null, role.hooks ? 'hooks' : null, role.agents.length ? 'agent' : null].filter(Boolean);
      console.log(`  ${role.name.padEnd(14)} ${role.skills.join(', ') || '(no skills)'}${extras.length ? `  [${extras.join(', ')}]` : ''}`);
    }
  }
  if (data.length === 1) console.log('\nNo registries yet - `agenv add <owner/repo>`.');
}

module.exports = { list };
