'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tmpHome, rm, ccmd, readJSON, listJSON } = require('./helpers');

function signalFile(home, id) { return path.join(home, 'signals', `${id}.json`); }
function create(home, project, msg, extra = []) {
  return ccmd(['signal', '--project', project, '--msg', msg, ...extra], { home });
}

test('signal creation writes only the id to stdout', () => {
  const home = tmpHome();
  try {
    const r = create(home, 'web', 'Need the final checkout decision');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^[A-Za-z0-9]+-[A-Za-z0-9]+\n$/);
    assert.equal(r.stderr, '');
  } finally { rm(home); }
});

test('signal --update edits in place, sets updatedAt, preserves identity, and clears seen', () => {
  const home = tmpHome();
  try {
    const first = create(home, 'web', 'Need the final checkout decision').stdout.trim();
    const second = create(home, 'web', 'Unrelated database migration status').stdout.trim();
    const firstPath = signalFile(home, first);
    const secondPath = signalFile(home, second);

    const original = readJSON(firstPath);
    original.createdAt = '2000-01-01T00:00:00.000Z';
    fs.writeFileSync(firstPath, JSON.stringify(original, null, 2) + '\n');
    const other = readJSON(secondPath);
    other.createdAt = '2025-01-01T00:00:00.000Z';
    fs.writeFileSync(secondPath, JSON.stringify(other, null, 2) + '\n');
    const beforeFiles = listJSON(path.join(home, 'signals')).sort();

    assert.equal(ccmd(['seen', `signal:${first}`], { home }).status, 0);
    assert.match(ccmd(['signals', 'web'], { home }).stdout, new RegExp(`${first}.*\\(✓ seen\\)`));

    const r = ccmd([
      'signal', '--update', first,
      '--msg', 'Updated checkout decision details',
      '--kind', 'question', '--branch', 'feature/new',
      '--project', 'different-project',
    ], { home });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, `updated ${first}\n`);
    assert.equal(r.stderr, '');
    assert.deepEqual(listJSON(path.join(home, 'signals')).sort(), beforeFiles, 'update must not create a signal file');

    const updated = readJSON(firstPath);
    assert.equal(updated.id, first);
    assert.equal(updated.key, `signal:${first}`);
    assert.equal(updated.createdAt, '2000-01-01T00:00:00.000Z');
    assert.equal(updated.project, 'web', '--project must not move a signal');
    assert.equal(updated.branch, 'feature_new');
    assert.equal(updated.msg, 'Updated checkout decision details');
    assert.equal(updated.kind, 'question');
    assert.ok(Date.parse(updated.updatedAt) > Date.parse(updated.createdAt));

    const listed = ccmd(['signals', 'web'], { home }).stdout;
    assert.doesNotMatch(listed, new RegExp(`${first}.*\\(✓ seen\\)`), 'an update re-surfaces a seen signal');
    const data = JSON.parse(ccmd(['data'], { home }).stdout);
    assert.equal(data.products.find(p => p.id === 'web').signals[0].id, first, 'updatedAt drives board ordering');
  } finally { rm(home); }
});

test('invalid and missing signal updates fail without creating files', () => {
  const home = tmpHome();
  try {
    const invalid = ccmd(['signal', '--update', '../../escape', '--msg', 'x'], { home });
    assert.notEqual(invalid.status, 0);
    assert.equal(invalid.stdout, '');
    assert.match(invalid.stderr, /usage: ccmd signal --update/);
    assert.equal(listJSON(path.join(home, 'signals')).length, 0);

    const missing = ccmd(['signal', '--update', 'abc-def', '--msg', 'x'], { home });
    assert.notEqual(missing.status, 0);
    assert.equal(missing.stdout, '');
    assert.match(missing.stderr, /no such open signal: abc-def/);
    assert.equal(listJSON(path.join(home, 'signals')).length, 0);
  } finally { rm(home); }
});

