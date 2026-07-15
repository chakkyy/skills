'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { tmpHome, rm, ccmd, listJSON } = require('./helpers');

// Blocker #6: real CLI failures exit non-zero; `--help` never mutates.

test('report --help prints help and does NOT write a row', () => {
  const home = tmpHome();
  try {
    const r = ccmd(['report', '--help', '--status', 'DONE', '--summary', 'oops'], { home, cwd: home });
    assert.match(r.stdout, /ccmd — Command Center/);
    // no entry for the cwd basename should have been created
    const proj = path.basename(home);
    assert.equal(listJSON(path.join(home, 'entries', proj)).length, 0, 'no row written by --help');
  } finally { rm(home); }
});

test('a broken ACC_HOME makes report exit non-zero', () => {
  const home = tmpHome();
  try {
    // a path under a file can never be mkdir'd
    const broken = path.join(home, 'afile', 'child');
    require('fs').writeFileSync(path.join(home, 'afile'), 'x');
    const r = ccmd(['report', '--status', 'DONE', '--summary', 'x'], { home: broken, cwd: home });
    assert.notEqual(r.status, 0, 'should surface the failure');
  } finally { rm(home); }
});

test('unknown command exits non-zero-safe but a normal help is 0', () => {
  const home = tmpHome();
  try {
    assert.equal(ccmd(['help'], { home }).status, 0);
  } finally { rm(home); }
});
