# EcoCut Calculator � Technical Documentation

## Overview

EcoCut Calculator is a full-stack workspace composed of:

- **Angular 21 SPA** in the repo root (`src/`) that delivers the calculator experience.
- **NestJS API** scaffold inside `/server` (currently placeholder) reserved for future persistence/integrations.

The frontend is deployed as a static site (NG build output), while the backend will expose REST/GraphQL endpoints when activated.

## Repository Layout

```
root/
+- src/                # Angular application source
+- public/             # Static assets copied at build time
+- server/             # NestJS backend (standalone package.json)
+- docs/               # Project instructions & documentation
+- package.json        # Frontend scripts/deps
+- angular.json        # Angular workspace config
+- README.md           # High-level summary
```

## Frontend Architecture

- **Entry Point:** `src/main.ts` bootstraps the standalone `App` component defined in `src/app/app.ts`.
- **Component Style:** Standalone components + Angular Signals. Routing is configured via `src/app/app.routes.ts` (empty for now).
- **Styling:** Global styles in `src/styles.scss`, component-level SCSS via `styleUrl` references.
- **HTTP/Proxy:** `app.config.ts` registers `provideHttpClient(withFetch())`. During local dev `npm start` passes `--proxy-config proxy.conf.json`, so any `/api/...` call from Angular is forwarded to the Nest server (`http://localhost:3000`). Keep backend running via `npm run server`.
- **Build:** `@angular/build:application` (esbuild + Vite dev server) configured in `angular.json`.
- **State:** Currently a single `title` signal; expand using dedicated state services/signals modules as features grow.
- **Shared UI:** `src/app/shared/ui` hosts cross-feature components such as the entry modal, brand banner, back chip, and reusable address autocomplete field so features never import from one another directly.

### Entry Modal Implementation

- **Component**: `src/app/shared/ui/entry-modal/entry-modal.component.ts` renders the warm lead / customer modal. It uses `NonNullableFormBuilder`, Angular signals for per-hedge state, and an anchored detail panel that moves based on the clicked polygon's bounding box.
- **SVG / Assets**: The hedge planner background lives in `public/assets/warm-lead/a_bird_s_eye_view_digital_illustration_showcases_a.png`. Each hedge polygon is defined in the component template (`hedge-1`�`hedge-8`). A README in that folder explains how to swap in the branded art.
- **State machine**:
  - Signals (`hedgeStates`, `savedConfigs`, `panelState`, etc.) keep the component reactive without services.
  - `cycleHedge` toggles `None ? Trim ? Rabattage ? None`, rehydrates saved configs, and clamps the contextual panel position inside the SVG container.
  - Trim configs capture either combinable sections (inside/top/outside) or presets, while Rabattage configs capture option + optional partial text.
- **Testing/coverage**: `src/app/shared/ui/entry-modal/entry-modal.component.spec.ts` holds 22 focused specs that exercise DOM interactions, state hydration, validations, and template bindings. Run `npx ng test --watch=false --coverage` to enforce the repo's �100% every file� rule (Husky hooks also run this before commits).
- **Calendar integration**:
  - `CalendarEventsService` (`src/app/shared/domain/entry/calendar-events.service.ts`) wraps the `/api/calendar/events` endpoints. The entry modal consumes it to show live availability; `HomeDataService.saveEntry` uses the same service when creating customer events.
  - `CalendarEventsService.listEventsForRange(startDate, endDate)` powers week/month overview windows without duplicating endpoint plumbing.
  - Calendar UI is now centralized in `CalendarSchedulerComponent` (`src/app/shared/ui/calendar-scheduler/calendar-scheduler.component.ts`); `EntryScheduleSectionComponent` is a compatibility wrapper so the scheduler can be dropped into future features without copy/paste.
  - `calendar-event.builder.ts` converts the payload into a Google Calendar-friendly summary/description (hedge plan, customer info, budgets, notes).
  - The customer template includes a Google Calendar-style **timeline grid** (7 AM�8 PM) rendered via `timelineHours`, `timelineEvents`, and `timelineSelection` signals. Dragging on the grid fills the start/end controls; overlapping events raise a conflict banner hooked into `selectionConflict` + `conflictConfirmed`.
  - The schedule block now includes Day/Week/Month toggles with Prev/Today/Next navigation; week and month cards are click-through shortcuts back to day mode for precise drag selection.