test('the fifth open signal emits a non-blocking cap warning on stderr', () => {
  const home = tmpHome();
  try {
    const messages = [
      'Alpha architecture ledger bloom',
      'Bravo browser canvas delta',
      'Cedar deployment engine frost',
      'Delta gateway harbor island',
      'Ember kernel launch matrix',
    ];
    for (const msg of messages.slice(0, 4)) assert.equal(create(home, 'web', msg).stderr, '');
    const fifth = create(home, 'web', messages[4]);
    assert.equal(fifth.status, 0);
    assert.match(fifth.stdout, /^[A-Za-z0-9]+-[A-Za-z0-9]+\n$/);
    assert.match(fifth.stderr, /⚠ web: 5 open signals \(>4\)/);
    assert.match(fifth.stderr, /ccmd signals web/);
  } finally { rm(home); }
});

test('duplicate advisory identifies the closest signal and ignores different messages', () => {
  const home = tmpHome();
  try {
    const expected = create(home, 'web', 'Checkout payment gateway timeout failure').stdout.trim();
    const different = create(home, 'web', 'Database migration index cleanup completed');
    assert.equal(different.stderr, '');

    const duplicate = create(home, 'web', 'Checkout payment gateway timeout failure today');
    assert.equal(duplicate.status, 0);
    assert.match(duplicate.stderr, new RegExp(`possible duplicate of ${expected}`));
    assert.match(duplicate.stderr, new RegExp(`ccmd signal --update ${expected}`));

    const unrelated = create(home, 'web', 'Typography spacing review completed tomorrow');
    assert.doesNotMatch(unrelated.stderr, /possible duplicate/);
  } finally { rm(home); }
});

test('ccmd signals groups open signals and filters by product id or repo', () => {
  const home = tmpHome();
  try {
    const init = ccmd([
      'init', '--features', 'goals,seen',
      '--product', 'alpha:Alpha Product:repo-a,repo-b',
      '--product', 'beta:Beta Product:repo-c',
      '--product', 'gamma:Gamma Product:repo-d',
    ], { home });
    assert.equal(init.status, 0);

    const alphaA = create(home, 'repo-a', 'Alpha release approval needed').stdout.trim();
    const alphaB = create(home, 'repo-b', 'Alpha pricing decision needed').stdout.trim();
    const beta = create(home, 'repo-c', 'Beta launch date needed').stdout.trim();
    const resolved = create(home, 'repo-d', 'Old resolved request').stdout.trim();
    assert.equal(ccmd(['resolve', resolved], { home }).status, 0);
    assert.equal(ccmd(['seen', `signal:${alphaB}`], { home }).status, 0);

    const all = ccmd(['signals'], { home });
    assert.equal(all.status, 0);
    assert.match(all.stdout, /Alpha Product \(alpha\) — 2 open signals · 1 on board/);
    assert.match(all.stdout, /Beta Product \(beta\) — 1 open signal/);
    assert.match(all.stdout, new RegExp(alphaA));
    assert.match(all.stdout, new RegExp(`${alphaB}.*\\(✓ seen\\)`));
    assert.match(all.stdout, new RegExp(beta));
    assert.doesNotMatch(all.stdout, /Gamma Product|Old resolved request/);

    const byProduct = ccmd(['signals', 'alpha'], { home }).stdout;
    assert.match(byProduct, /Alpha Product \(alpha\)/);
    assert.doesNotMatch(byProduct, /Beta Product/);

    const byRepo = ccmd(['signals', 'repo-b'], { home }).stdout;
    assert.match(byRepo, /Alpha Product \(alpha\)/);
    assert.match(byRepo, new RegExp(alphaA));
    assert.match(byRepo, new RegExp(alphaB));
    assert.doesNotMatch(byRepo, /Beta Product/);

    assert.equal(ccmd(['signals', 'gamma'], { home }).stdout, 'no open signals for "gamma"\n');
  } finally { rm(home); }
});
