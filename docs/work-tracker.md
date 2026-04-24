# Work Tracker

Living checklist for in-flight feature work so we never lose track of what€™s done vs. still active. Update this document in the same PR as the related code change.

## œ... Completed

| Task                                                                 | Done       | Notes                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CH-0 Chats scope + UX contract freeze                                | 2026-04-22 | Locked chats epic scope, phased CH-0..CH-12 implementation plan, client->chat deep-link requirement, and theme parity constraints so future chat slices stay coherent and context-safe if sessions reset.                                                                                                                              |
| CH-1 Quo chat provider foundation                                    | 2026-04-22 | Added typed Quo chat client wrapper (retry/backoff + error categorization), reusable provider health service, and `GET /communications/chats/health` endpoint; SMS transport now reuses the same Quo client to avoid duplicate API logic.                                                                                              |
| CH-2 Chat mirror persistence schema                                  | 2026-04-23 | Added durable SQLite chat mirror tables (`chat_conversations`, `chat_messages`, `chat_client_links`, `chat_sync_cursors`) with idempotent upserts, restart-safe cursor storage, and mirror stats surfaced through `GET /communications/chats/health`.                                                                                  |
| CH-3 Chat incremental sync engine                                    | 2026-04-23 | Added incremental/backfill/reset mirror sync flow with cursor watermarking (`conversations.lastMessageAt`, `messages.lastCreatedAt`, `sync.lastCompletedAt`) plus manual recovery endpoint `POST /communications/chats/sync`; sync uses paginated pull with idempotent upserts and optional reset mode.                                |
| CH-4 Quo webhook ingestion pipeline                                  | 2026-04-23 | Added chat webhook endpoint (`POST /communications/chats/webhooks/quo`) with optional HMAC signature enforcement (`QUO_WEBHOOK_SECRET`), payload normalization, dedupe by provider event id, raw webhook audit persistence, and immediate mirror upserts for conversation/message updates.                                             |
| CH-5 Chats backend API surface                                       | 2026-04-23 | Added chats API endpoints for conversation list/search/thread/read/send (`/communications/chats/conversations`, `/search`, `/conversations/:id/messages`, `/conversations/:id/read`), backed by mirror-query pagination, unread tracking, and outbound send persistence through the shared Quo transport.                              |
| NAV-5 Alert/banner enter-exit motion                                 | 2026-04-12 | Added shared alert/toast motion utility (`motion-alert`) in global styles for validation/state/banner surfaces, plus delayed close handling for Start Next Job save toast so success/error feedback no longer appears/disappears abruptly while still respecting reduced-motion preferences.                                           |
| NAV-4 Collapse/expand motion unification                             | 2026-04-12 | Added shared collapse utility motion (`motion-collapse`) in global styles and wired it into Start Next Job + Broadcast progressive-disclosure sections (workflow status, advanced panels, analytics panel/details, manual-add panel, per-client override) with reduced-motion fallback and hidden-state inert handling.                |
| NAV-3C Non-shared popover/menu motion parity                         | 2026-04-12 | Audited remaining non-shared popovers and aligned Home CTA/dropdown menus with the same open-close motion baseline (fade/slide + visibility handoff + reduced-motion fallback) so they no longer pop in/out abruptly compared to shared dropdown/popover components.                                                                   |
| NAV-3B Address suggestion popover open-close motion baseline         | 2026-04-12 | Added delayed close fade/slide motion for the shared address suggestion popover (`AddressAutocompleteFieldComponent`) with reduced-motion fallback so suggestion lists do not snap closed; updated component specs for close-timer rendering behavior.                                                                                 |
| NAV-3A Select dropdown open-close motion baseline                    | 2026-04-12 | Added fade/slide open-close motion for shared `SelectDropdownComponent` menus (including delayed close render and reduced-motion fallback) so dropdown options no longer disappear abruptly; updated shared dropdown and broadcast specs for close-timer behavior.                                                                     |
| NAV-2 overlay/modal transition baseline                              | 2026-04-12 | Added shared open/close motion for client detail overlay, client entry editor overlay, entry modal shell/backdrop, and broadcast confirmation modal/backdrop with reduced-motion fallbacks; updated related specs for delayed close timing.                                                                                            |
| UX-13D micro-interaction coverage pass                               | 2026-04-11 | Added shared surface transition baseline for `*-card` / `*-panel` / `*-banner` classes in `src/styles.scss`, plus subtle hover + fill-width motion in shared calendar day/week/month cards so non-button UI surfaces now animate consistently without per-feature duplication.                                                         |
| NAV-1 route transition baseline                                      | 2026-04-11 | Added app-level route transition baseline on navigation (`AppComponent` + `router-outlet`) using shared motion tokens with reduced-motion fallback so top-level page changes no longer snap abruptly.                                                                                                                                  |
| UX-13C global interaction motion coverage pass                       | 2026-04-11 | Extended shared motion baseline in `src/styles.scss` to cover common controls (buttons, form inputs, chips, dropdown triggers/options, address suggestions, key cards) and added missing hedge/icon transitions so interaction feedback remains consistent across the app without per-feature duplication.                             |
| UX-13A global motion token baseline + transition cleanup             | 2026-04-11 | Added shared motion tokens in `src/styles/theme.scss` (`fast/base/slow/panel`, standard/emphasis easing, lift distance), centralized reduced-motion handling in `src/styles.scss`, and migrated key feature transitions (Start Next Job, Home, Broadcast, Manage Employees, Clients, shared dropdown/calendar) to token-based timings. |
| UX-13B Motion sweep final pass                                       | 2026-04-11 | Completed a final transition audit and removed the remaining hard-coded motion timings in low-impact styles (`src/styles/brand.scss`, shared calendar fade animation), with reduced-motion fallback retained so all feature transitions now follow shared motion tokens.                                                               |
| Calendar scheduler component extraction (shared reuse)               | 2026-04-11 | Extracted the calendar schedule UI into shared `CalendarSchedulerComponent` and kept `EntryScheduleSectionComponent` as a thin wrapper, so we can reuse the same day/week/month scheduler in other features without changing current entry-modal behavior/styles.                                                                      |
| Calendar scheduling multi-view upgrade (day/week/month)              | 2026-04-10 | Added Day/Week/Month mode toggle plus Prev/Today/Next navigation in the entry modal schedule block, with week/month quick-glance day cards (event count + busy meter + preview text) that click through to day mode without changing drag-select behavior in the existing day timeline.                                                |
| Address rollout Phase B (shared autocomplete field extraction)       | 2026-04-10 | Added reusable `AddressAutocompleteFieldComponent` and swapped Entry Modal, Start Next Job, and Manage Employees history editor to use the same suggestion UI/events. This removes duplicate markup, keeps address UX consistent, and centralizes future address field updates in one place.                                           |
| Address rollout Phase A (entry modal + backend guardrails)           | 2026-04-07 | Added Nest `addresses` module (`/addresses/suggest`, `/addresses/validate`, `/addresses/usage`) with monthly SQLite usage tracking + caps, wired entry modal address suggestions/validation, and added query caching + debounce controls to reduce paid provider calls.                                                                |
| JX-7 Start Next Job UX/test/docs hardening final sweep               | 2026-04-06 | Re-ran full quality gates (`npm run lint:workspace`, `npm run test:ci`, `npm run build`, `cd server && npm run lint`, `npm run test`, `npm run check`) and finalized tracker/docs alignment for the JX flow now that JX-7A/JX-7B are shipped.                                                                                          |
| JX-7B Start Next Job blocker-action affordances                      | 2026-04-06 | Added action chips on draft blocker rows (`Fix in Step 1`, `Go to Step 2`, `Open continuity`) so operators can jump directly to the correct panel/advanced section instead of manually searching for what to fix.                                                                                                                      |
| JX-7A Start Next Job global feedback toast + text cleanup            | 2026-04-06 | Added a global save feedback toast (success/error/saving) visible across all Start Next Job steps with dismiss support for non-saving states, and replaced broken separator glyphs in trend cards with clean ASCII output for consistent rendering.                                                                                    |
| JX-6C Server lifecycle reporting parity                              | 2026-03-30 | Added backend lifecycle reporting parity (`GET /employees/reporting/lifecycle`) so exports/dashboards can read completed-on-time, completed-late, scheduled-late, and continuity counts with the exact same metric rules already used by Start Next Job and Manage Employees UI cards.                                                 |
| JX-6B Unified late/on-time + continuity metrics                      | 2026-03-30 | Added one shared lifecycle metric helper for Employees + Start Next Job so completed-on-time, completed-late, scheduled-late, and continuity counts are derived with identical rules across both modules.                                                                                                                              |
| JX-6A Start Next Job post-mutation board reconciliation              | 2026-03-30 | After assignment/history lifecycle mutations, the Start Next Job facade now re-syncs readiness/history/job-options from `/api/employees/*` to prevent optimistic UI drift and keep crew selection, scheduled-history actions, and analytics aligned with the backend source of truth.                                                  |
| JX-5 Continuity runs for completed jobs                              | 2026-03-30 | Completed linked jobs now require advanced continuity metadata (category + reason), and saving creates a new scheduled follow-up segment linked to the latest completed source record while preserving the original completed history entry.                                                                                           |
| JX-4 Manual mid-job crew clock-out                                   | 2026-03-30 | Added per-employee `Clock out member` action for active runs (`POST /employees/history/:entryId/clock-out`) with optional reason notes persisted for payroll/audit context, while keeping `End job` for full-run closeout.                                                                                                             |
| JX-3 Active run lifecycle (start/end)                                | 2026-03-30 | Added runtime `Start job` / `End job` lifecycle for scheduled assignments with new endpoints (`POST /employees/history/:entryId/start` and `/end`), active-run guards (no edit/cancel/reassign while active), cross-run employee blocking, and synchronized readiness/history/hours updates in API + UI.                               |
| JX-2 Job status model + picker defaults                              | 2026-03-30 | Added normalized job-option status (`scheduled`, `late`, `completed`) across API + frontend, sorted picker results by status priority, defaulted the picker to scheduled/late entries, and moved completed entries behind an explicit advanced toggle with matching tests.                                                             |
| JX-1 Start Next Job job-first draft flow                             | 2026-03-30 | Reordered `/jobs/start` to open on Job details first, made linked-job mode explicit/required (`linked` vs `manual`), moved selector into primary controls, and updated step gating to `Job -> Crew -> Review` with matching validation/tests.                                                                                          |
| UX-12 Start Next Job single-step workspace pass                      | 2026-03-29 | Reworked `/jobs/start` into a true guided flow: only one major step panel is visible at a time (Crew, Draft, Review, or Scheduled History), with clear Back/Continue controls and a simplified top workflow strip that keeps readiness status without duplicating full sections.                                                       |
| UX-11 Start Next Job progressive disclosure pass                     | 2026-03-29 | Added collapsible workflow/details, collapsible Step 2 advanced controls, moved primary save action into Step 3 review, and added collapsible analytics/history sections with step-jump auto-expand behavior to reduce overload while preserving full controls.                                                                        |
| UX-10 Start Next Job linked-client assignment sync                   | 2026-03-29 | Added linked client-job selection in `/jobs/start` Step 2 (via `/employees/job-options`) so draft metadata auto-fills from saved entries and assignment saves now persist `jobEntryId` across scheduled history + assignment hours for end-to-end traceability.                                                                        |
| UX-9 hours-to-history job-link workflow                              | 2026-03-29 | Added job-linked hours logging in Manage Employees (`No linked job` fallback included), surfaced `/employees/job-options` from saved Entries jobs, and synchronized linked manual-hours edits/deletes with matching completed history rows so timelines and payroll stay aligned.                                                      |
| UX-8 Manage Employees workspace mode pruning                         | 2026-03-26 | Removed redundant global workspace pills (`Profile editor`, `Hours editor`, `History timeline`) and kept only global context pivots (`Roster focus`, `Clock board`, `Assignment readiness`); profile/hours/history now open from employee card actions.                                                                                |
| UX-7 Manage Employees top-of-page declutter pass                     | 2026-03-26 | Moved canonical employee counts + summary cards into the controls area, removed the static workflow block, made Workspace mode compact/sticky, reduced top spacing, and de-emphasized the back chip so roster operations appear sooner.                                                                                                |
| UX-6 validation + accessibility clarity pass                         | 2026-03-26 | Added required semantics, assertive live-region validation messaging, and ARIA pressed/expanded states across Manage Employees + Start Next Job controls/forms.                                                                                                                                                                        |
| UX-5 interaction/state consistency pass                              | 2026-03-26 | Unified workspace action/chip tokens, loading/error/empty state treatments, and shared state language so Employees and Start Next Job surface matching feedback patterns.                                                                                                                                                              |
| UX-4 analytics progressive disclosure                                | 2026-03-26 | Start Next Job keeps KPI summaries visible by default while detailed trend cards stay behind Show/Hide details for lower cognitive load.                                                                                                                                                                                               |
| UX-3 Start Next Job step-flow simplification                         | 2026-03-26 | Added step-lock navigation, progress status rows, and continue actions so operators move through crew selection, draft completion, and review/save in order.                                                                                                                                                                           |
| UX-2 Manage Employees flow simplification                            | 2026-03-26 | Shipped roster-first workspace mode switching (clock/profile/hours/history/readiness) with progressive panel visibility to reduce page clutter.                                                                                                                                                                                        |
| UX-1 information hierarchy pass (Employees + Jobs)                   | 2026-03-26 | Added explicit primary vs advanced control grouping in both Manage Employees and Start Next Job drafts, while keeping workflow strips/jump navigation prominent for orientation.                                                                                                                                                       |
| Manage Employees Phase ME-21 cross-run trend analytics               | 2026-03-21 | Added analytics window shortcuts (7/30/90/custom) plus per-day cross-run trend cards in Start Next Job Step 2 (hours-share bar, status mix, completion/cancellation rates) and extended CSV export with trend rows for reporting.                                                                                                      |
| Manage Employees Phase ME-20 route-level variance drill-down         | 2026-03-21 | Added route-level variance cards in Start Next Job Step 2 (per-site tracked/scheduled/completed/cancelled counts, average-hours variance vs crew average, and latest scheduled slot) plus CSV export rows for route trends.                                                                                                            |
| Manage Employees Phase ME-19 per-employee trend drill-down           | 2026-03-21 | Added per-employee trend cards in Start Next Job Step 2 (tracked status counts, hours, completion/cancellation rates, and latest site/schedule context) so dispatchers can compare crew momentum directly in the board.                                                                                                                |
| Manage Employees Phase ME-18 date-range analytics window             | 2026-03-21 | Added Start Next Job analytics date-range filters (`From` / `To`) with invalid-range guardrails plus range-aware CSV export metadata, so dispatchers can isolate specific scheduling windows before sharing reports.                                                                                                                   |
| Manage Employees Phase ME-17 assignment analytics export             | 2026-03-21 | Added CSV export from Start Next Job Step 2 so schedulers can download selected-crew analytics plus underlying history rows (status/hours/site windows) for reporting and handoff without leaving the board.                                                                                                                           |
| Manage Employees Phase ME-16 assignment analytics panel              | 2026-03-21 | Added Start Next Job analytics in Step 2 (tracked/scheduled/completed/cancelled counts, total/average hours, completion/cancellation rates, and unique sites) powered by selected crew history so schedulers get fast operational context before dispatch.                                                                             |
| Manage Employees Phase ME-15 optimistic reconciliation flow          | 2026-03-21 | Updated Start Next Job mutations to patch scheduled history/readiness in-place (single + bulk complete/cancel/reassign + schedule edits) with rollback on API failure, so the board no longer relies on full reloads after every action.                                                                                               |
| Manage Employees Phase ME-14 bulk scheduled lifecycle actions        | 2026-03-21 | Added Start Next Job bulk-selection controls so operators can select multiple scheduled history rows and run complete/cancel actions in one pass, with partial-failure feedback and selection state that stays in sync after refreshes.                                                                                                |
| Manage Employees Phase ME-13 assignment reassignment workflow        | 2026-03-21 | Added `POST /employees/history/:entryId/reassign` plus Start Next Job UI wiring so schedulers can move scheduled entries to a different active crew member (with overlap checks) while linked assignment-hours rows stay synchronized.                                                                                                 |
| Manage Employees Phase ME-12 assignment edit/cancel lifecycle        | 2026-03-21 | Added schedule edit + cancel endpoints (`PATCH /employees/history/:entryId/schedule`, `POST /employees/history/:entryId/cancel`) and wired Start Next Job history cards to edit, complete, or cancel scheduled entries while keeping linked assignment-hours rows in sync.                                                             |
| Manage Employees Phase ME-11 assignment completion workflow          | 2026-03-21 | Added `POST /employees/history/:entryId/complete` plus Start Next Job history actions so schedulers can mark scheduled crew entries complete, refresh readiness totals immediately, and keep assignment lifecycle updates inside the same scheduling board.                                                                            |
| Manage Employees Phase ME-10 assignment persistence wiring           | 2026-03-21 | Added `POST /employees/assignments/start-next-job` so Start Next Job saves scheduled history rows plus assignment-source hours entries, updates roster activity, and immediately feeds Manage Employees timeline/payroll views after refresh.                                                                                          |
| Manage Employees Phase ME-9 clock-in / clock-out workflow            | 2026-03-21 | Added role-guarded clock cards in `/employees/manage` and backend `POST /employees/hours/clock`; sessions persist into hours with `source=clock`, `clockInAt`, `clockOutAt`, actor role, and timestamp so payroll reconciliation has a durable audit trail.                                                                            |
| Manage Employees Phase ME-8 Start Next Job assignment board          | 2026-03-21 | Added `/jobs/start` board with crew picker, readiness-based status badges, assignment draft validation, and conflict checks powered by `/employees/readiness` + `/employees/history` before draft confirmation.                                                                                                                        |
| Manage Employees Phase ME-7 tests/docs/rollout checklist             | 2026-03-21 | Re-ran quality gates after backend employee typing fixes (`npm run lint:workspace`, `npm run test:ci`, `npm run build`, and `cd server && npm run check`) and synced functional/technical docs so the employee workspace status reflects the shipped backend wiring.                                                                   |
| Manage Employees coverage hardening for API wiring edge cases        | 2026-03-21 | Added facade/shell regression specs for backend mutation failures, fallback API message parsing, readiness fallback rendering, empty-history + scheduled-history UI states, and optional payload normalization branches so backend-wired behavior stays stable.                                                                        |
| Manage Employees frontend wiring to backend employees API            | 2026-03-21 | Replaced seeded `EmployeesDataService` data with `/api/employees/*` HTTP calls (roster/hours/history/readiness plus profile/hours mutations) and forwarded operator-role headers so backend permission rules apply to live UI actions.                                                                                                 |
| Manage Employees Phase ME-4 backend role permissions API             | 2026-03-21 | Added Nest `employees` module (`/employees/roster`, `/employees/hours`, `/employees/history`, `/employees/readiness`) with owner/manager permission enforcement on profile/hours mutations and persisted employee snapshot storage.                                                                                                    |
| Manage Employees Phase ME-6 Start Next Job readiness wiring          | 2026-03-21 | Added a facade-level readiness contract (availability state, upcoming windows, next available time, conflict detection, completed/scheduled rollups) plus a shell preview panel so the future Start Next Job board can consume assignment data without duplicating logic.                                                              |
| Manage Employees Phase ME-5 per-employee job history timeline        | 2026-03-21 | Added an employee job-history timeline panel with site/address, scheduled window, status, and per-employee rollups (jobs, completed/scheduled counts, total hours, recent site) for upcoming Start Next Job assignment workflows.                                                                                                      |
| Manage Employees Phase ME-3 profile create/edit/archive              | 2026-03-21 | Added owner-safe profile editor with strict phone/email/rate validation, duplicate detection, soft-archive action, and manager capability guards that block owner-only profile/archive actions.                                                                                                                                        |
| Manage Employees Phase ME-2 roster + search/filter                   | 2026-03-21 | Added facade-driven roster loading with search + status filters, summary metrics, and explicit loading/error/empty UI states in `/employees/manage`.                                                                                                                                                                                   |
| Manage Employees Phase ME-1 route + shell scaffold                   | 2026-03-21 | Added `/employees/manage` route plus standalone shell scaffold matching shared dark-evergreen styling, with phased placeholders for roster/profile/hours/history slices.                                                                                                                                                               |
| Backfill schedule controller + duplicate guard specs                 | 2026-03-06 | Added focused unit suites for EntryModalScheduleController and EntryModalDuplicateGuard so the extracted logic is regression-proof on its own.                                                                                                                                                                                         |
| Establish core/features/shared structure                             | 2026-03-06 | Home + Clients now live under `src/app/features/...`, the shell/config/routes moved to `src/app/core`, and `src/app/shared/README.md` guides reuse.                                                                                                                                                                                    |
| Finalize entry modal façade + schedule controller split              | 2026-03-06 | Duplicate-guard + scheduling logic now live in dedicated classes, but handlers/view-models are proxied through the façade so specs/UI stay intact.                                                                                                                                                                                     |
| Extract reusable UI + domain libraries                               | 2026-03-06 | Entry modal + controllers now live under @shared/ui/entry-modal, plus shared brand/back components keep features from importing each other.                                                                                                                                                                                            |
| Restore schedule form controls to legacy styling                     | 2026-03-05 | Entry schedule component now carries the same pill inputs/ghost buttons as before extraction, so date/time fields and CTAs match the original UI.                                                                                                                                                                                      |
| Prevent client collisions when phone numbers repeat                  | 2026-03-05 | computeClientKey now combines phone digits with address/name fallbacks; new Jest spec ensures two clients with the same phone stay distinct.                                                                                                                                                                                           |
| Add client duplicate match API                                       | 2026-03-05 | `/entries/clients/match` now surfaces backend suggestions (email/phone/address/name) before logging a job; backed by new EntriesService specs.                                                                                                                                                                                         |
| Stand up CI workflow (GitHub Actions)                                | 2026-03-05 | `ci.yml` runs `npm run lint`, `npm run test:ci`, `npm run build`, and the Nest `npm run check`.                                                                                                                                                                                                                                        |
| Mock calendar APIs in Angular specs                                  | 2026-03-05 | Specs import `CalendarEventsServiceStub` so no tests hit `/api` during unit runs.                                                                                                                                                                                                                                                      |
| Add Nest server Jest coverage                                        | 2026-03-05 | Added specs for EntriesRepository, CalendarService, and CalendarController; `npm run check` now runs lint + Jest.                                                                                                                                                                                                                      |
| Normalize docs encoding                                              | 2026-03-05 | Re-encoded `docs/*.md` as UTF-8 so curly quotes/dashes render correctly.                                                                                                                                                                                                                                                               |
| Document env + secrets template                                      | 2026-03-05 | Added `.env.example` plus guidance in app-documentation.md so onboarding devs know which vars to set.                                                                                                                                                                                                                                  |
| Add `npm run clean` to purge artifacts                               | 2026-03-05 | Script uses `rimraf` to remove dist/, coverage/, server/dist/, server/coverage/, and JSON snapshots.                                                                                                                                                                                                                                   |
| Align ESLint setup for Nest server                                   | 2026-03-05 | Flat config now scopes Angular rules to `src/` and adds a server-specific block using `server/tsconfig.json`.                                                                                                                                                                                                                          |
| Restyle Clients page to match the dark Evergreen theme               | 2026-03-04 | Banner + controls reuse home branding/CTA tokens.                                                                                                                                                                                                                                                                                      |
| Normalize client search to ignore phone punctuation                  | 2026-03-04 | Search strips masking characters before matching.                                                                                                                                                                                                                                                                                      |
| Job entries show scheduled slot, desired budget, hedge plan          | 2026-03-05 | Drawer mirrors Google Calendar payload.                                                                                                                                                                                                                                                                                                |
| €œLast serviced / last job date€ respect future bookings             | 2026-03-04 | Only completed jobs update €œLast job€; future jobs fill €œNext job.€                                                                                                                                                                                                                                                                  |
| Client/job edit & delete actions (no calendar sync)                  | 2026-03-04 | Drawer exposes edit/delete with optimistic updates; calendar handled separately.                                                                                                                                                                                                                                                       |
| Hedge plan displayed per job in client drawer                        | 2026-03-04 | Uses same structure as calendar descriptions.                                                                                                                                                                                                                                                                                          |
| Rule: keep repo clean (no stray compiled files committed)            | 2026-03-03 | Added to general-instructions.md and enforced in reviews.                                                                                                                                                                                                                                                                              |
| Extract entry-modal.spec helpers into shared test utilities          | 2026-03-05 | Calendar/hedge harness moved to testing helpers + tsconfig excludes from coverage.                                                                                                                                                                                                                                                     |
| Extract calendar timeline into standalone component                  | 2026-03-05 | `EntryTimelineComponent` now owns layout/styles/tests; modal stays lean.                                                                                                                                                                                                                                                               |
| Extract calendar scheduling block into EntryScheduleSectionComponent | 2026-03-05 | Dedicated schedule section renders calendar form, slots, conflict UI, and editing banner; modal feeds it view models/handlers.                                                                                                                                                                                                         |
| Break clients-shell component/spec into facade + child components    | 2026-03-05 | Introduced `ClientsFacade`, toolbar, roster, detail drawer, and entry-editor overlays with full specs.                                                                                                                                                                                                                                 |
| Client CRM coverage hardening                                        | 2026-03-05 | Added exhaustive facade/component specs so every template branch is executed and coverage stays 100%.                                                                                                                                                                                                                                  |
| Client summary fallback spec stabilized                              | 2026-03-05 | Rebuilt the shell fixture with a stubbed `statsSnapshot` so the UI shows €œ—€ when no history exists.                                                                                                                                                                                                                                  |
| Split entry-modal feature into standalone subcomponents              | 2026-03-05 | Entry details form, schedule section, footer, and validation helpers are standalone; shell now orchestrates only state/handlers.                                                                                                                                                                                                       |
| Extract entry modal footer + validation helpers                      | 2026-03-05 | Added EntryModalFooterComponent + EntryModalValidationService so the shell delegates CTA + validation logic.                                                                                                                                                                                                                           |
| Persist entry data outside process memory                            | 2026-03-05 | EntriesRepository now writes to a SQLite file (`ENTRIES_DB_PATH`), migrating any legacy JSON snapshot automatically so history persists across restarts.                                                                                                                                                                               |
| Fix Husky/test scripts & lint-staged                                 | 2026-03-05 | Added `test:ci`, left `npm run test` for the coverage viewer, and updated Husky to run lint + test:ci + lint-staged before each commit.                                                                                                                                                                                                |
| Introduce Angular environment configs                                | 2026-03-05 | Added `src/environments/*`, wired file replacements, and pointed HTTP services/tests at `environment.apiBaseUrl`.                                                                                                                                                                                                                      |
| Document durable persistence upgrade plan                            | 2026-03-05 | Added a detailed migration outline (SQLite/Postgres + Prisma) to app-documentation.md so engineering knows the exact next steps.                                                                                                                                                                                                       |
| Highlight conflict override CTA                                      | 2026-03-05 | Conflict banner now adds spacing plus a red Overlap button in entry-schedule-section styles so warnings stand out.                                                                                                                                                                                                                     |
| Wrap entry modal logic in a façade base class                        | 2026-03-05 | Extracted EntryModalFacade so the component shell is thin and ready for future slices.                                                                                                                                                                                                                                                 |
| Stabilize coverage temp output path                                  | 2026-03-10 | Coverage now pre-creates `coverage/ecocut-calculator/.tmp` and Vitest reports into `coverage/ecocut-calculator` to avoid intermittent ENOENT failures.                                                                                                                                                                                 |
| Coverage hardening Phase 1A (overlay forwarding + banner getter)     | 2026-03-10 | Added forwarding/getter specs for client overlays and brand banner; baseline improved to 99.32% statements and 97.21% functions.                                                                                                                                                                                                       |
| Coverage hardening - Phase 1 (Clients surface)                       | 2026-03-16 | Completed exhaustive Clients surface specs and branch coverage so the full clients feature now reports 100% per-file coverage.                                                                                                                                                                                                         |
| Coverage hardening - Phase 2 (Entry modal core branches)             | 2026-03-16 | Closed remaining branches in modal facade/schedule/duplicate/timeline paths; modal feature now reports 100% per-file coverage.                                                                                                                                                                                                         |
| Coverage hardening - Phase 3 (Shared utilities and minor gaps)       | 2026-03-16 | Added missing branch coverage for panel store, builder, banner, and shared test helpers; all shared utility files are now fully covered.                                                                                                                                                                                               |
| Coverage hardening - Phase 4 (Guardrails + CI threshold handling)    | 2026-03-16 | Added deterministic per-file threshold enforcement (99% floor, currently passing at 100%) and documented/validated the guardrails in CI workflow.                                                                                                                                                                                      |
| Broadcast Phase 0 defaults locked                                    | 2026-03-16 | Locked MVP channels, caps, permissions, consent windows, unsubscribe behavior, and deliverability requirements before implementation.                                                                                                                                                                                                  |
| Broadcast Phase 1 route + shell scaffold                             | 2026-03-16 | Added `/communications/broadcast` route and standalone shell that reuses the Clients/Home visual language with starter metrics and planning cards.                                                                                                                                                                                     |
| Broadcast Phase 2 audience + channel builder                         | 2026-03-16 | Added `BroadcastFacade` + shell filters (query, channel, service window, upcoming window), eligibility counts, exclusion summaries, and dispatch validation.                                                                                                                                                                           |
| Broadcast Phase 3 template composer + merge preview                  | 2026-03-16 | Added merge-token composer controls, SMS segment metrics, per-client rendered preview, and facade/template tests to keep broadcast coverage at 100%.                                                                                                                                                                                   |
| Broadcast Phase 4 layered personalization + overrides                | 2026-03-16 | Added segment rules, channel variants, per-client override controls, deterministic layer priority, and active-layer preview tracing with full coverage.                                                                                                                                                                                |
| Broadcast Phase 5 test-send + confirmation modal                     | 2026-03-16 | Added schedule mode controls, test destination fields, modal confirmation flow, status banners, accessibility handling, and full coverage for all new branches.                                                                                                                                                                        |
| Broadcast Phase 6 backend delivery engine                            | 2026-03-17 | Added Nest `communications` module (`/communications/test`, `/communications/dispatch`, campaign status endpoints), Hostinger/Quo provider adapters, retries/throttling, and frontend delivery wiring via `BroadcastDeliveryService`.                                                                                                  |
| Broadcast Phase 7A suppression endpoints + enforcement               | 2026-03-17 | Added unsubscribe/resubscribe endpoints (`/communications/suppressions/*`) and suppression checks during test/dispatch sends so opted-out addresses/numbers are skipped and counted.                                                                                                                                                   |
| Broadcast Phase 7B approval workflow + immutable campaign audit      | 2026-03-17 | Added manager approval gating (`pending_approval`), owner approve/cancel endpoints, and append-only campaign audit timeline (`/communications/campaigns/:campaignId/audit`).                                                                                                                                                           |
| Broadcast Phase 7C webhook ingestion + campaign analytics            | 2026-03-17 | Added delivery webhook ingestion (`/communications/webhooks/delivery`) and per-campaign analytics endpoint (`/communications/campaigns/:campaignId/analytics`) with unsubscribe/resubscribe synchronization.                                                                                                                           |
| Broadcast Phase 7D provider webhook adapters + signature validation  | 2026-03-17 | Added provider-specific webhook route (`/communications/webhooks/delivery/:provider`), normalized Quo/Hostinger payload mapping, and HMAC signature checks when webhook secrets are configured.                                                                                                                                        |
| Broadcast Phase 7E durable communications persistence                | 2026-03-17 | Campaigns, pending approvals, audit timeline, analytics events, and suppression lists now persist to SQLite (`COMMUNICATIONS_DB_PATH`) so state survives restarts.                                                                                                                                                                     |
| Broadcast Phase 8A rollout gate automation + e2e smoke suite         | 2026-03-17 | Added `npm run check:rollout`, communications e2e coverage (`server/test/communications.e2e-spec.ts`), and a release checklist (`docs/release-checklist.md`) for staging and production sign-off.                                                                                                                                      |
| Quality gates + rollout                                              | 2026-03-17 | Completed first staging dry run and production sign-off using `docs/release-checklist.md` and rollout automation.                                                                                                                                                                                                                      |
| Broadcast UX polish (audience + safety workflow)                     | 2026-03-17 | Added recipient eligibility badges, cleaner themed scroll/checkbox controls, preview next/previous navigation, mandatory Step 2 channel confirmation, send-readiness checklist + blocking reasons, and a live pre-send cost estimate panel (CAD) for email/SMS campaigns.                                                              |

