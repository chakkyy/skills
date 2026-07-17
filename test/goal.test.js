'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { tmpHome, rm, ccmd, listJSON } = require('./helpers');

// Bug: goal ids are slug→lower→slice(0,48), and the slice could cut mid-word
// leaving a trailing '_' that slug() strips on lookup — so the id printed at
// creation answered "no such goal" in `goal --done`.

const LONG_TITLE = 'Astro: fixtures ronda 2 + benchmark interpretación + voz Cosmi';

test('goal --done resolves the exact id printed at creation (48-char truncation)', () => {
  const home = tmpHome();
  try {
    const r = ccmd(['goal', '--title', LONG_TITLE, '--summary', 'x', '--project', 'demo'], { home });
    const id = /^goal (\S+)/m.exec(r.stdout)[1];
    assert.doesNotMatch(id, /_$/, 'canonical id has no trailing underscore');
    const d = ccmd(['goal', '--done', id], { home });
    assert.match(d.stdout, new RegExp(`goal done ${id}`));
    assert.equal(listJSON(path.join(home, 'goals')).length, 0, 'goal archived');
  } finally { rm(home); }
});

test('goal --done finds legacy ids stored with the trailing underscore', () => {
  const home = tmpHome();
  try {
    // simulate a pre-fix store: filename and id end in '_'
    const legacyId = 'astro_fixtures_ronda_2_benchmark_interpretaci_n_';
    const dir = path.join(home, 'goals');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, legacyId + '.json'), JSON.stringify({
      id: legacyId, project: 'demo', title: LONG_TITLE, status: 'ready',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }));
    const d = ccmd(['goal', '--done', legacyId], { home });
    assert.match(d.stdout, /^goal done /m, 'legacy id resolves');
    assert.equal(listJSON(dir).length, 0, 'legacy goal archived');
  } finally { rm(home); }
});
