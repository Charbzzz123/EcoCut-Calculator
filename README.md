# EcoCut-Calculator

EcoCut's internal operations app for client intake, scheduling, crew work, and communications. The financial calculator described in older planning documents is future scope.

Start with the [documentation map](docs/README.md) for product scope, current architecture, production roadmap, and active work.

## Browser end-to-end checks

Install both packages and the Chromium browser once:

```sh
npm ci
npm ci --prefix server
npx playwright install chromium
```

Run `npm run test:e2e` to start an isolated Nest API and Angular app, then exercise the
main workflows in Chromium. The API uses fresh temporary SQLite databases on every run.
The suite uses the real local API for entries, clients, employees, and assignments;
Google Calendar, Quo messaging, and broadcast test delivery are mocked in browser tests
so no external sends occur. Use `npm run test:e2e:ui` to debug interactively. Failure
screenshots, videos, and traces are saved under `test-results/`.
