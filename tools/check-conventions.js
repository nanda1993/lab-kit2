#!/usr/bin/env node
// Checks the files you changed against billing-notify's team conventions.
// Rule numbers match the Rules section of the reference CLAUDE.md, so every rule a
// reviewer would otherwise have to remember is checked the same way every time.
// Legacy code you didn't touch is not checked.
//
//   node ../tools/check-conventions.js                 changes since the last commit
//   node ../tools/check-conventions.js --since main    changes since a branch or commit
//
// Exit code 1 when anything is flagged, so it can run in CI.
import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { assertRepo, changedFiles, commitsSince, argValue } from './git-changes.js';

assertRepo();
const since = argValue('since', 'HEAD');
const changes = changedFiles(since);
const read = p => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const RULES = {
  R1: 'Errors are AppError with a registered code, never a raw Error',
  R2: 'Provider 404/410 raises RECIPIENT_GONE',
  R3: 'Retries go through withRetry(), no hand-rolled loops or setTimeout',
  R4: 'Logs go through the injected logger, recipients masked',
  R5: 'A channel is registered, configured and tested',
  R6: 'Files where the file map says, kebab-case, process.env only in config/',
  R7: 'Tests use the shared fakes, no real timers',
  R8: 'Only what the ticket needs: README, package.json, .github/, docs/ untouched',
  R9: 'Applied migrations are never edited',
  R10: 'Commit messages: type(scope): summary [BILL-123]',
};

const findings = [];
const flag = (rule, where, detail) => findings.push({ rule, where, detail });
// A recipient value passed to a logger call as-is: { to: message.to }, { to }, { recipient: phone } …
const RAW_RECIPIENT = /\b(to|recipient|phone|token|email|number)\s*:\s*(message\.)?(to|recipient|token|phone|number|email)\b|[{,]\s*(to|recipient|token|phone|number|email)\s*[,}]|message\.to\b/;
const registered = new Set([...read('src/lib/error-codes.js').matchAll(/^\s+([A-Z_]+):/gm)].map(m => m[1]));

const live = [...changes].filter(([, s]) => s !== 'D').map(([p]) => p);
const jsFiles = live.filter(p => p.endsWith('.js'));