- **Suggested slot picker**:
  - EntryModalComponent derives a standard grid of crew slots (08:00�17:00) and compares each to the fetched Google events. Conflicts mark the chip `slot-chip--booked`, while open slots remain actionable.
  - Manual edits to the start/end inputs clear the selection, so the UI never shows a stale chip highlight.
  - Specs cover slot rebuilding, drag guards, and the DOM states for available/booked chips.
- **Integration**: `HomeShellComponent` imports the modal and toggles it from the floating �Add Entry� CTA. The component emits `EntryModalPayload` with the selected variant, normalized form payload, and hedge configs, which feed the fa�ade/server. Customer submissions automatically create a Google Calendar event via `HomeDataService`, which in turn stores the returned `eventId` back onto the payload so later edits/deletes can call the appropriate proxy endpoint.
- **Entry persistence client**: `EntryRepositoryService` (`src/app/shared/domain/entry/entry-repository.service.ts`) wraps `/api/entries` and `/api/entries/clients`. `HomeDataService.saveEntry` now awaits this service so every submission is recorded immediately (no more console stub). `listClients()` will power the future CRM dashboard without duplicating HTTP plumbing.
- **Address lookup client**: `AddressLookupService` (`src/app/shared/domain/address/address-lookup.service.ts`) wraps `/api/addresses/*` for debounced suggestions, server-side validation, and monthly usage snapshots. Address lookups use a 3000ms debounce + in-memory query cache to reduce paid autocomplete calls. UI rendering is centralized in `AddressAutocompleteFieldComponent` (`src/app/shared/ui/address-autocomplete-field/address-autocomplete-field.component.ts`) and reused by Entry Modal, Start Next Job, and Manage Employees history editing.
- **Client roster UI**: `/clients` is backed by `ClientsShellComponent` (standalone) which uses `EntryRepositoryService.listClients()` on init. The view renders summary cards, search/filter controls, and the roster list with dedicated loading/error states. Routes are defined in `app.routes.ts` (lazy loaded via `loadComponent`).
- **Manage Employees workspace (ME-1 to ME-9 UI)**: `/employees/manage` lazy-loads `ManageEmployeesShellComponent` with `EmployeesFacade` + `EmployeesDataService`. Current release includes roster retrieval/filtering, owner-safe profile create/edit/archive, operator role mode (owner vs manager), per-employee hours editing with capability guards, manager/owner clock in/out cards, employee timeline rollups, and a Start Next Job readiness contract panel (availability state, upcoming windows, next available time, conflict flag). Both reads and writes are now wired to `/api/employees/*`, with operator-role headers applied on mutating requests so backend permissions remain authoritative.
- **Manage Employees UX refinement (UX-1/UX-2/UX-5/UX-6/UX-7/UX-8 complete)**: the shell now prioritizes actionable controls over explanatory text (workflow block removed by default), groups toolbar actions into `Primary controls` vs `Advanced controls`, keeps one canonical roster count line plus summary cards in the controls region, and uses a compact sticky workspace-mode row (`Roster focus`, `Clock board`, `Assignment readiness`) to preserve context while scrolling; profile/hours/history views now open from per-employee card actions instead of global workspace pills. Workspace loading/error/empty messaging plus button/chip emphasis use shared styling tokens for consistency with Start Next Job, and form validation exposes required semantics + assertive live-region errors.
- **Start Next Job board (ME-8 + ME-21 + JX-1 + JX-2 + JX-3 + JX-4 + JX-5 + JX-6A + JX-6B + JX-6C)**: `/jobs/start` lazy-loads `StartNextJobShellComponent` with `StartNextJobFacade`. It consumes `/api/employees/readiness` + `/api/employees/history`, supports crew selection, validates scheduling conflicts against upcoming windows, persists confirmed assignments through `/api/employees/assignments/start-next-job`, and supports scheduled-history lifecycle actions (edit schedule, complete, cancel, reassign, plus bulk complete/cancel) directly from the board. Step 2 also consumes `/api/employees/job-options` so dispatch can link an assignment to an existing saved client job; linked selections auto-fill site/address/schedule and persist `jobEntryId` into assignment history + hours records. The board now starts in a job-first flow (`Job -> Crew -> Review`) with explicit required job mode selection (`linked` or `manual`) before crew-step progression. Job-option entries now include lifecycle status (`scheduled`, `late`, `completed`), default picker groups show scheduled+late entries, and completed entries stay hidden unless operators enable the advanced completed toggle. Selecting a completed linked job requires continuity metadata (category + reason), and save appends a linked follow-up segment without mutating the original completed record. Scheduled history cards now include runtime controls (`Start job` / `End job`) powered by active-run lifecycle endpoints, plus per-member `Clock out member` for mid-run early departures; ending a run still auto-clocks out any remaining active crew. Guards block edit/cancel/reassign while a run is active and prevent assigning employees who are already active on another run. Mutation flows reconcile history/readiness optimistically with rollback and now perform a canonical post-mutation reload from `/api/employees/*` to avoid cross-module drift; lifecycle KPIs (completed on-time/late, scheduled late, continuity) are derived via one shared helper that is also used in Manage Employees history context and now mirrored server-side through `/api/employees/reporting/lifecycle`; the summary panel exposes selected-crew analytics; operators can export those analytics/history rows to CSV; Step 2 date-range filters scope both displayed metrics and exported data; per-employee trend cards provide crew-level drill-down; route-level variance cards surface heavy/light sites; and cross-run trend cards (with 7/30/90/custom windows) show schedule quality over time in the same pane.
- **Start Next Job UX refinement (UX-3/UX-4/UX-5/UX-6/UX-11/UX-12 + JX-7 complete)**: the board now uses a guided top strip with step locks + readiness messaging while rendering one major panel at a time (`Crew`, `Draft`, `Review`, or `Scheduled history`) to reduce overload. Draft and review sections include explicit Back/Continue actions, advanced draft controls remain collapsible, analytics stay KPI-first with optional detailed trends, and scheduled-history lifecycle actions are isolated into their own step. Workspace state/button/chip feedback uses shared styling tokens, controls expose ARIA pressed/expanded + required/validation semantics for clearer keyboard/screen-reader flow, save lifecycle feedback uses one global toast so success/error states remain visible across all steps, and validation blockers now include direct action chips that route operators to the exact fix location.
- **Broadcast UI (Phase 1-6 live)**:
  - `/communications/broadcast` now lazy-loads `BroadcastShellComponent` and reuses the same evergreen shell language as `/clients`.
  - `BroadcastFacade` owns recipient loading, filter controls, channel selection, eligibility counts, exclusion summaries, and dispatch gating (no eligible recipients => dispatch blocked).
  - Phase 3 adds composer controls (`emailSubject`, `emailBody`, `smsBody`, CTA link, internal note), merge-token insertion, per-client preview rendering, and SMS character/segment metrics.
  - Phase 4 adds layered personalization controls: segment-rule selector, channel variant selectors, per-client override editor, and preview trace of active layers with priority `override > segment > channel > base`.
  - Phase 5 adds send controls (`scheduleMode`, `scheduleAt`, `testEmail`, `testPhone`), an accessible confirmation modal (click + keyboard close), and operator status banners for queued/scheduled actions.
  - Phase 6 wiring is live: confirmation actions call `BroadcastDeliveryService` (`src/app/shared/domain/communications/broadcast-delivery.service.ts`) which posts to `/api/communications/test` and `/api/communications/dispatch`.
  - Remaining UI slice is broadcast history + compliance/audit controls.

