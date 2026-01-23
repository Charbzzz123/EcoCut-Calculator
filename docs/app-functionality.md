# EcoCut Calculator – Functionality Catalog

## Current State (v0.0.0)
- App boots from `src/app/app.ts` and renders the Angular starter splash screen.
- Title signal defaults to "codex" (update once branding finalized).
- Landing page displays helpful Angular resource links (placeholder content to replace).
- No routing targets, forms, or calculator logic exist yet.

## Planned Core Capabilities
1. **Quote Builder** – capture lawn size, trimming options, debris removal, and generate price in real time.
2. **Scenario Comparison** – show side-by-side cost estimates for different tiers (basic/premium/eco packages).
3. **Client Summary Export** – produce shareable PDF/email summary with line items and EcoCut branding.
4. **Job Tracker Hooks** – emit structured data for downstream scheduling/billing tools (API contract TBD).

## Non-Functional Expectations
- Instant calculations (no page reloads); keep bundle lean (<50 kB initial target already met).
- Offline-capable front end once PWA shell is added.
- Responsive layout: mobile-first at 360px, scales gracefully to desktop dashboards.

## Feature Backlog Template
For each new feature, capture:
- **User story** – who benefits and why.
- **Inputs/Outputs** – fields, units, derived values.
- **Validation rules** – ranges, required combos.
- **Data persistence** – transient vs. stored (if backend added later).
- **Dependencies** – APIs, shared components, services.

Update this file whenever we add, change, or deprecate functionality so teammates have a single source of truth.
