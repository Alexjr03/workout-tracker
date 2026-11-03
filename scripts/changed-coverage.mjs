#!/usr/bin/env node
// changed-coverage: share of changed executable lines in src/ covered by the last test run.
// Reads coverage/lcov.info written by `vitest run --coverage`; never re-runs tests.
// Usage: node scripts/changed-coverage.mjs [--base <ref>] [--min 80]
// Exit: 0 pass, 1 below minimum, 2 could not run.
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { collectDiff } from './lib/diff.mjs';

const minArg = process.argv.indexOf('--min');
const MIN = minArg > -1 ? Number(process.argv[minArg + 1]) : 80;
const LCOV = 'coverage/lcov.info';

if (!existsSync(LCOV)) {
  console.error(`changed-coverage: ${LCOV} missing; run vitest with coverage first`);
  process.exit(2);
}
const diff = collectDiff();
if (!diff) {
  console.error('changed-coverage: not a git repo or no merge base; cannot check');
  process.exit(2);
}

// file -> Map(line -> hits)
const hitsByFile = new Map();
let current = null;
for (const raw of readFileSync(LCOV, 'utf8').split(/\r?\n/)) {
  if (raw.startsWith('SF:')) {
    const file = relative(process.cwd(), resolve(raw.slice(3))).replace(/\\/g, '/');
    current = new Map();
    hitsByFile.set(file, current);
  } else if (raw.startsWith('DA:') && current) {
    const [line, hits] = raw.slice(3).split(',').map(Number);
    current.set(line, hits);
  }
}

const isSource = (f) => /^src\/.*\.(ts|tsx)$/.test(f) && !/\.(test|spec)\.tsx?$|\.d\.ts$/.test(f);
let total = 0;
let covered = 0;
const missed = [];
for (const { file, line } of diff.added) {
  if (!isSource(file)) continue;
  const fileHits = hitsByFile.get(file);
  // Vitest reports every file its coverage `include` matches, tested or not (0 hits),
  // so a file missing from lcov was excluded on purpose in vite.config.ts.
  if (!fileHits) continue;
  if (!fileHits.has(line)) continue; // not an executable line
  total += 1;
  if (fileHits.get(line) > 0) covered += 1;
  else missed.push(`${file}:${line}`);
}

if (total === 0) {
  console.log('changed-coverage: no changed executable lines in src/');
  process.exit(0);
}
const pct = (covered / total) * 100;
const summary = `changed-coverage: ${pct.toFixed(1)}% (${covered}/${total}) of changed lines covered, minimum ${MIN}%`;
if (pct >= MIN) {
  console.log(summary);
  process.exit(0);
}
console.error(summary);
console.error('Uncovered changed lines:');
for (const m of missed.slice(0, 40)) console.error(`  ${m}`);
process.exit(1);