## Backend Services

- `/server` hosts the NestJS 11 API (ESM). It now contains a **Google Calendar integration** for pushing EcoCut jobs/events.
- REST endpoints (documented in `server/README.md`):
  - `POST /calendar/events` � create an event with summary/description/start/end/timezone/attendees.
  - `GET /calendar/events?timeMin&timeMax` � fetch sanitized Google events for the requested window (used by the entry modal to show availability).
  - `PATCH /calendar/events/:eventId` � edit an existing Google Calendar entry when schedulers tweak a slot inside the modal.
  - `DELETE /calendar/events/:eventId` � remove a previously created event.
- **Entries module**:
  - `POST /entries` � append the emitted `EntryModalPayload` (plus generated `id` + `createdAt`). The repository writes each record to the on-disk SQLite database at `ENTRIES_DB_PATH`, so history survives restarts and the most recent calendar `eventId` stays attached for future edits.
  - `GET /entries` � retrieve the append-only job history (same SQLite snapshot) so undo/reporting layers can read the source of truth.
  - `GET /entries/clients` � returns the deduplicated client roster (keyed by email ? phone ? name+address) with `jobsCount`, `lastJobDate`, and `lastCalendarEventId`.
  - Implementation lives in `server/src/entries/` (service, repository, controller, module). The repository persists to SQLite today (`ENTRIES_DB_PATH`) and can later be swapped for Postgres without changing the public API.
