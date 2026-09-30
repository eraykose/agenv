'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeSandbox } = require('./helpers');

test('add clones, links every role plus the built-in one, and switches roles off by default', (t) => {
  const sb = makeSandbox();
  t.after(sb.cleanup);
  const { bare } = sb.makeRegistry('team', ['coding', 'design']);
  const out = sb.run(['add', bare]);
  assert.match(out, /team -> /);
  assert.match(out, /coding\s+skills: coding-guide/);

  const cfg = sb.readJson(path.join(sb.agenvHome, 'config.json'));
  assert.equal(cfg.registries.team.url, bare);
  assert.equal(cfg.registries.team.commit, sb.git('rev-parse HEAD', path.join(sb.agenvHome, 'registries', 'team')));

  // Claude: symlinks for roles and the built-in role, manifests carry the defaults.
  for (const [name, target] of [['coding', 'registries/team/plugins/coding'], ['design', 'registries/team/plugins/design'], ['agenv', 'meta/plugins/agenv']]) {
    assert.equal(fs.readlinkSync(path.join(sb.home, '.claude', 'skills', name)), path.join(sb.agenvHome, target));
  }
  assert.equal(sb.readJson(path.join(sb.agenvHome, 'meta/plugins/agenv/.claude-plugin/plugin.json')).defaultEnabled, undefined, 'built-in role stays on');
  assert.equal(sb.readJson(path.join(sb.agenvHome, 'registries/team/plugins/coding/.claude-plugin/plugin.json')).defaultEnabled, false);

  // Codex: one marketplace per registry (name from the catalogue), roles added, non-builtin off.
  const codexCfg = fs.readFileSync(path.join(sb.home, '.codex', 'config.toml'), 'utf8');
  assert.match(codexCfg, /^model = "gpt-5"/);
  assert.match(codexCfg, /\[marketplaces\.team\]/);
  assert.match(codexCfg, /\[marketplaces\.agenv\]/);
  assert.match(codexCfg, /\[plugins\."coding@team"\]\nenabled = false/);
  assert.match(codexCfg, /\[plugins\."agenv@agenv"\]\nenabled = true/);

  // Gemini: linked, user-scope off for roles, on for the built-in.
  const calls = sb.calls();
  assert.ok(calls.includes(`gemini extensions link ${path.join(sb.agenvHome, 'registries/team/plugins/coding')} --consent`));
  assert.ok(calls.includes('gemini extensions disable --scope user coding'));
  assert.ok(calls.includes('gemini extensions enable --scope user agenv'));

  const list = JSON.parse(sb.run(['list', '--json']));
  assert.deepEqual(list.map((r) => r.name), ['agenv', 'team']);
  assert.deepEqual(list[1].roles.map((r) => r.name), ['coding', 'design']);
});

test('add refuses a duplicate registry name or a colliding role name, leaving nothing behind', (t) => {
  const sb = makeSandbox();
  t.after(sb.cleanup);
  const a = sb.makeRegistry('alpha', ['coding']);
  sb.run(['add', a.bare]);
  assert.throws(() => sb.run(['add', a.bare]), /already configured/);
  const b = sb.makeRegistry('beta', ['coding']);
  assert.throws(() => sb.run(['add', b.bare]), /Role name\(s\) already used by another registry: coding/);
  assert.deepEqual(Object.keys(sb.readJson(path.join(sb.agenvHome, 'config.json')).registries), ['alpha']);
  assert.deepEqual(fs.readdirSync(path.join(sb.agenvHome, 'registries')), ['alpha'], 'no temp clone left');
  const c = sb.makeRegistry('gamma', ['agenv']);
  assert.throws(() => sb.run(['add', c.bare]), /already used by another registry: agenv/);
  assert.throws(() => sb.run(['add', path.join(sb.base, 'nowhere.git')]), /Could not clone/);
});

