# EcoCut repository guidance

Follow the [owner's working agreement](docs/team-workflow.md). Finish the whole task before proposing commits. Commit only an explicitly approved batch, using the approved subjects without attribution trailers. Keep chat updates short and clear.

Read [docs/README.md](docs/README.md) for the documentation map and [docs/work-tracker.md](docs/work-tracker.md) for active work. The [current architecture](docs/architecture/current-state.md) describes the code as it exists; the [production roadmap](docs/production-roadmap.md) lists release gates.

- Inspect `git status` before edits. Preserve unrelated user changes. Keep new files focused and reasonably short.
- Use the current `DEV` integration branch name as written. New task branches follow [engineering-workflow.md](docs/engineering-workflow.md); do not rename branches implicitly.
- Distinguish implemented, proposed, mocked, and provider-verified behavior. Browser mocks do not establish that an external service works in production.
- The business has no Canada-only hosting or processing requirement. Track what client and employee data each provider receives, and apply jurisdiction-specific rules where relevant, including future tax calculations. See [provider boundaries](docs/provider-boundaries.md).
- `x-operator-role` is a demo UI/API convention, not authentication. Do not treat it as a production security control.
- For material changes, record acceptance examples and update the relevant primary document and work tracker. Use an ADR for a consequential choice with tradeoffs; avoid duplicate descriptions across documents.
- Run tests and checks proportional to the change. Include backend authorization, migration/restore, and browser checks when those paths are affected. Report any unrun or failing gate honestly.
- Never commit secrets, real client data, generated reports, or database files. Do not copy a live SQLite `.db` file as the backup procedure; use an online backup method and verify restoration.
