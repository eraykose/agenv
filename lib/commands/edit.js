'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const registries = require('../registries');

// agenv edit <role>[/<skill>]   (role may be qualified: <registry>/<role>/<skill>)
// Opens $EDITOR in a terminal; otherwise (an agent, a pipe) prints the path.
function edit({ spec, print } = {}) {
  if (!spec) throw new Error('Usage: agenv edit <role>[/<skill>]');
  const parts = spec.split('/');
  const regs = registries.all();
  let link;
  let skill;
  if (parts.length === 3) {
    link = registries.findLink(`${parts[0]}/${parts[1]}`, regs);
    skill = parts[2];
  } else {
    try {
      link = registries.findLink(parts.length === 2 ? `${parts[0]}/${parts[1]}` : parts[0], regs);
    } catch (err) {
      if (parts.length !== 2) throw err;
      link = registries.findLink(parts[0], regs);
      skill = parts[1];
    }
  }
  let file = link.path;
  if (skill) {
    file = path.join(link.path, 'skills', skill, 'SKILL.md');
    if (!fs.existsSync(file)) throw new Error(`No skill "${skill}" in ${registries.qualified(link)} (${link.registry.listSkills(link.role).map((s) => s.dir).join(', ') || 'none'}).`);
  }
  const editor = process.env.VISUAL || process.env.EDITOR;
  if (!print && editor && process.stdout.isTTY && process.stdin.isTTY) {
    spawnSync(editor, [file], { stdio: 'inherit', shell: true });
    return;
  }
  console.log(file);
}

module.exports = { edit };
