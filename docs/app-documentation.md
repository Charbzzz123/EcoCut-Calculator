# EcoCut Calculator — Technical Documentation

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

### Entry Modal Implementation

- **Component**: `src/app/home/components/entry-modal/entry-modal.component.ts` renders the warm lead / customer modal. It uses `NonNullableFormBuilder`, Angular signals for per-hedge state, and an anchored detail panel that moves based on the clicked polygon's bounding box.
- **SVG / Assets**: The hedge planner background lives in `public/assets/warm-lead/a_bird_s_eye_view_digital_illustration_showcases_a.png`. Each hedge polygon is defined in the component template (`hedge-1`–`hedge-8`). A README in that folder explains how to swap in the branded art.
- **State machine**:
  - Signals (`hedgeStates`, `savedConfigs`, `panelState`, etc.) keep the component reactive without services.
  - `cycleHedge` toggles `None ? Trim ? Rabattage ? None`, rehydrates saved configs, and clamps the contextual panel position inside the SVG container.
  - Trim configs capture either combinable sections (inside/top/outside) or presets, while Rabattage configs capture option + optional partial text.
- **Testing/coverage**: `src/app/home/components/entry-modal/entry-modal.component.spec.ts` holds 22 focused specs that exercise DOM interactions, state hydration, validations, and template bindings. Run `npx ng test --watch=false --coverage` to enforce the repo's “100% every file” rule (Husky hooks also run this before commits).
- **Calendar integration**:
  - `CalendarEventsService` (`src/app/home/services/calendar-events.service.ts`) wraps the `/api/calendar/events` endpoints. The entry modal consumes it to show live availability; `HomeDataService.saveEntry` uses the same service when creating customer events.
  - `calendar-event.builder.ts` converts the payload into a Google Calendar-friendly summary/description (hedge plan, customer info, budgets, notes).
  - The customer template includes a Google Calendar-style **timeline grid** (7 AM–8 PM) rendered via `timelineHours`, `timelineEvents`, and `timelineSelection` signals. Dragging on the grid fills the start/end controls; overlapping events raise a conflict banner hooked into `selectionConflict` + `conflictConfirmed`.
- **Suggested slot picker**:
  - EntryModalComponent derives a standard grid of crew slots (08:00–17:00) and compares each to the fetched Google events. Conflicts mark the chip `slot-chip--booked`, while open slots remain actionable.
  - Manual edits to the start/end inputs clear the selection, so the UI never shows a stale chip highlight.
  - Specs cover slot rebuilding, drag guards, and the DOM states for available/booked chips.
- **Integration**: `HomeShellComponent` imports the modal and toggles it from the floating “Add Entry” CTA. The component emits `EntryModalPayload` with the selected variant, normalized form payload, and hedge configs, which feed the façade/server. Customer submissions automatically create a Google Calendar event via `HomeDataService`, which in turn stores the returned `eventId` back onto the payload so later edits/deletes can call the appropriate proxy endpoint.
- **Entry persistence client**: `EntryRepositoryService` (`src/app/home/services/entry-repository.service.ts`) wraps `/api/entries` and `/api/entries/clients`. `HomeDataService.saveEntry` now awaits this service so every submission is recorded immediately (no more console stub). `listClients()` will power the future CRM dashboard without duplicating HTTP plumbing.
- **Client roster UI**: `/clients` is backed by `ClientsShellComponent` (standalone) which uses `EntryRepositoryService.listClients()` on init. The view renders summary cards, search/filter controls, and the roster list with dedicated loading/error states. Routes are defined in `app.routes.ts` (lazy loaded via `loadComponent`).

## Backend Services

- `/server` hosts the NestJS 11 API (ESM). It now contains a **Google Calendar integration** for pushing EcoCut jobs/events.
- REST endpoints (documented in `server/README.md`):
  - `POST /calendar/events` — create an event with summary/description/start/end/timezone/attendees.
  - `GET /calendar/events?timeMin&timeMax` — fetch sanitized Google events for the requested window (used by the entry modal to show availability).
  - `PATCH /calendar/events/:eventId` — edit an existing Google Calendar entry when schedulers tweak a slot inside the modal.
  - `DELETE /calendar/events/:eventId` — remove a previously created event.
- **Entries module**:
  - `POST /entries` — append the emitted `EntryModalPayload` (plus generated `id` + `createdAt`). Each save flushes to `server/data/entries-store.json` (override via `ENTRIES_STORE_PATH`) so history survives restarts, and the most recent calendar `eventId` stays attached for future edits.
  - `GET /entries` — retrieve the append-only job history (same file-backed snapshot) so undo/reporting layers can read the source of truth.
  - `GET /entries/clients` — returns the deduplicated client roster (keyed by email → phone → name+address) with `jobsCount`, `lastJobDate`, and `lastCalendarEventId`.
  - Implementation lives in `server/src/entries/` (service, repository, controller, module). The repository handles loading/saving JSON today and can later be swapped for SQLite/Postgres without changing the public API.
