'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { tmpHome, rm, ccmd, CCMD, readJSON } = require('./helpers');

function spawnCcmd(home, args) {
  return new Promise((resolve) => {
    const p = spawn('node', [CCMD, ...args], { env: Object.assign({}, process.env, { ACC_HOME: home }) });
    p.on('exit', resolve);
  });
}

// #3: a prune must never delete a freshly-rewritten report. We race a `report`
// (DONE → IN_PROGRESS v2) against a `prune` many times; v2 must always survive.
test('concurrent prune never deletes a fresh report', async () => {
  const home = tmpHome();
  const file = path.join(home, 'entries', 'web');
  try {
    for (let i = 0; i < 40; i++) {
      // seed a prunable DONE row
      ccmd(['report', '--project', 'web', '--branch', 'main', '--status', 'DONE', '--summary', 'v1 done'], { home });
      // race: prune (would archive the DONE) vs a fresh IN_PROGRESS report
      await Promise.all([
        spawnCcmd(home, ['prune']),
        spawnCcmd(home, ['report', '--project', 'web', '--branch', 'main', '--status', 'IN_PROGRESS', '--summary', 'v2 fresh']),
      ]);
      // v2 must be recoverable: either still on the board, or (if it landed first and
      // prune skipped) present as IN_PROGRESS. It must never be silently deleted.
      const files = fs.readdirSync(file).filter(f => f.endsWith('.json'));
      assert.equal(files.length, 1, `round ${i}: exactly one row (v2 preserved)`);
      const row = readJSON(path.join(file, files[0]));
      assert.equal(row.status, 'IN_PROGRESS', `round ${i}: the fresh v2 survived, not the archived DONE`);
      assert.equal(row.summary, 'v2 fresh');
      // clean for next round
      rm(path.join(home, 'entries'));
    }
  } finally { rm(home); }
});
