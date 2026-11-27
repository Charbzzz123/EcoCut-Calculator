# Demo to production roadmap

Status: proposed sequence, 2026-10-02. Keep detailed tasks in [the work tracker](work-tracker.md). A milestone closes only when its evidence is linked, not when code alone is merged.

## Priority order

P0 means a blocker for storing real client or employee data on an internet-reachable system. P1 means a blocker for a supported release. P2 is improvement after the first release.

| Priority | Decision or outcome                                                                 | Why it comes first                                       |
| -------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| P0       | Agree first-release scope, operators, data handling, and recovery targets           | These constrain hosting, storage, and identity           |
| P0       | Replace caller-supplied role header with authenticated, server-enforced permissions | The current role header can be chosen by any API caller  |
| P0       | Make storage durable and prove backup **and restore**                               | Four local SQLite files currently hold business data     |
| P0       | Restrict secrets and provider webhooks; inventory data sent to each provider        | Client contact and location data cross system boundaries |
| P1       | Staging deployment with reproducible configuration                                  | Local tests do not validate a real deployment            |
| P1       | Release gates, monitoring, incident and rollback runbooks                           | A small team needs a repeatable recovery path            |
| P2       | Additional reports, calculator features, and scale work                             | Do these after the core workflow is safe and reliable    |

## Milestone 0 — agree the product contract

- [ ] Confirm users, roles, first-release journeys, and out-of-scope features in the [product brief](product-brief.md).
- [x] Confirm that Canada-only storage and processing are not product requirements; allow regional expansion.
- [ ] Define client and employee data handling, retention, and provider ownership for the first release.
- [ ] Set RPO (maximum acceptable lost work) and RTO (maximum acceptable recovery time).
- [ ] Record monthly hosting and external API budgets, expected usage, and one owner for each service account.
- [ ] Separate shipped behavior from planned calculator features in the functionality catalog.

**Exit:** the business owner can describe what the first release must do, what data it holds, and how much downtime/data loss is acceptable.

## Milestone 1 — secure the API and data flows

- [ ] Choose identity (company-managed SSO or another supported login) and server-side roles; protect every write and sensitive read endpoint.
- [ ] Remove authorization based on untrusted `x-operator-role`; test denied and allowed requests against the API.
- [ ] Complete the [provider boundary review](provider-boundaries.md) for Google Calendar/Maps, Quo, SMTP, backups, logs, and browser storage.
- [ ] Configure webhook authentication, request validation, rate limits, audit events, and secret rotation.
- [ ] Define data retention, deletion, and minimum access by role.

**Exit:** an unauthenticated caller cannot read or change private business data; permissions are verified in tests and a staging review.

## Milestone 2 — choose and prove storage

- [ ] Accept a [data-storage ADR](decisions/0001-data-storage.md) using cost, latency, RPO/RTO, and operator effort as criteria.
- [ ] Normalize database paths and remove demo seed records from production startup.
- [ ] Add explicit schema/version migrations and a pre-deploy backup step.
- [ ] Automate consistent backups of all data stores, encryption, retention, and a separate backup destination.
- [ ] Restore into a fresh environment and verify records, chat links, campaign state, and calendar references.
- [ ] Define idempotent retries and recovery for cross-database/external-provider operations.

**Exit:** a documented restore drill meets RPO/RTO without relying on a live `.db` file copy.

## Milestone 3 — staging and provider verification

- [ ] Select the host after cost, reliability, latency, and deployment review; record the topology in an ADR and deployment diagram.
- [ ] Build separate staging and production configurations, domains, secrets, and data stores.
- [ ] Deploy the exact build artifact checked by CI; run database migrations separately from serving traffic.
- [ ] Verify Calendar, address lookup and read-only conversation history in staging, including unavailable and rate-limited states. Verify zero outbound customer delivery using fake transports.
- [ ] Set API quotas, app-level monthly caps, billing alerts, and a dashboard for usage/error/latency by provider.

**Exit:** staging exercises real integrations without using production customers or sending unintended messages.

## Milestone 4 — release and operations

- [ ] Require frontend, server, browser, dependency, and migration checks before merge to the release branch.
- [ ] Protect integration and production branches; define deployment approval according to the GitHub plan in use.
- [ ] Add health checks, structured logs, error alerts, uptime checks, backup freshness alerts, and data-export controls.
- [ ] Write and rehearse deploy, rollback, restore, secret rotation, and provider outage runbooks.
- [ ] Pilot with 4–10 operators; record defects and support questions in the work tracker.

**Exit:** a release can be deployed, observed, rolled back, and restored by following a written procedure.

## Milestone 5 — first supported production release

- [ ] Product owner accepts the agreed journeys and data policy.
- [ ] Security, recovery, provider, and staging gates above are complete.
- [ ] Run a final restore drill and staged release rehearsal; record commit, date, approvers, and evidence.
- [ ] Publish a short release note and maintain a dated incident/change log.

**Exit:** real use begins with a named owner, monitoring, and an agreed support path.

## Hosting direction to evaluate

For 4–10 occasional users, a **single small VM with SQLite** is a plausible low-cost pilot architecture. It needs disciplined patching, access control, backups, and restore testing. Compare regions and providers by total monthly cost, latency, and recovery needs; no host is selected yet. Managed PostgreSQL becomes attractive when multi-instance uptime, managed recovery, or cross-module transactions justify its fixed cost and migration effort. [Cloud Run's local filesystem does not persist after an instance stops](https://docs.cloud.google.com/run/docs/container-contract), so it cannot host the current SQLite files as durable data.
