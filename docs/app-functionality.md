# EcoCut Calculator â€“ Functionality Catalog

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

- **Primary CTA**: â€œAdd Entryâ€ pill button above the fold plus a floating CTA pinned to the bottom-right. Hover/click reveals quick sub-actions (`+ Warm Lead`, `+ Customer / Closed`) that trigger their respective flows; options auto-hide when focus leaves the button group.
- **Layout**: hero header with an â€œOperations snapshotâ€ eyebrow, welcome copy, and hero metrics grid; quick action tiles live immediately below so users can jump to core operations without scrolling.
- **Theme**: dark evergreen palette with EcoCut logo + mascot imagery in the hero to reinforce branding while keeping contrast WCAG-compliant.
- **Hero Metrics** (card grid): Jobs logged today, Todayâ€™s gross pre-tax total, Current PRF balance, Outstanding Charbel owed.
- **Action Shortcuts**: quick links for `Start Next Job`, `Manage Employees`, `Clients`, `Schedule`, `Finances`, `Performance Stats`, `Client Broadcast`, and `Advanced Options`.
- **Activity Feed**: recent jobs list showing partner names, gross amount, status, and timestamp with a link to view details.
- **Alerts Panel**: notifications for configuration changes, commission updates, or payroll anomalies requiring attention.
- **Insights Widgets**: weekly payroll snapshot (hours + wages per employee) and PRF trend mini-chart.
- **Performance Considerations**: load hero metrics within 1s, use skeleton loaders for lists, ensure layout adapts to single-column on mobile while keeping the New Job CTA thumb-reachable.

### Warm Lead / Customer Entry Modal

- Launched from the â€œAdd Entryâ€ dropdown (floating CTA). Two variants reuse the same component: **Warm Lead** (default) and **Customer / Closed** (used for future scheduling + client conversion work).
- **Required form fields**: first name, last name, home address, phone number, job type (Hedge Trimming, Rabattage, Both), job value. Optional: desired budget, additional details textarea.
- **Address verification (rollout in progress)**:
  - Address entry uses debounced provider suggestions (3000ms) and requires selecting a provider suggestion when strict mode is enabled.
  - Validation happens server-side from suggestion id (not raw free text) to ensure a complete civic address.
  - Usage guardrails pause lookup automatically when monthly caps are reached.
  - Search calls are minimized via min-length threshold (3 chars) and frontend query caching to control paid API usage.
- **Dynamic job-type guard**: the hedge canvas only appears after a job type is picked so we donâ€™t waste rendering cycles for visitors who are just scanning the form.
- **Interactive hedge canvas**:
  - Uses `public/assets/warm-lead/a_bird_s_eye_view_digital_illustration_showcases_a.png` as the background plus eight SVG polygons (`hedge-1`..`hedge-8`).
  - Clicking a polygon cycles `None ? Trim ? Rabattage ? None`, highlights the hedge, and opens an anchored panel near the clicked region (position is clamped within the SVG bounds).
  - Trim state offers combinable toggles (Inside / Top / Outside) plus mutually exclusive presets (Normal, Total). Rabattage state offers mutually exclusive radio options (Partial, Total, Total w/out roots); choosing Partial forces the â€œHow much to trim offâ€ textarea.
  - Each hedge stores its own config; saving validates partial text, unsaved states remain highlighted, and clearing a hedge resets its saved payload.
  - **Map-or-details save guard**: saving is blocked unless at least one hedge is mapped or `Additional details` contains text. This applies to both Warm Lead and Customer entries so the crew always gets either a mapped plan or an explicit written note.
  - **Selected-hedge configuration guard**: any selected hedge must be fully configured before save. Trim requires either custom checkboxes (Inside/Top/Outside) or a preset (Normal/Total), and Rabattage partial requires the amount text.
- **Panel UX safeguards**: only one panel open at a time, Cancel resets transient edits, OK persists the config. Inline errors are shown for missing partial text.
- **Submission flow**: emitting the modal payload returns `variant`, `form` data, and the per-hedge config record for domain services/undo. Successful save resets the modal and closes it; Close/Cancel also reset state without emitting.
- **Roadmap hooks**: Customer variant will later add calendar scheduling + warm-lead ? customer conversion. Keep the shared component evolutive (theme tokens, signal-driven state, full test coverage).
- **Customer scheduling requirements**:
  - Customer variant now surfaces a **Schedule on EcoCut Calendar** block. Date, start time, and end time are mandatory; the Save button remains disabled until theyâ€™re valid.
  - The calendar block displays a live availability feed pulled from EcoCutâ€™s Google Calendar (via the Nest proxy). Users can see existing jobs for the selected date (times shown in the browserâ€™s timezone) and pick an open slot without leaving the modal. Loading and error states are clearly messaged.
  - Existing events show up with `Edit` and `Delete` controls. Editing pre-fills the timeline/grid so schedulers can tweak the slot in place; deleting issues a `DELETE /calendar/events/:eventId` call via the proxy and refreshes availability immediately.
