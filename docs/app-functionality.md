# EcoCut Calculator – Functionality Catalog

## Scope Overview
- Rebuild the legacy "Job Calculator" workflow with a modern Angular/Nest stack.
- Preserve auditable financial math while making UX faster and clearer.
- Plan changes up front; treat this document as the single source of truth for behavior.

## Core Workflow (Happy Path)
1. User enters **Gross amount** and specifies whether the price already includes taxes.
2. User selects **Partners** (multi-select) and **Employees** (each with hours; hourly rates sourced from Employees data).
3. Optional: enable **10% commission** and pick a **Representative**.
4. User clicks **Calculate & Log** which must:
   - Normalize the gross amount, compute all splits, and return the result payload for the UI.
   - Persist a Job record + all related logs, update funds/totals, bump invoice sequence when required, and update summaries.
5. User can click **Undo Last Entry** to rollback the most recent Job atomically (logs, balances, invoice tracker, summaries).

## Home Screen UX
- **Primary CTA**: “Add Entry” pill button above the fold plus a floating CTA pinned to the bottom-right. Hover/click reveals quick sub-actions (`+ Warm Lead`, `+ Customer / Closed`) that trigger their respective flows; options auto-hide when focus leaves the button group.
- **Layout**: hero header with an “Operations snapshot” eyebrow, welcome copy, and hero metrics grid; quick action tiles live immediately below so users can jump to Undo, Manage Employees, or Advanced Options without scrolling.
- **Theme**: dark evergreen palette with EcoCut logo + mascot imagery in the hero to reinforce branding while keeping contrast WCAG-compliant.
- **Hero Metrics** (card grid): Jobs logged today, Today’s gross pre-tax total, Current PRF balance, Outstanding Charbel owed.
- **Action Shortcuts**: quick links for `Add Job`, `Start Next Job`, `Undo Last Entry`, `Manage Employees`, `Employee List`, `Clients`, `Schedule`, `Finances`, `Upcoming Pay`, `Performance Stats`, `Client Broadcast`, and `Advanced Options`. Icons follow the latest emoji/icon guidance (dollar for Finances, calendar for Schedule, flex arm for Performance, group for Employee List, etc.).
- **Activity Feed**: recent jobs list showing partner names, gross amount, status, and timestamp with a link to view details.
- **Alerts Panel**: notifications for configuration changes, commission updates, or payroll anomalies requiring attention.
- **Insights Widgets**: weekly payroll snapshot (hours + wages per employee) and PRF trend mini-chart.
- **Performance Considerations**: load hero metrics within 1s, use skeleton loaders for lists, ensure layout adapts to single-column on mobile while keeping the New Job CTA thumb-reachable.

### Warm Lead / Customer Entry Modal
- Launched from the “Add Entry” dropdown (floating CTA). Two variants reuse the same component: **Warm Lead** (default) and **Customer / Closed** (used for future scheduling + client conversion work).
- **Required form fields**: first name, last name, home address, phone number, job type (Hedge Trimming, Rabattage, Both), job value. Optional: desired budget, additional details textarea.
- **Dynamic job-type guard**: the hedge canvas only appears after a job type is picked so we don’t waste rendering cycles for visitors who are just scanning the form.
- **Interactive hedge canvas**:
  - Uses `public/assets/warm-lead/a_bird_s_eye_view_digital_illustration_showcases_a.png` as the background plus eight SVG polygons (`hedge-1`..`hedge-8`).
  - Clicking a polygon cycles `None → Trim → Rabattage → None`, highlights the hedge, and opens an anchored panel near the clicked region (position is clamped within the SVG bounds).
  - Trim state offers combinable toggles (Inside / Top / Outside) plus mutually exclusive presets (Normal, Total). Rabattage state offers mutually exclusive radio options (Partial, Total, Total w/out roots); choosing Partial forces the “How much to trim off” textarea.
  - Each hedge stores its own config; saving validates partial text, unsaved states remain highlighted, and clearing a hedge resets its saved payload.