- **Addresses module**:
  - `GET /addresses/suggest?q=...&sessionToken=...` - proxy to provider autocomplete with monthly cap guardrails.
  - `POST /addresses/validate` - validates a selected suggestion id and returns normalized civic address fields.
  - `GET /addresses/usage` - returns monthly caps/counts + 75/90/100% threshold flags for quota monitoring.
  - Usage persistence is stored in SQLite at `ADDRESS_USAGE_DB_PATH` (default `server/data/address-usage.db`).
- **Employees module**:
  - `GET /employees/roster` - list employee profiles used by the Manage Employees roster.
  - `GET /employees/job-options` - list saved client jobs (from Entries) with normalized `status` (`scheduled`, `late`, `completed`) for linked-job pickers in hours logging and Start Next Job.
  - `GET /employees/reporting/lifecycle` - lifecycle rollup report (completed on-time, completed late, scheduled late, continuity) with optional query filters: `from`, `to`, `employeeIds` (comma-separated).
  - `GET /employees/hours` - list per-employee hours entries.
  - `GET /employees/history` - list employee job-history timeline entries.
  - `POST /employees/history/:entryId/start` - start a scheduled assignment run and clock in linked assignment-hours rows.
  - `POST /employees/history/:entryId/end` - end an active assignment run, auto-clock out remaining crew, and finalize runtime hours.
  - `POST /employees/history/:entryId/clock-out` - clock out a single active crew member from an active run (optional reason note) without ending the full run.
  - `POST /employees/history/:entryId/complete` - mark a scheduled history entry as completed (owner/manager role) and refresh readiness rollups.
  - `PATCH /employees/history/:entryId/schedule` - edit scheduled entry details (site/address/start/end) and keep linked assignment-source hours rows synchronized.
  - `POST /employees/history/:entryId/cancel` - cancel scheduled entries and remove linked assignment-source hours rows.
  - `POST /employees/history/:entryId/reassign` - reassign scheduled entries to a different active employee, with overlap checks and linked assignment-hours synchronization.
  - `GET /employees/readiness` - list Start Next Job readiness contract data (availability state, upcoming windows, conflict flags, totals).
  - `POST /employees/assignments/start-next-job` - persist selected Start Next Job crew into scheduled history entries plus assignment-source hours rows; accepts optional `jobEntryId` to bind assignment metadata to a saved client job, and for completed linked jobs accepts required continuity metadata (`continuityCategory`, `continuityReason`) so follow-up segments stay lineage-linked.
  - `POST /employees/roster`, `PATCH /employees/roster/:employeeId`, `POST /employees/roster/:employeeId/archive` - profile writes with role guardrails (`owner` required for update/archive; `owner` or `manager` for create).
  - `POST /employees/hours`, `PATCH /employees/hours/:entryId`, `DELETE /employees/hours/:entryId` - hours mutations allowed for `owner` and `manager`; linked-job hours can generate/update/remove matching completed history rows for the same employee. Manual-correction mode supports optional `correctionNote`.
  - `POST /employees/hours/clock` - role-guarded clock in/out action that writes audit-ready clock sessions into the hours stream (`source=clock`, `clockInAt`, `clockOutAt`, actor/timestamp).
  - Planned next endpoint for execution tracking: none currently (continuity + mid-run clock-out are live); next focus is cross-module integrity and UX hardening.
  - Role is supplied through `x-operator-role` request header (`owner` default, `manager` optional). Unauthorized operations are rejected server-side with `403`.
  - Snapshot persistence is stored in SQLite at `EMPLOYEES_DB_PATH` (default `server/data/employees.db`).
