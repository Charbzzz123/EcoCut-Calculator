---
name: start-branch
description: Create and name a branch for a new EcoCut story or isolate work from an active checkout.
---

# start branch

Check `git status --short --branch`, the full `git status`, and `git worktree list`. Identify the intended base and local-only commits. Continue on the current story branch when appropriate. For new feature work use local `DEV` and the naming rules in the team workflow. If a rebase or unrelated changes occupy the checkout, create a sibling worktree from the verified base. Record the branch and worktree path. Never clean, stash or resolve someone else’s work as setup.


[Upstream workflow](https://github.com/github/awesome-copilot/blob/93fc8b9ee3ef56b9b5e7261e6ce92d314cb2c1cf/skills/conventional-branch/SKILL.md) · [EcoCut team workflow](../../../docs/team-workflow.md)
