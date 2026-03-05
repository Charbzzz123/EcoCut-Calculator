# Work Tracker

Living checklist for in-flight feature work so we never lose track of what’s done vs. still active. Update this section in the same PR as the related code change.

| Task | Status | Updated | Notes |
| --- | --- | --- | --- |
| Restyle Clients page to match dark evergreen theme (banner, buttons, typography) | ✅ Done | 2026-03-04 | Matches home hero branding and button tokens. |
| Normalize client search to ignore phone punctuation | ✅ Done | 2026-03-04 | Search strips non-digits before matching. |
| Job entries show scheduled slot, desired budget, hedge plan (calendar parity) | ✅ Done | 2026-03-04 | Drawer lists event payload except hedge plan UI still pending polish. |
| “Last serviced” and “Last job date” respect future bookings | ✅ Done | 2026-03-04 | Uses completed_at timestamps only. |
| Client/job edit & delete actions (no calendar sync) | ✅ Done | 2026-03-04 | Client drawer exposes edit/delete with optimistic updates. |
| Rule: keep repo clean (no stray compiled files in commits) | ✅ Done | 2026-03-03 | Added to general-instructions.md. |
| Display hedge plan per job in client drawer (match Google Calendar event text) | ⏳ In Progress | — | Need to render trim/rabattage breakdown for each hedge just like entry payload. |

