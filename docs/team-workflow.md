# Working with the EcoCut owner

## During a task

Use short, natural English. State the result, evidence and next decision. Technical names matter when they help the owner find a file, understand a failure or approve a change.

Codex names and creates a branch using the [engineering workflow](engineering-workflow.md). Finish the whole authorized task and verify the result before the commit handoff. A commit boundary is a way to organise the finished work. It does not interrupt implementation.

## One handoff

1. State the branch and its intended base. List what changed and the checks actually run.
2. Present the commits in dependency order. For each, give the exact conventional subject and file paths. Identify the specific hunks for mixed files. Keep each change coherent with its matching tests.
3. Give one PR title and a ready-to-paste description covering the operator outcome, verification and follow-up.
4. The owner can stage and commit, or explicitly approve the proposed batch for Codex. Approval covers those subjects and changes only. Use the configured identity and subject-only messages, with no co-author or other trailer. Verify the committed messages and remaining diff. Push, PR publication and merge are separate actions.

The owner will decide how to promote DEV to main before release.

## Planning and documentation

Use a private GitHub Project for live planning once connected. Keep one backlog. During migration retain the existing tracker IDs, then replace its active queue with a board link after comparing the imported items. Use repository Markdown for the wiki. The [docs index](README.md) identifies each guide.

A decision stays active while it governs the application. On replacement, remove the obsolete text from active guidance and move its dated record under `docs/history/`. Link to the new decision from the history index. Create the archive when there is a record to move.
