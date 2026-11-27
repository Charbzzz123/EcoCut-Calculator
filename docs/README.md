# EcoCut documentation map

[Temporary reorganisation plan](reorganisation.md) · [Team workflow](team-workflow.md)

This page is the entry point for product, engineering, and release information. Keep each fact in one primary document and link to it elsewhere.

| Question                                                             | Primary document                                      | State                                     |
| -------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| What problem are we solving, for whom, and what counts as a release? | [Product Guide](product-brief.md)                     | Draft; business decisions to confirm      |
| What exists in the code today?                                       | [System Design Guide](architecture/current-state.md) | Evidence-based snapshot                   |
| Why did we choose a platform or design?                              | [Decision records](decisions/README.md)               | Start with material, reversible decisions |
| What must happen before a live release?                              | [Production roadmap](production-roadmap.md)           | Ordered gates and exit criteria           |
| What data and cost does each external service handle?                | [Provider boundary review](provider-boundaries.md)    | Inventory and operational review          |
| What is being done next?                                             | [Work tracker](work-tracker.md)                       | Keep this living checklist                |
| What should a code change include?                                   | [Engineering workflow](engineering-workflow.md)       | Branches, review, and CI                  |
| Where is the historical broadcast checklist?                                  | [Broadcast release checklist](release-checklist.md)   | Historical delivery workflow                |

## Existing reference material

- [Functionality catalog](app-functionality.md) contains both implemented behavior and original calculator plans. Check the route or API before treating a section as shipped.
- [Technical documentation](app-documentation.md) contains valuable implementation history, but some early overview and roadmap text predates the live Nest API. The current architecture document is the source for present topology.
- [General instructions](general-instructions.md) records the older working agreement. Repository-wide agent guidance is now in [`AGENTS.md`](../AGENTS.md); reconcile the older instructions as the docs migration proceeds.
- [`server/README.md`](../server/README.md) still includes Nest starter material and needs an EcoCut-specific rewrite.

## Maintenance rule

Update the product brief for scope changes, the architecture snapshot for deployed component or data-flow changes, an ADR for a material choice and its tradeoffs, and the work tracker for task status. A runbook records an operation that someone must be able to perform under pressure. Avoid copying the same description into several files.

## Next documentation cleanup

- Split the mixed shipped/planned functionality catalog into release requirements and feature reference pages.
- Retire stale sections of the historical technical document after checking them against code.
- Rewrite the backend README for EcoCut; normalize the old Markdown encoding artifacts.
- Move older completed tracker detail to a dated archive when the active checklist becomes hard to scan. Keep task IDs and links intact.
