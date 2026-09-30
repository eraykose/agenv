#!/usr/bin/env node
'use strict';
const pkg = require('../package.json');

const VALUE_FLAGS = new Set(['--dir', '--only', '--roles', '--description', '--ref', '--registry', '--branch', '--message', '--name', '--owner']);
const ALIASES = { '-y': '--yes', '-h': '--help', '-v': '--version', '-n': '--dry-run', '-g': '--global', '-d': '--description', '-m': '--message', '-r': '--registry' };

// Tiny argv parser: `--flag`, `--flag value`, `--flag=value`, short aliases, positionals.
function parse(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    if (a === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (ALIASES[a]) a = ALIASES[a];
    if (!a.startsWith('--')) {
      positional.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq !== -1) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    if (VALUE_FLAGS.has(a)) {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      flags[a.slice(2)] = argv[++i];
    } else flags[a.slice(2)] = true;
  }
  return { flags, positional };
}

const HELP = `agenv ${pkg.version} - nvm for your agents: one setup, every tool, the right role in every folder

Usage: agenv <command> [options]

Registries
  add <owner/repo | git URL | path> [--ref <ref>] [--only <tools>]
                              Clone a registry under ~/.agenv and link its roles (off by default)
  remove <registry> [--purge] [--force]
                              Unlink and delete a registry (--purge: also marketplace + user settings)
  update [registry...] [--check] [--json] [--dry-run]
                              Fetch, show what changed, fast-forward, relink, refresh Codex
  list [--json]               Registries and their roles

Roles in a folder
  use [--roles a,b | --all] [--dir <path>] [--global] [--only <tools>] [--dry-run]
                              Choose the roles active here (or machine-wide) on every linked tool
  status [--dir <path>] [--cost] [--json]
                              What is linked, per-role state, active roles here

Maintenance
  sync [--only <tools>] [--dry-run]
                              Make every tool match config (relink, refresh); safe any time
  doctor [registry|path] [--json]
                              Validate registries and links; exit 1 on errors (CI: agenv doctor .)
  path [registry]             Print a clone's path
  uninstall [--force] [--dry-run]
                              Unlink everything (built-in role included) and delete ~/.agenv

Editing a registry
  edit <role>[/<skill>] [--print]
                              Open in $EDITOR, or print the path
  new role <name> | new skill <role>/<name> [--registry <r>] [-d <text>]
  build [registry|path] [--check]
                              Regenerate per-tool manifests from plugin.json + mcp.json
  propose -m "<why>" [--registry <r>] [--branch <b>] [--dry-run]
                              Branch, commit, push, open a PR
  init [dir] [--name <n>] [--description <d>] [--owner <o>]
                              Scaffold a new registry repo

Tools for --only: claude, codex, gemini. Roles may be written <registry>/<role>.
AGENV_HOME overrides ~/.agenv.
`;

async function main() {
  const { flags, positional } = parse(process.argv.slice(2));
  const command = positional[0];
  if (flags.version) return console.log(`agenv ${pkg.version}`);
  if (flags.help || command === 'help' || command === undefined) return console.log(HELP);
  const dryRun = Boolean(flags['dry-run']);
  const all = Boolean(flags.all || flags.yes);
  const json = Boolean(flags.json);

  switch (command) {
    case 'add':
      return require('../lib/commands/add').add({ source: positional[1], ref: flags.ref, only: flags.only, dryRun });
    case 'remove':
    case 'rm':
      return require('../lib/commands/remove').remove({ name: positional[1], purge: Boolean(flags.purge), force: Boolean(flags.force), dryRun });
    case 'update':
    case 'up': {
      const ok = require('../lib/commands/update').update({ names: positional.slice(1), check: Boolean(flags.check), dryRun, json });
      process.exitCode = ok ? 0 : 1;
      return;
    }
    case 'list':
    case 'ls':
      return require('../lib/commands/list').list({ json });
    case 'use':
      return require('../lib/commands/use').use({ dir: flags.dir, all, roles: flags.roles, only: flags.only, global: Boolean(flags.global), dryRun });
    case 'status':
      return require('../lib/commands/status').status({ dir: flags.dir, cost: Boolean(flags.cost), json });
    case 'sync':
      return require('../lib/commands/sync').sync({ dryRun, only: flags.only });
    case 'doctor': {
      const ok = require('../lib/commands/doctor').doctor({ target: positional[1], json });
      process.exitCode = ok ? 0 : 1;
      return;
    }
    case 'path':
      return require('../lib/commands/path').pathCmd({ name: positional[1] });
    case 'edit':
      return require('../lib/commands/edit').edit({ spec: positional[1], print: Boolean(flags.print) });
    case 'new':
      return require('../lib/commands/new').create({ kind: positional[1], target: positional[2], description: flags.description, registry: flags.registry });
    case 'build': {
      const ok = require('../lib/commands/build').buildCmd({ target: positional[1], check: Boolean(flags.check) });
      process.exitCode = ok ? 0 : 1;
      return;
    }
    case 'propose':
      return require('../lib/commands/propose').propose({ message: flags.message, registry: flags.registry, branch: flags.branch, dryRun });
    case 'uninstall':
      return require('../lib/commands/uninstall').uninstall({ force: Boolean(flags.force), dryRun });
    case 'init':
      return require('../lib/commands/init').init({ dir: positional[1], name: flags.name, description: flags.description, owner: flags.owner });
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
