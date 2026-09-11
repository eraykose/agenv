'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeSandbox } = require('./helpers');

test('init scaffolds a registry that build --check and doctor accept', (t) => {
  const sb = makeSandbox();
  t.after(sb.cleanup);
  const dir = path.join(sb.base, 'reg');
  const out = sb.run(['init', dir, '--name', 'acme-agents', '--owner', 'Acme']);
  assert.match(out, /Created registry "acme-agents"/);
  for (const f of ['agreg.json', 'plugins/example/plugin.json', 'plugins/example/.claude-plugin/plugin.json', 'plugins/example/gemini-extension.json', '.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json', '.github/workflows/ci.yml']) {
    assert.ok(fs.existsSync(path.join(dir, f)), f);
  }
  const claudeMp = sb.readJson(path.join(dir, '.claude-plugin', 'marketplace.json'));
  assert.equal(claudeMp.name, 'acme-agents');
  assert.equal(claudeMp.owner.name, 'Acme');
  const codexMp = sb.readJson(path.join(dir, '.agents', 'plugins', 'marketplace.json'));
  assert.deepEqual(codexMp.plugins[0].source, { source: 'local', path: './plugins/example' });
  assert.equal(sb.readJson(path.join(dir, 'plugins/example/.claude-plugin/plugin.json')).defaultEnabled, false);
  assert.match(sb.run(['build', dir, '--check']), /in sync/);
  assert.match(sb.run(['doctor', dir]), /0 error\(s\)/);
  assert.equal(sb.git('symbolic-ref --short HEAD', dir), 'main');
  assert.throws(() => sb.run(['init', dir]), /already has agreg.json/);
  assert.throws(() => sb.run(['init', path.join(sb.base, 'Bad Name')]), /kebab-case/);
});

test('new role / new skill inside a registry path, build detects drift, doctor catches broken skills', (t) => {
  const sb = makeSandbox();
  t.after(sb.cleanup);
  const dir = path.join(sb.base, 'reg');
  sb.run(['init', dir, '--name', 'reg']);
  sb.run(['new', 'role', 'coding', '-d', 'Coding role'], { cwd: dir });
  assert.throws(() => sb.run(['new', 'role', 'coding'], { cwd: dir }), /already has a role/);
  sb.run(['new', 'skill', 'coding/review'], { cwd: dir });
  assert.match(fs.readFileSync(path.join(dir, 'plugins/coding/skills/review/SKILL.md'), 'utf8'), /^---\nname: review\n/);
  assert.throws(() => sb.run(['new', 'skill', 'coding/review'], { cwd: dir }), /already has a skill/);
  assert.throws(() => sb.run(['new', 'skill', 'nope/x'], { cwd: dir }), /Unknown role "nope"/);

  const src = path.join(dir, 'plugins/coding/plugin.json');
  const m = sb.readJson(src);
  m.description = 'changed';
  fs.writeFileSync(src, JSON.stringify(m, null, 2) + '\n');
  assert.throws(() => sb.run(['build', dir, '--check']), /out of date\s+plugins\/coding/);
  assert.throws(() => sb.run(['doctor', dir]), /generated manifests out of date/);
  sb.run(['build', dir]);
  assert.equal(sb.readJson(path.join(dir, 'plugins/coding/gemini-extension.json')).description, 'changed');

  fs.writeFileSync(path.join(dir, 'plugins/coding/skills/review/SKILL.md'), 'no frontmatter\n');
  assert.throws(() => sb.run(['doctor', dir]), /missing frontmatter/);
});

test('mcp.json is referenced by path for Claude and inlined for Gemini', (t) => {
  const sb = makeSandbox();
  t.after(sb.cleanup);
  const dir = path.join(sb.base, 'reg');
  sb.run(['init', dir, '--name', 'reg']);
  const servers = { mcpServers: { figma: { command: 'npx', args: ['-y', 'figma-mcp'] } } };
  fs.writeFileSync(path.join(dir, 'plugins/example/mcp.json'), JSON.stringify(servers, null, 2) + '\n');
  sb.run(['build', dir]);
  assert.equal(sb.readJson(path.join(dir, 'plugins/example/.claude-plugin/plugin.json')).mcpServers, './mcp.json');
  assert.deepEqual(sb.readJson(path.join(dir, 'plugins/example/gemini-extension.json')).mcpServers, servers.mcpServers);
});