- **Panel UX safeguards**: only one panel open at a time, Cancel resets transient edits, OK persists the config. Inline errors are shown for missing partial text.
- **Submission flow**: emitting the modal payload returns `variant`, `form` data, and the per-hedge config record for domain services/undo. Successful save resets the modal and closes it; Close/Cancel also reset state without emitting.
- **Roadmap hooks**: Customer variant will later add calendar scheduling + warm-lead → customer conversion. Keep the shared component evolutive (theme tokens, signal-driven state, full test coverage).
- **Customer scheduling requirements**:
  - Customer variant now surfaces a **Schedule on EcoCut Calendar** block. Date, start time, and end time are mandatory; the Save button remains disabled until they’re valid.
  - The calendar block displays a live availability feed pulled from EcoCut’s Google Calendar (via the Nest proxy). Users can see existing jobs for the selected date (times shown in the browser’s timezone) and pick an open slot without leaving the modal. Loading and error states are clearly messaged.
  - Existing events show up with `Edit` and `Delete` controls. Editing pre-fills the timeline/grid so schedulers can tweak the slot in place; deleting issues a `DELETE /calendar/events/:eventId` call via the proxy and refreshes availability immediately.
- **Interactive day timeline**:
  - Replaces the static slot-only picker with a Google Calendar-style vertical day view (7 AM – 8 PM) inside the modal. Users click and drag directly on the column to select any custom window; the controls auto-fill start/end times from the selection.
  - Existing Google events render as stacked blocks with overlap detection. When the chosen window collides with an existing job, a conflict banner appears and Save stays disabled until the user explicitly overrides (so double-bookings are intentional).
  - A live “current time” line appears when viewing today, giving schedulers real-time context. The view gracefully handles parallel teams by laying blocks side-by-side and labeling them with summary + location.
- **Calendar event auto-generation**:
  - When a customer entry is saved the frontend builds a structured event description (contact info, job value, hedge plan breakdown, additional details) and sends it to the Nest backend (`POST /calendar/events`). Location defaults to the customer address.
  - The response `eventId` is stored alongside the entry payload so future edits can call `PATCH /calendar/events/:eventId` and removals can call `DELETE /calendar/events/:eventId` through the same proxy.
- **Suggested slot picker**:
  - Customer entries show an “Suggested time slots” grid once a date is chosen. Slots mirror the standard crew day (08:00–17:00).
  - Slots automatically disable when the backend reports a conflicting Google Calendar event. Available slots autofill the start/end controls and highlight the selection; manual edits clear the chip state.
  - Hover/click feedback is instant so schedulers can pick a slot in under a second.
- **Live availability feed**:
  - The “Upcoming events” panel now refreshes via the Nest proxy so the list matches Google Calendar in real time. Loading, empty, and error states are rendered inline with helper copy.
  - When the backend fails (e.g., missing credentials) we keep the modal usable but display a warning banner (“Unable to load Google Calendar availability right now.”).
- **Validation rules**:
  - Customer variant cannot be saved until date, start, and end times are provided and the range is valid (end after start). Inline helpers (“Required” or “End time must be after the start time”) surface under each field.
  - Calendar notes are optional but trimmed; blank values are omitted from the payload.

## Inputs & Data Sources
- **Employee Catalog**: `[name, rate]` tuples powering the employee picker + validation.
- **Representative Catalog**: `[name, baseCommissionRate]` list for commission selection (default 10% but editable per rep).
- **Partners List**: dynamic dataset defining available partners (needed for both split math and logs).
- **Funds Snapshot**: `PRF`, `CharbelOwed`, and future funds; required for display + mutation.
- **Invoice Tracker**: map of `{year -> lastSequence}` to generate IDs like `2026-004`.

### Dynamic Data & Integrations
- Manage every catalog (Partners, Employees, Representatives) directly in the app via admin screens:
  - Add/remove/update entries without redeploying; persist changes immediately.
  - Employee records capture name, hourly rate, optional default hours.
  - Representative records capture name plus individualized commission rate (fall back to 10% global default when unspecified).
  - Partner records capture name and any metadata needed for reporting.
- Advanced Options panel exposes calculation constants (tax rate, reserve %, labour %, surplus split, commission fallback %) so admins can adjust values with audit trails.
- Changes propagate instantly to the calculator UI (forms rehydrate from live datasets).
- Capture who/when updates are made for traceability (user + timestamp fields or an audit log).
- **Calendar Sync (backend)**: When an entry is logged (job, warm lead, or closed customer), the server can optionally push it to EcoCut’s Google Calendar by calling `/calendar/events`. Event metadata includes summary, description, time window, and attendee list. Updates route through `PATCH /calendar/events/:eventId`, and undo/removals issue the corresponding `DELETE` call so Google Calendar always mirrors the job ledger.

#### Admin UX Requirements
- **Audit & Traceability**
  - Record every change with: record ID, field changed, previous value, new value, actor, timestamp.
  - Provide history view per entity and allow Owners to revert to a prior state.
  - Retain audit logs indefinitely unless retention policy is defined later.
