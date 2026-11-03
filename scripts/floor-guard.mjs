#!/usr/bin/env node
// floor-guard: diff-scoped enforcement of the CONSTRAINTS.md floor.
// Usage: node scripts/floor-guard.mjs [--base <ref>]   (default base: main)
// Exit: 0 clean, 1 floor violation, 2 could not run.
import { collectDiff } from './lib/diff.mjs';

const diff = collectDiff();
if (!diff) {
  console.error('floor-guard: not a git repo or no merge base; cannot check');
  process.exit(2);
}

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SELF = /^scripts\/(floor-guard\.mjs|lib\/)/;
const TEST = /\.(test|spec)\.(ts|tsx)$/;

const SUPPRESSIONS =
  /@ts-ignore|@ts-nocheck|@ts-expect-error|eslint-disable|istanbul ignore|v8 ignore|c8 ignore|gitleaks:allow/;
const STUBS =
  /throw new Error\(.*[Nn]ot implemented|catch\s*(\(\w*\))?\s*\{\s*\}|\bTODO\b|\bFIXME\b/;
const SKIPS = /\b(it|test|describe)\.(skip|todo|only)\b|\bx(it|describe)\(|\.fixme\(/;
// SPEC › Boundaries: no network calls. The app is offline-only.
const NETWORK = /\bfetch\s*\(|XMLHttpRequest|new WebSocket|sendBeacon|new EventSource/;

const findings = [];
const flag = (rule, file, text) => findings.push({ rule, file, text: text.trim().slice(0, 120) });

for (const { file, text } of diff.added) {
  if (/(^|\/)CONSTRAINTS\.md$/.test(file) && /^\| *W\d+ *\|/.test(text))
    flag('new-exception', file, text);
  if (!CODE.test(file) || SELF.test(file)) continue;
  if (SUPPRESSIONS.test(text)) flag('silenced-checker', file, text);
  if (STUBS.test(text)) flag('unfinished-work', file, text);
  if (SKIPS.test(text)) flag('test-made-easier', file, text);
  if (/^src\//.test(file) && !TEST.test(file) && NETWORK.test(text))
    flag('network-call', file, text);
}

// Assertions removed: flag a test file only when it ends with fewer assertion lines than it had,
// so rewriting an assertion is allowed but stripping one is not (owner decision, 2026-11-03).
const ASSERTION = /\b(expect|assert)\b/;
const assertionDelta = new Map();
for (const { file, text } of diff.added) {
  if (TEST.test(file) && ASSERTION.test(text))
    assertionDelta.set(file, (assertionDelta.get(file) ?? 0) + 1);
}
for (const { file, text } of diff.removed) {
  if (TEST.test(file) && ASSERTION.test(text))
    assertionDelta.set(file, (assertionDelta.get(file) ?? 0) - 1);
}
for (const [file, delta] of assertionDelta) {
  if (delta < 0) flag('assertion-removed', file, `${-delta} fewer assertion line(s)`);
}

// Weakened threshold: a CONSTRAINTS.md line whose leading cell matches but whose numbers went down.
const nums = (s) => (s.match(/\d+(\.\d+)?/g) || []).map(Number);
const key = (s) => s.split(/[|:]/).slice(0, 2).join('|').trim();
const inConstraints = (l) => /(^|\/)CONSTRAINTS\.md$/.test(l.file);
const addedC = diff.added.filter(inConstraints);
for (const r of diff.removed.filter(inConstraints)) {
  const a = addedC.find((x) => key(x.text) === key(r.text));
  const before = nums(r.text);
  if (a && nums(a.text).some((n, i) => before[i] !== undefined && n < before[i])) {
    flag('threshold-lowered', r.file, `${r.text.trim()}  ->  ${a.text.trim()}`);
  } else if (!a && /^- /.test(r.text.trim())) {
    flag('floor-rule-removed', r.file, r.text);
  }
}

if (findings.length === 0) {
  console.log('floor-guard: clean');
  process.exit(0);
}
console.error(`floor-guard: ${findings.length} floor violation(s):`);
for (const f of findings) console.error(`  [${f.rule}] ${f.file}: ${f.text}`);
console.error(
  '\nEach one lowers the bar. Fix the code, or add a tracked exception with an owner and expiry.',
);
process.exit(1);
