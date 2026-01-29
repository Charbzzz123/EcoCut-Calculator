# Project Working Agreement

## Mission
Build and maintain the EcoCut Calculator, an Angular 21 single-page app (SPA) that helps EcoCut estimate jobs quickly with a **speed-first ethos**—performance and snappy UX take priority while still delivering polished visuals.

## Development Environment
- Node.js 20.11+ (or >=18.18) with npm 11.x; prefer `npm ci` for clean installs.
- Angular CLI 21 with the default standalone/ESBuild toolchain.
- Typescript 5.9, ESLint 9, Prettier 3.

## Coding Guidelines
1. Follow Angular style guide (standalone components, strict typing, feature-based folders when we outgrow `src/app`).
2. Default to a **facade-driven feature structure**: components talk to a feature facade that orchestrates services, adapters, and API clients so the codebase stays evolutive.
3. Prioritize performance: keep bundle size lean, avoid blocking operations on the main thread, budget for sub-second interactions, and profile hot paths regularly.
4. Write pure, testable functions; keep components dumb and move business logic into services/helpers as they emerge.
5. Stick to SCSS; avoid inline styles except for quick prototypes.
6. Favor RxJS streams or Angular Signals for state over ad-hoc globals.
7. Share what's shareable: prefer libs/modules for cross-feature components/services so frontend & backend (Nest) can reuse DTOs, validation schemas, and utilities via a `/libs` or `/shared` workspace.
8. Keep templates accessible (semantic tags, ARIA labels, keyboard flows) and UX copy purposeful—speed should never sacrifice usability.
9. Stick to a unified design system: SCSS variables/mixins, spacing scales, and typography go into shared theme files so every page feels part of the same product.
10. Never code without a plan: document the intended approach (sketch, checklist, or ADR) before opening a PR.
11. Never assume requirements—ask, discuss, and capture the agreement before implementing.

## Tooling Rules
- Run `npm run lint` and `npm run test` before pushing.
- Aim for full file coverage; add or update specs alongside every feature/fix.
- Use Prettier for formatting; never hand-format conflicting styles.
- Husky hooks run automatically after `npm install`; do not bypass unless broken.
- Prefer `npm.cmd` when PowerShell policies block scripts.

## Workflow
1. Create a task ticket; write down acceptance criteria and planned approach.
2. Branch from the active integration branch (`dev`) using `feature/<ticket-id>-short-desc`.
3. Keep `main`/`master` pristine for tagged releases only (alpha/beta/GA). Merge feature PRs into `dev`; promote to `main` only when the version is publish-ready.
4. Build iteratively: design -> implement -> lint/test (all passing) -> review.
5. Keep commits focused, logically sized, and descriptive; commit after each meaningful step so reviewers can follow the story (no giant “everything” commits).
6. Never merge unless statements/branches/functions/lines are all at 100% and verified locally (run `npm run test` or the coverage script every time); fix or add specs immediately when you touch a file.
6. Document UI/UX changes in the functionality doc and changelog (to add later).

## Communication
- Document major decisions in pull requests and in `docs/app-documentation.md`.
- Surface blockers early; never let an unresolved issue sit silently.
- Keep README updated for onboarding; mirror high-level info in project wiki when available.
