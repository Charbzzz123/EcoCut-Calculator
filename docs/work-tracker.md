# Work Tracker

Living checklist for in-flight feature work so we never lose track of what’s done vs. still active. Update this section in the same PR as the related code change.

## ✅ Completed

| Task | Done | Notes |
| Stand up CI workflow for lint/test/build | --- | Add a GitHub Actions (or similar) pipeline that runs `npm run lint`, `npm run test:ci`, `npm run build`, and the Nest `npm run check` on every PR. |
| Fix Husky/test scripts & lint-staged | --- | Add a `test:ci` script (no browser pop-up), have Husky run `npm run lint && npm run test:ci && npx lint-staged`, and keep the coverage viewer in a dev-only script. |
| Mock calendar APIs in Angular specs | --- | Use HttpTestingController or dedicated mock services so unit tests don’t hit `/api` and spam 404 logs. |
| Add Nest server Jest coverage | --- | Create Jest specs for `EntriesService`, `EntriesRepository`, and the calendar controller/service and run them via `npm run check`. |
| Normalize docs encoding | --- | Convert `docs/*.md` to clean UTF-8 (replace mojibake like `â€”`, `ðŸ`) and note the rule in contributor docs. |
| Document env + secrets template | --- | Provide `.env.example` / README instructions for `GOOGLE_CALENDAR_*` and other required vars so secrets stay out of git but onboarding stays easy. |
| Add `npm run clean` for artifacts | --- | Add a script (rimraf) to remove `dist/`, `coverage/`, `server/dist/`, `server/data/*.json`, etc., and run it in CI to keep trees pristine. |
| Restyle Clients page to match dark evergreen theme | 2026-03-04 | Banner + controls reuse home branding/CTA tokens. |
| Normalize client search to ignore phone punctuation | 2026-03-04 | Search strips masking characters before matching. |
| Job entries show scheduled slot, desired budget, hedge plan | 2026-03-05 | Drawer mirrors Google Calendar payload. |
| “Last serviced / last job date” respect future bookings | 2026-03-04 | Only completed jobs update “Last job”; future jobs fill “Next job.” |
| Client/job edit & delete actions (no calendar sync) | 2026-03-04 | Drawer exposes edit/delete with optimistic updates; calendar handled separately. |
| Rule: keep repo clean (no stray compiled files committed) | 2026-03-03 | Added to general-instructions.md and enforced in reviews. |
| Hedge plan displayed per job in client drawer | 2026-03-04 | Uses same structure as calendar descriptions. |
| Extract entry-modal.spec helpers into shared test utilities | 2026-03-05 | Calendar/hedge harness moved to testing helpers + tsconfig excludes from coverage. |
| Extract calendar timeline into standalone component | 2026-03-05 | `EntryTimelineComponent` now owns layout/styles/tests; modal stays lean. |
| Extract calendar scheduling block into EntryScheduleSectionComponent | 2026-03-05 | Dedicated schedule section component renders calendar form, slots, conflict UI, and editing banner; modal now feeds it view models/handlers. |
| Break clients-shell component/spec into facade + child components | 2026-03-05 | Introduced `ClientsFacade`, toolbar, roster, detail drawer, and entry-editor overlays with full specs. |
| Client CRM coverage hardening | 2026-03-05 | Added exhaustive facade/component specs so every template branch is executed and coverage returns to 100%. |
| Client summary fallback spec stabilized | 2026-03-05 | Recreated the shell fixture with a stubbed `statsSnapshot` so the UI shows â€” when no historic dates exist and the spec stays deterministic. |
| Split entry-modal feature into standalone subcomponents | 2026-03-05 | Entry details form, schedule section, footer, and validation helpers are now standalone pieces so the shell only orchestrates state/handlers. |
| Extract entry modal footer + validation helpers | 2026-03-05 | Added EntryModalFooterComponent + EntryModalValidationService so the shell delegates CTA + validation logic. |
| Persist entry data outside process memory | 2026-03-05 | EntriesRepository writes JSON snapshots under data/entries-store.json, so client/job history survives restarts. |

## 🔧 In Progress / Backlog

| Task | Owner | Notes |
| --- | --- | --- |
| *(none yet — add next task here)* | --- | --- |
