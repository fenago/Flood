#!/usr/bin/env node
// Render risk-card-demo.html in Chromium (Playwright), save screenshots and run
// offline checks. No network: the page and tokens load from file://.
//
// Usage: node render-check.mjs [path/to/axe.min.js]
//   - Needs the `playwright` package resolvable (do not add it to the repo).
//   - axe-core is optional; pass the path to a local axe.min.js to run it.
// Checks:
//   1. axe-core WCAG 2.0/2.1/2.2 A+AA rules (if axe path given), light and dark.
//   2. Every link/button in the tab bar and top bar is >= 44x44 CSS px.
//   3. No horizontal scroll at 320 CSS px wide (WCAG 1.4.10 Reflow).
//   4. prefers-reduced-transparency: reduce turns the glass solid (no backdrop blur).
//   5. The last focusable element in <main> is not hidden by the fixed tab bar
//      when focused (WCAG 2.4.11).

import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(join(here, 'risk-card-demo.html')).href;
const axePath = process.argv[2];
const axeSource = axePath && existsSync(axePath) ? readFileSync(axePath, 'utf8') : null;

const results = [];
const record = (name, ok, detail = '') => { results.push({ name, ok, detail }); };

const browser = await chromium.launch();
try {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 1180 }, deviceScaleFactor: 1, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto(pageUrl);
    await page.screenshot({ path: join(here, `risk-card-demo-${scheme}.png`) });

    if (axeSource) {
      await page.addScriptTag({ content: axeSource });
      const axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
        return { violations: r.violations.map((v) => `${v.id} (${v.nodes.length})`), passes: r.passes.length, incomplete: r.incomplete.map((v) => v.id) };
      });
      record(`axe ${scheme}`, axe.violations.length === 0,
        `violations: [${axe.violations.join(', ')}] passes: ${axe.passes} needs-review: [${axe.incomplete.join(', ')}]`);
    }

    const small = await page.$$eval('.tabbar a, .topbar button', (els) => els
      .map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), w: r.width, h: r.height }; })
      .filter((r) => r.w < 44 || r.h < 44));
    record(`targets >= 44px ${scheme}`, small.length === 0, JSON.stringify(small));

    // Focus the last link in main, then check the tab bar does not fully cover it.
    await page.locator('main a').last().focus();
    const obscured = await page.evaluate(() => {
      const a = document.activeElement.getBoundingClientRect();
      const t = document.querySelector('.tabbar').getBoundingClientRect();
      return a.top >= t.top && a.bottom <= t.bottom;
    });
    record(`focus not obscured ${scheme}`, !obscured);
    await ctx.close();
  }

  // Reflow at 320 px.
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 } });
    const page = await ctx.newPage();
    await page.goto(pageUrl);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    record('reflow at 320px (no horizontal scroll)', sw <= cw, `scrollWidth ${sw}, clientWidth ${cw}`);
    await ctx.close();
  }

  // Reduced transparency via CDP media emulation (Chromium only).
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    await page.goto(pageUrl);
    const s = await page.$eval('.tabbar', (e) => { const cs = getComputedStyle(e); return { bg: cs.backgroundColor, bf: cs.backdropFilter }; });
    const solid = !/rgba?\([^)]*,\s*0?\.\d+\)|\/\s*0?\.\d+/.test(s.bg) && (s.bf === 'none' || /blur\(0px\)/.test(s.bf));
    record('reduced transparency -> solid tab bar', solid, JSON.stringify(s));
    await page.screenshot({ path: join(here, 'risk-card-demo-reduced-transparency.png') });
    await ctx.close();
  }
} finally {
  await browser.close();
}

let fails = 0;
for (const r of results) { if (!r.ok) fails++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  ' + r.detail : ''}`); }
console.log(`\n${results.length} checks, ${fails} failing.`);
process.exit(fails ? 1 : 0);
