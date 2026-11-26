#!/usr/bin/env node
// Flesch-Kincaid grade level for UI copy in the spec files - zero dependencies.
// Usage: node readability.mjs [spec.md ...]   (default: all *.md specs in this folder)
//
// Copy lines are written as:  > [ID] text
// Formula (Kincaid et al. 1975): 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
// Syllables use a vowel-group heuristic (approximate, +/- about 1 grade on short text).
// Placeholders like {city} count as one 2-syllable word. Numbers count as 2 syllables.
// Target: grade <= 8 (risk-communication skill). Lines under 6 words are reported but
// not graded, because FK is meaningless on button labels.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(here).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => join(here, f));

// Accepted exceptions: proper nouns or official names we must keep verbatim.
const EXCEPTIONS = {
  'NOTICE': 'Required notice; agency name and "officials" are fixed wording.',
};

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return /\d/.test(word) || /^\{.*\}$/.test(word) ? 2 : 0;
  if (w.length <= 3) return 1;
  let s = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = s.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function grade(text) {
  const clean = text.replace(/\{[^}]+\}/g, 'place').replace(/[·—–]/g, ' ');
  const sentences = Math.max(1, (clean.match(/[.!?…]+(\s|$)/g) || []).length);
  const words = clean.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const fk = 0.39 * (words.length / sentences) + 11.8 * (syl / Math.max(1, words.length)) - 15.59;
  return { words: words.length, sentences, syl, fk };
}

let fails = 0, graded = 0, sumW = 0, sumS = 0, sumSyl = 0;
for (const file of files) {
  console.log(`\n## ${basename(file)}`);
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^> \[([A-Z0-9-]+)\] (.+)$/);
    if (!m) continue;
    const [, id, text] = m;
    const g = grade(text);
    let status;
    if (g.words < 6) status = 'short (not graded)';
    else {
      graded++; sumW += g.words; sumS += g.sentences; sumSyl += g.syl;
      if (g.fk <= 8) status = 'PASS';
      else if (EXCEPTIONS[id]) status = `EXCEPTION - ${EXCEPTIONS[id]}`;
      else { status = 'FAIL'; fails++; }
    }
    console.log(`${id.padEnd(18)} grade ${g.fk.toFixed(1).padStart(5)}  words ${String(g.words).padStart(2)}  ${status}`);
  }
}
const overall = 0.39 * (sumW / sumS) + 11.8 * (sumSyl / sumW) - 15.59;
console.log(`\n${graded} lines graded, ${fails} failing. Overall grade across graded lines: ${overall.toFixed(1)}`);
process.exit(fails ? 1 : 0);
