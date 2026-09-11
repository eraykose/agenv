'use strict';
const git = require('../git');
const { which, q } = require('../tools');
const { run } = require('../run');
const { inferRegistry } = require('./shared');

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

// Branch, commit everything in the clone, push, open a PR. The registry is the one
// named, the one cwd is inside, or the only one configured.
function propose({ message, registry: name, branch: branchFlag, dryRun } = {}) {
  if (!message) throw new Error('Usage: agreg propose -m "<why this change>" [--registry <name>] [--branch <name>]');
  const reg = inferRegistry(name);
  const dir = reg.dir;
  const current = git.branch(dir);
  const base = git.defaultBranch(dir);
  const dirty = git.isDirty(dir);
  if (!dirty && current === base) {
    throw new Error(`${reg.name}: nothing to propose - no uncommitted changes in ${dir}${name ? '' : ' (inferred from the current folder; pass --registry <name> to target a configured clone)'}.`);
  }

  const branchName = current !== base && current !== 'HEAD' ? current : branchFlag || `agreg/${slugify(message) || 'change'}`;
  console.log(`== ${reg.name}: ${dir} ==`);
  if (branchName !== current && !git.checkout(branchName, dir, { newBranch: true, dryRun }).ok) throw new Error(`Could not create branch ${branchName}.`);
  if (dirty && !git.commitAll(message, dir, { dryRun }).ok) throw new Error('Commit failed.');
  if (!git.push(branchName, dir, { dryRun }).ok) throw new Error('Push failed - is the remote reachable and writable?');

  if (which('gh')) {
    const body = `Proposed with \`agreg propose\` from ${reg.name}.\n\nAfter merging, every machine runs \`agreg update\`.`;
    run(`gh pr create --title ${q(message)} --body ${q(body)} --base ${q(base)} --head ${q(branchName)}`, { cwd: dir, dryRun });
  } else {
    const url = (git.remoteUrl(dir) || '').replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
    console.log(url.startsWith('https://github.com/') ? `  open a PR: ${url}/compare/${base}...${branchName}?expand=1` : `  pushed ${branchName}; open a PR on your git host`);
  }
  console.log(`\nAfter it merges: \`agreg update\` on every machine. Meanwhile this clone stays on ${branchName}; \`git checkout ${base}\` in ${dir} to go back.`);
}

module.exports = { propose, slugify };
