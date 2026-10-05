# DD2 Lab Kit — Agentic Coding Workflow & Context Files
**PwC Full-Stack AI track · Mon 5 Oct 2026 · 08:00–11:00**

You'll work in **billing-notify**, a small telecom billing-notifications service for a fictional
operator, Kestrel Mobile. A coding agent (Claude Code) adds a push channel without any context
file, then again with one, and then builds an SMS channel through the full
Planner → Implementer → Tester → Reviewer loop.

## Setup (5 minutes)

```bash
cd lab-kit
bash setup.sh            # creates ~/dd2/billing-notify with its git history
cd ~/dd2/billing-notify
npm test                 # 21 passing
claude --version         # Claude Code installed?
```

**No npm packages are installed, ever.** The service, the tests and the tools use only Node's
standard library, so a corporate proxy can't block the lab. You need **git**, **Node 20+**, and
**Claude Code** for the agent steps.

**No working Claude Code on the day?** You can still do every step. `node ../tools/catch-up.js <step>`
puts your repo where it would be after that step, using a real recorded run (see `reference/`).

## Fresh Linux VM

Ubuntu or Debian:

```bash
sudo apt-get update && sudo apt-get install -y git curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version           # v20.x or newer
```

RHEL, Rocky or Alma 9: `sudo dnf module install -y nodejs:20 && sudo dnf install -y git`

No sudo? Use nvm instead:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc && nvm install 20
```

**Claude Code**, without sudo (pick one):

```bash
curl -fsSL https://claude.ai/install.sh | bash           # native installer, goes in ~/.local/bin
# or
npm config set prefix ~/.npm-global && export PATH=~/.npm-global/bin:$PATH
npm install -g @anthropic-ai/claude-code
```

Then run `claude` once and sign in the way your engagement has set up. Behind a proxy, set
`HTTPS_PROXY` first. `claude doctor` checks the install.

The first time you run `claude` inside `billing-notify` it asks whether you trust the folder.
Say yes. Until you do, the project's `.claude/settings.json` allow-rules are ignored.

## Commands you'll use

Run these from inside `~/dd2/billing-notify`:

| Command | What it does |
|---|---|
| `npm test` | The service's test suite (Node's built-in runner) |
| `npm test -- --coverage` | Same, with a coverage table |
| `node ../tools/check-conventions.js` | Checks your uncommitted changes against the team's rules (R1–R10) |
| `node ../tools/check-conventions.js --since main` | Same, for everything on your branch since `main` |
| `node ../tools/check-scope.js docs/plans/BILL-157.md` | Did the change touch only the files the plan named? |
| `node ../tools/catch-up.js step4` | Jump to the end of a step (your work is backed up first) |

The tools live **outside** the repo on purpose, so the agent doesn't find them and learn the rules
from them. In the lab, the rules have to come from the context file.

## Layout

```
lab-kit/
  setup.sh                     creates ~/dd2/{billing-notify,tools,reference}
  template/billing-notify/     the service (setup.sh copies it and builds its git history)
  tools/                       check-conventions.js · check-scope.js · catch-up.js
  reference/                   real Claude Code runs for every step, plus the reference CLAUDE.md

~/dd2/billing-notify/
  CLAUDE.md                    ← you write this in Step 3
  .claude/settings.json        ← agent permissions, also Step 3
  src/channels/                email (legacy) · inapp (legacy) · push and sms come later
  src/lib/                     AppError · withRetry · maskRecipient · redis · http router
  docs/tickets/                BILL-142 push · BILL-157 SMS · BILL-163, BILL-171 take-home
  migrations/                  001, 002 are applied: never edit them
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `$'\r': command not found` from setup.sh | The kit passed through Windows. `sed -i 's/\r$//' setup.sh` |
| `Permission denied` on setup.sh | Use `bash setup.sh` |
| `already exists` | `bash setup.sh --reset` (old copy is kept as a backup) |
| `EACCES` on `npm install -g` | Use the native installer or the npm prefix lines above. Don't use sudo. |
| `Unknown git ref "main"` | You're not in `~/dd2/billing-notify`, or the repo was made by hand. Re-run setup. |
| Agent ignores `CLAUDE.md` | Is it committed at the repo root? Did you start `claude` inside the repo? Run `/memory` in Claude Code to see what it loaded. |
