'use strict';
const fs = require('fs');
const path = require('path');
const registry = require('../registry');
const { KEBAB } = require('../registry');
const { build } = require('../build');
const git = require('../git');
const { run } = require('../run');

const SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';

// Scaffold a new registry repo: identity, one example role, CI running `agenv doctor`.
function init({ dir, name, description, owner } = {}) {
  const root = path.resolve(dir || '.');
  const regName = name || path.basename(root);
  if (!KEBAB.test(regName)) throw new Error(`Registry name "${regName}" must be kebab-case (pass --name).`);
  if (fs.existsSync(path.join(root, 'agenv.json'))) throw new Error(`${root} already has agenv.json.`);
  fs.mkdirSync(path.join(root, 'plugins', 'example', 'skills', 'example-guide'), { recursive: true });
  fs.mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true });

  const identity = { name: regName, description: description || `${regName}: agent roles managed with agenv` };
  if (owner) identity.owner = { name: owner };
  fs.writeFileSync(path.join(root, 'agenv.json'), JSON.stringify(identity, null, 2) + '\n');
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

An [agenv](https://github.com/eraykose/agenv) registry. Each folder under \`plugins/\` is a role.

\`\`\`bash
npm i -g agenv
agenv add <this repo's owner/repo>
agenv use            # in a project, pick the roles active there
\`\`\`

Edit \`plugins/<role>/skills/<skill>/SKILL.md\`; run \`agenv build .\` after changing
\`plugin.json\` or \`mcp.json\`; \`agenv doctor .\` before opening a PR.
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
      - run: npx --yes agenv doctor .
`
  );
  if (!fs.existsSync(path.join(root, '.gitignore'))) fs.writeFileSync(path.join(root, '.gitignore'), '.DS_Store\n.claude/settings.local.json\n.codex/config.toml\n');
  build(registry.open(root), { quiet: true });
  if (!git.isRepo(root)) run(`git init -q -b main`, { cwd: root, quiet: true });
  console.log(`Created registry "${regName}" in ${root}:`);
  console.log('  agenv.json, plugins/example/, generated manifests, README.md, .github/workflows/ci.yml');
  console.log('\nNext: rename plugins/example, commit, push to GitHub, then on each machine: `agenv add <owner/repo>`.');
}

module.exports = { init };
