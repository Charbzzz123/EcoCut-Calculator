# Work Tracker

Living checklist for in-flight feature work so we never lose track of what’s done vs. still active. Update this section in the same PR as the related code change.

## ✅ Completed

| Task | Done | Notes |
| --- | --- | --- |
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

## 🔧 In Progress / Backlog

| Task | Owner | Notes |
| --- | --- | --- |
| Split entry-modal feature into smaller subcomponents (form + data sections still pending) | --- | **2026-03-05:** Entry details + schedule sections now live in dedicated components. Footer CTA + validation helpers are extracted; future tweaks get new tasks. |
| Extract entry modal footer + validation helpers | 2026-03-05 | Added `EntryModalFooterComponent` and `EntryModalValidationService`; shell now only orchestrates view models/handlers. |
| Persist entry data outside process memory | TBD | EntriesService still stores data in-memory; move to SQLite/Postgres so undo/report survive restarts. |
