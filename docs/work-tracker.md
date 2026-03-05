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

## 🔧 In Progress / Backlog

| Task | Owner | Notes |
| --- | --- | --- |
| Split entry-modal feature into smaller subcomponents (form + data sections still pending) | TBD | **2026-03-05:** Entry details + schedule sections now live in dedicated components. Next up: carve out the modal footer/CTA bar and move validation helpers into a dedicated service so the shell only orchestrates state. |
| Extract entry modal footer + validation helpers | TBD | Coordinated task for shrinking the modal: build `EntryModalFooterComponent` for the Cancel/Save buttons + conflict messaging, and introduce an injectable validation utility that centralizes calendar/hedge validation. |
| Break clients-shell component/spec into façade + child components | TBD | File sizes >10 KB / 16 KB; create toolbar, roster, overlay components. |
| Persist entry data outside process memory | TBD | EntriesService still stores data in-memory; move to SQLite/Postgres so undo/report survive restarts. |
