'use strict';
const git = require('../git');
const config = require('../config');
const registry = require('../registry');
const registries = require('../registries');
const targets = require('../targets');
const { firstTimeDefaults, printNotes } = require('./shared');

// Which roles/skills a set of changed paths touches: "coding/code-review", "coding (plugin.json)".
function touched(files) {
  const out = new Set();
  for (const f of files) {
    const m = f.match(/^plugins\/([^/]+)\/(?:skills\/([^/]+)\/)?/);
    if (!m) continue;
    out.add(m[2] ? `${m[1]}/${m[2]}` : `${m[1]} (${f.split('/').slice(2).join('/')})`);
  }
  return [...out].sort();
}

// The commit a registry should be on: its pinned ref (tag, branch, or sha) or upstream.
function wanted(reg) {
  const ref = reg.entry.ref;
  if (!ref) return git.rev('@{u}', reg.dir);
  return git.rev(`origin/${ref}`, reg.dir) || git.rev(ref, reg.dir);
}

function update({ names = [], check, dryRun, json } = {}) {
  const regs = names.length ? names.map((n) => registries.find(n)) : registries.openConfigured();
  if (!regs.length) {
    console.log('No registries configured - `agenv add <owner/repo>` first.');
    return true;
  }
  const results = [];
  const notes = [];
  let healthy = true;
  for (const reg of regs) {
    if (reg.builtin) continue;
    const res = { registry: reg.name, status: 'up-to-date' };
    results.push(res);
    if (!json) console.log(`== ${reg.name} ==`);
    if (git.isDirty(reg.dir)) {
      res.status = 'dirty';
      healthy = false;
      if (!json) console.log(`  has uncommitted changes - \`agenv propose\` them (or clean up) before updating`);
      continue;
    }
    if (!git.fetch(reg.dir, { quiet: json }).ok) {
      res.status = 'fetch-failed';
      healthy = false;
      continue;
    }
    const from = git.head(reg.dir);
    const to = wanted(reg);
    if (!to) {
      res.status = 'no-upstream';
      if (!json) console.log('  no upstream to compare with');
      continue;
    }
    if (to === from) {
      if (!json) console.log('  up to date');
      continue;
    }
    const commits = git.log(from, to, reg.dir);
    const changes = touched(git.changedFiles(from, to, reg.dir));
    Object.assign(res, { status: 'behind', from, to, commits: commits.split('\n').filter(Boolean), changes });
    if (!json) {
      console.log(`  ${from.slice(0, 7)} -> ${to.slice(0, 7)}`);
      for (const line of res.commits) console.log(`    ${line}`);
      if (changes.length) console.log(`  touches: ${changes.join(', ')}`);
    }
    if (check || dryRun) continue;

    const rolesBefore = reg.roles();
    const ok = reg.entry.ref ? git.checkout(to, reg.dir, { detach: true }).ok : git.fastForward(reg.dir).ok;
    if (!ok) {
      res.status = 'failed';
      healthy = false;
      continue;
    }
    res.status = 'updated';
    config.update((cfg) => {
      cfg.registries[reg.name].commit = git.head(reg.dir);
    });
    const fresh = registry.open(reg.dir);
    const rolesAfter = fresh.roles();
    const newLinks = fresh.links().filter((l) => !rolesBefore.includes(l.role));
    const goneLinks = rolesBefore.filter((r) => !rolesAfter.includes(r)).map((role) => ({ registry: fresh, role, name: role, path: fresh.rolePath(role) }));
    const links = registries.allLinks();
    for (const t of targets.installedTargets(links)) {
      if (!json) console.log(`  -- ${t.label}`);
      if (goneLinks.length) t.unlink(goneLinks, { dryRun });
      firstTimeDefaults(t, t.link(newLinks, { dryRun }), links, { dryRun });
      const r = t.refresh(fresh.links(), { dryRun });
      notes.push(...r.notes);
    }
  }
  if (json) console.log(JSON.stringify(results, null, 2));
  else {
    printNotes(notes);
    if (results.some((r) => r.status === 'updated')) console.log('  - Cowork/claude.ai: click Update on the marketplace to pull the same commits.');
  }
  return healthy;
}

module.exports = { update, touched };
