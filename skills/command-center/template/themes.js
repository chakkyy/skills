/* Command Center — theme presets + custom accent, injected as CSS variables.
   bin/ccmd appends themeVars(theme, accent) after style.css at render time.
   style.css holds the `swiss` defaults (light/dark auto); terminal & soft
   override the palette for a dark, single-mode look. Everything is a variable,
   so a theme is just a variable map. */
'use strict';

function hexToRgba(hex, a) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return null;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

// Variable overrides per theme. `swiss` is empty — it's the base in style.css.
const THEMES = {
  swiss: '',
  terminal: `
    --canvas:#0a0a0b; --surface:#141417; --surface-2:#0f0f11; --ink:#e7e7ea; --muted:#8a8a92; --faint:#565660;
    --hair:rgba(255,255,255,.08); --hair-2:rgba(255,255,255,.15); --track:#1d1d21;
    --amber:#e5b567; --amber-soft:rgba(229,181,103,.15); --green:#8ec07c; --green-soft:rgba(142,192,124,.15);
    --sans: ui-monospace,"SF Mono","SFMono-Regular",Menlo,Consolas,monospace;
    --r:8px; --r-lg:10px; --r-sm:6px;
    --shadow-sm:0 1px 2px rgba(0,0,0,.5); --shadow:0 1px 2px rgba(0,0,0,.5); --shadow-lg:0 10px 40px rgba(0,0,0,.6);
  `,
  soft: `
    --canvas:#0e0e12; --surface:#17171d; --surface-2:#1c1c23; --ink:#ededf2; --muted:#9a9aa6; --faint:#63636f;
    --hair:rgba(255,255,255,.07); --hair-2:rgba(255,255,255,.13); --track:#26262e;
    --amber:#e0a94b; --amber-soft:rgba(224,169,75,.16); --green:#4fd48c; --green-soft:rgba(79,212,140,.16);
    --r:14px; --r-lg:20px; --r-sm:10px;
    --shadow-sm:0 1px 2px rgba(0,0,0,.3); --shadow:0 2px 8px rgba(0,0,0,.35),0 12px 32px rgba(0,0,0,.4); --shadow-lg:0 16px 50px rgba(0,0,0,.55);
  `,
};

// Match/beat the specificity of style.css's [data-theme] blocks, and come last.
const SEL = ':root, :root[data-theme="light"], :root[data-theme="dark"]';

function themeVars(theme, accent) {
  const t = THEMES[theme] != null ? theme : 'swiss';
  let out = '';
  if (THEMES[t]) out += `${SEL}{${THEMES[t]}}\n`;
  if (accent) {
    const soft = hexToRgba(accent, t === 'swiss' ? 0.10 : 0.18) || 'rgba(10,132,255,.16)';
    out += `${SEL}{--accent:${accent};--accent-soft:${soft};}\n`;
  }
  return out;
}

module.exports = { themeVars, hexToRgba, THEMES };