- **Interactive day timeline**:
  - Replaces the static slot-only picker with a Google Calendar-style vertical day view (7?AM?â€“?8?PM) inside the modal. Users click and drag directly on the column to select any custom window; the controls auto-fill start/end times from the selection.
  - Existing Google events render as stacked blocks with overlap detection. When the chosen window collides with an existing job, a conflict banner appears and Save stays disabled until the user explicitly overrides (so double-bookings are intentional).
  - A live â€œcurrent timeâ€ line appears when viewing today, giving schedulers real-time context. The view gracefully handles parallel teams by laying blocks side-by-side and labeling them with summary + location.
- **Calendar view modes (day/week/month)**:
  - The schedule section now exposes `Day`, `Week`, and `Month` toggles with `Prev`, `Today`, and `Next` window navigation.
  - Week and month views provide quick-glance load indicators per day (event count, first event preview, and busy bar) so dispatch can spot crowded days before booking.
  - Clicking any day from week/month jumps back to day mode for that date, preserving the existing drag-to-select timeline behavior and Date/Start/End synchronization.
- **Calendar event auto-generation**:
  - When a customer entry is saved the frontend builds a structured event description (contact info, job value, hedge plan breakdown, additional details) and sends it to the Nest backend (`POST /calendar/events`). Location defaults to the customer address.
  - The response `eventId` is stored alongside the entry payload so future edits can call `PATCH /calendar/events/:eventId` and removals can call `DELETE /calendar/events/:eventId` through the same proxy.
- **Suggested slot picker**:
  - Customer entries show an â€œSuggested time slotsâ€ grid once a date is chosen. Slots mirror the standard crew day (08:00â€“17:00).
  - Slots automatically disable when the backend reports a conflicting Google Calendar event. Available slots autofill the start/end controls and highlight the selection; manual edits clear the chip state.
  - Hover/click feedback is instant so schedulers can pick a slot in under a second.
- **Live availability feed**:
  - The â€œUpcoming eventsâ€ panel now refreshes via the Nest proxy so the list matches Google Calendar in real time. Loading, empty, and error states are rendered inline with helper copy.
  - When the backend fails (e.g., missing credentials) we keep the modal usable but display a warning banner (â€œUnable to load Google Calendar availability right now.â€).
- **Validation rules**:
  - Customer variant cannot be saved until date, start, and end times are provided and the range is valid (end after start). Inline helpers (â€œRequiredâ€ or â€œEnd time must be after the start timeâ€) surface under each field.
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
- **Calendar Sync (backend)**: When an entry is logged (job, warm lead, or closed customer), the server can optionally push it to EcoCutâ€™s Google Calendar by calling `/calendar/events`. Event metadata includes summary, description, time window, and attendee list. Updates route through `PATCH /calendar/events/:eventId`, and undo/removals issue the corresponding `DELETE` call so Google Calendar always mirrors the job ledger.

#### Admin UX Requirements

- **Audit & Traceability**
  - Record every change with: record ID, field changed, previous value, new value, actor, timestamp.
  - Provide history view per entity and allow Owners to revert to a prior state.
  - Retain audit logs indefinitely unless retention policy is defined later.
- **Access Control**
  - Roles:
    - **Owner** â€“ full control (catalog CRUD, advanced options, funds overrides, undo, future clock-in approvals).
    - **Manager** â€“ can add employees and adjust their hours/default schedules; can initiate employee clock-ins once that feature ships; read-only for other catalogs/settings.
    - **Employee** â€“ view-only access to their assignments/summaries.
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
  - Prevent deletion if employee appears in current week jobsâ€”require archive (inactive) instead.
- **Representatives Manager**
  - List with Name, Commission %, Active flag.
  - Validation: commission between 0 and 100%; decimal precision to 2 places.
  - Fall back to global commission when field blank (UI hint).
  - Provide bulk assign to set same commission across selected reps.
- **Advanced Options Panel**
  - Form groups by category (Taxation, Splits, Invoice Rules, Safety Nets).
  - Each field shows default + current values and tooltips explaining downstream impact.
  - Require confirmation modal summarizing changes before saving; include â€œeffective fromâ€ timestamp.
  - Persist changes versioned; show history list with revert option.
- **General UX**
  - Optimistic updates with toasts on success; rollback on failure.
  - Autosave disabledâ€”explicit Save button to avoid accidental edits.
  - All forms must surface validation errors inline plus summary banner.
  - Provide search/filter on each catalog screen for speed with large datasets.

### Manage Employees Workspace (Current Release)