## In Progress / Backlog

| Step   | Task                                 | Owner | Notes                                                                                                                                                                                                                         |
| ------ | ------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CH-6   | Client <-> Quo contact sync          | —     | Auto-upsert Quo contacts from client create/update, add link-existing flow, and handle unknown inbound numbers with explicit linking/creation actions.                                                                        |
| CH-7   | Home + routing entrypoint            | —     | Add `Chats` quick action and route (`/communications/chats`) so operators can launch inbox directly from home.                                                                                                                |
| CH-8   | Chats UI MVP                         | —     | Build messenger-style split view (conversation list + thread + composer), mobile stacked behavior, send states, and evergreen theme parity.                                                                                   |
| CH-9   | Client-aware chat header + deep-link | —     | Client click should auto-open the linked chat thread; chat header must surface client context (last/upcoming jobs, totals) with quick actions back to client profile/jobs.                                                    |
| CH-10  | Rate/cost guardrails for chats       | —     | Enforce queue/throttle (10 rps key limit), outbound pacing, usage counters, and optional auto-pause threshold for safe operations.                                                                                            |
| CH-11  | Test + rollout hardening             | —     | Add unit/integration/e2e coverage for sync/send/webhook/linking flows, then run full quality gates before staged rollout.                                                                                                     |
| CH-12  | Final docs + runbook                 | —     | Document architecture, env/setup, webhook ops, failure modes, and support runbook across app docs and release checklist.                                                                                                      |
| ADDR-1 | Address strict-mode rollout          | —     | Keep `enforceVerifiedAddress=false` in development until provider credentials are configured, then run staging validation and switch strict-mode to `true` in production configs.                                             |
| ADDR-2 | Address usage + quota UI in Finance  | —     | Backend usage ledger, monthly caps, and threshold guardrails are shipped (`/addresses/usage`). Remaining work: surface this in the future Finance section with monthly cost/threshold widgets and optional auto-pause toggle. |
| DATA-1 | Centralize job display labels        | —     | Add canonical `displayLabel` read model (client + job type) and optional `clientNameSnapshot` on history rows so labels stay consistent across Start Next Job, history, and reports even if client names change later.        |
| DATA-2 | Migrate EntriesRepository database   | —     | Replace file-based persistence with SQLite/Postgres via a managed ORM (e.g., Prisma) when ready.                                                                                                                              |

