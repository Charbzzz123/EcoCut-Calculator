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

## 🔧 In Progress / Backlog

| Task | Owner | Notes |
| --- | --- | --- |
| Split entry-modal feature into smaller subcomponents (form, timeline, calendar) | TBD | Current component/html/spec > 40 KB; aim for <1K lines each. |
| Break clients-shell component/spec into façade + child components | TBD | File sizes >10 KB / 16 KB; create toolbar, roster, overlay components. |
| Persist entry data outside process memory | TBD | EntriesService still stores data in-memory; move to SQLite/Postgres so undo/report survive restarts. |
