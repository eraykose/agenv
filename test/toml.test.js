'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const toml = require('../lib/toml');

const SAMPLE = `model = "gpt-5"

[marketplaces.agenv]
source_type = "local"
source = "/home/me/agenv"

[plugins."coding@agenv"]
enabled = true

[projects."/home/me/proj"]
trust_level = "trusted"
`;

test('getBool / getString read quoted-key tables', () => {
  assert.equal(toml.getBool(SAMPLE, 'plugins', 'coding@agenv', 'enabled'), true);
  assert.equal(toml.getBool(SAMPLE, 'plugins', 'design@agenv', 'enabled'), undefined);
  assert.equal(toml.getString(SAMPLE, 'marketplaces', 'agenv', 'source'), '/home/me/agenv');
  assert.equal(toml.getString(SAMPLE, 'projects', '/home/me/proj', 'trust_level'), 'trusted');
});

test('setValue rewrites an existing key in place and leaves the rest untouched', () => {
  const out = toml.setValue(SAMPLE, 'plugins', 'coding@agenv', 'enabled', 'false');
  assert.match(out, /\[plugins\."coding@agenv"\]\nenabled = false\n/);
  assert.equal(out.replace('enabled = false', 'enabled = true'), SAMPLE);
});

test('setValue appends a new table at the end', () => {
  const out = toml.setValue(SAMPLE, 'plugins', 'design@agenv', 'enabled', 'true');
  assert.ok(out.startsWith(SAMPLE.trimEnd()));
  assert.match(out, /\n\n\[plugins\."design@agenv"\]\nenabled = true\n$/);
  assert.equal(toml.getBool(out, 'plugins', 'design@agenv', 'enabled'), true);
  assert.equal(toml.getBool(out, 'plugins', 'coding@agenv', 'enabled'), true);
});

test('setValue on an empty file creates just the table', () => {
  assert.equal(toml.setValue('', 'plugins', 'x@y', 'enabled', 'false'), '[plugins."x@y"]\nenabled = false\n');
});

test('removeTable drops the table and its preceding blank line only', () => {
  const out = toml.removeTable(SAMPLE, 'plugins', 'coding@agenv');
  assert.ok(!out.includes('coding@agenv'));
  assert.ok(out.includes('[projects."/home/me/proj"]'));
  assert.ok(out.includes('[marketplaces.agenv]'));
});