- **Broadcast module (MVP delivery live)**:
  - Exposes `POST /communications/test`, `POST /communications/dispatch`, `GET /communications/campaigns`, and `GET /communications/campaigns/:campaignId`.
  - Phase 7A suppression endpoints are live: `GET /communications/suppressions`, `POST /communications/suppressions/unsubscribe`, `POST /communications/suppressions/resubscribe`.
  - Phase 7B approval/audit endpoints are live: `POST /communications/campaigns/:campaignId/approve`, `POST /communications/campaigns/:campaignId/cancel`, and `GET /communications/campaigns/:campaignId/audit`.
  - Phase 7C webhook/analytics endpoints are live: `POST /communications/webhooks/delivery` and `GET /communications/campaigns/:campaignId/analytics`.
  - Phase 7D provider webhook adapter route is live: `POST /communications/webhooks/delivery/:provider` for provider-native payloads (currently `quo` and `hostinger`).
  - Uses swappable provider adapters via injection tokens:
    - `HostingerEmailProvider` (SMTP via Nodemailer)
    - `QuoSmsProvider` (HTTP API)
  - `CommunicationsService` applies retry + throttle guards during send loops, skips suppressed recipients by channel, supports approval-gated sends (`pending_approval`), ingests provider delivery webhooks (including unsubscribe/resubscribe sync), and persists campaign status/stats (`recipients`, `attempted`, `sent`, `failed`, `suppressed`) with append-only audit entries.
  - Communications persistence is durable in SQLite (`COMMUNICATIONS_DB_PATH`) via `CommunicationsRepository`, covering campaigns, pending approvals, audit records, delivery events, and suppressions.
  - Provider webhook signatures are validated via HMAC when `QUO_WEBHOOK_SECRET` or `HOSTINGER_WEBHOOK_SECRET` are configured.
  - Next slices still pending: durable campaign persistence, queue workers, consent expiry enforcement, and idempotency keys.
- **Chats foundation (CH-1/CH-2/CH-3/CH-4 live)**:
  - `GET /communications/chats/health` now returns Quo provider readiness (`configured`, `connected`, from-number visibility, diagnostics text) plus mirror counters (`conversations`, `messages`, `clientLinks`, `cursors`).
  - Quo integrations now share one typed transport wrapper (`QuoChatClientService`) with retry/backoff and categorized provider errors (auth vs transient).
  - Existing SMS sends in broadcast now reuse the same Quo transport client to avoid duplicated provider logic.
  - Chat persistence now includes durable mirror tables in `COMMUNICATIONS_DB_PATH`: `chat_conversations`, `chat_messages`, `chat_client_links`, and `chat_sync_cursors` with idempotent upserts.
  - Manual mirror sync endpoint is live at `POST /communications/chats/sync` (`incremental`, `backfill`, `reset`), using stored cursors for restart-safe incremental pulls.
  - Webhook ingest endpoint is live at `POST /communications/chats/webhooks/quo` with optional HMAC verification (`QUO_WEBHOOK_SECRET`), provider-event dedupe, raw payload audit persistence (`chat_webhook_events`), and immediate mirror upserts.
  - Remaining chat slices (conversation/thread APIs, UI route) are planned under CH-5..CH-12 in `docs/work-tracker.md`.
