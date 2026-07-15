'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { tmpHome, rm, ccmd, CCMD } = require('./helpers');

function readLine(home, line) {
  return spawnSync('node', [CCMD, 'read'], {
    input: line, encoding: 'utf8',
    env: Object.assign({}, process.env, { ACC_HOME: home }),
  });
}

// #14: the ccmd-read relay consumes structured input and validates keys — a
// malicious pasted line can never reach a shell.
test('ccmd read marks valid keys and ignores shell-injection tokens', () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'web', '--branch', 'main', '--status', 'IN_PROGRESS', '--summary', 'x'], { home });
    const evil = 'ccmd-read: entry:web/main, $(touch /tmp/pwned_ccmd), `id`, a b; rm -rf ~, signal:legit-id';
    const r = readLine(home, evil);
    assert.match(r.stdout, /marked 2 read/); // entry:web/main + signal:legit-id are format-valid; the rest ignored
    assert.match(r.stdout, /ignored/);
    assert.ok(!fs.existsSync('/tmp/pwned_ccmd'), 'no shell command executed');
    // the valid entry key got a seen marker
    assert.ok(fs.readdirSync(path.join(home, 'seen')).length >= 1);
  } finally { rm(home); try { fs.unlinkSync('/tmp/pwned_ccmd'); } catch {} }
});

test('ccmd read handles keys as an argument too', () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'web', '--branch', 'main', '--status', 'DONE', '--summary', 'x'], { home });
    const r = ccmd(['read', 'ccmd-read: entry:web/main'], { home });
    assert.match(r.stdout, /marked 1 read/);
  } finally { rm(home); }
});

// #8: store dirs are private (POSIX only)
test('store dirs are created 0700 and files 0600', { skip: process.platform === 'win32' }, () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'web', '--branch', 'main', '--status', 'DONE', '--summary', 'x'], { home });
    const dmode = fs.statSync(path.join(home, 'entries')).mode & 0o777;
    assert.equal(dmode, 0o700, 'entries dir 0700');
    const fmode = fs.statSync(path.join(home, 'entries', 'web', 'main.json')).mode & 0o777;
    assert.equal(fmode, 0o600, 'entry file 0600');
  } finally { rm(home); }
});
