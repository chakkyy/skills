'use strict';
// Shared test helpers: run the real ccmd binary against a throwaway ACC_HOME.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CCMD = path.join(__dirname, '..', 'skills', 'command-center', 'bin', 'ccmd');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'acc-test-'));
}
function rm(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }

// Run `ccmd <args...>` with ACC_HOME=home (+ optional env/cwd). Returns {status,stdout,stderr}.
function ccmd(args, { home, cwd, env } = {}) {
  const r = spawnSync('node', [CCMD, ...args], {
    cwd: cwd || home || process.cwd(),
    env: Object.assign({}, process.env, { ACC_HOME: home }, env || {}),
    encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function listJSON(dir) { try { return fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch { return []; } }

module.exports = { CCMD, tmpHome, rm, ccmd, readJSON, listJSON };