- **Access Control**
  - Roles:
    - **Owner** – full control (catalog CRUD, advanced options, funds overrides, undo, future clock-in approvals).
    - **Manager** – can add employees and adjust their hours/default schedules; can initiate employee clock-ins once that feature ships; read-only for other catalogs/settings.
    - **Employee** – view-only access to their assignments/summaries.
  - Admin screens gated behind authentication; role-based guards enforce capabilities above.
  - Advanced Options (tax/split tuning) accessible only to Owners with an extra confirmation step.
- **Partners Manager**
  - Table with sortable columns (Name, Active?, Notes, Last Updated).
  - Inline validation: name required, unique; optional notes trimmed to 280 chars.
  - Bulk actions: activate/deactivate multiple partners, export CSV snapshot.
  - Editing opens side drawer form with audit info (created by, updated by, timestamps).
- **Employees Manager**
  - Grid listing Name, Hourly Rate, Default Hours, Active flag.
  - Validation: rate > 0 with two-decimal precision; hours >= 0 (can be fractional); names unique.
  - Supports batch rate updates (e.g., apply % increase) with preview modal.
  - Prevent deletion if employee appears in current week jobs—require archive (inactive) instead.
- **Representatives Manager**
  - List with Name, Commission %, Active flag.
  - Validation: commission between 0 and 100%; decimal precision to 2 places.
  - Fall back to global commission when field blank (UI hint).
  - Provide bulk assign to set same commission across selected reps.
- **Advanced Options Panel**
  - Form groups by category (Taxation, Splits, Invoice Rules, Safety Nets).
  - Each field shows default + current values and tooltips explaining downstream impact.
  - Require confirmation modal summarizing changes before saving; include “effective from” timestamp.
  - Persist changes versioned; show history list with revert option.
- **General UX**
  - Optimistic updates with toasts on success; rollback on failure.
  - Autosave disabled—explicit Save button to avoid accidental edits.
  - All forms must surface validation errors inline plus summary banner.
  - Provide search/filter on each catalog screen for speed with large datasets.

## Calculation & Business Rules
Constants:
- `TAX_RATE = 0.14975`
- `COMM_RATE = 0.10`
- Reserve split percentages: `Charbel reimburse 18%`, `PRF seed 18%`, Labour pool `54%`, Surplus split `40/60` (owner/reinvest).

Steps (should live in a pure domain service):
1. **Normalize Gross**
   - If tax-included, `grossPreTax = grossInput / (1 + TAX_RATE)`; else `grossPreTax = grossInput`.
2. **Commission**
   - When enabled: `commission = COMM_RATE * grossPreTax`, logged against the selected Rep.
   - When disabled: `commission = 0`, but a fallback amount (same 10%) is routed to PRF later.
3. **Reserve Split (36%)**
   - `charReimb = 0.18 * grossPreTax`, `prfSeed = 0.18 * grossPreTax`.
   - Funds impact: `CharbelOwed -= charReimb`, `PRF += prfSeed`.
4. **Labour Pool (54%)**
   - `share = (0.54 * grossPreTax) / (Np + Ne)` where `Np` = partners selected, `Ne` = employees selected.
   - `partnerPayTotal = share * Np`, `employeePot = share * Ne`.
   - `wageBill = S(hours * rate)` from employee selections.
5. **PRF Draw for Wage Shortfall**
   - `surplus = employeePot - wageBill`.
   - If `surplus < 0`, set `prfDraw = surplus` (negative), update funds `PRF += prfDraw`, then `surplus = 0`.
6. **Surplus Split**
   - `owner40 = 0.40 * surplus`, `reinv60 = 0.60 * surplus`.
7. **Commission Fallback**
   - If no commission, `commFallback = COMM_RATE * grossPreTax` goes to PRF; else `commFallback = 0`.
8. **PRF Contribution Summary**
   - `prfContribution = prfSeed + reinv60 + commFallback + prfDraw` (captures net change, prfDraw is negative when used).
9. **Outputs**
   - Provide structured payload: grossPreTax, commission, charReimb, partner share + totals, employee pot, wageBill, surplus, owner40, reinv60, prfDraw, prfContribution, commFallback, invoice metadata, fund deltas.