- **Frontend proxying & dev setup**
  - `npm start` automatically passes `--proxy-config proxy.conf.json`, so `/api/*` traffic goes to `http://localhost:3000/*`. Always run `npm run server` in a second terminal before testing calendar flows locally.
  - When the Nest server or credentials are unavailable the frontend logs the failure (via `console.warn`) and surfaces the inline banner but the form remains usable.
- **Environment variables**
  | Name | Required | Purpose |
  | ---- | -------- | ------- |
  | `GOOGLE_CALENDAR_CREDENTIALS_PATH` _or_ `GOOGLE_CALENDAR_CREDENTIALS` | Yes | Points to / contains the service-account JSON for `ecocut-calendar-bot@ecocut-calendar-link.iam.gserviceaccount.com`. JSON files live outside the repo. |
  | `GOOGLE_CALENDAR_ID` | Optional | Overrides the default target calendar (`ecojcut@gmail.com`). |
  | `ENTRIES_DB_PATH` | Optional | SQLite file path for persisted job/CRM entry history (`server/data/entries.db` by default). |
  | `ADDRESS_PROVIDER` | Optional | Address provider switch (`google` or `none`). |
  | `GOOGLE_MAPS_API_KEY` | Required when `ADDRESS_PROVIDER=google` | API key for Places autocomplete/details. |
  | `ADDRESS_USAGE_DB_PATH` | Optional | SQLite file path for address API usage ledger (`server/data/address-usage.db` by default). |
  | `ADDRESS_AUTOCOMPLETE_CAP_MONTHLY` | Optional | Hard monthly cap for autocomplete requests. |
  | `ADDRESS_DETAILS_CAP_MONTHLY` | Optional | Hard monthly cap for place-details validation requests. |
  | `ADDRESS_VALIDATION_CAP_MONTHLY` | Optional | Reserved cap for future dedicated address-validation calls. |
  | `COMMUNICATIONS_DB_PATH` | Optional | SQLite file path for broadcast campaigns/audit/analytics/suppressions (`server/data/communications.db` by default). |
  | `EMPLOYEES_DB_PATH` | Optional | SQLite file path for persisted employees roster/hours/history snapshot (`server/data/employees.db` by default). |
  | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM` | Required for email sends | Hostinger SMTP credentials used by the communications module. |
  | `QUO_API_BASE_URL`, `QUO_API_KEY`, `QUO_FROM_NUMBER`, `QUO_FROM_NUMBER_ID`, `QUO_USER_ID` | Required for SMS sends | Quo API configuration used by `QuoSmsProvider`. |
  | `QUO_WEBHOOK_SECRET`, `HOSTINGER_WEBHOOK_SECRET` | Optional (recommended for production) | Enables signature validation on provider webhook routes (`/communications/webhooks/delivery/:provider` and `/communications/chats/webhooks/quo` for Quo chat events). |
- Failure to provide credentials disables the calendar module gracefully but the endpoints will throw a clear error�set env vars before local dev or deployments.
- Use `.env.example` as the template for onboarding; copy it to `.env` (or export variables via your shell profile) and fill in the credential values before running `npm run server`. Never commit the real secrets.
- Always run backend scripts from `server/` (`npm run start:dev`, `npm run test`, etc.) so node_modules stay isolated.

## Tooling & Commands

| Purpose      | Frontend Command        | Notes                                                                |
| ------------ | ----------------------- | -------------------------------------------------------------------- |
| Install deps | `npm ci`                | Use `npm.cmd` if execution policy blocks scripts.                    |
| Dev server   | `npm start`             | Opens http://localhost:4200/                                         |
| Build        | `npm run build`         | Outputs to `dist/ecocut-calculator`                                  |
| Unit tests   | `npm run test`          | Launches Angular/Vitest suite (coverage auto-opens).                 |
| Lint         | `npm run lint`          | Angular ESLint configuration.                                        |
| Rollout gate | `npm run check:rollout` | Runs frontend lint/test/build plus server lint/unit/e2e in sequence. |

## Environments

- **Local:** Angular dev server, optional Nest dev server once implemented.
- **Preview (TBD):** Configure via CI/CD (GitHub Actions + Vercel/Netlify) to auto-build pull requests.
- **Production (TBD):** Upload built assets to CDN or static hosting; connect to managed backend service once ready.

Angular build-time configuration now lives under `src/environments/`:

| File                         | Purpose                                                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `environment.ts`             | Default (production) values. Ships with `production: true` and an `/api` base URL so frontends behind the proxy just work. Override `apiBaseUrl` for hosted environments (e.g., `https://api.ecocut.app`). |
| `environment.development.ts` | Development overrides. Today it also points to `/api`, but you can set it to `http://localhost:3000/api` if you prefer to bypass the Angular proxy.                                                        |

