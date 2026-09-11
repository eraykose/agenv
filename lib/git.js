'use strict';
const { run, capture } = require('./run');
const { q } = require('./tools');

// Thin wrappers over the git binary. Queries are silent; mutations echo and honour --dry-run.

function query(args, dir) {
  const out = capture(`git ${args}`, { cwd: dir });
  return out === null ? null : out.trim();
}

function isRepo(dir) {
  return query('rev-parse --is-inside-work-tree', dir) === 'true';
}

function head(dir) {
  return query('rev-parse HEAD', dir);
}

function branch(dir) {
  return query('rev-parse --abbrev-ref HEAD', dir);
}

function isDetached(dir) {
  return branch(dir) === 'HEAD';
}

function isDirty(dir) {
  return (query('status --porcelain', dir) || '') !== '';
}

function remoteUrl(dir) {
  return query('remote get-url origin', dir);
}

function upstream(dir) {
  return query('rev-parse --abbrev-ref --symbolic-full-name @{u}', dir);
}

function rev(ref, dir) {
  return query(`rev-parse --verify ${q(ref)}^{commit}`, dir);
}

function defaultBranch(dir) {
  const r = query('symbolic-ref refs/remotes/origin/HEAD', dir);
  return r ? r.replace('refs/remotes/origin/', '') : 'main';
}

function log(from, to, dir) {
  return query(`log --oneline ${q(`${from}..${to}`)}`, dir) || '';
}

function changedFiles(from, to, dir) {
  const out = query(`diff --name-only ${q(from)} ${q(to)}`, dir) || '';
  return out ? out.split('\n') : [];
}

function clone(url, dir, { dryRun } = {}) {
  return run(`git clone --quiet ${q(url)} ${q(dir)}`, { dryRun });
}

function fetch(dir, { dryRun, quiet } = {}) {
  return run('git fetch --quiet --tags origin', { cwd: dir, dryRun, quiet });
}

function fastForward(dir, { dryRun } = {}) {
  return run('git merge --ff-only --quiet @{u}', { cwd: dir, dryRun });
}

function checkout(ref, dir, { dryRun, newBranch } = {}) {
  return run(`git checkout --quiet ${newBranch ? '-b ' : ''}${q(ref)}`, { cwd: dir, dryRun });
}

function commitAll(message, dir, { dryRun } = {}) {
  const added = run('git add -A', { cwd: dir, dryRun });
  if (!added.ok) return added;
  return run(`git commit --quiet -m ${q(message)}`, { cwd: dir, dryRun });
}

function push(branchName, dir, { dryRun } = {}) {
  return run(`git push --quiet -u origin ${q(branchName)}`, { cwd: dir, dryRun });
}

module.exports = {
  isRepo,
  head,
  branch,
  isDetached,
  isDirty,
  remoteUrl,
  upstream,
  rev,
  defaultBranch,
  log,
  changedFiles,
  clone,
  fetch,
  fastForward,
  checkout,
  commitAll,
  push,
};