- **Frontend proxying & dev setup**
  - `npm start` automatically passes `--proxy-config proxy.conf.json`, so `/api/*` traffic goes to `http://localhost:3000/*`. Always run `npm run server` in a second terminal before testing calendar flows locally.
  - When the Nest server or credentials are unavailable the frontend logs the failure (via `console.warn`) and surfaces the inline banner but the form remains usable.
- **Environment variables**
  | Name | Required | Purpose |
  | ---- | -------- | ------- |
  | `GOOGLE_CALENDAR_CREDENTIALS_PATH` _or_ `GOOGLE_CALENDAR_CREDENTIALS` | Yes | Points to / contains the service-account JSON for `ecocut-calendar-bot@ecocut-calendar-link.iam.gserviceaccount.com`. JSON files live outside the repo. |
  | `GOOGLE_CALENDAR_ID` | Optional | Overrides the default target calendar (`ecojcut@gmail.com`). |
- Failure to provide credentials disables the calendar module gracefully but the endpoints will throw a clear error—set env vars before local dev or deployments.
- Use `.env.example` as the template for onboarding; copy it to `.env` (or export variables via your shell profile) and fill in the credential values before running `npm run server`. Never commit the real secrets.
- Always run backend scripts from `server/` (`npm run start:dev`, `npm run test`, etc.) so node_modules stay isolated.

## Tooling & Commands

| Purpose      | Frontend Command | Notes                                                |
| ------------ | ---------------- | ---------------------------------------------------- |
| Install deps | `npm ci`         | Use `npm.cmd` if execution policy blocks scripts.    |
| Dev server   | `npm start`      | Opens http://localhost:4200/                         |
| Build        | `npm run build`  | Outputs to `dist/ecocut-calculator`                  |
| Unit tests   | `npm run test`   | Launches Angular/Vitest suite (coverage auto-opens). |
| Lint         | `npm run lint`   | Angular ESLint configuration.                        |

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

## Next Steps

- Replace placeholder Angular template with real calculator components.
- Move the in-memory entries store to a durable database (SQLite/Postgres) so undo + reporting have a dependable source.
- Extend the `/clients` view into a full CRM (client detail drawer, job history timeline, edit/delete hooks) once backend persistence is durable.
- Automate documentation publishing (Docs site or wiki) once scope grows.

## Durable Persistence Upgrade Plan

We currently serialize entries to `server/data/entries-store.json`, which is fine for prototyping but can’t handle concurrent requests, backups, or multi-host deployments. The migration path:

1. **Pick the storage engine** — use SQLite for local/dev (single-file, zero setup) and Postgres for staging/prod. Adopt Prisma ORM so we can share schema + migrations across environments.
2. **Model the schema** — create `entries`, `clients`, and `hedge_configs` tables. Every appended job becomes a row keyed by `entry_id`; tie job history to clients via `client_id` (email+phone composite). Store hedge JSON in a structured table so analytics can query it later.
3. **Introduce a Repository Abstraction** — keep the existing `EntriesRepository` interface but provide a Prisma-backed implementation. Guard it with an adapter so the JSON store can remain as a fallback during rollout.
4. **Migration script** — add `npm run migrate:seed` in `/server` to load the JSON snapshot into the new DB the first time we deploy.
5. **Update API + tests** — point `EntriesService` to the Prisma repository, extend Jest integration tests to spin up an in-memory SQLite DB, and keep contract tests to ensure the REST surface stays identical.
6. **Ops / CI** — add DB containers to CI so `npm run check` runs migrations + tests against SQLite. Document `.env` knobs (`DATABASE_URL`) alongside the calendar creds.

Once those steps ship we can safely add more CRM features (undo, job timeline analytics, crew assignment) knowing the data layer is durable.

## Branding & Theming

- **Design tokens** live in src/styles/theme.scss; src/styles.scss simply consumes those variables so tokens stay centralized.
- **Dark evergreen palette** keeps the UI in sync with the EcoCut brand (deep greens, neon growth accents).
- **Brand assets** belong in public/assets/brand/. Expected files: eco-logo.png (wordmark) and eco-mascot.png (character). A placeholder SVG loads if the mascot file is absent.

### Client detail drawer implementation

- `/clients` now composes `ClientsShellComponent` with `ClientDetailDrawerComponent`. Cards render as buttons and open the drawer, which fetches data via `EntryRepositoryService.getClientDetail` and renders contact info plus job history.
- Drawer state is driven entirely by signals (`activeClient`, `clientDetail`, `detailState`). Requests are guarded with a `detailRequestId` so stale responses don't clobber newer selections.
- Tests (`clients-shell.component.spec.ts`, `client-detail-drawer.component.spec.ts`) cover the roster interactions, overlay behavior, error/retry UX, and drawer rendering states to keep coverage at 100%.

### Entries API updates

- Added `GET /entries/clients/:clientId` which merges the stored client summary with the append-only job history for that key. History rows include variant, form info, calendar metadata, and hedge configs so UI layers can render deep CRM timelines later.
- `EntriesService` exposes `getClientDetails` and throws `NotFoundException` when a key is missing; `EntryRepositoryService` now shares the `ClientDetail`/`ClientHistoryEntry` types with the frontend.
