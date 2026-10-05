#!/usr/bin/env node
// Fell behind, or Claude Code isn't working on your machine? This puts your repo into
// the state it would be in after a given step, using the reference run in ../reference/.
//
//   node ../tools/catch-up.js step4
//
// Steps: step2 step3 step4 step5 step6 step7 step8
// Your current work is kept first: uncommitted changes are stashed and your current
// commit gets a backup/<time> branch, so nothing is lost.
import { execFileSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REF = join(dirname(fileURLToPath(import.meta.url)), '..', 'reference');
const STEPS = ['step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8'];
const target = process.argv[2];
if (!STEPS.includes(target)) {
  console.error(`Usage: node ../tools/catch-up.js <${STEPS.join('|')}>`);
  process.exit(2);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
try { git('rev-parse', '--verify', '--quiet', 'baseline'); }
catch { console.error('Run this from inside ~/dd2/billing-notify (the repo setup.sh created).'); process.exit(2); }

const apply = dir => cpSync(join(REF, dir), '.', { recursive: true });
const commit = msg => { git('add', '-A'); git('commit', '-q', '-m', msg); };
const reached = step => STEPS.indexOf(target) >= STEPS.indexOf(step);

// ── keep the learner's work ──────────────────────────────────────────────────
const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
const dirty = git('status', '--porcelain') !== '';
if (dirty) git('stash', 'push', '-u', '-q', '-m', `catch-up ${target} ${stamp}`);
const existing = new Set(git('branch', '--format=%(refname:short)').split('\n'));
let backup = `backup/${stamp}`;
for (let n = 2; existing.has(backup); n++) backup = `backup/${stamp}-${n}`;
git('branch', backup);
console.log(`\nYour previous work is on branch ${backup}${dirty ? ' (uncommitted changes are in git stash list)' : ''}.`);

// ── rebuild from baseline ────────────────────────────────────────────────────
git('checkout', '-q', '-f', '-B', 'main', 'baseline');
git('clean', '-fdq');

// Step 2: the push channel written without any context file, on its own branch.
git('checkout', '-q', '-B', 'attempt/no-context', 'main');
apply('step2-no-context/files');
commit('feat(channels): add push channel, no-context attempt [BILL-142]');
if (target !== 'step2') git('checkout', '-q', 'main');

if (reached('step3')) {
  cpSync(join(REF, 'step3-context-files/CLAUDE.md'), 'CLAUDE.md');
  cpSync(join(REF, 'step3-context-files/.claude'), '.claude', { recursive: true });
  commit('docs(repo): add CLAUDE.md and agent permissions [BILL-170]');
}
if (reached('step4')) {
  git('checkout', '-q', '-B', 'attempt/with-context', 'main');
  apply('step4-with-context/files');
  commit('feat(channels): add push channel [BILL-142]');
}
if (reached('step5')) {
  git('checkout', '-q', 'main');
  git('merge', '-q', '--ff-only', 'attempt/with-context');
  git('checkout', '-q', '-B', 'feat/BILL-157-sms', 'main');
  apply('step5-plan/files');
}
if (reached('step6')) apply('step6-implement/files');
if (reached('step7')) {
  cpSync(join(REF, 'step7-close-loop/files/tests'), 'tests', { recursive: true });
  // feature first, then the CLAUDE.md lesson as its own commit
  git('add', '-A', '--', '.', ':!CLAUDE.md');
  git('commit', '-q', '-m', 'feat(channels): add sms channel with retry and segment logging [BILL-157]');
  cpSync(join(REF, 'step7-close-loop/files/CLAUDE.md'), 'CLAUDE.md');
  commit('docs(claude): invalid-input tests use values that can never become valid [BILL-157]');
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const notes = {
  step2: 'Compare with: node ../tools/check-conventions.js --since main',
  step3: 'Read CLAUDE.md and .claude/settings.json. The agent\'s own draft is ../reference/step3-context-files/CLAUDE.agent-draft.md',
  step4: 'Compare: git diff attempt/no-context attempt/with-context -- src/',
  step5: 'Read docs/plans/BILL-157.md',
  step6: 'Run npm test: one route test fails. That is Step 7.',
  step7: 'Run: node ../tools/check-conventions.js --since main',
  step8: 'Review with: git diff main...HEAD   (reference review: ../reference/step8-review/review.md)',
};
console.log(`Repo is now at the end of ${target}, on branch ${branch}.`);
console.log(`Next: ${notes[target]}\n`);