- **Current status**: route + shell live with roster search/filter, active/inactive status filtering, summary metrics, owner-safe profile create/edit/archive, a dedicated hours editor (per-employee logs + totals), clock in/out cards with role-guarded actions, a per-employee history timeline (site/address + scheduled windows + status + rollups), and a Start Next Job readiness contract preview panel, all backed by `/employees` API data instead of static seed-only frontend state.
- **Primary goal**: give Owners/Managers one place to manage staff, track hours, and review employee job history before we enable full `Start Next Job` assignment flows.
- **Roster view**
  - Search + status filters (active/inactive) with a compact, fast list.
  - Core columns: Name, Role, Hourly rate, Availability status, Last activity.
- **Employee profile panel**
  - Editable fields: first/last name, phone, email, role, hourly rate, notes.
  - Archive action (soft delete) only; no hard delete from UI.
- **Hours management**
  - Managers can update hours entries; Owners can edit all staffing/compensation fields.
  - Every hours edit records actor, timestamp, previous value, and new value.
  - Hours editor now requires choosing a **linked job mode**: either a saved client job or `No linked job (manual correction)`.
  - When a linked job is selected, site/address is always derived from that job (read-only) and saved hours keep the job reference.
  - Manual-correction mode hides site/address entry and allows an optional correction note for payroll context.
- **Clock in / Clock out**
  - Managers and Owners can clock active employees in/out directly from the workspace.
  - Clock sessions persist into `/employees/hours` with `source=clock`, `clockInAt`, `clockOutAt`, `updatedByRole`, and `updatedAt` audit fields.
  - Guards prevent invalid transitions (double clock-in, clock-out without an open session, or clocking inactive employees).
- **Employee job history**
  - Per-employee timeline of assigned jobs showing site/address, date, scheduled window, status, and hours worked on that job.
  - Totals rollups: jobs tracked, completed vs scheduled counts, total hours, and recent site summary.
  - Lifecycle rollups now also include completed-on-time, completed-late, scheduled-late, and continuity counts.
  - Linked manual hours now generate/update a corresponding completed timeline row, so hours logging and history stay synchronized.
  - This history becomes the data source for future assignment suggestions in `Start Next Job`.
- **Start Next Job readiness contract**
  - For each employee we now expose: readiness state (`available`, `scheduled`, `inactive`), upcoming scheduled windows, next scheduled slot, next available time, completed/scheduled job counts, completed/scheduled hours, last completed site/date, and overlap/conflict flag.
  - The contract is now produced by the backend `/employees/readiness` endpoint and consumed by the Employees facade, so future assignment screens can consume one normalized source without recomputing availability rules in multiple places.
- **Permissions**
  - Owner: full control.
  - Manager: add employee + edit hours.
  - Employee: view-only.
  - Current release enforces these guards in both frontend facade/UI and backend `/employees` API endpoints (via operator-role checks), so unauthorized profile/archive writes are blocked server-side too.
- **Validation and safeguards**
  - Required contact/rate fields with strict phone/email formatting.
  - Prevent duplicate employee creation using normalized name + phone/email checks.
  - Block save with a clear missing-field summary when required inputs are incomplete.
- **UX hierarchy pass (completed)**
  - Consolidated roster counts into the controls area (single canonical `Showing X employee(s)` line + summary cards) so operators see key state before scrolling.
  - Removed the static workflow text block from default view to reduce non-actionable UI noise.
  - Kept workspace-mode jump controls focused on global context (`Roster focus`, `Clock board`, `Assignment readiness`) while making them compact for faster scanning.
- **Roster-first flow simplification (completed)**
  - Added a dedicated workspace-mode switch that defaults to roster focus and keeps only high-level sections (`Clock board`, `Assignment readiness`) in global nav to reduce cognitive load.
  - Readiness was moved behind explicit mode selection so daily operations (roster/profile/hours/history) stay front-and-center.
  - Loading/error/empty messages now opt into shared workspace-state styling hooks so operational feedback reads consistently across employee/job screens.
  - Status chips and action buttons now consume shared workspace tokens (default/primary/danger emphasis) so control hierarchy matches Start Next Job.
  - Added explicit `Primary controls` vs `Advanced controls` grouping in the toolbar so core actions (search, refresh, add) are visually separated from operator/status toggles.
  - Workspace mode now stays sticky and visually smaller while scrolling so context remains visible without dominating the page; profile/hours/history views are launched from per-employee card actions instead of global buttons.
- **Queued next slices**
  - None right now (ME-1 through ME-21 complete).

### Start Next Job Assignment Board (Current Release)

- **Route**: `/jobs/start` (triggered by the home quick action `Start Next Job`).
- **Step order (current)**: `Step 1 Job -> Step 2 Crew -> Step 3 Review`, with Scheduled history as a separate workspace panel.
- **Inputs**: linked client job mode (**required**), job label, site/address, scheduled start/end, crew search filter.
- **Linked job mode requirement**:
  - Operators must explicitly choose either a linked client job or `No specific client job (manual)`.
  - Linked job mode auto-fills label/address/schedule and keeps those fields read-only.
  - Manual mode keeps fields editable.
