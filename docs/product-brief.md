# EcoCut Product Guide

**Approved product rule.** Customer communications in EcoCut are permanently read-only. Operators can search and read conversations and open them from client records. Replies, test deliveries and broadcast delivery happen outside EcoCut. Existing send paths are implementation debt. Contact-record sync is a separate provider-data decision.

Status: draft for business review. Last checked against the repository: 2026-10-02. Confirmed constraints: 4–10 occasional internal users and the lowest practical operating cost. There is no Canada-only hosting or processing requirement; future tax calculations must use the applicable jurisdiction.

## Purpose and users

EcoCut is an internal operations workspace for recording leads and customers, scheduling jobs and crews, tracking employee hours, and reviewing customer conversations. Likely users are owners, managers, and field crew; their exact access needs still need confirmation.

## Lead and customer stages

The existing entry form already distinguishes **Warm Lead** (the customer has not accepted and is still considering) from **Customer / Closed** (the customer agreed to proceed). It currently asks the operator to choose the variant when creating an entry. **Agreed requirement.** When a lead accepts, the operator can change that existing record to Customer / Closed while keeping its details and history. Calendar scheduling remains a separate step.

## Company workspaces

**Approved direction.** EcoCut and EcoAir will use one CRM with a company switcher. Authorized staff can use the same login to switch between the companies they have access to. Each company can have its own settings, service catalog, and integrations.

The proposed default is separate customer, job, and conversation records for each company, with access enforced by the server. Example: an EcoAir-only user cannot open an EcoCut customer or conversation, even through a direct link. Confirm which staff work across companies, whether any records or calendars should be shared, and when EcoAir needs access. Resolve those questions before agreeing on permissions, data migration, and provider setup.

## Current usable scope

The app has routes for Home, Clients, Manage Employees, Start Next Job, Broadcast, and Chats. It has a Nest API and local SQLite persistence. Calendar, address lookup, email, and Quo integrations depend on external configuration. The original financial calculator, funds, invoice sequence, and undo workflow described in the [functionality catalog](app-functionality.md) are **planned scope**, not an accepted claim about the current application.

## First live-release outcome

An authorized EcoCut operator can complete the agreed lead-to-job workflow, find the resulting records after a restart, and recover from a failed external service without losing the primary record. The owner can see who changed important data and the customer conversation history linked to the job.

## Proposed release boundaries

1. **Internal pilot:** known operators, controlled data, documented backup and restore, and verified provider configuration.
2. **First production release:** server-side identity and authorization, reliable data storage and recovery, deployment pipeline, monitoring, and monitored provider integrations.
3. **Later product expansion:** financial calculator and additional reporting only after their requirements and acceptance examples are agreed.

## Product decisions to confirm

- Who uses the first release, and from which devices or locations?
- Which workflow is the launch promise: lead intake, scheduling, crew operations, conversation history, or all four?
- What information may be stored about clients and employees, and how long must it be kept?
- Which provider features must work on day one, and what is the acceptable fallback when each is unavailable? See the [provider boundary review](provider-boundaries.md).
- Which jurisdictions will the calculator support first, and what location determines the tax rules?
- What downtime and data loss are acceptable? Record target RTO and RPO before selecting storage.
- What monthly operating budget within the requested low-cost target is acceptable after quotes?
- Which features are explicitly excluded from the first release?

Until those are answered, this brief is a working hypothesis rather than a signed-off PRD. Add user journeys and acceptance examples here before expanding feature scope.