All frontend services derive their HTTP targets from `environment.apiBaseUrl`, so changing the base no longer requires hunting through code. The `angular.json` build + test targets replace `environment.ts` with `environment.development.ts` whenever we run dev builds or unit tests, keeping local tooling in sync.

## Documentation Workflow

1. Update `docs/general-instructions.md` when rules/processes change.
2. Update `docs/app-functionality.md` whenever features are added/modified.
3. Use this file for architectural notes, environment configs, data flows, and onboarding steps.
4. Reference the README only for the elevator pitch; keep detailed material here.
5. Use `docs/release-checklist.md` when executing staging dry-runs and production sign-off.

## Next Steps

- Replace placeholder Angular template with real calculator components.
- Extend the `/clients` view into a full CRM (client detail drawer, job history timeline, edit/delete hooks) once backend persistence is durable.
- Continue `/communications/broadcast` rollout in remaining slices: campaign history UI and final rollout checklist/integration hardening.
- Build `/communications/chats` (Quo inbox replacement) in staged CH slices: conversation/thread APIs, then UI/deep-link rollout.
- Continue Start Next Job enhancements with deeper assignment performance drill-down (e.g., seasonal route baselines and forecasted crew demand) now that analytics, date-range filtering, per-employee trend cards, route-level variance cards, cross-run trends, optimistic lifecycle reconciliation, and CSV export are live.
- Continue Start Next Job + Employees cross-module integrity and reporting consistency (JX-6) now that continuity and run lifecycle slices are live.
- Automate documentation publishing (Docs site or wiki) once scope grows.

## Durable Persistence

Entries are now stored in a lightweight SQLite database instead of the old JSON snapshot. The Nest repository (`server/src/entries/entries.repository.ts`) opens the file specified by `ENTRIES_DB_PATH` (default `server/data/entries.db`), enables WAL mode, and persists each `StoredEntry` row as JSON text inside the `entries` table. On first boot it automatically migrates any legacy `entries-store.json` snapshot into SQLite so teams upgrading from the previous release keep their history.

Key operational notes:

- **Configuration** � set `ENTRIES_DB_PATH` in `.env` if you want the database elsewhere (e.g., mounted volume in production). The deprecated `ENTRIES_STORE_PATH` only controls where the migration looks for the legacy JSON file.
- **Backups** � the DB is a single file; copy/zip it for cold backups or take file-system snapshots. Because WAL mode is enabled, copying the `.db` file while the server is running is still safe.
- **Deployment** � no external service is required. The first write creates the file automatically, and CI can run against the same DB file without extra containers.

