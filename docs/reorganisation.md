# Temporary EcoCut reorganisation plan

**Goal:** make one story easy to specify, build, verify and review from start to finish. Use GitHub for planning and code. Use the [docs index](README.md) as the wiki. Remove this plan after the first branch has gone through review and the live board owns the remaining work.

## Implemented on this branch

- Added project skills under `.agents/skills/`. Each has one job, an upstream source pinned to the reviewed revision, and EcoCut-specific instructions.
- Established the [branch and commit handoff](team-workflow.md). The current branch is the first real exercise of the branch and handoff rules.
- Brought the existing local product, engineering and architecture drafts into this isolated branch. Added the read-only customer communication requirement, a customer-save decision diagram, and routing for current versus historical documentation.
- Prepared the board structure and first ranked stories below. The GitHub issue connector can access issues, but the available browser session is signed out of Projects. The board and iterations are **pending online setup**.

## Which skill to use

| When | Skill | Result |
| --- | --- | --- |
| Start a story | start-branch | Correct base, named branch, existing edits protected |
| Explain progress | plain-updates | Short update with the decision or check that matters |
| Agree a change | write-spec | Operator outcome and testable examples |
| Choose the next work | plan-sprint | Ranked stories with parent and blocker IDs |
| Trace a defect | debug-workflow | First failing boundary and a repeatable check |
| Verify a change | check-change | Smallest meaningful real check and its limits |
| Review code | review-change | Findings against the actual diff and story |
| Keep the wiki current | maintain-guides | Correct guide, flow diagram or decision updated |
| Finish the task | commit-plan | One ordered list of subjects and paths or hunks |
| Finish the branch | pr-draft | Paste-ready PR title and body |

## GitHub Project setup

Use a private project called **EcoCut development**, linked to the existing repo. Reuse a matching project if one exists. Create a backlog table sorted by rank, a current-iteration board grouped by status, and a blocked view. Use status (Backlog, Ready, Doing, Review, Done), numeric rank, iteration and size. A blocked story names its blocker. Start with one-week iterations and choose scope by capacity.

Use an issue for an epic, a child issue for a story, and a checklist for its tasks. Search by existing ID before creating anything. After setup, read back the parent, iteration and status of one sample story. Replace the temporary queue only after checking the count and links.

## First ranked stories

| Rank / sprint | Epic and story | Tasks and acceptance | Depends on |
| --- | --- | --- | --- |
| 1 / 0 | E0 Resume work · S01 reconcile local baseline | Owner identifies which Desktop changes and local commit belong together. Compare both worktrees before integration. | Owner's active rebase |
| 2 / 0 | E0 · S03 document read-only history | Record the decision and replace outbound rollout goals. Wording distinguishes current code from the approved target. Draft delivered here. | Ready for owner review |
| 3 / 0 | E0 · S02 prove the local pilot journey | Use temporary data. Save a client, assign a crew, refresh and find the same job. Capture the commands and result. | S01 |
| 4 / 1 | E1 Read-only communications · S11 stop all outbound delivery | Trace replies, broadcast, test sends and queued work after restart. Verify zero transport calls with a fake provider. | S03 |
| 5 / 1 | E1 · S12 show history only | Remove sending actions. Verify search, thread reading and client links on desktop and mobile. | S11 |
| 6 / 2 | E2 Pilot access · PROD-3 enforce operator roles | Agree the role matrix. Verify allowed and denied API access independently of the browser. | Pilot roles agreed under PROD-1 |
| 7 / 3 | E3 Recovery · PROD-4 restore business records | Agree recovery targets, restore all stores in a fresh environment, verify cross-store links. | PROD-1, DATA-2 |
| 8 / 4 | E4 Online pilot · PROD-5 rehearse release | Measure a small VM, verify persistent storage, rollback and provider fallbacks. Choose release promotion with owner. | PROD-2, PROD-3, PROD-4 |

## Trial and removal

This rollout changes how we develop the app. Product stories S11 onward are future implementation work. For the first branch, check a dirty checkout, one full-task commit plan and a readable PR draft. For the first runtime story, try the spec, review and verification skills on its real diff. Tune only what causes friction. Add framework or hosting skills when their first actual story supplies a useful example.

When board links, owner review and the first runtime trial are recorded, delete this file and its temporary pointer from the docs index. The team rules and skills are permanent.
