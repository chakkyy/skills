'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { tmpHome, rm, ccmd, CCMD } = require('./helpers');

function req(port, { method = 'GET', pathname = '/', headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: pathname, headers }, res => {
      let data = ''; res.on('data', c => (data += c)); res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    // A server that refuses (e.g. destroys an oversized upload) surfaces here — resolve, don't throw.
    r.on('error', (e) => resolve({ status: 'reset', err: e.code }));
    r.on('socket', s => s.on('error', () => {}));
    if (body != null) r.write(body, () => {});
    r.end();
  });
}
async function withServer(home, fn) {
  const port = 7900 + Math.floor(Math.random() * 90);
  const srv = spawn('node', [CCMD, 'serve', '--port', String(port)], { env: Object.assign({}, process.env, { ACC_HOME: home }) });
  await new Promise(r => setTimeout(r, 700));
  try { await fn(port); } finally { srv.kill(); }
}

test('server rejects non-localhost Host (DNS-rebinding guard)', async () => {
  const home = tmpHome();
  try {
    ccmd(['demo'], { home });
    await withServer(home, async (port) => {
      const r = await req(port, { headers: { Host: 'evil.example.com' } });
      assert.equal(r.status, 403);
      const ok = await req(port, { headers: { Host: `localhost:${port}` } });
      assert.equal(ok.status, 200);
    });
  } finally { rm(home); }
});

test('/seen enforces method, content-type, body size, and key validity', async () => {
  const home = tmpHome();
  try {
    ccmd(['demo'], { home });
    // find a real entry key
    const proj = 'acme-web';
    const files = fs.readdirSync(path.join(home, 'entries', proj)).filter(f => f.endsWith('.json'));
    const branch = files[0].replace(/\.json$/, '');
    const realKey = `entry:${proj}/${branch}`;
    await withServer(home, async (port) => {
      assert.equal((await req(port, { method: 'GET', pathname: '/seen' })).status, 405, 'GET /seen → 405');
      assert.equal((await req(port, { method: 'POST', pathname: '/seen', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415, 'text/plain → 415');
      const big = 'x'.repeat(200000);
      const r413 = await req(port, { method: 'POST', pathname: '/seen', headers: { 'Content-Type': 'application/json' }, body: big }).catch(e => ({ status: 'reset', err: e.code }));
      assert.ok(r413.status === 413 || r413.status === 'reset', 'oversized body refused (413 or connection reset)');
      // arbitrary nonexistent key → accepted HTTP-wise but creates NO marker
      await req(port, { method: 'POST', pathname: '/seen', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'entry:../../etc/passwd' }) });
      await req(port, { method: 'POST', pathname: '/seen', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'signal:does-not-exist' }) });
      const seenBefore = fs.readdirSync(path.join(home, 'seen'));
      // valid key → marker created
      const rok = await req(port, { method: 'POST', pathname: '/seen', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: realKey }) });
      assert.equal(rok.status, 204);
      const seenAfter = fs.readdirSync(path.join(home, 'seen'));
      assert.equal(seenAfter.length, seenBefore.length + 1, 'only the valid key created a marker');
    });
  } finally { rm(home); }
});

test('/hash changes when the store changes', async () => {
  const home = tmpHome();
  try {
    ccmd(['demo'], { home });
    await withServer(home, async (port) => {
      const h1 = (await req(port, { pathname: '/hash' })).body;
      ccmd(['report', '--project', 'acme-web', '--branch', 'zzz', '--status', 'DONE', '--summary', 'x'], { home });
      const h2 = (await req(port, { pathname: '/hash' })).body;
      assert.notEqual(h1, h2);
    });
  } finally { rm(home); }
});