- **Linked job picker feed**:
  - Linked jobs now expose lifecycle status: `Scheduled`, `Late`, or `Completed`.
  - Default picker groups show `Scheduled + late jobs` first.
  - `Completed` jobs stay hidden unless operators explicitly enable `Show completed jobs (advanced)` in Step 2.
- **Completed-job continuity flow**:
  - When a completed linked job is selected, continuity details are now mandatory (`category` + `reason`) before save.
  - Saving creates a new scheduled follow-up segment linked to the latest completed source record while preserving the original completed entry.
  - Continuity metadata is persisted on history/hours rows for issue-return tracking and payroll/audit context.
- **Crew picker**: operators can select/deselect employees from live readiness records (`/employees/readiness`) with status badges (`Available`, `Scheduled`, `Inactive`).
- **Conflict checks**: selection validates inactive members, existing readiness conflicts, next-available constraints, and overlap against upcoming windows before draft can proceed.
- **Draft readiness**: panel shows blocking reasons until required fields + crew are valid and conflict-free.
- **Workflow guidance strip**: top-of-page guided strip keeps one row of step actions (`Step 1 crew`, `Step 2 draft`, `Step 3 review`, `Scheduled history`) plus live readiness messaging.
- **Single-step workspace flow**: only one major board panel is rendered at a time (Crew, Draft, Review, or Scheduled history) to cut page clutter and keep operator focus on the current task.
- **Step locks + readiness messaging**: draft/review/history jump controls stay disabled until prerequisites are met, and inline status rows explicitly call out what is still missing (`select crew`, `capture draft details`, `resolve blockers`).
- **Progressive CTAs**: `Continue to Step 2` appears in the crew panel, `Continue to Step 3` appears in draft, and explicit `Back to Step ...` actions are present in Draft/Review/History to keep navigation predictable.
- **Progressive disclosure refresh**: Step 2 advanced controls and Step 3 analytics details stay collapsible, while scheduled-history lifecycle actions live in their own dedicated history step.
- **Review-first save action**: primary `Save assignment` now sits in Step 3 review so validation blockers, conflicts, and analytics context are visible when confirming.
- **Crew history context**: selected crew history list is sourced from `/employees/history` so schedulers can verify recent assignments before confirming.
- **Persistence wiring**: `Save assignment` now calls `/employees/assignments/start-next-job`, which writes scheduled history rows plus assignment-source hours entries for each selected employee and refreshes readiness/history immediately after save.
- **Linked job sync**: Step 2 now supports selecting a saved client job from `/employees/job-options`. When linked, draft site/address/schedule auto-fill from the entry and the saved assignment persists `jobEntryId` into both history + assignment hours records so employee operations stay tied to the source client job.
- **Completion workflow**: scheduled history entries can still be marked complete through lifecycle controls (`/employees/history/:entryId/complete`) for exception handling, while day-to-day execution now follows `Start job` -> `End job`.
- **Lifecycle controls**: scheduled history cards now support `Edit schedule` and `Cancel assignment` actions. Edits call `/employees/history/:entryId/schedule`; cancel calls `/employees/history/:entryId/cancel`. Both flows refresh readiness/history and keep linked assignment-hours entries aligned with schedule changes.
- **Reassignment controls**: scheduled cards support `Reassign to ...` when exactly one different active crew member is selected. Reassign calls `/employees/history/:entryId/reassign`, runs overlap checks, and moves linked assignment-hours entries to the new employee.
- **Run lifecycle controls**: scheduled history cards now expose explicit runtime controls: `Start job` (opens an active run) and `End job` (closes the run and auto-clocks out remaining crew for that assignment).
- **Mid-run crew clock-out**: while a run is active, each employee card now exposes `Clock out member` so one person can leave early without ending the full run; optional note text is saved for payroll/audit context.
- **Active-run guardrails**:
  - Operators cannot select a crew member for a new assignment when that employee is already active on another run.
  - Active runs cannot be edited/cancelled/reassigned until `End job` is executed.
  - Multiple assignment runs can stay active in parallel as long as no employee is active in more than one run.
