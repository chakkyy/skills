'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tmpHome, rm, ccmd } = require('./helpers');

function render(home) { ccmd(['render'], { home }); return fs.readFileSync(path.join(home, 'dashboard.html'), 'utf8'); }

// #4: a read (seen) signal stays on the board (dimmed) until RESOLVED.
test('marking a signal read keeps it visible; only resolve removes it', () => {
  const home = tmpHome();
  try {
    const id = ccmd(['signal', '--project', 'web', '--kind', 'blocker', '--msg', 'need a decision'], { home }).stdout.trim();
    ccmd(['seen', `signal:${id}`], { home });
    let html = render(home);
    assert.ok(html.includes(`signal:${id}`), 'read signal still rendered');
    assert.ok(/Acknowledged/.test(html), 'shown as Acknowledged, not gone');
    ccmd(['resolve', id], { home });
    html = render(home);
    assert.ok(!html.includes(`signal:${id}`), 'resolved signal is gone');
  } finally { rm(home); }
});

// #4: a read report DOES drop off (entries are per-turn state, not open asks).
test('a read entry drops off the board', () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'web', '--branch', 'main', '--status', 'IN_PROGRESS', '--summary', 'x'], { home });
    ccmd(['seen', 'entry:web/main'], { home });
    assert.ok(!render(home).includes('entry:web/main'), 'read entry hidden');
  } finally { rm(home); }
});

// #11: with the seen feature OFF, none of its semantics run.
test('seen feature off: no filtering, no CLI, no prune-by-seen', () => {
  const home = tmpHome();
  try {
    ccmd(['init', '--features', 'goals', '--product', 'web:Web:globe:web'], { home }); // seen off
    ccmd(['report', '--project', 'web', '--branch', 'main', '--status', 'IN_PROGRESS', '--summary', 'x'], { home });
    // a stale seen marker must NOT hide the entry when the feature is off
    fs.mkdirSync(path.join(home, 'seen'), { recursive: true });
    fs.writeFileSync(path.join(home, 'seen', 'entry_web_main'), 'x');
    const html = render(home);
    assert.ok(html.includes('entry:web/main'), 'entry visible despite stale seen marker');
    assert.ok(!/class="ack"/.test(html), 'no ack buttons');
    // CLI seen is disabled
    const r = ccmd(['seen', 'entry:web/main'], { home });
    assert.match(r.stdout, /feature is off/);
    assert.notEqual(r.status, 0);
    // prune does NOT archive a seen (non-DONE) entry
    ccmd(['prune'], { home });
    assert.ok(fs.existsSync(path.join(home, 'entries', 'web', 'main.json')), 'not pruned by seen');
  } finally { rm(home); }
});
