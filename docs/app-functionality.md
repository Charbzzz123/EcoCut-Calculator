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
- **Primary CTA**: prominent “New Job” button available above the fold and as a floating action button on mobile.
- **Hero Metrics** (card grid): Jobs logged today, Today’s gross pre-tax total, Current PRF balance, Outstanding Charbel owed.
- **Action Shortcuts**: quick links for `New Job`, `Undo Last Entry`, `Manage Employees`, `Advanced Options`.
- **Activity Feed**: recent jobs list showing partner names, gross amount, status, and timestamp with a link to view details.
- **Alerts Panel**: notifications for configuration changes, commission updates, or payroll anomalies requiring attention.
- **Insights Widgets**: weekly payroll snapshot (hours + wages per employee) and PRF trend mini-chart.
- **Performance Considerations**: load hero metrics within 1s, use skeleton loaders for lists, ensure layout adapts to single-column on mobile while keeping the New Job CTA thumb-reachable.

## Inputs & Data Sources
- **Employee Catalog**: `[name, rate]` tuples powering the employee picker + validation.
- **Representative Catalog**: `[name, baseCommissionRate]` list for commission selection (default 10% but editable per rep).
- **Partners List**: dynamic dataset defining available partners (needed for both split math and logs).
- **Funds Snapshot**: `PRF`, `CharbelOwed`, and future funds; required for display + mutation.
- **Invoice Tracker**: map of `{year -> lastSequence}` to generate IDs like `2026-004`.

### Dynamic Data Management Requirements
- Manage every catalog (Partners, Employees, Representatives) directly in the app via admin screens:
  - Add/remove/update entries without redeploying; persist changes immediately.
  - Employee records capture name, hourly rate, optional default hours.
  - Representative records capture name plus individualized commission rate (fall back to 10% global default when unspecified).
  - Partner records capture name and any metadata needed for reporting.
- Advanced Options panel exposes calculation constants (tax rate, reserve %, labour %, surplus split, commission fallback %) so admins can adjust values with audit trails.
- Changes propagate instantly to the calculator UI (forms rehydrate from live datasets).
- Capture who/when updates are made for traceability (user + timestamp fields or an audit log).

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