- **Bulk lifecycle controls**: schedulers can multi-select scheduled history entries and run `Complete selected` or `Cancel selected` actions from the same panel. The board reports partial failures (for example, 3 of 4 succeeded) and keeps failed rows selected for quick retry.
- **Optimistic board updates**: schedule edits and lifecycle actions now patch board state immediately (history + readiness summaries) with rollback when an API call fails, so operators get instant feedback without waiting for full board reloads.
- **Post-mutation canonical refresh**: after assignment and lifecycle mutations succeed, the board re-syncs readiness/history/job-options from `/api/employees/*` to prevent stale optimistic drift between Start Next Job and Manage Employees modules.
- **Assignment analytics panel**: the summary column now shows selected-crew analytics (tracked, scheduled, completed, cancelled, completed-on-time, completed-late, scheduled-late, continuity segments, total/average hours, completion/cancellation rates, unique sites) so dispatch decisions stay data-driven during scheduling.
- **Server lifecycle reporting parity**: backend now exposes `GET /employees/reporting/lifecycle` so dashboards/exports can retrieve the same completed-on-time, completed-late, scheduled-late, and continuity rollups that UI analytics cards use.
- **Analytics export**: Step 2 now includes `Export CSV`, which downloads selected-crew analytics plus detailed history rows (employee, status, site/address, scheduled window, and hours) for handoff/reporting.
- **Date-range analytics window**: Step 2 now supports `From`/`To` filters for analytics; invalid ranges are blocked with inline guidance, and both panel metrics + CSV export respect the selected window.
- **Per-employee trend drill-down**: Step 2 now renders employee-level trend cards (status counts, total/average hours, completion/cancellation rates, last site, last scheduled slot) so supervisors can compare crew members before finalizing dispatch.
- **Route-level variance drill-down**: Step 2 now renders per-route cards (site/address, status mix, total/average hours, completion/cancellation rates, and average-hours variance vs crew average) so supervisors can spot heavy routes before dispatch.
- **Cross-run trend analytics**: Step 2 now includes analytics window shortcuts (`7 days`, `30 days`, `90 days`, `Custom`) plus per-day trend cards (hours-share bar, status mix, completion/cancellation rates) to compare run quality over time inside the same board.
- **Progressive analytics disclosure (completed)**: core KPI cards (tracked/scheduled/completed/cancelled/hours/rates/sites) remain visible by default, while heavy trend sections (employee, route variance, cross-run) are collapsed behind a `Show detailed analytics` toggle.
- **State-message consistency (completed)**: loading/error/empty states now use shared workspace-state styling hooks that match Manage Employees feedback cards.
- **Global mutation feedback toast**: save lifecycle messages (saving/success/error) now render in one banner above the workflow panels so assignment/history actions always return visible feedback regardless of the currently focused step; non-saving messages can be dismissed manually.
- **Blocker-action affordances**: each Step 3 validation blocker now exposes a direct action (`Fix in Step 1`, `Go to Step 2`, `Open continuity`) that jumps operators to the right section and expands continuity controls when needed.
- **Button/chip consistency (completed)**: review/workflow actions and readiness/status chips now use the same visual token hierarchy used in Manage Employees (default, primary, danger emphasis).
- **Validation + accessibility clarity (completed)**: required draft/profile/hours fields now expose explicit required semantics, validation blockers are announced in assertive live regions, and step/workspace controls expose ARIA pressed/expanded state for keyboard/screen-reader clarity.
- **Step-2 hierarchy grouping (completed)**: Start Next Job draft now separates `Primary details` from `Advanced controls` so essential scheduling fields stay visually dominant.

#### Start Next Job - Next Evolution (Planned)

- **Status + tracking outcomes**:
  - Each run tracks planned window vs actual execution and flags `on schedule`, `late`, or `in advance`.
  - Continuity segments already append to the same client-job lineage; next step is exposing dedicated issue-rate dashboards on top of that data.
- **Cross-module consistency requirement**:
  - Start Next Job lifecycle events must stay synchronized with Manage Employees (clock board, hours log, history timeline, readiness), so payroll and operational analytics read from one coherent event stream.

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

| Constant / Rule             | Default Value        | Editable via Advanced Options?  | Notes                                                                  |
| --------------------------- | -------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| Tax rate                    | 0.14975              | Yes                             | Applies to normalize gross input.                                      |
| Commission rate             | 0.10                 | Yes (global) + per-rep override | Global fallback; individual reps can store their own % in the catalog. |
| Charbel reimbursement share | 18% of gross         | Yes                             | Impacts CharbelOwed fund.                                              |
| PRF seed share              | 18% of gross         | Yes                             | Direct input to PRF before other contributions.                        |
| Labour pool share           | 54% of gross         | Yes                             | Drives partner/employee share calculation.                             |
| Surplus split (owner/reinv) | 40% / 60%            | Yes                             | Determines post-wage surplus allocation.                               |
| Commission fallback logic   | Enabled              | Toggle + value                  | When commission disabled, fallback % of gross routed to PRF.           |
| Invoice generation rule     | Taxed jobs only      | Toggle + format options         | Controls whether non-taxed jobs can still receive invoice numbers.     |
| PRF draw behavior           | Cover wage shortfall | Toggle thresholds               | Determines whether PRF auto-covers deficits or raises warning.         |

## Persistence Model