### JX Plan Detail (freeze this before coding)

Use this as the source of truth if chat context resets.

#### JX-1 - Job-first draft flow

- **Status**: Completed on 2026-03-30.

- **Frontend**
  - Move linked client job picker to the first required control in `/jobs/start`.
  - Keep `No specific client job (manual)` as a required explicit choice (not implicit).
  - Auto-fill label/address/start when a linked job is selected.
- **Validation**
  - Block crew actions until a job mode is selected.
  - If linked job mode: prevent editing linked fields directly.
- **Done when**
  - Operator can start from job selection first and proceed without confusion.

#### JX-2 - Job status model + picker defaults

- **Status**: Completed on 2026-03-30.

- **Data model**
  - Normalize assignment/job lifecycle status to: `scheduled`, `late`, `completed`.
- **Picker behavior**
  - Default results: `scheduled + late`.
  - Advanced toggle enables `completed` jobs.
- **Done when**
  - Completed jobs are hidden by default and visible only when explicitly enabled.

#### JX-3 - Active run lifecycle (start/end)

- **Status**: Completed on 2026-03-30.

- **Backend/API**
  - Add run lifecycle operations: `start run`, `end run`.
  - End run auto-clocks out all remaining active crew on that run.
- **Frontend**
  - Replace schedule-only end logic with explicit runtime start/end controls.
  - Support multiple active runs simultaneously.
