# Engineering workflow

Status: working convention, 2026-10-02. This is intentionally small enough for a one- or two-person development team.

Read the [team workflow](team-workflow.md) for commit approval, PR drafts and documentation upkeep.

## Branches and changes

- `main` is the release line. `DEV` is the current integration branch; keep its uppercase spelling. Verify branch trigger filters against the checkout being released. Decide later whether to retire `DEV` in favor of short-lived branches into protected `main`. Do not silently rename the remote branch.
- Create short-lived branches with lowercase names: `feature/<tracker-id>-slug`, `fix/<tracker-id>-slug`, `docs/<tracker-id>-slug`, or `chore/<tracker-id>-slug`. Example: `feature/ch10-quo-guardrails`.
- Use a work-tracker ID when one exists; otherwise use a short descriptive slug. Keep one cohesive change per PR. Avoid a release branch until release frequency justifies it.
- Merge through a PR after CI and review. A production hotfix starts from `main`, uses `fix/<id>-slug`, and is merged back to the active integration branch if it remains in use.

## Before a PR

1. State the user outcome, acceptance examples, and affected data/provider boundaries.
2. Identify schema, migration, backup, credential, and deployment effects before implementation.
3. Add tests at the lowest useful level; use browser tests for critical journeys and provider contract tests for integrations.
4. Update the primary doc from the [documentation map](README.md) and the [work tracker](work-tracker.md) when scope/status changes.
5. Run the gates relevant to the change. Current CI jobs cover frontend lint/unit/build, server checks, and Playwright. `npm run check:rollout` is not yet the full browser/deployment gate.

## Release path to build

- Protect `main` and the active integration branch with required checks and review. Configure this in GitHub after confirming the repository plan and administrator access.
- CI builds/tests each PR; staging deploy uses the same artifact, migration plan, and environment-specific secrets.
- Production promotion uses a release checklist, backup verification, post-deploy smoke checks, rollback steps, and recorded sign-off. Use GitHub Environments when the available plan supports the desired reviewers and secrets.
- Keep deployment credentials short-lived where the host supports OIDC. Never put production secrets in a PR job.

## Agent guidance

[`AGENTS.md`](../AGENTS.md) holds always-on repository rules for coding agents. A skill should be created only for a repeatable, bounded procedure that needs detailed steps or tools, such as a release readiness audit or a provider cost review. Add that skill after the underlying workflow is agreed and exercised once; otherwise it will encode assumptions that may change.
