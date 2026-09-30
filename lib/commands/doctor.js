'use strict';
const path = require('path');
const registries = require('../registries');
const targets = require('../targets');
const claude = require('../targets/claude');
const gemini = require('../targets/gemini');
const codex = require('../targets/codex');
const git = require('../git');
const { KEBAB } = require('../registry');
const { which, q } = require('../tools');
const { capture } = require('../run');
const { build } = require('../build');
const { registriesDir } = require('../home');
const { openTarget } = require('./shared');

// Validates registries (manifests, skills, generated files), runs the tools' own
// validators where present, and checks link health. Exit 1 on errors: the CI gate for a
// registry is `npx agenv doctor .`.
function doctor({ target, json } = {}) {
  const errors = [];
  const warnings = [];
  const say = (s) => !json && console.log(s);
  const ok = (m) => say(`  ok    ${m}`);
  const warn = (m) => {
    warnings.push(m);
    say(`  warn  ${m}`);
  };
  const fail = (m) => {
    errors.push(m);
    say(`  FAIL  ${m}`);
  };

  const machine = !target;
  const regs = machine ? registries.all() : [openTarget(target)];

  for (const reg of regs) {
    say(`== ${reg.name}${reg.builtin ? ' (built-in)' : ''} ==`);
    const roles = reg.roles();
    if (!roles.length) fail(`${reg.name}: no roles (a role is plugins/<role>/plugin.json)`);
    if (!reg.builtin && !git.isRepo(reg.dir)) warn(`${reg.name}: not a git checkout`);
    const { changed, problems } = build(reg, { check: true, quiet: true });
    for (const p of problems) fail(`${reg.name}: ${p}`);
    if (changed.length) fail(`${reg.name}: generated manifests out of date: ${changed.join(', ')} (run \`agenv build ${reg.builtin ? '' : reg.name}\`)`);
    else if (!problems.length) ok(`${reg.name}: generated manifests match plugin.json / mcp.json`);
    for (const role of roles) {
      if (!KEBAB.test(role)) fail(`${reg.name}/${role}: role names must be kebab-case`);
      const skills = reg.listSkills(role);
      if (!skills.length && !reg.readMcp(role)) warn(`${reg.name}/${role}: no skills and no mcp.json - the role is empty`);
      for (const s of skills) {
        const rel = path.relative(reg.dir, s.file);
        if (!s.frontmatter) fail(`${reg.name}: ${rel}: missing frontmatter`);
        else {
          if (!s.frontmatter.name) fail(`${reg.name}: ${rel}: frontmatter has no name`);
          else if (s.frontmatter.name !== s.dir) warn(`${reg.name}: ${rel}: name "${s.frontmatter.name}" differs from folder "${s.dir}"`);
          if (!s.frontmatter.description) fail(`${reg.name}: ${rel}: frontmatter has no description`);
        }
      }
    }
    if (which('claude')) {
      if (capture(`claude plugin validate ${q(reg.dir)} --strict`) === null) fail(`${reg.name}: claude plugin validate --strict (marketplace) failed`);
      else ok(`${reg.name}: claude: marketplace manifest valid`);
      for (const role of roles) {
        if (capture(`claude plugin validate ${q(reg.rolePath(role))} --strict`) === null) fail(`${reg.name}/${role}: claude plugin validate --strict failed`);
        else ok(`${reg.name}/${role}: claude: valid`);
      }
    }
    if (which('gemini')) {
      for (const role of roles) {
        if (capture(`gemini extensions validate ${q(reg.rolePath(role))}`) === null) fail(`${reg.name}/${role}: gemini extensions validate failed`);
        else ok(`${reg.name}/${role}: gemini: valid`);
      }
    }
  }
  if (!which('claude') && !which('gemini')) warn('neither claude nor gemini on PATH - vendor validators skipped');

  if (machine) {
    say('== Links ==');
    const links = registries.allLinks(regs);
    const names = new Map();
    for (const l of links) {
      if (names.has(l.name)) fail(`role name "${l.name}" exists in both ${names.get(l.name)} and ${l.registry.name} (ADR 0008)`);
      names.set(l.name, l.registry.name);
    }
    for (const t of targets.ALL) {
      if (!t.detected()) continue;
      const missing = links.filter((l) => !t.isLinked(l));
      if (missing.length === links.length) warn(`${t.label}: nothing linked (run \`agenv sync\`)`);
      else if (missing.length) warn(`${t.label}: not linked: ${missing.map(registries.qualified).join(', ')} (run \`agenv sync\`)`);
      else ok(`${t.label}: all ${links.length} roles linked`);
    }
    for (const d of claude.danglingUnder(registriesDir())) fail(`Claude Code: dangling link ${d}`);
    for (const l of links) {
      const src = gemini.linkSource(l.name);
      if (src && src !== l.path) warn(`Gemini CLI: ${l.name} is linked from ${src}, not ${l.path}`);
    }
    for (const reg of regs) {
      const src = codex.marketplaceSource(reg.name);
      if (src && src !== reg.dir) warn(`Codex: marketplace "${reg.name}" points at ${src}, not ${reg.dir}`);
    }
  }

  if (json) console.log(JSON.stringify({ errors, warnings }, null, 2));
  else console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
  return errors.length === 0;
}

module.exports = { doctor };
