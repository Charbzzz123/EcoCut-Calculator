# Browser checks

Run `npm run test:e2e` from the repository root. Playwright starts Angular on port 4208
and Nest on port 3200. Each run creates fresh SQLite files in a temporary directory,
so local business data is untouched. The suite uses one worker because tests share
that temporary backend. Browser contexts are isolated between tests.

| Area              | Browser coverage                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Dashboard         | Main routes, back links, entry variants                                                                       |
| Entry and clients | Validation, warm lead save, customer calendar link, search, profile edit/delete, job edit/delete              |
| Employees         | Profile creation, owner/manager controls, filters, clock in/out, manual hours create/edit/remove              |
| Start Next Job    | Manual and linked drafts, crew selection, review, save, history, cancellation, run start/end, early crew exit |
| Broadcast         | Audience filter, merge preview, channel confirmation, SMS test and dispatch review, daily caps                |
| Chats             | Search, thread, reply, sync feedback, client deep link, unconfigured provider state                           |
| Mobile            | Entry dialog, client navigation, chat inbox/thread switch                                                     |

Entry, client, employee, and assignment operations use the real local Nest API. The
calendar request, Quo chat traffic, and broadcast test/dispatch delivery are mocked at the
browser network boundary; no real messages or calendar events are created. Provider
credentials, webhooks, and actual delivery require a separate staging run.

The HTML report is in `playwright-report/`. Screenshots, video, and traces for failures
are in `test-results/`. Run `npm run test:e2e:ui` for interactive debugging.
