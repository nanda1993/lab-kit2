// Shared helper: which files changed between a git ref and the working tree,
// including files that are new and not yet committed.
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function assertRepo() {
  try { git('rev-parse', '--is-inside-work-tree'); }
  catch { console.error('Run this from inside the billing-notify repo (cd ~/dd2/billing-notify).'); process.exit(2); }
}

export function changedFiles(ref = 'HEAD') {
  try { git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`); }
  catch { console.error(`Unknown git ref "${ref}". Try: git log --oneline`); process.exit(2); }
  const files = new Map();
  const diff = git('diff', '--name-status', '--no-renames', ref);
  for (const line of diff.split('\n').filter(Boolean)) {
    const [status, path] = line.split('\t');
    files.set(path, status[0]);
  }
  const untracked = git('ls-files', '--others', '--exclude-standard');
  for (const path of untracked.split('\n').filter(Boolean)) files.set(path, 'A');
  return files; // path -> 'A' | 'M' | 'D'
}

export function commitsSince(ref) {
  const out = git('log', '--format=%s', `${ref}..HEAD`);
  return out.split('\n').filter(Boolean);
}

export function argValue(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
