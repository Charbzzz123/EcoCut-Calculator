# Work Tracker

Living checklist for in-flight feature work so we never lose track of what’s done vs. still active. Update this document in the same PR as the related code change.

## ✅ Completed

| Task                                                                 | Done       | Notes                                                                                                                                             |
| -------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restore schedule form controls to legacy styling                     | 2026-03-05 | Entry schedule component now carries the same pill inputs/ghost buttons as before extraction, so date/time fields and CTAs match the original UI. |
| Prevent client collisions when phone numbers repeat                  | 2026-03-05 | computeClientKey now combines phone digits with address/name fallbacks; new Jest spec ensures two clients with the same phone stay distinct.      |
| Add client duplicate match API                                       | 2026-03-05 | `/entries/clients/match` now surfaces backend suggestions (email/phone/address/name) before logging a job; backed by new EntriesService specs.    |
| Stand up CI workflow (GitHub Actions)                                | 2026-03-05 | `ci.yml` runs `npm run lint`, `npm run test:ci`, `npm run build`, and the Nest `npm run check`.                                                   |
| Mock calendar APIs in Angular specs                                  | 2026-03-05 | Specs import `CalendarEventsServiceStub` so no tests hit `/api` during unit runs.                                                                 |
| Add Nest server Jest coverage                                        | 2026-03-05 | Added specs for EntriesRepository, CalendarService, and CalendarController; `npm run check` now runs lint + Jest.                                 |
| Normalize docs encoding                                              | 2026-03-05 | Re-encoded `docs/*.md` as UTF-8 so curly quotes/dashes render correctly.                                                                          |
| Document env + secrets template                                      | 2026-03-05 | Added `.env.example` plus guidance in app-documentation.md so onboarding devs know which vars to set.                                             |
| Add `npm run clean` to purge artifacts                               | 2026-03-05 | Script uses `rimraf` to remove dist/, coverage/, server/dist/, server/coverage/, and JSON snapshots.                                              |
| Align ESLint setup for Nest server                                   | 2026-03-05 | Flat config now scopes Angular rules to `src/` and adds a server-specific block using `server/tsconfig.json`.                                     |
| Restyle Clients page to match the dark Evergreen theme               | 2026-03-04 | Banner + controls reuse home branding/CTA tokens.                                                                                                 |
| Normalize client search to ignore phone punctuation                  | 2026-03-04 | Search strips masking characters before matching.                                                                                                 |
| Job entries show scheduled slot, desired budget, hedge plan          | 2026-03-05 | Drawer mirrors Google Calendar payload.                                                                                                           |
| “Last serviced / last job date” respect future bookings              | 2026-03-04 | Only completed jobs update “Last job”; future jobs fill “Next job.”                                                                               |
| Client/job edit & delete actions (no calendar sync)                  | 2026-03-04 | Drawer exposes edit/delete with optimistic updates; calendar handled separately.                                                                  |
| Hedge plan displayed per job in client drawer                        | 2026-03-04 | Uses same structure as calendar descriptions.                                                                                                     |
| Rule: keep repo clean (no stray compiled files committed)            | 2026-03-03 | Added to general-instructions.md and enforced in reviews.                                                                                         |
| Extract entry-modal.spec helpers into shared test utilities          | 2026-03-05 | Calendar/hedge harness moved to testing helpers + tsconfig excludes from coverage.                                                                |
| Extract calendar timeline into standalone component                  | 2026-03-05 | `EntryTimelineComponent` now owns layout/styles/tests; modal stays lean.                                                                          |
| Extract calendar scheduling block into EntryScheduleSectionComponent | 2026-03-05 | Dedicated schedule section renders calendar form, slots, conflict UI, and editing banner; modal feeds it view models/handlers.                    |
| Break clients-shell component/spec into facade + child components    | 2026-03-05 | Introduced `ClientsFacade`, toolbar, roster, detail drawer, and entry-editor overlays with full specs.                                            |
| Client CRM coverage hardening                                        | 2026-03-05 | Added exhaustive facade/component specs so every template branch is executed and coverage stays 100%.                                             |
| Client summary fallback spec stabilized                              | 2026-03-05 | Rebuilt the shell fixture with a stubbed `statsSnapshot` so the UI shows “—” when no history exists.                                              |
| Split entry-modal feature into standalone subcomponents              | 2026-03-05 | Entry details form, schedule section, footer, and validation helpers are standalone; shell now orchestrates only state/handlers.                  |
| Extract entry modal footer + validation helpers                      | 2026-03-05 | Added EntryModalFooterComponent + EntryModalValidationService so the shell delegates CTA + validation logic.                                      |
| Persist entry data outside process memory                            | 2026-03-05 | EntriesRepository writes JSON snapshots under `data/entries-store.json`, so client/job history survives restarts.                                 |
| Fix Husky/test scripts & lint-staged                                 | 2026-03-05 | Added `test:ci`, left `npm run test` for the coverage viewer, and updated Husky to run lint + test:ci + lint-staged before each commit.           |
| Introduce Angular environment configs                                | 2026-03-05 | Added `src/environments/*`, wired file replacements, and pointed HTTP services/tests at `environment.apiBaseUrl`.                                 |
| Document durable persistence upgrade plan                            | 2026-03-05 | Added a detailed migration outline (SQLite/Postgres + Prisma) to app-documentation.md so engineering knows the exact next steps.                  |

## 🔧 In Progress / Backlog

| Task   | Owner | Notes                                                              |
| ------ | ----- | ------------------------------------------------------------------ |
| _None_ | —     | All tracked items are complete. Add the next task here when ready. |
