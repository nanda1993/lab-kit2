# Reference runs

Every folder here is a real Claude Code run on this repo, recorded on 4 Oct 2026 with Claude
Code 2.1 and its default model. Your agent's wording and details will differ. The shape of the
result is what to compare.

| Folder | Step | What's in it |
|---|---|---|
| `step2-no-context/` | 2 | Push channel with **no** CLAUDE.md: the files, the agent's summary, the convention check (2 findings) |
| `step3-context-files/` | 3 | The reference `CLAUDE.md` and `.claude/settings.json`, plus `CLAUDE.agent-draft.md`, the draft the agent wrote from the slide's prompt |
| `step4-with-context/` | 4 | Same task **with** CLAUDE.md: the plan it stopped to show, the files, 0 findings |
| `step5-plan/` | 5 | The Planner's `docs/plans/BILL-157.md` for the SMS channel |
| `step6-implement/` | 6 | The SMS implementation, with the route test that breaks left broken |
| `step7-close-loop/` | 7 | The test fix and the lesson added to CLAUDE.md, with the agent's own rule for comparison |
| `step8-review/` | 8 | A fresh session's independent review of the whole branch |
| `demo-rate-limit/` | demo | The trainer's slide 32 demo: plan mode output and the implementation |

`node ../tools/catch-up.js <step>` applies these to your repo. You never need to copy files by hand.
