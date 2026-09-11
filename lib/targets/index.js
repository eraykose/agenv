'use strict';
const claude = require('./claude');
const codex = require('./codex');
const gemini = require('./gemini');

// Cowork is not a target: it consumes a registry as a marketplace by URL (see README).
const ALL = [claude, codex, gemini];

const detectedTargets = () => ALL.filter((t) => t.detected());
const installedTargets = (links) => ALL.filter((t) => t.installed(links));

// Parse `--only claude,codex` against a candidate list.
function pickTargets(only, candidates, what) {
  const wanted = String(only)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = wanted.filter((w) => !ALL.some((t) => t.id === w));
  if (unknown.length) throw new Error(`Unknown tool(s): ${unknown.join(', ')}. Known: ${ALL.map((t) => t.id).join(', ')}`);
  const missing = wanted.filter((w) => !candidates.some((t) => t.id === w));
  if (missing.length) throw new Error(`Not ${what}: ${missing.join(', ')} (${what}: ${candidates.map((t) => t.id).join(', ') || 'none'})`);
  return candidates.filter((t) => wanted.includes(t.id));
}

module.exports = { ALL, detectedTargets, installedTargets, pickTargets };