- **Guards**
  - Block selecting an employee already active in another run.
- **Done when**
  - One crew can end a run without blocking other crews from starting another run.

#### JX-4 - Manual mid-job crew clock-out

- **Status**: Completed on 2026-03-30.

- **Behavior**
  - Add per-employee `Clock out now` while run is active.
  - Optional reason note stored for audit/payroll context.
- **Synchronization**
  - Update hours, readiness, and history immediately after mid-run clock-out.
- **Done when**
  - Employee can leave early without ending the full job/run.

#### JX-5 - Continuity for completed jobs

- **Status**: Completed on 2026-03-30.

- **Advanced flow**
  - Allow reopening completed jobs only as `manual continuity`.
  - Continuity creates a new linked execution segment; original completed record stays intact.
- **Tracking**
  - Mark continuity reason/category so issue-return rates can be measured.
- **Done when**
  - Return visits are tracked separately but linked to original job lineage.

#### JX-6 - Cross-module sync + reporting integrity

- **Status**: Completed on 2026-03-30 (JX-6A + JX-6B + JX-6C).

- **Consistency checks**
  - JX-6A complete: Start Next Job now re-fetches canonical readiness/history/job-options after lifecycle mutations to eliminate optimistic drift.
  - JX-6B complete: Employees + Start Next Job now consume one shared lifecycle metric helper for on-time/late/continuity counts.
  - JX-6C complete: backend reporting endpoint now applies the same lifecycle rules for parity in server-generated analytics.
