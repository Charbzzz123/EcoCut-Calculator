# Work Tracker

Living checklist for in-flight feature work so we never lose track of what€™s done vs. still active. Update this document in the same PR as the related code change.

## œ... Completed

| Task                                                                 | Done       | Notes                                                                                                                                                        |
| -------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backfill schedule controller + duplicate guard specs                 | 2026-03-06 | Added focused unit suites for EntryModalScheduleController and EntryModalDuplicateGuard so the extracted logic is regression-proof on its own.               |
| Establish core/features/shared structure                             | 2026-03-06 | Home + Clients now live under `src/app/features/...`, the shell/config/routes moved to `src/app/core`, and `src/app/shared/README.md` guides reuse.          |
| Finalize entry modal façade + schedule controller split              | 2026-03-06 | Duplicate-guard + scheduling logic now live in dedicated classes, but handlers/view-models are proxied through the façade so specs/UI stay intact.           |
| Extract reusable UI + domain libraries                               | 2026-03-06 | Entry modal + controllers now live under @shared/ui/entry-modal, plus shared brand/back components keep features from importing each other.                  |
| Restore schedule form controls to legacy styling                     | 2026-03-05 | Entry schedule component now carries the same pill inputs/ghost buttons as before extraction, so date/time fields and CTAs match the original UI.            |
| Prevent client collisions when phone numbers repeat                  | 2026-03-05 | computeClientKey now combines phone digits with address/name fallbacks; new Jest spec ensures two clients with the same phone stay distinct.                 |
| Add client duplicate match API                                       | 2026-03-05 | `/entries/clients/match` now surfaces backend suggestions (email/phone/address/name) before logging a job; backed by new EntriesService specs.               |
| Stand up CI workflow (GitHub Actions)                                | 2026-03-05 | `ci.yml` runs `npm run lint`, `npm run test:ci`, `npm run build`, and the Nest `npm run check`.                                                              |
| Mock calendar APIs in Angular specs                                  | 2026-03-05 | Specs import `CalendarEventsServiceStub` so no tests hit `/api` during unit runs.                                                                            |
| Add Nest server Jest coverage                                        | 2026-03-05 | Added specs for EntriesRepository, CalendarService, and CalendarController; `npm run check` now runs lint + Jest.                                            |
| Normalize docs encoding                                              | 2026-03-05 | Re-encoded `docs/*.md` as UTF-8 so curly quotes/dashes render correctly.                                                                                     |
| Document env + secrets template                                      | 2026-03-05 | Added `.env.example` plus guidance in app-documentation.md so onboarding devs know which vars to set.                                                        |
| Add `npm run clean` to purge artifacts                               | 2026-03-05 | Script uses `rimraf` to remove dist/, coverage/, server/dist/, server/coverage/, and JSON snapshots.                                                         |
| Align ESLint setup for Nest server                                   | 2026-03-05 | Flat config now scopes Angular rules to `src/` and adds a server-specific block using `server/tsconfig.json`.                                                |
| Restyle Clients page to match the dark Evergreen theme               | 2026-03-04 | Banner + controls reuse home branding/CTA tokens.                                                                                                            |
| Normalize client search to ignore phone punctuation                  | 2026-03-04 | Search strips masking characters before matching.                                                                                                            |
| Job entries show scheduled slot, desired budget, hedge plan          | 2026-03-05 | Drawer mirrors Google Calendar payload.                                                                                                                      |
| €œLast serviced / last job date€ respect future bookings             | 2026-03-04 | Only completed jobs update €œLast job€; future jobs fill €œNext job.€                                                                                        |
| Client/job edit & delete actions (no calendar sync)                  | 2026-03-04 | Drawer exposes edit/delete with optimistic updates; calendar handled separately.                                                                             |
| Hedge plan displayed per job in client drawer                        | 2026-03-04 | Uses same structure as calendar descriptions.                                                                                                                |
| Rule: keep repo clean (no stray compiled files committed)            | 2026-03-03 | Added to general-instructions.md and enforced in reviews.                                                                                                    |
| Extract entry-modal.spec helpers into shared test utilities          | 2026-03-05 | Calendar/hedge harness moved to testing helpers + tsconfig excludes from coverage.                                                                           |
| Extract calendar timeline into standalone component                  | 2026-03-05 | `EntryTimelineComponent` now owns layout/styles/tests; modal stays lean.                                                                                     |
| Extract calendar scheduling block into EntryScheduleSectionComponent | 2026-03-05 | Dedicated schedule section renders calendar form, slots, conflict UI, and editing banner; modal feeds it view models/handlers.                               |
| Break clients-shell component/spec into facade + child components    | 2026-03-05 | Introduced `ClientsFacade`, toolbar, roster, detail drawer, and entry-editor overlays with full specs.                                                       |
| Client CRM coverage hardening                                        | 2026-03-05 | Added exhaustive facade/component specs so every template branch is executed and coverage stays 100%.                                                        |
| Client summary fallback spec stabilized                              | 2026-03-05 | Rebuilt the shell fixture with a stubbed `statsSnapshot` so the UI shows €œ—€ when no history exists.                                                        |
| Split entry-modal feature into standalone subcomponents              | 2026-03-05 | Entry details form, schedule section, footer, and validation helpers are standalone; shell now orchestrates only state/handlers.                             |
| Extract entry modal footer + validation helpers                      | 2026-03-05 | Added EntryModalFooterComponent + EntryModalValidationService so the shell delegates CTA + validation logic.                                                 |
| Persist entry data outside process memory                            | 2026-03-05 | EntriesRepository now writes to a SQLite file (`ENTRIES_DB_PATH`), migrating any legacy JSON snapshot automatically so history persists across restarts.     |
| Fix Husky/test scripts & lint-staged                                 | 2026-03-05 | Added `test:ci`, left `npm run test` for the coverage viewer, and updated Husky to run lint + test:ci + lint-staged before each commit.                      |
| Introduce Angular environment configs                                | 2026-03-05 | Added `src/environments/*`, wired file replacements, and pointed HTTP services/tests at `environment.apiBaseUrl`.                                            |
| Document durable persistence upgrade plan                            | 2026-03-05 | Added a detailed migration outline (SQLite/Postgres + Prisma) to app-documentation.md so engineering knows the exact next steps.                             |
| Highlight conflict override CTA                                      | 2026-03-05 | Conflict banner now adds spacing plus a red Overlap button in entry-schedule-section styles so warnings stand out.                                           |
| Wrap entry modal logic in a façade base class                        | 2026-03-05 | Extracted EntryModalFacade so the component shell is thin and ready for future slices.                                                                       |
| Stabilize coverage temp output path                                  | 2026-03-10 | Coverage now pre-creates `coverage/ecocut-calculator/.tmp` and Vitest reports into `coverage/ecocut-calculator` to avoid intermittent ENOENT failures.       |
| Coverage hardening Phase 1A (overlay forwarding + banner getter)     | 2026-03-10 | Added forwarding/getter specs for client overlays and brand banner; baseline improved to 99.32% statements and 97.21% functions.                             |
| Coverage hardening - Phase 1 (Clients surface)                       | 2026-03-16 | Completed exhaustive Clients surface specs and branch coverage so the full clients feature now reports 100% per-file coverage.                               |
| Coverage hardening - Phase 2 (Entry modal core branches)             | 2026-03-16 | Closed remaining branches in modal facade/schedule/duplicate/timeline paths; modal feature now reports 100% per-file coverage.                               |
| Coverage hardening - Phase 3 (Shared utilities and minor gaps)       | 2026-03-16 | Added missing branch coverage for panel store, builder, banner, and shared test helpers; all shared utility files are now fully covered.                     |
| Coverage hardening - Phase 4 (Guardrails + CI threshold handling)    | 2026-03-16 | Added deterministic per-file threshold enforcement (99% floor, currently passing at 100%) and documented/validated the guardrails in CI workflow.            |
| Broadcast Phase 0 defaults locked                                    | 2026-03-16 | Locked MVP channels, caps, permissions, consent windows, unsubscribe behavior, and deliverability requirements before implementation.                        |
| Broadcast Phase 1 route + shell scaffold                             | 2026-03-16 | Added `/communications/broadcast` route and standalone shell that reuses the Clients/Home visual language with starter metrics and planning cards.           |
| Broadcast Phase 2 audience + channel builder                         | 2026-03-16 | Added `BroadcastFacade` + shell filters (query, channel, service window, upcoming window), eligibility counts, exclusion summaries, and dispatch validation. |

