# 0001 — Storage for the first live release

Status: proposed. Date: 2026-10-02. Owners: EcoCut business owner and engineering owner.

## Context

The current Nest API uses four local SQLite databases, often with JSON snapshot payloads. The first release targets 4–10 occasional internal users and minimal monthly cost. Recovery targets are still undecided. Hosting region should be chosen by cost, latency, provider fit, and applicable privacy needs; Canada-only hosting is not a requirement.

## Options considered

| Option                                             | Benefits                                                                                   | Costs and risks                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Single VM, local SQLite, consistent online backups | Small infrastructure footprint; preserves current code; suitable for low concurrency       | Team owns OS patching, backup/restore, disk failure response, and downtime during VM failure; one instance |
| Managed PostgreSQL with a stateless API            | Managed storage/backup options; easier multi-instance deployment and relational migrations | Higher fixed cost; migration of four stores and snapshot-shaped data; operational learning                 |
| Ephemeral container with existing SQLite paths     | Simple first deploy                                                                        | Data is lost on restart/redeploy; unacceptable for business records                                        |

## Proposed direction

Evaluate a single VM with SQLite for a controlled pilot **only if** authentication, consistent backup, tested restore, and agreed RPO/RTO are in place. Compare suitable regions and provider quotes. Reassess managed PostgreSQL when availability or cross-module consistency justifies its fixed cost and migration effort. This is a proposal, not a deployment authorization.

## Validation and revisit trigger

Measure the time to deploy and restore, backup freshness, storage growth, and API write latency. Revisit when the app needs more than one instance, recovery targets exceed single-VM capability, or cross-store consistency becomes a recurring incident source.