- **Analytics**
  - Lifecycle report API is now available at `GET /employees/reporting/lifecycle` with optional `from`, `to`, and `employeeIds` filters.
- **Done when**
  - Same action produces matching state everywhere in app + API.

#### JX-7 - UX/test/docs hardening

- **Status**: Completed on 2026-04-06 (JX-7A/JX-7B + final sweep).

- **UX**
  - Keep progressive disclosure, clear blockers, and explicit success/error messaging.
- **Tests**
  - Add unit tests for lifecycle transitions, mid-job clock-out, completed-job continuity, and guardrails.
  - Run full quality gates (lint + tests + build + server checks).
- **Docs**
  - Update `app-functionality.md`, `app-documentation.md`, and mark tracker rows completed with dates/notes.
- **Done when**
  - User can execute full flow with no ambiguous state and docs match shipped behavior.

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

### CH Plan Detail (freeze this before coding)

Use this as the source of truth if chat context resets.

#### CH-0 - Scope + UX contract

- **Status**: Completed on 2026-04-22.
- Locked target: EcoCut-native Quo inbox replacement (conversation list, thread view, send/reply, contact sync hooks, client-aware header context).
- Locked UX requirement: use existing evergreen tokens/components so chats feel native to the current app shell.
- Locked deep-link requirement: selecting a client should auto-open that client's chat context.

