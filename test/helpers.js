'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'agreg.js');

// One Node script stands in for claude, codex, gemini, and gh. It logs its argv and
// reproduces the on-disk side effects observed in the real tools (docs/targets.md).
const SHIM = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const [tool, home, log] = [process.env.SHIM_TOOL, process.env.SHIM_HOME, process.env.SHIM_LOG];
const args = process.argv.slice(2);
fs.appendFileSync(log, tool + (args.length ? ' ' + args.join(' ') : '') + '\\n');
const cmd = args.join(' ');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\\n'); };
const esc = (s) => s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
if (tool === 'codex') {
  const cfg = path.join(home, '.codex', 'config.toml');
  const read = () => (fs.existsSync(cfg) ? fs.readFileSync(cfg, 'utf8') : '');
  if (cmd.startsWith('plugin marketplace add ')) {
    const name = readJson(path.join(args[3], '.agents', 'plugins', 'marketplace.json')).name;
    fs.writeFileSync(cfg, read() + '\\n[marketplaces.' + name + ']\\nsource_type = "local"\\nsource = "' + args[3] + '"\\n');
    console.log(JSON.stringify({ marketplaceName: name }));
  }
  if (cmd.startsWith('plugin marketplace remove ')) fs.writeFileSync(cfg, read().replace(new RegExp('\\\\n\\\\[marketplaces\\\\.' + esc(args[3]) + '\\\\][^[]*'), '\\n'));
  if (cmd.startsWith('plugin add ')) {
    const id = args[2];
    let text = read();
    if (text.includes('[plugins."' + id + '"]')) text = text.replace(new RegExp('(\\\\[plugins\\\\."' + esc(id) + '"\\\\]\\\\nenabled = )(true|false)'), '$1true');
    else text += '\\n[plugins."' + id + '"]\\nenabled = true\\n';
    fs.writeFileSync(cfg, text);
  }
  if (cmd.startsWith('plugin remove ')) fs.writeFileSync(cfg, read().replace(new RegExp('\\\\n\\\\[plugins\\\\."' + esc(args[2]) + '"\\\\][^[]*'), '\\n'));
}
if (tool === 'gemini') {
  const extDir = path.join(home, '.gemini', 'extensions');
  const enablement = path.join(extDir, 'extension-enablement.json');
  if (cmd.startsWith('extensions link ')) {
    const name = readJson(path.join(args[2], 'gemini-extension.json')).name || path.basename(args[2]);
    writeJson(path.join(extDir, name, '.gemini-extension-install.json'), { source: args[2], type: 'link' });
    const all = readJson(enablement); all[name] = { overrides: [home + '/*'] }; writeJson(enablement, all);
  }
  if (cmd.startsWith('extensions uninstall ')) { fs.rmSync(path.join(extDir, args[2]), { recursive: true, force: true }); const all = readJson(enablement); delete all[args[2]]; writeJson(enablement, all); }
  if (cmd.startsWith('extensions enable ') || cmd.startsWith('extensions disable ')) {
    const on = args[1] === 'enable';
    const base = args[3] === 'user' ? home : process.cwd();
    const name = args[4];
    const all = readJson(enablement);
    const list = ((all[name] && all[name].overrides) || []).filter((o) => o !== base + '/*' && o !== '!' + base + '/*');
    list.push((on ? '' : '!') + base + '/*');
    all[name] = { overrides: list };
    writeJson(enablement, all);
  }
}
if (tool === 'claude' && cmd.startsWith('plugin details ')) {
  console.log('Projected token cost');
  console.log('  Always-on:   ~123 tok   added to every session');
}
if (tool === 'gh' && cmd.startsWith('pr create')) console.log('https://github.com/example/registry/pull/1');
`;

function makeSandbox() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'agreg-test-'));
  const home = path.join(base, 'home');
  const agregHome = path.join(home, '.agreg');
  const shims = path.join(base, 'bin');
  const log = path.join(base, 'calls.log');
  fs.mkdirSync(shims, { recursive: true });
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(home, '.codex', 'config.toml'), 'model = "gpt-5"\n');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(shims, 'shim.js'), SHIM);
  for (const tool of ['claude', 'codex', 'gemini', 'gh']) {
    const shim = path.join(shims, tool);
    fs.writeFileSync(shim, `#!/usr/bin/env bash\nSHIM_TOOL=${tool} SHIM_HOME="${home}" SHIM_LOG="${log}" exec node "${path.join(shims, 'shim.js')}" "$@"\n`);
    fs.chmodSync(shim, 0o755);
  }
  const env = {
    ...process.env,
    HOME: home,
    AGREG_HOME: agregHome,
    PATH: `${shims}:${process.env.PATH}`,
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
    GIT_CONFIG_GLOBAL: '/dev/null',
    EDITOR: '',
    VISUAL: '',
  };
  const sb = {
    base,
    home,
    agregHome,
    log,
    env,
    calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : []),
    run(args, opts = {}) {
      try {
        return execFileSync('node', [BIN, ...args], { env, cwd: opts.cwd || base, encoding: 'utf8', input: opts.input, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (err) {
        throw new Error(`agreg ${args.join(' ')} exited ${err.status}\n${err.stdout || ''}${err.stderr || ''}`);
      }
    },
    git: (args, cwd) => execSync(`git ${args}`, { env, cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
    // A registry repo with the given roles, pushed to a bare remote. Returns { work, bare }.
    makeRegistry(name, roles = ['coding']) {
      const work = path.join(base, `src-${name}`);
      const bare = path.join(base, `${name}.git`);
      sb.run(['init', work, '--name', name, '--description', `${name} registry`, '--owner', 'Test']);
      fs.rmSync(path.join(work, 'plugins', 'example'), { recursive: true, force: true });
      for (const role of roles) sb.run(['new', 'role', role, '-d', `${role} role`], { cwd: work });
      sb.git('add -A', work);
      sb.git('commit -q -m init', work);
      execSync(`git init -q --bare -b main "${bare}"`, { env });
      sb.git(`remote add origin "${bare}"`, work);
      sb.git('push -q -u origin main', work);
      return { work, bare };
    },
    readJson: (f) => JSON.parse(fs.readFileSync(f, 'utf8')),
    cleanup: () => fs.rmSync(base, { recursive: true, force: true }),
  };
  return sb;
}

module.exports = { makeSandbox, ROOT, BIN };