With the persistence layer durable we can confidently layer on �undo,� richer CRM history, and analytics without worrying about concurrent writes or data loss.

## Branding & Theming

- **Design tokens** live in `src/styles/theme.scss`; `src/styles.scss` consumes those variables so tokens stay centralized.
- **Motion tokens** (`--motion-duration-fast/base/slow/panel`, `--motion-ease-standard/emphasis`, lift distance) are now centralized in the same theme file so feature SCSS avoids hard-coded transition timings.
- **Global interaction baseline** in `src/styles.scss` now applies token-based motion to shared controls (buttons, inputs, chips, dropdown triggers/options, suggestion rows, and key cards) so new screens inherit consistent interaction feedback by default.
- **Surface micro-interactions** are also centralized in `src/styles.scss` for shared `*-card`, `*-panel`, and `*-banner` containers so state shifts/hover feedback remain cohesive between modules.
- **Route-level transitions** are handled at the app shell (`AppComponent` around `router-outlet`) using tokenized motion and reduced-motion fallback so top-level page navigation is smooth but still accessible.
- **Overlay/modal transitions** now use the same motion token baseline for open/close in shared shells (entry modal, client detail overlay/editor overlay, broadcast confirmation) so panel behavior stays consistent across modules.
- **Shared select dropdown menus** now keep menus rendered during close (short fade/slide exit) with reduced-motion fallback in `SelectDropdownComponent`, so option lists no longer snap in/out when opening or dismissing.
- **Shared address suggestion popovers** now use the same delayed close fade/slide behavior in `AddressAutocompleteFieldComponent`, keeping address lookup menus visually consistent with dropdown motion and reduced-motion rules.
- **Home-specific floating menus** (Add Entry CTA/dropdowns) now follow the same fade/slide + visibility handoff pattern so non-shared popover menus behave consistently with the shared motion baseline.
- **Shared collapse/expand utility motion** now lives in global styles (`.motion-collapse` / `.motion-collapse__inner`) and is used by Start Next Job + Broadcast progressive-disclosure sections so advanced/progress/analytics panels expand/collapse consistently without per-feature timing drift.
- **Shared alert/banner motion utility** now lives in global styles (`.motion-alert`) and is applied to validation/state surfaces, with Start Next Job save-toast close-delay rendering so success/error feedback has smooth enter/exit instead of hard snaps.
- **Reduced motion** is enforced globally in `src/styles.scss` for shared interactive controls and shared panel-enter animation utilities.
- **Dark evergreen palette** keeps the UI in sync with the EcoCut brand (deep greens, neon growth accents).
- **Brand assets** belong in public/assets/brand/. Expected files: eco-logo.png (wordmark) and eco-mascot.png (character). A placeholder SVG loads if the mascot file is absent.

### Client detail drawer implementation

- `/clients` now composes `ClientsShellComponent` with `ClientDetailDrawerComponent`. Cards render as buttons and open the drawer, which fetches data via `EntryRepositoryService.getClientDetail` and renders contact info plus job history.
- Drawer state is driven entirely by signals (`activeClient`, `clientDetail`, `detailState`). Requests are guarded with a `detailRequestId` so stale responses don't clobber newer selections.
- Tests (`clients-shell.component.spec.ts`, `client-detail-drawer.component.spec.ts`) cover the roster interactions, overlay behavior, error/retry UX, and drawer rendering states to keep coverage at 100%.

### Entries API updates

- Added `GET /entries/clients/:clientId` which merges the stored client summary with the append-only job history for that key. History rows include variant, form info, calendar metadata, and hedge configs so UI layers can render deep CRM timelines later.
- `EntriesService` exposes `getClientDetails` and throws `NotFoundException` when a key is missing; `EntryRepositoryService` now shares the `ClientDetail`/`ClientHistoryEntry` types with the frontend.
