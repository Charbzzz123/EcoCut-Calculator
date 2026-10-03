# EcoCut-Calculator

Our own custom calculator for our own business

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
