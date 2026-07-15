'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tmpHome, rm, ccmd, listJSON } = require('./helpers');

// Blocker #1: `ccmd demo` must never clobber real data. Only a store seeded by
// `ccmd demo` (marker file) may be reset without --force.

test('demo refuses when the store has only a real report (no products)', () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'web', '--status', 'IN_PROGRESS', '--summary', 'real'], { home });
    assert.equal(listJSON(path.join(home, 'entries', 'web')).length, 1, 'report written');
    const r = ccmd(['demo'], { home });
    assert.match(r.stdout, /already has real data/);
    assert.notEqual(r.status, 0, 'demo exits non-zero when it refuses');
    assert.equal(listJSON(path.join(home, 'entries', 'web')).length, 1, 'real report preserved');
  } finally { rm(home); }
});

test('demo refuses when the store has ONLY signals (empty-collection guard bug)', () => {
  const home = tmpHome();
  try {
    ccmd(['signal', '--project', 'web', '--kind', 'blocker', '--msg', 'x'], { home });
    assert.equal(listJSON(path.join(home, 'signals')).length, 1);
    const r = ccmd(['demo'], { home });
    assert.match(r.stdout, /already has real data/);
    assert.equal(listJSON(path.join(home, 'signals')).length, 1, 'signal preserved');
  } finally { rm(home); }
});

test('demo refuses when the store has ONLY goals', () => {
  const home = tmpHome();
  try {
    ccmd(['goal', '--project', 'web', '--title', 'Big', '--status', 'ready'], { home });
    assert.equal(listJSON(path.join(home, 'goals')).length, 1);
    const r = ccmd(['demo'], { home });
    assert.match(r.stdout, /already has real data/);
    assert.equal(listJSON(path.join(home, 'goals')).length, 1, 'goal preserved');
  } finally { rm(home); }
});

test('demo seeds a fresh (empty) store', () => {
  const home = tmpHome();
  try {
    const r = ccmd(['demo'], { home });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /seeded demo store/);
    assert.ok(fs.existsSync(path.join(home, '.demo-store')), 'marker written');
    assert.equal(listJSON(path.join(home, 'entries', 'acme-web')).length, 2);
  } finally { rm(home); }
});

test('demo re-seeds a demo store without --force (marker present)', () => {
  const home = tmpHome();
  try {
    ccmd(['demo'], { home });
    const r = ccmd(['demo'], { home });
    assert.equal(r.status, 0, 're-seed allowed on a demo store');
    assert.match(r.stdout, /seeded demo store/);
  } finally { rm(home); }
});

test('a real report on a demo store clears the marker, protecting later data', () => {
  const home = tmpHome();
  try {
    ccmd(['demo'], { home });
    assert.ok(fs.existsSync(path.join(home, '.demo-store')));
    ccmd(['report', '--project', 'acme-web', '--status', 'DONE', '--summary', 'real now'], { home });
    assert.ok(!fs.existsSync(path.join(home, '.demo-store')), 'marker cleared by real write');
    const r = ccmd(['demo'], { home });
    assert.match(r.stdout, /already has real data/, 'demo now refuses');
  } finally { rm(home); }
});

test('demo --force overwrites a real store', () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'web', '--status', 'IN_PROGRESS', '--summary', 'real'], { home });
    const r = ccmd(['demo', '--force'], { home });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /seeded demo store/);
  } finally { rm(home); }
});