- **Job (History) Record** â€“ single source of truth with fields: date, grossPreTax, withTax flag, partner CSV, employee summary, wageBill, commission, rep, charReimb, partnerPay, employeePot, surplus, owner40, reinv60, prfContribution, invoiceNumber, jobId.
- **PartnersLog** â€“ one row per partner per job `(date, partner, share, jobId)`.
- **PartnersTotals** â€“ lifetime totals per partner (increment/decrement on log/undo).
- **Owners40Totals** â€“ aggregate owner40 running sum.
- **PayrollLog** â€“ one row per employee per job `(date, employee, hours, rate, wage, jobId)`.
- **RepLog** â€“ only when commission is used `(date, rep, commission, jobId)`.
- **Funds Store** â€“ key/value totals for `PRF`, `CharbelOwed`, future reserves.
- **InvoiceTracker** â€“ {year -> lastSequence}; invoice assigned only when tax flag is true.

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

- **Weekly Summary** â€“ bucket PayrollLog rows by week ending Saturday; aggregate hours and wages per employee.
- **Daily Summary (Current Week)** â€“ aggregate current week entries per day/employee.
- **This-week Pay Widget** â€“ quick glance of hours + wages per employee for the week starting Saturday.
- Summaries recalc after every Calculate/Undo to stay in sync.

## Decisions & Open Questions

1. **Commission impact on pools** â€“ legacy behavior _tracked_ commission but did not subtract it from any pool (other than skipping PRF fallback). Decide whether the new system should explicitly deduct commission from available gross distributions.
2. **Data storage** â€“ confirm final storage tech (Sheets-compatible? SQL? Firestore?) because undo/transactions depend on locking semantics.
3. **Partner/Employee catalogs** â€“ define ownership (manual admin UI vs. synced data source) and how changes affect historical entries.
4. **New UX flow** â€“ determine how we expose speed-first interactions (e.g., auto-calculating on change vs. explicit "Calculate" button) without violating logging guarantees.

Update this document whenever we clarify rules or add new functionality so implementation always mirrors the agreed specification.

## Client Roster & Job History

- Every entry emitted by the modal is now persisted through the Nest API (`POST /entries`). The saved payload includes the original form data, hedge configs, calendar info (start/end/time zone), and the Google Calendar `eventId` returned by the sync step so future edits can target the same calendar record.
- The backend now persists an append-only array of saved entries to a SQLite database (`ENTRIES_DB_PATH`, default `server/data/entries.db`). Each record receives a generated `id` and `createdAt` timestamp for auditing, and the repository automatically migrates any legacy JSON snapshot on first boot.
- A derived client roster is kept in sync automatically. Deduplication uses email (preferred), otherwise normalized phone number, otherwise `first+last+address`. Each client summary tracks full name, address, phone/email, total jobs logged, last job timestamp, and the most recent calendar event id.
- New API surface:
  - `GET /entries` â€“ returns the raw entry history (future undo pipeline will read from here).
  - `GET /entries/clients` â€“ returns the deduped client roster described above.
- The frontendâ€™s `HomeDataService.saveEntry` now calls the repository service instead of logging to the console, ensuring every job immediately appears in the roster/history datasets.
- Future correction flows will mutate job data via this API so calendar edits + CRM updates stay auditable end-to-end.

### Client book UI (current release)

- **Access**: Quick action â€œClientsâ€ on the home dashboard navigates to `/clients`, a dedicated view styled like the existing dark hero but optimized for CRM data. A back link returns to the dashboard without refreshing.
- **Insights strip**: three cards show total clients, cumulative jobs logged, and the most recent job timestamp (auto-formatted). These values update instantly when the roster refreshes.
- **Search & refresh**: sticky toolbar with a pill-shaped search field (name, address, phone, email) plus a refresh button that re-queries `/entries/clients`. Typing debounces at 150?ms so the list feels instant.
- **Roster list**: stacked cards displaying name, job count, contact info, address, and â€œLast jobâ€ timestamp. List is keyboard accessible, announces changes via `aria-live`, and shows informative states (loading, empty, error with retry).
- **Performance expectations**: roster fetch must resolve in <600?ms for average data sets; filtering stays client-side until we add pagination. Coverage includes loading/error paths so the feature remains evolutive.

#### Client detail drawer

- Clicking a client card opens a right-side drawer (kept entirely within the Clients view) that shows contact info, aggregate stats, and the entire job history for that customer. Drawer loads data via `GET /entries/clients/:clientId` and stays responsive with loading + error states.
- Job history entries list the scheduled timestamp (taken from the Google Calendar slot when available), variant (warm lead or customer), job type/value, desired budget, location, contact info, calendar window (start/end plus timezone), and any additional notes captured on the entry form.
- If calendar info exists on a history item we display the precise time range so schedulers can trace what was booked in Google Calendar for that job.
- Roster search ignores phone-number punctuation so typing digits only (e.g., 4385551111) still matches entries formatted as (438) 555-1111, and the "Last job" timestamps mirror the scheduled slot instead of the entry creation time.
- Drawer can be closed via the header button, backdrop click, or Escape. An inline Retry button re-fetches the detail if the initial call fails.
- The roster remains keyboard-friendly: cards render as buttons so the drawer can be opened without a mouse, and focus is trapped inside the drawer until itâ€™s closed.
- All drawer logic is signal-driven and fully covered by unit tests so future CRM actions (quick actions, edit flows) can be added without refactoring the roster list again.

