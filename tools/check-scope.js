#!/usr/bin/env node
// The Reviewer's first question: did the change touch the files the plan said it would?
//
//   node ../tools/check-scope.js docs/plans/BILL-157.md               uncommitted changes vs the plan
//   node ../tools/check-scope.js docs/plans/BILL-157.md --since main  everything on this branch vs the plan
//
// A file is "in the plan" if its path appears anywhere in the plan file.
// Exit code 1 when files were changed that the plan never mentioned.
import { readFileSync, existsSync } from 'node:fs';
import { assertRepo, changedFiles, argValue } from './git-changes.js';

assertRepo();
const planPath = process.argv[2];
if (!planPath || planPath.startsWith('--') || !existsSync(planPath)) {
  console.error('Usage: node ../tools/check-scope.js <plan-file> [--since <ref>]');
  process.exit(2);
}
const since = argValue('since', 'HEAD');
const plan = readFileSync(planPath, 'utf8');
const planned = new Set(
  [...plan.matchAll(/(?:^|[\s`'"(\[])((?:src|config|tests|migrations|docs|scripts|\.github|\.claude)\/[\w./-]+\.\w+|CLAUDE\.md|package\.json|README\.md)/gm)]
    .map(m => m[1].replace(/[.,;:)]+$/, '')),
);
const changes = changedFiles(since);
const touched = [...changes.keys()].filter(p => p !== planPath);

const inPlan = touched.filter(p => planned.has(p));
const creep = touched.filter(p => !planned.has(p));
const missed = [...planned].filter(p => !changes.has(p) && p !== planPath);

console.log(`\nScope check · plan ${planPath} · ${since === 'HEAD' ? 'uncommitted changes' : `changes since ${since}`}\n`);
console.log(`  Planned and changed (${inPlan.length})`);
inPlan.forEach(p => console.log(`    ✓ ${p}`));
console.log(`\n  Changed but NOT in the plan (${creep.length})${creep.length ? '  ← scope creep: was each one agreed?' : ''}`);
creep.forEach(p => console.log(`    ⚠ ${p}`));
console.log(`\n  Mentioned in the plan but not changed (${missed.length})${missed.length ? '  ← reference only, or dropped?' : ''}`);
missed.forEach(p => console.log(`    · ${p}`));
console.log('');
process.exit(creep.length ? 1 : 0);