test('use writes explicit on/off for every tool at folder scope, then --global at user scope', (t) => {
  const sb = makeSandbox();
  t.after(sb.cleanup);
  sb.run(['add', sb.makeRegistry('team', ['coding', 'design', 'marketing']).bare]);
  const proj = path.join(sb.base, 'proj');
  fs.mkdirSync(proj);
  const out = sb.run(['use', '--roles', 'coding', '--dir', proj]);
  assert.match(out, /on:\s+coding\n/);
  assert.match(out, /off:\s+design, marketing/);
  const claude = sb.readJson(path.join(proj, '.claude', 'settings.local.json'));
  assert.deepEqual(claude.enabledPlugins, { 'agenv@skills-dir': true, 'coding@skills-dir': true, 'design@skills-dir': false, 'marketing@skills-dir': false });
  const codex = fs.readFileSync(path.join(proj, '.codex', 'config.toml'), 'utf8');
  assert.match(codex, /\[plugins\."coding@team"\]\nenabled = true/);
  assert.match(codex, /\[plugins\."design@team"\]\nenabled = false/);
  assert.match(codex, /\[plugins\."agenv@agenv"\]\nenabled = true/);
  assert.match(out, /Codex reads a folder's/);
  assert.ok(sb.calls().includes('gemini extensions enable --scope workspace coding'));
  assert.ok(sb.calls().includes('gemini extensions disable --scope workspace design'));

  sb.run(['use', '--roles', 'team/design', '--dir', proj]);
  const claude2 = sb.readJson(path.join(proj, '.claude', 'settings.local.json'));
  assert.equal(claude2.enabledPlugins['coding@skills-dir'], false);
  assert.equal(claude2.enabledPlugins['design@skills-dir'], true);
  assert.equal((fs.readFileSync(path.join(proj, '.codex', 'config.toml'), 'utf8').match(/coding@team/g) || []).length, 1);

  sb.run(['use', '--roles', 'marketing', '--global']);
  const user = sb.readJson(path.join(sb.home, '.claude', 'settings.json'));
  assert.equal(user.enabledPlugins['marketing@skills-dir'], true);
  assert.equal(user.enabledPlugins['coding@skills-dir'], false);
  assert.match(fs.readFileSync(path.join(sb.home, '.codex', 'config.toml'), 'utf8'), /\[plugins\."marketing@team"\]\nenabled = true/);
  assert.throws(() => sb.run(['use', '--roles', 'agenv', '--dir', proj]), /always on/);
  assert.throws(() => sb.run(['use', '--roles', 'nope', '--dir', proj]), /Unknown role "nope"/);

  const status = JSON.parse(sb.run(['status', '--dir', proj, '--json', '--cost']));
  assert.deepEqual(status.active, ['team/design']);
  assert.equal(status.roles.find((r) => r.role === 'design').alwaysOnTokens, '123');
  const text = sb.run(['status', '--dir', proj]);
  assert.match(text, /Active here: design/);
});

test('use sets the agent persona for a single role that defines one, and the prompt fallback works', (t) => {
  const sb = makeSandbox();
  t.after(sb.cleanup);
  const { work, bare } = sb.makeRegistry('team', ['coding', 'design']);
  fs.mkdirSync(path.join(work, 'plugins/coding/agents'));
  fs.writeFileSync(path.join(work, 'plugins/coding/agents/engineer.md'), '---\nname: engineer\ndescription: x\n---\n');
  sb.git('add -A', work);
  sb.git('commit -q -m agent', work);
  sb.git('push -q', work);
  sb.run(['add', bare]);
  const proj = path.join(sb.base, 'proj');
  fs.mkdirSync(proj);
  sb.run(['use', '--roles', 'coding', '--dir', proj]);
  assert.equal(sb.readJson(path.join(proj, '.claude', 'settings.local.json')).agent, 'coding:engineer');
  sb.run(['use', '--roles', 'coding,design', '--dir', proj]);
  assert.equal(sb.readJson(path.join(proj, '.claude', 'settings.local.json')).agent, undefined);
  const out = sb.run(['use', '--dir', proj], { input: '2\n' });
  assert.match(out, /\[1\] coding/);
  assert.equal(sb.readJson(path.join(proj, '.claude', 'settings.local.json')).enabledPlugins['design@skills-dir'], true);
  assert.equal(sb.readJson(path.join(proj, '.claude', 'settings.local.json')).enabledPlugins['coding@skills-dir'], false);
});

test('update shows what changed, fast-forwards, links new roles off, and refuses a dirty clone', (t) => {
  const sb = makeSandbox();
  t.after(sb.cleanup);
  const { work, bare } = sb.makeRegistry('team', ['coding']);
  sb.run(['add', bare]);
  assert.match(sb.run(['update']), /up to date/);

  fs.writeFileSync(path.join(work, 'plugins/coding/skills/coding-guide/SKILL.md'), '---\nname: coding-guide\ndescription: tightened\n---\nBe strict.\n');
  sb.run(['new', 'role', 'design'], { cwd: work });
  sb.git('add -A', work);
  sb.git('commit -q -m "Tighten coding, add design"', work);
  sb.git('push -q', work);

  const check = JSON.parse(sb.run(['update', '--check', '--json']));
  assert.equal(check[0].status, 'behind');
  assert.deepEqual(check[0].changes.filter((c) => c.startsWith('coding')), ['coding/coding-guide']);
  assert.ok(check[0].changes.some((c) => c.startsWith('design')));
  assert.equal(check[0].commits.length, 1);

  const out = sb.run(['update']);
  assert.match(out, /Tighten coding, add design/);
  assert.match(out, /design off until `agenv use`/);
  const clone = path.join(sb.agenvHome, 'registries', 'team');
  assert.equal(sb.git('rev-parse HEAD', clone), sb.git('rev-parse HEAD', work));
  assert.equal(sb.readJson(path.join(sb.agenvHome, 'config.json')).registries.team.commit, sb.git('rev-parse HEAD', work));
  assert.equal(fs.readlinkSync(path.join(sb.home, '.claude', 'skills', 'design')), path.join(clone, 'plugins', 'design'));
  const codexCfg = fs.readFileSync(path.join(sb.home, '.codex', 'config.toml'), 'utf8');
  assert.match(codexCfg, /\[plugins\."design@team"\]\nenabled = false/);
  assert.match(codexCfg, /\[plugins\."coding@team"\]\nenabled = false/, 'refresh restores the off flag');
  assert.equal(sb.calls().filter((c) => c === 'codex plugin add coding@team').length, 2, 'add + refresh');
  assert.match(out, /Cowork/);

  fs.writeFileSync(path.join(clone, 'plugins/coding/skills/coding-guide/SKILL.md'), '---\nname: coding-guide\ndescription: local edit\n---\n');
  assert.throws(() => sb.run(['update']), /uncommitted changes/);
});

test('edit resolves paths, propose branches + pushes + opens a PR, remove refuses a dirty clone', (t) => {
  const sb = makeSandbox();
  t.after(sb.cleanup);
  const { bare } = sb.makeRegistry('team', ['coding']);
  sb.run(['add', bare]);
  const clone = path.join(sb.agenvHome, 'registries', 'team');
  assert.equal(sb.run(['edit', 'coding', '--print']).trim(), path.join(clone, 'plugins', 'coding'));
  const skill = sb.run(['edit', 'coding/coding-guide']).trim();
  assert.equal(skill, path.join(clone, 'plugins', 'coding', 'skills', 'coding-guide', 'SKILL.md'));
  assert.equal(sb.run(['edit', 'team/coding/coding-guide']).trim(), skill);
  assert.throws(() => sb.run(['edit', 'coding/nope']), /No skill "nope"/);
  assert.equal(sb.run(['path']).trim(), clone);
  assert.equal(sb.run(['path', 'team']).trim(), clone);

  assert.throws(() => sb.run(['propose', '-m', 'Nothing']), /nothing to propose/);
  fs.writeFileSync(skill, '---\nname: coding-guide\ndescription: Proposed change\n---\nBody.\n');
  assert.throws(() => sb.run(['remove', 'team']), /uncommitted changes/);
  const out = sb.run(['propose', '-m', 'Tighten the coding guide']);
  assert.match(out, /After it merges/);
  assert.equal(sb.git('rev-parse --abbrev-ref HEAD', clone), 'agenv/tighten-the-coding-guide');
  assert.ok(sb.git('branch --list', bare).includes('agenv/tighten-the-coding-guide'), 'branch pushed to the remote');
  assert.ok(sb.calls().some((c) => c.startsWith('gh pr create --title Tighten the coding guide')));
  assert.equal(sb.git('status --porcelain', clone), '');

  sb.run(['remove', 'team', '--purge']);
  assert.ok(!fs.existsSync(clone));
  assert.ok(!fs.existsSync(path.join(sb.home, '.claude', 'skills', 'coding')));
  assert.ok(fs.existsSync(path.join(sb.home, '.claude', 'skills', 'agenv')), 'built-in link stays');
  assert.deepEqual(sb.readJson(path.join(sb.agenvHome, 'config.json')).registries, {});
  const codexCfg = fs.readFileSync(path.join(sb.home, '.codex', 'config.toml'), 'utf8');
  assert.ok(!codexCfg.includes('marketplaces.team'));
  assert.ok(!codexCfg.includes('coding@team'));
  assert.ok(sb.calls().includes('gemini extensions uninstall coding'));
});

test('sync repairs missing links; doctor reports machine health; path/list explain an empty setup', (t) => {
  const sb = makeSandbox();
  t.after(sb.cleanup);
  assert.match(sb.run(['list']), /No registries yet/);
  assert.throws(() => sb.run(['path']), /No registries configured/);
  assert.throws(() => sb.run(['use', '--roles', 'x']), /Nothing is linked yet|No roles/);
  sb.run(['add', sb.makeRegistry('team', ['coding']).bare]);
  assert.match(sb.run(['doctor']), /0 error\(s\)/);
  fs.unlinkSync(path.join(sb.home, '.claude', 'skills', 'coding'));
  assert.match(sb.run(['doctor']), /warn\s+Claude Code: not linked: team\/coding/);
  sb.run(['sync']);
  assert.ok(fs.existsSync(path.join(sb.home, '.claude', 'skills', 'coding')));
  assert.match(sb.run(['doctor']), /0 error\(s\)/);
  const d = JSON.parse(sb.run(['doctor', '--json']));
  assert.deepEqual(d.errors, []);
  assert.throws(() => sb.run(['bogus']), /Unknown command: bogus/);
  assert.throws(() => sb.run(['add', 'x', '--only', 'cursor']), /Unknown tool/);
});

test('uninstall unlinks everything including the built-in role and deletes the home', (t) => {
  const sb = makeSandbox();
  t.after(sb.cleanup);
  sb.run(['add', sb.makeRegistry('team', ['coding']).bare]);
  sb.run(['use', '--roles', 'coding', '--global']);
  const clone = path.join(sb.agenvHome, 'registries', 'team');
  fs.writeFileSync(path.join(clone, 'plugins/coding/skills/coding-guide/SKILL.md'), '---\nname: coding-guide\ndescription: local\n---\n');
  assert.throws(() => sb.run(['uninstall']), /Uncommitted changes/);
  sb.run(['uninstall', '--force']);
  assert.ok(!fs.existsSync(sb.agenvHome));
  assert.deepEqual(fs.readdirSync(path.join(sb.home, '.claude', 'skills')), []);
  const codexCfg = fs.readFileSync(path.join(sb.home, '.codex', 'config.toml'), 'utf8');
  assert.equal(codexCfg.trim(), 'model = "gpt-5"', 'Codex config back to what it was');
  assert.deepEqual(sb.readJson(path.join(sb.home, '.claude', 'settings.json')).enabledPlugins, {});
  assert.ok(sb.calls().includes('gemini extensions uninstall agenv'));
  assert.ok(sb.calls().includes('codex plugin marketplace remove agenv'));
});

test('propose from inside an unconfigured source checkout targets that checkout and says so', (t) => {
  const sb = makeSandbox();
  t.after(sb.cleanup);
  const { work, bare } = sb.makeRegistry('team', ['coding']);
  sb.run(['add', bare]);
  assert.throws(() => sb.run(['propose', '-m', 'x'], { cwd: work }), /inferred from the current folder/);
  assert.throws(() => sb.run(['propose', '-m', 'x', '--registry', 'team'], { cwd: work }), /nothing to propose - no uncommitted changes in .*registries\/team\./);
});
