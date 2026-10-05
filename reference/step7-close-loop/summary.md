# Step 7 — closing the loop

## What the agent did when asked to commit and add a rule

I couldn't make either commit. `git add` for the BILL-157 files worked, but the `git commit` call was denied with "Claude requested permissions to use Bash, but you haven't granted it yet." I haven't tried another route around that.

**Current state**
- The eight BILL-157 files are staged (the plan, config, channel, registry, dispatch service, migration, and both test files).
- The CLAUDE.md edit is in the working tree and not staged, so it will stay out of the first commit.
- Nothing is committed. `HEAD` is still `9af7fbf feat(channels): add push channel [BILL-142]`.

**The CLAUDE.md rule I added** is rule 11 in the numbered Rules section, after the commit-format rule:

> 11. Before registering a new channel, run `grep -rn "'<name>'" tests/`. Any test that uses the new channel's name as an "unknown channel" example must switch to a name that is not a channel (e.g. `carrier-pigeon`) in the same change.

It is checkable because the grep either finds a test or it doesn't. It would have caught the failure I hit, where the routes test used `sms` as its unsupported-channel example. I appended it as 11 so no existing rule numbers change.

**Messages I intended to use**
1. `feat(channels): add sms channel with retry and segment logging [BILL-157]`
2. `docs(claude): require unknown-channel tests to stop using new channel names [BILL-157]`

If you grant Bash commit permission, I'll run the first commit with the files already staged. Then I'll stage `CLAUDE.md` and make the second commit. Or you can run the commits yourself with those messages.

Note: `git commit` is an **ask** rule in `.claude/settings.json`, so the agent stopped and asked. That is the permission file working. In an interactive session you get a prompt and approve it.

## The rule the agent wrote vs the reference rule

Agent's rule 11 (a procedure to follow at one moment):

```text
11. Before registering a new channel, run `grep -rn "'<name>'" tests/`. Any test that uses the new
    channel's name as an "unknown channel" example must switch to a name that is not a channel
    (e.g. `carrier-pigeon`) in the same change.

```

Reference rule, added to rule 7 (a property every test must have):

```text
7. Tests use `node:test` and `node:assert/strict`, and the fakes in `tests/helpers/fakes.js`
   (`createTestDeps`, fake `sleep`). No real timers, no network.
   Invalid-input tests use values that can never become valid (`carrier-pigeon`, `not-a-token`),
   never a channel, template or code that is on the backlog. (Learned on BILL-157: a test used `sms`
   as its "unknown channel" and broke the day SMS shipped.)
```

Both would have caught it. The reference version is checkable in review and covers templates and codes too, not just channels.