for (const file of jsFiles) {
  const src = read(file);
  const inSrc = file.startsWith('src/');
  const inTests = file.startsWith('tests/');

  src.split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    const code = line.replace(/\/\/.*$/, '');
    if (inSrc && /new\s+(Error|TypeError|RangeError)\s*\(/.test(code) && !file.endsWith('app-error.js'))
      flag('R1', at, code.trim());
    for (const m of code.matchAll(/new\s+AppError\(\s*['"`]([A-Z_]+)['"`]/g))
      if (!registered.has(m[1])) flag('R1', at, `code "${m[1]}" is not in src/lib/error-codes.js`);
    if (inSrc && /\bsetTimeout\s*\(/.test(code) && file !== 'src/lib/retry.js') flag('R3', at, code.trim());
    if (inSrc && /\bconsole\.(log|info|warn|error|debug)\s*\(/.test(code)) flag('R4', at, code.trim());
    if (inSrc && /logger\.(info|warn|error|debug)\s*\(/.test(code) && RAW_RECIPIENT.test(code) && !/mask/i.test(code))
      flag('R4', at, `recipient logged unmasked: ${code.trim()}`);
    if (/\bprocess\.env\b/.test(code) && !file.startsWith('config/') && !file.startsWith('scripts/'))
      flag('R6', at, code.trim());
    if (inTests && /\bsetTimeout\s*\(/.test(code)) flag('R7', at, code.trim());
  });

  if (inSrc && /\b(attempt|retries|retry)\b/i.test(src) && /\b(for|while)\s*\(/.test(src) &&
      !/withRetry/.test(src) && file !== 'src/lib/retry.js')
    flag('R3', file, 'looks like a hand-rolled retry loop; use withRetry() from src/lib/retry.js');

  if (inSrc || inTests || file.startsWith('config/')) {
    const name = basename(file);
    const dir = dirname(file);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z]+)*\.js$/.test(name)) flag('R6', file, 'file name is not kebab-case');
    if (dir === 'src/channels' && name !== 'index.js' && !name.endsWith('.channel.js')) flag('R6', file, 'channel files end in .channel.js');
    if (dir === 'src/routes' && !name.endsWith('.routes.js')) flag('R6', file, 'route files end in .routes.js');
    if (dir === 'src/services' && name !== 'templates.js' && !name.endsWith('.service.js')) flag('R6', file, 'service files end in .service.js');
    if (dir === 'src/providers' && name !== 'index.js' && !name.endsWith('-provider.js')) flag('R6', file, 'provider files end in -provider.js');
    if (inTests && dir !== 'tests/helpers' && !name.endsWith('.test.js')) flag('R6', file, 'test files end in .test.js');
    if (inSrc && !dir.startsWith('src/channels') && /channel/i.test(name)) flag('R6', file, 'channels live in src/channels/<name>.channel.js');
  }
}

// R2 + R5 — every channel you added or changed is wired up and handles dead recipients.
for (const file of live.filter(p => /^src\/channels\/.+\.channel\.js$/.test(p))) {
  const name = basename(file, '.channel.js');
  const src = read(file);
  if (/fromProviderError|statusCode/.test(src) && !/RECIPIENT_GONE/.test(src + read('src/lib/provider-error.js')))
    flag('R2', file, 'a provider 404/410 should raise RECIPIENT_GONE (CRM sync purges dead tokens/numbers)');
  if (!read('src/channels/index.js').includes(`./${name}.channel.js`)) flag('R5', file, 'not imported in src/channels/index.js');
  if (!new RegExp(`\\b${name}\\s*:`).test(read('config/channels.js'))) flag('R5', file, `no "${name}" entry in config/channels.js`);
  if (!existsSync(`tests/channels/${name}.channel.test.js`)) flag('R5', file, `no tests/channels/${name}.channel.test.js`);
}

// R8 — files a feature ticket shouldn't need.
for (const file of live)
  if (['README.md', 'package.json', 'package-lock.json'].includes(file) || file.startsWith('.github/') || (file.startsWith('docs/') && !file.startsWith('docs/plans/')))
    flag('R8', file, 'outside the ticket\'s scope unless the ticket asked for it');

// R9 — migrations are append-only.
for (const [file, status] of changes)
  if (file.startsWith('migrations/') && status !== 'A') flag('R9', file, status === 'D' ? 'deleted an applied migration' : 'edited an applied migration; add a new numbered file instead');

// R10 — commit messages on this branch since --since.
if (since !== 'HEAD') {
  for (const subject of commitsSince(since))
    if (!/^(feat|fix|chore|docs|test|refactor|perf)\([a-z0-9-]+\): .+ \[BILL-\d+\]$/.test(subject))
      flag('R10', 'commit', `"${subject}"`);
}

// ── report ────────────────────────────────────────────────────────────────────
const label = since === 'HEAD' ? 'uncommitted changes' : `changes since ${since}`;
console.log(`\nConvention check · ${live.length} file(s) in ${label}\n`);
if (!live.length) { console.log('  Nothing changed yet.\n'); process.exit(0); }
for (const f of live) console.log(`  ${changes.get(f) === 'A' ? '+' : '~'} ${f}`);
console.log('');
const byRule = findings.reduce((acc, f) => ((acc[f.rule] ||= []).push(f), acc), {});
for (const [id, text] of Object.entries(RULES)) {
  const hits = byRule[id] || [];
  console.log(`  ${hits.length ? '✗' : '✓'} ${id.padEnd(3)} ${text}`);
  for (const h of hits) console.log(`        ${h.where}  ${h.detail.slice(0, 110)}`);
}
console.log(`\n  ${findings.length ? `${findings.length} finding(s) across ${Object.keys(byRule).length} rule(s)` : 'No findings.'}\n`);
process.exit(findings.length ? 1 : 0);
