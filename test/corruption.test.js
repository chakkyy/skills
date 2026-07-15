'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tmpHome, rm, ccmd } = require('./helpers');

// #19: a corrupt JSON file must not silently become "empty state" — it's
// quarantined (bytes preserved) with a diagnostic, and the rest still renders.
test('corrupt entry is quarantined, not silently dropped; board still renders', () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'web', '--branch', 'good', '--status', 'DONE', '--summary', 'healthy row'], { home });
    // hand-corrupt a second entry file
    const dir = path.join(home, 'entries', 'web');
    fs.writeFileSync(path.join(dir, 'broken.json'), '{ this is not json ');
    const r = ccmd(['render'], { home });
    assert.equal(r.status, 0, 'render does not crash');
    assert.match(r.stderr, /corrupt JSON quarantined/, 'diagnostic emitted');
    // bytes preserved as .corrupt-*
    const quarantined = fs.readdirSync(dir).filter(f => f.startsWith('broken.json.corrupt-'));
    assert.equal(quarantined.length, 1, 'corrupt file preserved, not overwritten');
    // healthy row still on the board
    const html = fs.readFileSync(path.join(home, 'dashboard.html'), 'utf8');
    assert.ok(html.includes('healthy row'));
  } finally { rm(home); }
});

// A missing file is normal → silent fallback, no diagnostic.
test('a missing config is not treated as corruption', () => {
  const home = tmpHome();
  try {
    const r = ccmd(['render'], { home });
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stderr, /corrupt/);
  } finally { rm(home); }
});
