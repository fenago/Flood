#!/usr/bin/env node
// Contrast check for tokens.css - zero dependencies, Node 18+.
// Usage: node contrast-check.mjs [path/to/tokens.css]
//
// Formula: WCAG 2.2 "relative luminance" and "contrast ratio" definitions
// (https://www.w3.org/TR/WCAG22/#dfn-relative-luminance):
//   channel c = v/255; c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4
//   L = 0.2126 R + 0.7152 G + 0.0722 B
//   ratio = (L1 + 0.05) / (L2 + 0.05), L1 the lighter
// Thresholds: 4.5:1 normal text (SC 1.4.3), 3:1 large text and UI parts (SC 1.4.11).
//
// Glass pairs: text sits on a translucent tint over unknown content. We composite
// the tint (at --glass-opacity) over a set of worst-case uniform backdrops and
// check the text against each result. Blur and saturate() leave a uniform
// backdrop unchanged, so uniform colours are the worst case.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? join(here, 'tokens.css');
const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Return the body of the first `{...}` that follows index `from`.
function blockAfter(text, from) {
  const open = text.indexOf('{', from);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error('unbalanced braces');
}

function readVars(body) {
  const vars = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const lightRoot = readVars(blockAfter(css, css.search(/^:root\s*\{/m)));
const darkIdx = css.indexOf('@media (prefers-color-scheme: dark)');
if (darkIdx < 0) throw new Error('no dark-mode block found');
const darkRoot = { ...lightRoot, ...readVars(blockAfter(blockAfter(css, darkIdx), 0)) };

function hex(vars, name) {
  let v = vars[name];
  for (let i = 0; i < 5 && v && v.startsWith('var('); i++) v = vars[v.slice(4, -1).trim()];
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${name} is not a 6-digit hex (${v})`);
  return v;
}
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
function luminance(h) {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const over = (top, alpha, bottom) =>
  toHex(rgb(top).map((t, i) => alpha * t + (1 - alpha) * rgb(bottom)[i]));

// Pairs: [foreground token, background token, minimum ratio, note]
const TEXT = 4.5, UI = 3;
const pairs = [
  ['--color-text', '--color-bg', TEXT, 'body text on page'],
  ['--color-text', '--color-surface', TEXT, 'body text on card'],
  ['--color-text', '--color-surface-2', TEXT, 'text on grouped row'],
  ['--color-text-muted', '--color-bg', TEXT, 'secondary text on page'],
  ['--color-text-muted', '--color-surface', TEXT, 'secondary text on card'],
  ['--color-text-muted', '--color-surface-2', TEXT, 'secondary text on row'],
  ['--color-accent', '--color-bg', TEXT, 'link text on page'],
  ['--color-accent', '--color-surface', TEXT, 'link text on card'],
  ['--color-on-accent', '--color-accent', TEXT, 'primary button label'],
  ['--color-alert-text', '--color-alert-bg', TEXT, 'NWS alert banner text'],
  ['--risk-low-on', '--risk-low', TEXT, 'Low badge'],
  ['--risk-elevated-on', '--risk-elevated', TEXT, 'Elevated badge'],
  ['--risk-high-on', '--risk-high', TEXT, 'High badge'],
  ['--risk-severe-on', '--risk-severe', TEXT, 'Severe badge'],
  ['--color-focus', '--color-bg', UI, 'focus ring on page'],
  ['--color-focus', '--color-surface', UI, 'focus ring on card'],
  ['--color-alert-edge', '--color-alert-bg', UI, 'alert banner edge'],
  ['--color-alert-edge', '--color-bg', UI, 'alert banner edge vs page'],
];
const glassText = [
  ['--color-text', TEXT, 'tab/toolbar label'],
  ['--color-text-muted', TEXT, 'unselected tab label'],
  ['--color-accent', TEXT, 'selected tab label'],
];
const BACKDROPS = ['#000000', '#ffffff', '#808080', '#ff0000', '#00a000', '#0000ff', '#ffff00'];

let failures = 0;
const rows = [];
for (const [mode, vars] of [['light', lightRoot], ['dark', darkRoot]]) {
  for (const [fg, bg, min, note] of pairs) {
    const r = ratio(hex(vars, fg), hex(vars, bg));
    const ok = r >= min;
    if (!ok) failures++;
    rows.push([mode, `${fg} on ${bg}`, hex(vars, fg), hex(vars, bg), r, min, ok, note]);
  }
  const alpha = parseFloat(vars['--glass-opacity']) / 100;
  const tint = hex(vars, '--color-surface');
  for (const [fg, min, note] of glassText) {
    let worst = { r: Infinity };
    for (const bd of BACKDROPS) {
      const mixed = over(tint, alpha, bd);
      const r = ratio(hex(vars, fg), mixed);
      if (r < worst.r) worst = { r, bd, mixed };
    }
    const ok = worst.r >= min;
    if (!ok) failures++;
    rows.push([mode, `${fg} on glass(${Math.round(alpha * 100)}%) over ${worst.bd}`,
      hex(vars, fg), worst.mixed, worst.r, min, ok, `${note} (worst backdrop)`]);
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('mode', 6), pad('pair', 58), pad('fg', 8), pad('bg', 8), pad('ratio', 7), pad('min', 4), 'result');
for (const [mode, pair, fg, bg, r, min, ok, note] of rows) {
  console.log(pad(mode, 6), pad(pair, 58), pad(fg, 8), pad(bg, 8), pad(r.toFixed(2), 7),
    pad(min, 4), ok ? 'PASS' : 'FAIL', '-', note);
}
console.log(`\n${rows.length} pairs checked, ${failures} failing.`);
process.exit(failures ? 1 : 0);