### Client broadcast workspace

- **Access and navigation**: Home quick action **Client Broadcast** must open `/communications/broadcast` (same lazy-load pattern as `/clients`). The page keeps the same dark evergreen surface style, floating accents, and button language as Clients/Home.
- **Audience panel** (implemented):
  - Default mode is **All clients**.
  - Active filters: search by name/address/phone/email, has email, has phone, last serviced window, and upcoming job window.
  - Live counts render total recipients, SMS-capable recipients, Email-capable recipients, and dual-channel recipients.
  - Exclusion summary shows how many recipients are missing email, missing SMS, missing both, and excluded by the currently selected channel.
  - A compact scrollable recipient preview list is always visible under filters so operators can quickly verify who is currently included before sending.
  - Recipient rows now include eligibility badges (`Email + SMS`, `Email only`, `SMS only`, `Missing channel`) for at-a-glance verification.
- **Channel selection** (implemented):
  - Modes: `Email`, `SMS`, `Both`.
  - Validation blocks dispatch when selected channel has zero eligible recipients and surfaces a clear inline error.
  - Step 2 now includes a mandatory **Confirm channel selection** action; changing channel after confirming requires reconfirmation before test send or dispatch can proceed.
- **Message composer** (implemented):
  - Subject line (required for email).
  - Message body with reusable variable chips (for example: `{{firstName}}`, `{{address}}`, `{{nextJobDate}}`).
  - Optional CTA link and optional internal note (not sent to clients).
  - Character counter and estimated segment count for SMS.
- **Preview and safety controls**:
  - Real-time preview card for email and SMS rendering (implemented).
  - Preview supports selecting a specific client to render the exact final message after merge fields and fallback values are applied (implemented).
  - Preview navigation now includes `Previous` / `Next` controls so operators can scan multiple recipients without reopening dropdowns.
  - Layer stack is now live (implemented): base template + channel variant + segment rule + per-client override, with deterministic priority `override > segment > channel > base` and an active-layer list visible in the UI.
  - The send panel now includes a live **Estimated cost (CAD)** block showing email recipients, SMS recipients/segments, and total estimated send cost before confirmation.
  - **Send test** is live (implemented): owner/manager can target test email/SMS destinations and confirm before queueing.
  - **Schedule send** is live (implemented): dispatch can be `Send now` or `Schedule for later` via timestamp input.
  - Confirmation modal is live (implemented): shows mode, channel, recipient count, and selected schedule before final action.
  - Status banner is live (implemented): success copy confirms whether a test or broadcast was queued/scheduled.
  - Send controls now show a readiness checklist (`Recipients`, `Channel`, `Message`, `Schedule`) plus blocking-reason feedback before buttons are enabled.
  - **Backend delivery engine** is live (implemented): confirmation actions now call server endpoints (`POST /communications/test`, `POST /communications/dispatch`) instead of local stubs, and return a campaign status payload used by the UI banner.
  - **Approval flow (backend) is live (implemented)**: manager-originated sends can be held in `pending_approval` until an owner approves through campaign endpoints; campaign payload includes approval metadata.
  - **Webhook + analytics ingestion (backend) is live (implemented)**: provider events can be ingested through `POST /communications/webhooks/delivery`, and campaign-level delivery metrics are exposed through `GET /communications/campaigns/:campaignId/analytics`.
  - **Provider webhook normalization (backend) is live (implemented)**: provider-formatted payloads can be posted to `POST /communications/webhooks/delivery/:provider` where they are normalized before ingestion.
- **Operations history**:
  - List past broadcast jobs with status (`draft`, `scheduled`, `sending`, `sent`, `failed`, `partially sent`), channel, counts, creator, and timestamps.
  - Ability to reopen a draft, duplicate a prior campaign, or cancel a scheduled campaign.
  - Backend audit timeline endpoint is live: `GET /communications/campaigns/:campaignId/audit` returns immutable action events (`created`, `pending_approval`, `approved`, `processing`, `completed`, `failed`, `cancelled`, `suppressed`).
  - Delivery analytics endpoint is live: campaign dashboards can query totals for `sent`, `delivered`, `failed`, `bounced`, `complained`, `unsubscribed`, and `resubscribed`.
  - Campaign runtime state is durable (implemented): campaign summaries, pending approvals, audit records, delivery events, and suppression data persist in SQLite so analytics/audit survive server restarts.
