'use strict';
const fs = require('fs');
const path = require('path');
const registries = require('../registries');
const { KEBAB } = require('../registry');
const { build } = require('../build');
const { inferRegistry } = require('./shared');

const SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';

const skillTemplate = (name, description) => `---
name: ${name}
description: ${description}
---

# ${name}

<!-- What the agent should do when this skill applies. The description above is the only
     part that sits in every prompt; the body loads on invocation. -->
`;

// agenv new role <name> [--registry r] [-d text]
// agenv new skill <role>/<name> [--registry r] [-d text]
function create({ kind, target, description, registry: name } = {}) {
  if (kind === 'role') {
    if (!target || !KEBAB.test(target)) throw new Error('Usage: agenv new role <kebab-case-name> [--registry <name>]');
    const reg = inferRegistry(name);
    if (reg.hasRole(target)) throw new Error(`${reg.name} already has a role "${target}".`);
    const taken = reg.entry ? registries.allLinks().find((l) => l.name === target) : null;
    if (taken) throw new Error(`Role name "${target}" is already used by ${taken.registry.name} (ADR 0008).`);
    const dir = reg.rolePath(target);
    fs.mkdirSync(path.join(dir, 'skills', `${target}-guide`), { recursive: true });
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ $schema: SCHEMA, name: target, version: '0.1.0', description: description || `${target} role` }, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, 'skills', `${target}-guide`, 'SKILL.md'), skillTemplate(`${target}-guide`, `Use this when working as the ${target} role. Replace with real trigger phrasing.`));
    console.log(`Created plugins/${target}/ in ${reg.name} with skills/${target}-guide/SKILL.md`);
    build(reg);
    console.log('\nNext: edit the skill, `agenv doctor`, `agenv propose -m "..."`. Linked machines see the role after `agenv update` (off until `agenv use`).');
    return;
  }
  if (kind === 'skill') {
    const m = target && target.match(/^(?:([a-z0-9-]+)\/)?([a-z0-9-]+)\/([a-z0-9-]+)$/);
    if (!m || !KEBAB.test(m[3])) throw new Error('Usage: agenv new skill <role>/<kebab-case-name> [--registry <name>]');
    const [, regName, role, skill] = m;
    const reg = inferRegistry(name || regName);
    reg.assertRole(role);
    const dir = path.join(reg.rolePath(role), 'skills', skill);
    if (fs.existsSync(dir)) throw new Error(`${reg.name}/${role} already has a skill "${skill}".`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), skillTemplate(skill, description || 'Use this when ... Trigger on "...".'));
    console.log(`Created ${path.relative(process.cwd(), path.join(dir, 'SKILL.md'))}`);
    console.log('Claude Code and Gemini read it in place (Gemini after a restart); Codex after `agenv sync`.');
    return;
  }
  throw new Error('Usage: agenv new role <name> | agenv new skill <role>/<name>');
}

module.exports = { create };
