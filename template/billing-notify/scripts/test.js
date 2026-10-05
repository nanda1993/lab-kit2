#!/usr/bin/env node
// Test entry point: runs every *.test.js under tests/ with Node's built-in runner.
//   npm test                    → whole suite
//   npm test -- tests/channels  → one folder or file
//   npm test -- --coverage      → with a coverage report
// `node --test <folder>` stopped discovering tests inside a folder in Node 22, so
// this script expands folders into file lists itself.
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const walk = dir => readdirSync(dir).sort().flatMap(entry => {
  const p = join(dir, entry);
  return statSync(p).isDirectory() ? walk(p) : (p.endsWith('.test.js') ? [p] : []);
});

const args = process.argv.slice(2);
const coverage = args.includes('--coverage');
const targets = args.filter(a => !a.startsWith('--'));
const files = (targets.length ? targets : ['tests']).flatMap(t => {
  if (!existsSync(t)) { console.error(`no such path: ${t}`); process.exit(1); }
  return statSync(t).isDirectory() ? walk(t) : [t];
});
if (!files.length) { console.error('no *.test.js files found'); process.exit(1); }

const nodeArgs = ['--test', ...(coverage ? ['--experimental-test-coverage'] : []), ...files];
process.exit(spawnSync(process.execPath, nodeArgs, { stdio: 'inherit', env: { ...process.env, LOG_LEVEL: 'silent' } }).status ?? 1);
