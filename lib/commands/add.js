'use strict';
const fs = require('fs');
const path = require('path');
const git = require('../git');
const config = require('../config');
const registry = require('../registry');
const registries = require('../registries');
const targets = require('../targets');
const { registriesDir } = require('../home');
const { firstTimeDefaults, describe } = require('./shared');

// owner/repo -> GitHub HTTPS; an existing local path -> absolute; anything else is a git URL.
function normalizeSource(source) {
  if (!source) throw new Error('Usage: agenv add <owner/repo | git URL | path>');
  if (fs.existsSync(source)) return path.resolve(source);
  if (/^[\w.-]+\/[\w.-]+$/.test(source)) return `https://github.com/${source}.git`;
  return source;
}

async function add({ source, ref, only, dryRun } = {}) {
  const url = normalizeSource(source);
  const detected = targets.detectedTargets();
  const selected = only ? targets.pickTargets(only, detected, 'detected') : detected; // validate before any network
  fs.mkdirSync(registriesDir(), { recursive: true });
  const tmp = path.join(registriesDir(), `.tmp-${process.pid}-${Date.now()}`);
  if (dryRun) {
    console.log(`  [dry-run] would clone ${url}${ref ? ` at ${ref}` : ''} under ${registriesDir()} and link it`);
    return;
  }

  console.log(`== Cloning ${url} ==`);
  if (!git.clone(url, tmp).ok) throw new Error(`Could not clone ${url}. Private repo? Make sure git can reach it (ssh-agent, gh auth, credential helper).`);
  try {
    if (ref && !git.checkout(ref, tmp).ok) throw new Error(`Ref "${ref}" not found in ${url}.`);
    const probe = registry.open(tmp);
    const existing = registries.all();
    if (existing.some((r) => r.name === probe.name)) throw new Error(`A registry named "${probe.name}" is already configured (\`agenv list\`).`);
    const taken = new Set(registries.allLinks(existing).map((l) => l.name));
    const clashes = probe.roles().filter((r) => taken.has(r));
    if (clashes.length) throw new Error(`Role name(s) already used by another registry: ${clashes.join(', ')}. Role names must be unique across registries (ADR 0008) - rename them in one registry.`);
    const dest = path.join(registriesDir(), probe.name);
    fs.renameSync(tmp, dest);
    config.update((cfg) => {
      cfg.registries[probe.name] = { url, ref: ref || null, commit: git.head(dest), addedAt: new Date().toISOString() };
    });
    const reg = registry.open(dest);
    console.log(`  ${reg.name} -> ${dest}  (${git.head(dest).slice(0, 7)})`);
    console.log('\nRoles it brings (read before trusting - skills steer the agent, hooks run scripts):');
    console.log(describe(reg));

    const links = registries.allLinks();
    if (!selected.length) console.log('\nNo supported agent CLI (claude, codex, gemini) found - registry added but not linked.');
    for (const t of selected) {
      console.log(`\n== ${t.label} ==`);
      const fresh = t.link(links, { dryRun });
      firstTimeDefaults(t, fresh, links, { dryRun });
    }
    console.log('\nNext: `agenv use` in a project folder to switch roles on there; `agenv status` to see the state.');
  } catch (err) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw err;
  }
}

module.exports = { add, normalizeSource };
