# EcoCut Calculator – Technical Documentation

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
- **Build:** `@angular/build:application` (esbuild + Vite dev server) configured in `angular.json`.
- **State:** Currently a single `title` signal; expand using dedicated state services/signals modules as features grow.

## Backend Placeholder
The `/server` directory hosts a NestJS 11 project (ESM) with its own tooling (ESLint, Prettier). It is not wired to the Angular app yet—treat it as a future service. Run backend scripts from `server/` (e.g., `npm run start:dev`). Document new endpoints inside `server/README.md` and mirror cross-cutting info back here.

## Tooling & Commands
| Purpose        | Frontend Command            | Notes |
| -------------- | --------------------------- | ----- |
| Install deps   | `npm ci`                    | Use `npm.cmd` if execution policy blocks scripts. |
| Dev server     | `npm start`                 | Opens http://localhost:4200/ |
| Build          | `npm run build`             | Outputs to `dist/ecocut-calculator` |
| Unit tests     | `npm run test`              | Launches Angular/Vitest suite (coverage auto-opens). |
| Lint           | `npm run lint`              | Angular ESLint configuration. |

## Environments
- **Local:** Angular dev server, optional Nest dev server once implemented.
- **Preview (TBD):** Configure via CI/CD (GitHub Actions + Vercel/Netlify) to auto-build pull requests.
- **Production (TBD):** Upload built assets to CDN or static hosting; connect to managed backend service once ready.

## Documentation Workflow
1. Update `docs/general-instructions.md` when rules/processes change.
2. Update `docs/app-functionality.md` whenever features are added/modified.
3. Use this file for architectural notes, environment configs, data flows, and onboarding steps.
4. Reference the README only for the elevator pitch; keep detailed material here.

## Next Steps
- Replace placeholder Angular template with real calculator components.
- Flesh out server requirements and link to front end via API clients.
- Automate documentation publishing (Docs site or wiki) once scope grows.