### Configurable Settings Matrix
| Constant / Rule              | Default Value | Editable via Advanced Options? | Notes |
| --------------------------- | ------------- | ------------------------------ | ----- |
| Tax rate                    | 0.14975       | Yes                            | Applies to normalize gross input. |
| Commission rate             | 0.10          | Yes (global) + per-rep override | Global fallback; individual reps can store their own % in the catalog. |
| Charbel reimbursement share | 18% of gross  | Yes                            | Impacts CharbelOwed fund. |
| PRF seed share              | 18% of gross  | Yes                            | Direct input to PRF before other contributions. |
| Labour pool share           | 54% of gross  | Yes                            | Drives partner/employee share calculation. |
| Surplus split (owner/reinv) | 40% / 60%     | Yes                            | Determines post-wage surplus allocation. |
| Commission fallback logic   | Enabled       | Toggle + value                 | When commission disabled, fallback % of gross routed to PRF. |
| Invoice generation rule     | Taxed jobs only | Toggle + format options      | Controls whether non-taxed jobs can still receive invoice numbers. |
| PRF draw behavior           | Cover wage shortfall | Toggle thresholds       | Determines whether PRF auto-covers deficits or raises warning. |

## Persistence Model
- **Job (History) Record** – single source of truth with fields: date, grossPreTax, withTax flag, partner CSV, employee summary, wageBill, commission, rep, charReimb, partnerPay, employeePot, surplus, owner40, reinv60, prfContribution, invoiceNumber, jobId.
- **PartnersLog** – one row per partner per job `(date, partner, share, jobId)`.
- **PartnersTotals** – lifetime totals per partner (increment/decrement on log/undo).
- **Owners40Totals** – aggregate owner40 running sum.
- **PayrollLog** – one row per employee per job `(date, employee, hours, rate, wage, jobId)`.
- **RepLog** – only when commission is used `(date, rep, commission, jobId)`.
- **Funds Store** – key/value totals for `PRF`, `CharbelOwed`, future reserves.
- **InvoiceTracker** – {year -> lastSequence}; invoice assigned only when tax flag is true.

## Undo Semantics
- Undo targets **only the last inserted Job**.
- Execution must be transactional/locked so no concurrent mutation slips in.
- Steps when undoing:
  1. Read the most recent Job record.
  2. Delete dependent logs (PartnersLog, PayrollLog, RepLog) by `jobId`.
  3. Reverse totals (`PartnersTotals`, `Owners40Totals`).
  4. Reverse funds (`CharbelOwed += charReimb`, `PRF -= prfContribution`).
  5. Rewind invoice tracker only if the invoice belongs to the latest issued sequence for that year.
  6. Remove the Job record and rebuild/recalculate summaries.

## Reporting & Summaries
- **Weekly Summary** – bucket PayrollLog rows by week ending Saturday; aggregate hours and wages per employee.
- **Daily Summary (Current Week)** – aggregate current week entries per day/employee.
- **This-week Pay Widget** – quick glance of hours + wages per employee for the week starting Saturday.
- Summaries recalc after every Calculate/Undo to stay in sync.

## Decisions & Open Questions
1. **Commission impact on pools** – legacy behavior *tracked* commission but did not subtract it from any pool (other than skipping PRF fallback). Decide whether the new system should explicitly deduct commission from available gross distributions.
2. **Data storage** – confirm final storage tech (Sheets-compatible? SQL? Firestore?) because undo/transactions depend on locking semantics.
3. **Partner/Employee catalogs** – define ownership (manual admin UI vs. synced data source) and how changes affect historical entries.
4. **New UX flow** – determine how we expose speed-first interactions (e.g., auto-calculating on change vs. explicit "Calculate" button) without violating logging guarantees.

Update this document whenever we clarify rules or add new functionality so implementation always mirrors the agreed specification.

## Client Roster & Job History
- Every entry emitted by the modal is now persisted through the Nest API (`POST /entries`). The saved payload includes the original form data, hedge configs, calendar info (start/end/time zone), and the Google Calendar `eventId` returned by the sync step so future edits can target the same calendar record.
- The backend keeps an append-only array of saved entries (currently in-memory while we stand up a real datastore). Each record receives a generated `id` and `createdAt` timestamp for auditing.
- A derived client roster is kept in sync automatically. Deduplication uses email (preferred), otherwise normalized phone number, otherwise `first+last+address`. Each client summary tracks full name, address, phone/email, total jobs logged, last job timestamp, and the most recent calendar event id.
- New API surface:
  - `GET /entries` – returns the raw entry history (future undo pipeline will read from here).
  - `GET /entries/clients` – returns the deduped client roster described above.
- The frontend’s `HomeDataService.saveEntry` now calls the repository service instead of logging to the console, ensuring every job immediately appears in the roster/history datasets.
- Future correction flows will mutate job data via this API so calendar edits + CRM updates stay auditable end-to-end.