#### CH-1 - Quo provider foundation

- **Status**: Completed on 2026-04-22.
- Added typed Quo chat client wrapper with retry/backoff + error categorization.
- Added provider health service and `GET /communications/chats/health` endpoint.
- Reused the same client in SMS transport to avoid duplicate Quo request logic.

#### CH-2 - Mirror persistence schema

- **Status**: Completed on 2026-04-23.
- Added durable SQLite mirror tables in `communications.db`:
  - `chat_conversations`
  - `chat_messages`
  - `chat_client_links` (`clientId <-> quoContactId`)
  - `chat_sync_cursors`
- Added idempotent upsert methods for conversation/message mirrors and restart-safe cursor persistence.
- Added mirror counters to `GET /communications/chats/health` for quick operational verification.

#### CH-3 - Pull sync engine

- **Status**: Completed on 2026-04-23.
- Implemented paginated sync loops for conversation + message mirrors with incremental watermark filtering and idempotent upserts.
- Added sync modes:
  - `incremental` (default)
  - `backfill` (ignores previous cursors)
  - `reset` (clears mirror tables/cursors, keeps client links, then re-syncs)
- Added manual recovery endpoint: `POST /communications/chats/sync`.

#### CH-4 - Webhook ingest pipeline

- **Status**: Completed on 2026-04-23.
- Added `POST /communications/chats/webhooks/quo` for chat message lifecycle events.
- Enforces HMAC signature validation when `QUO_WEBHOOK_SECRET` is configured.
- Persists raw webhook payload audits in `chat_webhook_events` and normalizes lifecycle updates into chat mirrors immediately.
- Deduplicates replayed webhook deliveries using provider event identity (`provider_event_id`).

