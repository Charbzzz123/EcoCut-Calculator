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

## CRM direction

EcoCut and EcoAir will use one app with a company switcher. The [Product Guide](product-brief.md#company-workspaces) holds the approved direction, proposed data rules, and open questions.

The first CRM candidate is the lead-to-completed-job journey. Establish the baseline with sample data, then turn the gaps into stories. Confirm which features the team needs at launch while the baseline review runs. Use the dependency order below to choose sprint scope after the stories are ready.

## First ranked stories

| Rank / sprint | Epic and story | Tasks and acceptance | Depends on |
| --- | --- | --- | --- |
| 1 / 0 | E0 Resume work · S01 reconcile local baseline | Walkthrough baseline approved. Reconciliation of original edits and the rebase remains open. See the review below. | — |
| 2 / 0 | E0 · S02 walk through the CRM with sample data | Complete for desktop with sample data. See the walkthrough results below. | Approved DEV baseline |
| Parallel | PROD-1 define the first release | Agree the customer journey, release scope, roles, company access, and whether any records can be shared. | Owner input |
| After S02 | CRM · Lead to booked job (proposed) | Find a lead, see its owner and next follow-up, and book a job with the lead history intact. | S02, PROD-1 workflow |
| After S02 | CRM · Schedule and complete work (proposed) | Assign or reschedule a job and record completion. Reuse working crew and job flows. | S02, PROD-1 roles; use the lead story for the full journey |
| Parallel | E1 Read-only communications · S03, S11, S12 | Review the documented decision, then disable outbound delivery and remove send actions. Verify history, search, and client links. | S03 before S11; S11 before S12 |
| Before pilot | E2 Pilot access · PROD-3 enforce login and company access | Authorized users switch companies. Direct requests for another company's records are denied without membership. | PROD-1 roles and company rules |
| Before pilot | E3 Recovery · PROD-4 restore business records | Prove backup and restore preserve records, their company ownership, and cross-store links. | PROD-1, DATA-2 |
| Before launch | E4 Online pilot · PROD-5 rehearse release | Verify the agreed CRM journey, provider fallbacks, persistent storage, and rollback in staging. | Core pilot stories, PROD-2, PROD-3, PROD-4 |

After the walkthrough, consider a Today view for overdue follow-ups and jobs needing attention, recurring services, and crew handoff notes, photos, or checklists. Pull quotes, invoices, or payment tracking into the first release if the owner needs them for the daily workflow.

### S01 baseline review

Local `DEV` at `eeefdd4e` contains the end-to-end coverage commit and is the candidate baseline. The reorganisation branch adds documentation and skills on top of it. The original checkout has separate uncommitted edits and an active rebase. A queued rebase commit includes a calendar credential file and generated dependencies. Review the useful changes separately before integrating anything from that rebase. The owner approved this baseline for the sample walkthrough. Reconciliation of the original checkout remains open.

### S02 walkthrough results

Desktop Chromium ran on local DEV at `eeefdd4e` with temporary SQLite files and mocked Calendar. Seven existing tests passed across Entries and Clients, Linked Job, and Jobs. A separate same-customer Playwright walkthrough also passed: save and reopen a warm lead, assign a crew through Start Next Job, complete the linked run, and verify the completion and original lead note after a refresh.

- **Lead to booked job:** The client drawer had edit and delete actions. The walkthrough could schedule the lead from Start Next Job, but the original entry still showed as a warm lead after the work was completed. Define what “booked” should mean and how the client record should show the transition.
- **Schedule and complete work:** Saving the assignment cleared the crew selection and disabled Scheduled history. Reselecting the crew made the saved job available to start and finish. Consider a direct route from the saved assignment to its history.
- **Repository setup:** DEV still tracks files under `server/node_modules`. Installing server dependencies changes tracked files in a fresh worktree. Triage dependency cleanup separately from the CRM stories.

## Trial and removal

This rollout changes how we develop the app. Product stories S11 onward are future implementation work. For the first branch, check a dirty checkout, one full-task commit plan and a readable PR draft. For the first runtime story, try the spec, review and verification skills on its real diff. Tune only what causes friction. Add framework or hosting skills when their first actual story supplies a useful example.

When board links, owner review and the first runtime trial are recorded, delete this file and its temporary pointer from the docs index. The team rules and skills are permanent.