## In Progress / Backlog

| Step | Task                                 | Owner | Notes                                                                                                                                                       |
| ---- | ------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3    | Template composer + merge fields     | —     | Add manual template editor with merge tokens (for example: name, last job value/date, next job date, address) and missing-data fallbacks.                   |
| 4    | Layered personalization + overrides  | —     | Support crossed modes with deterministic priority: per-client override > segment rule > channel variant > base template.                                    |
| 5    | Preview, test send, and confirmation | —     | Render exact per-client preview before sending, show SMS segment counter, add send-test flow and final confirmation modal.                                  |
| 6    | Backend delivery engine              | —     | Add Nest communications module, provider adapters, queue, retry/throttle controls, and campaign status endpoints.                                           |
| 7    | Compliance + audit + analytics       | —     | Enforce unsubscribe/suppression, add approval flow, track sent/delivered/failed/suppressed counts, ingest provider webhooks, and keep immutable audit logs. |
| 8    | Quality gates + rollout              | —     | Full unit/integration coverage, lint/build clean, staging dry run, then production release checklist.                                                       |

### Broadcast Requirements (locked for implementation)

- No AI-generated campaign copy required for MVP; operators write templates manually.
- Personalization is merge-field based, not bot-generated, and must support per-client values.
- Operators can combine multiple customization modes in one campaign (segments + channel variants + individual overrides).
- Final message preview must show the exact rendered content for a selected client before send.
- SMS and email must both support unsubscribe behavior and automatic suppression enforcement.
- Default stack for MVP: Hostinger business email transport + Quo SMS API transport.
- Use safe sending defaults: queue, throttling, daily caps, retries, and explicit confirmation before send.
- MVP daily caps: `email <= 80/day`, `sms <= 200/day` until deliverability is validated.
- Role defaults: Owner can send/cancel; Manager can draft and request scheduling but cannot dispatch without Owner approval.
- Consent defaults (Canada): existing-customer implied window tracked from last paid service (24 months) and inquiry window tracked separately (6 months); expired records are excluded automatically.
- Unsubscribe defaults: email one-click + SMS STOP/START sync, with suppression applied immediately and fully honored within policy windows.
- Configure and verify SPF, DKIM, and DMARC before enabling production email broadcasts.
- Include one-click unsubscribe support for bulk email sends and honor unsubscribe requests within policy windows.
- Enforce provider guardrails in-app (Quo request-rate limits and mailbox/day send caps).

## To Eventually Do

| Task                                       | Owner | Notes                                                                                            |
| ------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------ |
| Migrate EntriesRepository to real database | —     | Replace file-based persistence with SQLite/Postgres via a managed ORM (e.g., Prisma) when ready. |
