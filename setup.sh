#!/usr/bin/env bash
# DD2 lab setup. Creates the billing-notify repo (with its git history) in ~/dd2.
#   ./setup.sh            first-time setup
#   ./setup.sh --reset    start again from a clean repo (your old one is kept as a backup)
#   DD2_HOME=~/dd2-demo ./setup.sh    a second copy, e.g. for the trainer's live demo
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DD2_HOME="${DD2_HOME:-$HOME/dd2}"
REPO="$DD2_HOME/billing-notify"
RESET=0
[[ "${1:-}" == "--reset" ]] && RESET=1

ok()   { printf '  \033[32m✔\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
die()  { printf '  \033[31m✘\033[0m %s\n' "$1"; exit 1; }

echo
echo "DD2 lab setup → $DD2_HOME"
echo

# ── prerequisites ──────────────────────────────────────────────────────────────
command -v git >/dev/null || die "git not found. Install it: sudo apt-get install -y git"
command -v node >/dev/null || die "Node.js not found. Install Node 20+ (see README: 'Fresh Linux VM')."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
(( NODE_MAJOR >= 20 )) || die "Node $(node --version) is too old. Need 20 or newer (see README)."
ok "git $(git --version | awk '{print $3}') · node $(node --version)"
if command -v claude >/dev/null; then
  ok "Claude Code $(claude --version 2>/dev/null | head -1)"
else
  warn "Claude Code not found. Install it before the lab: npm install -g @anthropic-ai/claude-code"
  warn "(You can still follow every step with: node ../tools/catch-up.js <step>)"
fi

# ── workspace ─────────────────────────────────────────────────────────────────
mkdir -p "$DD2_HOME"
if [[ -e "$REPO" ]]; then
  if (( RESET )); then
    BACKUP="$REPO.backup-$(date +%Y%m%d-%H%M%S)"
    mv "$REPO" "$BACKUP"
    ok "old repo moved to $BACKUP"
  else
    die "$REPO already exists. Run ./setup.sh --reset to start again (your old copy is kept)."
  fi
fi
rm -rf "$DD2_HOME/tools" "$DD2_HOME/reference"
cp -R "$KIT_DIR/tools" "$DD2_HOME/tools"
cp -R "$KIT_DIR/reference" "$DD2_HOME/reference"
cp -R "$KIT_DIR/template/billing-notify" "$REPO"
ok "copied repo, tools and reference into $DD2_HOME"

# ── git history (so the agent, and you, can read how the team commits) ─────────
cd "$REPO"
git init -q
git symbolic-ref HEAD refs/heads/main
git config user.name  >/dev/null || git config user.name  "DD2 Learner"
git config user.email >/dev/null || git config user.email "learner@dd2.local"
git config core.autocrlf false

commit() { # commit "<author>" "<date>" "<message>" paths...
  local who="$1" when="$2" msg="$3"; shift 3
  git add -- "$@"
  GIT_AUTHOR_NAME="$who" GIT_AUTHOR_EMAIL="$(echo "$who" | tr 'A-Z ' 'a-z.')@kestrel.example" \
  GIT_COMMITTER_NAME="$who" GIT_COMMITTER_EMAIL="$(echo "$who" | tr 'A-Z ' 'a-z.')@kestrel.example" \
  GIT_AUTHOR_DATE="$when" GIT_COMMITTER_DATE="$when" \
    git commit -q -m "$msg"
}

commit "Priya Nair"   "2026-02-09T10:12:00+05:30" "chore(repo): scaffold billing-notify service [BILL-101]" \
  package.json README.md .gitignore .env.example scripts .github config \
  src/app.js src/server.js src/lib/http.js src/lib/logger.js src/lib/store.js src/providers \
  src/services/templates.js src/routes src/middleware tests/helpers migrations/001_create_notification_log.sql
commit "Arjun Mehta"  "2026-02-23T16:40:00+05:30" "feat(channels): add in-app inbox channel [BILL-108]" \
  src/channels/inapp.channel.js tests/channels/inapp.channel.test.js
commit "Meera Iyer"   "2026-03-10T14:22:00+05:30" "feat(channels): add email channel with retry [BILL-112]" \
  src/channels/email.channel.js src/channels/index.js tests/channels/email.channel.test.js
commit "Priya Nair"   "2026-04-14T11:05:00+05:30" "feat(errors): add AppError, error-code registry, withRetry and maskRecipient for new code [BILL-121]" \
  src/lib/app-error.js src/lib/error-codes.js src/lib/provider-error.js src/lib/retry.js src/lib/mask.js \
  tests/lib/app-error.test.js tests/lib/retry.test.js tests/lib/mask.test.js
commit "Arjun Mehta"  "2026-06-18T09:48:00+05:30" "feat(dispatch): de-duplicate dispatches on dedupeKey via Redis [BILL-134]" \
  src/lib/redis.js src/services/dispatch.service.js migrations/002_add_account_id.sql \
  tests/lib/redis.test.js tests/routes
commit "Meera Iyer"   "2026-09-29T17:30:00+05:30" "docs(tickets): add channel backlog BILL-142, BILL-157, BILL-163, BILL-171 [BILL-140]" \
  docs
if [[ -n "$(git status --porcelain)" ]]; then
  commit "Priya Nair" "2026-09-30T09:00:00+05:30" "chore(repo): tidy [BILL-101]" .
fi
git tag baseline
ok "git repo with $(git rev-list --count HEAD) commits, tagged 'baseline'"

# A local .env with fake secrets. It is gitignored; Step 3's permission rules keep the agent out of it.
cat > .env <<'ENV'
PORT=3000
LOG_LEVEL=info
API_KEYS=dev-key-billing,dev-key-collections
SMS_AGGREGATOR_API_KEY=sk_live_FAKE_7f3a9c_DO_NOT_SHARE
PUSH_GATEWAY_SECRET=pg_FAKE_d41d8cd98f00
ENV
ok "wrote a local .env with fake secrets (gitignored)"

# ── baseline test run ─────────────────────────────────────────────────────────
if OUT="$(node scripts/test.js 2>&1)"; then
  PASS="$(printf '%s\n' "$OUT" | grep -Eo '^(# |ℹ )pass [0-9]+' | grep -Eo '[0-9]+' | tail -1)"
  ok "baseline tests green: ${PASS:-all} passing"
else
  printf '%s\n' "$OUT" | tail -20
  die "baseline tests failed. Paste the lines above into the chat."
fi

cat <<NEXT

  Ready. Next:
    cd $REPO
    npm test
    claude            # start Claude Code here when the trainer says so

NEXT
