'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { tmpHome, rm, CCMD } = require('./helpers');

const HOOKS = path.join(__dirname, '..', 'hooks');
const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: 'ignore' });

function setupRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-hookrepo-'));
  git(repo, 'init');
  git(repo, 'config', 'user.email', 't@t.t');
  git(repo, 'config', 'user.name', 't');
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'v1\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-m', 'init');
  return repo;
}
function runHook(script, { repo, home, sid, stopActive = false }) {
  const input = JSON.stringify({ session_id: sid, cwd: repo, stop_hook_active: stopActive });
  return spawnSync('bash', [path.join(HOOKS, script)], {
    input, encoding: 'utf8',
    env: Object.assign({}, process.env, { ACC_HOME: home, ACC_CCMD: CCMD }),
  });
}

// #5: editing a file that was ALREADY dirty at prompt time must still count as
// "work this turn" (the old porcelain-hash missed it → false negative).
test('Stop hook catches an edit to an already-dirty tracked file', () => {
  const repo = setupRepo();
  const home = tmpHome();
  const sid = 'sess-' + Date.now();
  try {
    // file is already dirty when the prompt arrives
    fs.writeFileSync(path.join(repo, 'tracked.txt'), 'v2-dirty\n');
    runHook('ccmd-session-baseline.sh', { repo, home, sid });
    // the turn edits the same (already-dirty) file further — porcelain stays " M tracked.txt"
    fs.writeFileSync(path.join(repo, 'tracked.txt'), 'v3-more-changes\n');
    const r = runHook('ccmd-report-check.sh', { repo, home, sid });
    const out = JSON.parse(r.stdout || '{}');
    assert.equal(out.decision, 'block', 'blocked because work happened without a report');
  } finally { rm(repo); rm(home); }
});

test('Stop hook passes once a report is made', () => {
  const repo = setupRepo();
  const home = tmpHome();
  const sid = 'sess2-' + Date.now();
  try {
    runHook('ccmd-session-baseline.sh', { repo, home, sid });
    fs.writeFileSync(path.join(repo, 'new.txt'), 'untracked work\n');
    spawnSync('node', [CCMD, 'report', '--status', 'IN_PROGRESS', '--summary', 'did the work'],
      { cwd: repo, env: Object.assign({}, process.env, { ACC_HOME: home }) });
    const r = runHook('ccmd-report-check.sh', { repo, home, sid });
    assert.equal(r.stdout.trim(), '', 'no block after reporting');
  } finally { rm(repo); rm(home); }
});

test('Stop hook is a no-op on a read-only turn', () => {
  const repo = setupRepo();
  const home = tmpHome();
  const sid = 'sess3-' + Date.now();
  try {
    runHook('ccmd-session-baseline.sh', { repo, home, sid });
    // no changes this turn
    const r = runHook('ccmd-report-check.sh', { repo, home, sid });
    assert.equal(r.stdout.trim(), '', 'no block when nothing changed');
  } finally { rm(repo); rm(home); }
});
