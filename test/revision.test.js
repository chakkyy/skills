'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tmpHome, rm, ccmd } = require('./helpers');

function revFor(home, key) {
  const html = fs.readFileSync(path.join(home, 'dashboard.html'), 'utf8');
  const re = new RegExp('data-ack="' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '" data-rev="([^"]*)"');
  const m = re.exec(html);
  return m && m[1];
}

// #10: the card carries a data-rev that changes when the item is re-reported, so
// the frontend can invalidate a stale "read" instead of inheriting it forever.
test('data-rev changes when an entry is re-reported', async () => {
  const home = tmpHome();
  try {
    ccmd(['report', '--project', 'web', '--branch', 'main', '--status', 'IN_PROGRESS', '--summary', 'v1'], { home });
    ccmd(['render'], { home });
    const rev1 = revFor(home, 'entry:web/main');
    assert.ok(rev1, 'entry has a data-rev');
    await new Promise(r => setTimeout(r, 5));
    ccmd(['report', '--project', 'web', '--branch', 'main', '--status', 'DONE', '--summary', 'v2'], { home });
    ccmd(['render'], { home });
    const rev2 = revFor(home, 'entry:web/main');
    assert.ok(rev2 && rev2 !== rev1, 'data-rev changed after re-report (stale read invalidated)');
  } finally { rm(home); }
});
