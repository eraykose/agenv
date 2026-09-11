'use strict';
const fs = require('fs');
const path = require('path');
const registry = require('../registry');
const { KEBAB } = require('../registry');
const { build } = require('../build');
const git = require('../git');
const { run } = require('../run');

const SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';

// Scaffold a new registry repo: identity, one example role, CI running `agreg doctor`.
function init({ dir, name, description, owner } = {}) {
  const root = path.resolve(dir || '.');
  const regName = name || path.basename(root);
  if (!KEBAB.test(regName)) throw new Error(`Registry name "${regName}" must be kebab-case (pass --name).`);
  if (fs.existsSync(path.join(root, 'agreg.json'))) throw new Error(`${root} already has agreg.json.`);
  fs.mkdirSync(path.join(root, 'plugins', 'example', 'skills', 'example-guide'), { recursive: true });
  fs.mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true });

  const identity = { name: regName, description: description || `${regName}: agent roles managed with agreg` };
  if (owner) identity.owner = { name: owner };
  fs.writeFileSync(path.join(root, 'agreg.json'), JSON.stringify(identity, null, 2) + '\n');
  fs.writeFileSync(
    path.join(root, 'plugins', 'example', 'plugin.json'),
    JSON.stringify({ $schema: SCHEMA, name: 'example', version: '0.1.0', description: 'Example role - rename or delete' }, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(root, 'plugins', 'example', 'skills', 'example-guide', 'SKILL.md'),
    `---
name: example-guide
description: Use this when working as the example role. Replace with real trigger phrasing.
---

# example-guide

Replace this with the instructions the agent should follow.
`
  );
  fs.writeFileSync(
    path.join(root, 'README.md'),
    `# ${regName}

An [agreg](https://github.com/eraykose/agreg) registry. Each folder under \`plugins/\` is a role.

\`\`\`bash
npm i -g agreg
agreg add <this repo's owner/repo>
agreg use            # in a project, pick the roles active there
\`\`\`

Edit \`plugins/<role>/skills/<skill>/SKILL.md\`; run \`agreg build .\` after changing
\`plugin.json\` or \`mcp.json\`; \`agreg doctor .\` before opening a PR.
`
  );
  fs.writeFileSync(
    path.join(root, '.github', 'workflows', 'ci.yml'),
    `name: ci
on: [push, pull_request]
jobs:
  doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
      - run: npx --yes agreg doctor .
`
  );
  if (!fs.existsSync(path.join(root, '.gitignore'))) fs.writeFileSync(path.join(root, '.gitignore'), '.DS_Store\n.claude/settings.local.json\n.codex/config.toml\n');
  build(registry.open(root), { quiet: true });
  if (!git.isRepo(root)) run(`git init -q -b main`, { cwd: root, quiet: true });
  console.log(`Created registry "${regName}" in ${root}:`);
  console.log('  agreg.json, plugins/example/, generated manifests, README.md, .github/workflows/ci.yml');
  console.log('\nNext: rename plugins/example, commit, push to GitHub, then on each machine: `agreg add <owner/repo>`.');
}

module.exports = { init };