- **Compliance and permissions**:
  - Owner can create, schedule, send, cancel, and view analytics.
  - Manager can create drafts and schedule sends but cannot bypass approval if approval mode is enabled.
  - Respect client opt-out flags per channel; suppressed recipients are excluded automatically and shown in summary counts.
  - Suppression controls are now backed by API endpoints (`POST /communications/suppressions/unsubscribe`, `POST /communications/suppressions/resubscribe`, `GET /communications/suppressions`) so STOP/unsubscribe events can be enforced immediately during dispatch.
  - Webhook signatures can be enforced per provider when webhook secrets are configured, preventing unsigned/invalid callback ingestion.
  - Persist consent metadata per channel (type, source, timestamp, expiry for implied consent windows) and block recipients whose consent is expired.
  - Every email message includes sender identity and unsubscribe details; one-click unsubscribe headers are required for bulk sends.
  - SMS composer should warn when copy exceeds one segment and clearly show estimated segment/cost impact before send.
  - Broadcast runs need an emergency stop control that cancels queued deliveries and prevents duplicate dispatches for the same campaign action.
  - MVP defaults: `email <= 80/day`, `sms <= 200/day`, Owner approval required before dispatch, and immediate suppression for email unsubscribes/SMS STOP events.

### Client Editing & Hedge Plan Enhancements

- Client history entries now show the saved hedge plan lines (trim/rabattage breakdown) alongside desired budget and notes so crews know exactly what was requested before rolling out.
- Each job row in the drawer exposes **Edit job** and **Delete job** actions. Edit opens the shared Entry Modal prefilled with the job payload; saving issues a "PATCH /entries/:entryId" call. Delete confirms and routes through "DELETE /entries/:entryId" to keep the roster in sync.
- Client metadata includes both **Last job** (only past-dated work) and **Next job** timestamps, mirroring the cards on the roster so upcoming bookings are obvious.
- Owners/managers can update contact info inline (first/last name, address, phone, email). Submitting emits "PATCH /entries/clients/:clientId" which updates all matching entries and refreshes the roster + drawer immediately.
- A Delete client action removes the customer (and all related jobs) via "DELETE /entries/clients/:clientId" after confirmation.
- Search continues to ignore punctuation in phone numbers/emails, so typing raw digits (e.g., 4385551111) still matches entries stored as (438) 555-1111.

### Chats workspace (planned Quo inbox replacement)

- **Goal**: ship a first-party `Chats` section that allows EcoCut operators to handle Quo SMS traffic directly inside the app (conversation list, thread view, send/reply, contact management), while keeping the existing evergreen UX language.
- **Data contract**:
  - Conversations are shown newest-to-oldest (recent activity first).
  - Threads load newest messages first, with pagination for older history.
  - Sending remains channel-safe (SMS only) and reflects `sending`, `sent`, `failed` states in the thread.
- **Client-aware workflow (locked requirement)**:
  - Selecting a client from Client Book should deep-link into Chats and auto-open that client's linked conversation.
  - Chat header should show client context (last completed job, next scheduled job, total jobs) plus quick actions back into client/job views.
- **Contact sync expectations**:
  - New/updated EcoCut clients should auto-upsert to Quo contacts using stable external linking.
  - Unknown inbound numbers should surface as unlinked chat records with explicit link/create-client actions.
- **Runtime safeguards**:
  - Enforce provider rate limits with queue/throttling.
  - Keep read-sync operations incremental and idempotent.
  - Track usage for future Finance dashboards (cost/threshold monitoring).
- **Current status**:
  - **CH-1 foundation is implemented**: typed Quo client wrapper + provider health endpoint (`GET /communications/chats/health`) are live.
  - **CH-2 mirror persistence is implemented**: conversations/messages/client-links/sync-cursors now persist in SQLite with idempotent upserts and restart-safe cursors.
  - **CH-3 sync engine is implemented**: manual `POST /communications/chats/sync` now supports `incremental`, `backfill`, and `reset` modes with timestamp cursors and paginated pull-sync.
  - **CH-4 webhook ingestion is implemented**: Quo chat webhooks now ingest via `POST /communications/chats/webhooks/quo` with optional HMAC validation, replay dedupe, and immediate mirror updates.
  - **CH-5 chats API surface is implemented**: mirror-backed conversation list/search/thread/send/read endpoints are live under `/communications/chats/*` with pagination and unread tracking.
  - **CH-6 client-contact sync is implemented**: client create/update now auto-syncs Quo contacts, manual link/unlink APIs are live under `/communications/chats/links/*`, and unknown inbound conversation resolution is live under `/communications/chats/conversations/unlinked` + `/resolve`.
  - Remaining slices (home entrypoint, chats UI, deep-linking, rollout hardening) are tracked in `docs/work-tracker.md` under CH-7 through CH-12.
