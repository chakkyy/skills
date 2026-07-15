'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { tmpHome, rm, ccmd } = require('./helpers');
const themes = require('../skills/command-center/template/themes.js');

// Blocker #9: a malicious accent must never break out of the injected <style>.

test('themeVars rejects a style-breakout accent', () => {
  const evil = '</style><script>alert(1)</script>';
  const css = themes.themeVars('swiss', evil);
  assert.ok(!css.includes('<script>'), 'no script tag leaks');
  assert.ok(!css.includes('</style>'), 'cannot close the style block');
  assert.ok(!css.includes(evil));
});

test('safeAccent only accepts hex', () => {
  assert.equal(themes.safeAccent('#0a84ff'), '#0a84ff');
  assert.equal(themes.safeAccent('#FFF'), '#fff');
  assert.equal(themes.safeAccent('red'), null);
  assert.equal(themes.safeAccent('#0a84ff;}body{x'), null);
  assert.equal(themes.safeAccent('rgb(1,2,3)'), null);
});

test('a poisoned config.accent cannot inject into the rendered board', () => {
  const home = tmpHome();
  try {
    ccmd(['demo'], { home });
    // hand-poison the config the way an attacker-controlled file might
    const cfgPath = path.join(home, 'config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    cfg.accent = '#000;} </style><script>alert(document.cookie)</script><style>';
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
    ccmd(['render'], { home });
    const html = fs.readFileSync(path.join(home, 'dashboard.html'), 'utf8');
    assert.ok(!html.includes('<script>alert(document.cookie)'), 'no injected script in board');
  } finally { rm(home); }
});