#### CH-5 - Chats API surface

- **Status**: Completed on 2026-04-23.
- Added mirror-backed endpoints for:
  - `GET /communications/chats/conversations`
  - `GET /communications/chats/search`
  - `GET /communications/chats/conversations/:conversationId/messages`
  - `POST /communications/chats/conversations/:conversationId/messages`
  - `POST /communications/chats/conversations/:conversationId/read`
- Added server-side pagination + unread tracking with per-conversation read-state persistence (`chat_conversation_reads`).
- Kept frontend isolated from direct Quo calls (backend-only provider integration).

#### CH-6 - Client-contact sync

- Upsert Quo contacts from EcoCut client create/update.
- Support link-existing contact flow for duplicates.
- Add unlinked inbound number queue with explicit resolve action.

#### CH-7 - Home + route entry

- Add `Chats` quick action card + `/communications/chats` route.
- Preserve existing home action-card hierarchy and keyboard flow.

#### CH-8 - Chats UI MVP

- Desktop: split view (left conversation list, right active thread/composer).
- Mobile: stacked list->thread navigation.
- Include sending/delivered/failed states, unread markers, empty/error/loading states.

#### CH-9 - Client-aware thread context

- Thread header shows client identity + quick context:
  - last job
  - upcoming job
  - total jobs
- Add quick actions back to client profile and job workflows.

#### CH-10 - Guardrails (rate/cost/reliability)

- Enforce queue + throttles (respect Quo 10 rps per key).
- Add monthly usage counters + threshold warnings.
- Optional auto-pause on threshold breach for safe operations.

#### CH-11 - Test + rollout hardening

- Add unit/integration/e2e coverage for sync/webhook/send/link flows.
- Run full quality gates before rollout.
- Validate failure-mode UX (provider down, auth failure, rate limit).

#### CH-12 - Documentation + runbook

- Update app-functionality + app-documentation + release checklist with:
  - architecture
  - env/setup
  - webhook ops
  - troubleshooting flows

## To Eventually Do

| Task | Owner | Notes                                                                                         |
| ---- | ----- | --------------------------------------------------------------------------------------------- |
| —    | —     | No deferred items right now; active remaining items are tracked in **In Progress / Backlog**. |
