# Project Working Agreement

## Mission
Build and maintain the EcoCut Calculator, an Angular 21 single-page app (SPA) that helps EcoCut estimate jobs quickly.

## Development Environment
- Node.js 20.11+ (or >=18.18) with npm 11.x; prefer `npm ci` for clean installs.
- Angular CLI 21 with the default standalone/ESBuild toolchain.
- Typescript 5.9, ESLint 9, Prettier 3.

## Coding Guidelines
1. Follow Angular style guide (standalone components, strict typing, feature-based folders when we outgrow `src/app`).
2. Write pure, testable functions; keep components dumb and move business logic into services/helpers as they emerge.
3. Stick to SCSS; avoid inline styles except for quick prototypes.
4. Favor RxJS streams or Angular Signals for state over ad-hoc globals.
5. Keep templates accessible (semantic tags, ARIA labels, keyboard flows).

## Tooling Rules
- Run `npm run lint` and `npm run test` before pushing.
- Use Prettier for formatting; never hand-format conflicting styles.
- Husky hooks run automatically after `npm install`; do not bypass unless broken.
- Prefer `npm.cmd` when PowerShell policies block scripts.

## Workflow
1. Create a task ticket; write down acceptance criteria.
2. Branch from `main`, naming `feature/<ticket-id>-short-desc`.
3. Build iteratively: design -> implement -> lint/test -> review.
4. Keep commits focused and descriptive; squash only when merging to `main` via PR.
5. Document UI/UX changes in the functionality doc and changelog (to add later).

## Communication
- Document major decisions in pull requests and in `docs/app-documentation.md`.
- Surface blockers early; never let an unresolved issue sit silently.
- Keep README updated for onboarding; mirror high-level info in project wiki when available.
