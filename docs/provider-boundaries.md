# External provider inventory and operations

Status: initial review, 2026-10-02. EcoCut has no Canada-only storage or processing requirement. The first release may use existing providers, subject to ordinary data handling, consent, security, cost, and reliability checks. If the company later expands to the US, review the rules that apply to each workflow and customer location.

| Integration                  | Data sent by the current app                    | Launch review                                                                                        |
| ---------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Google Places address lookup | Address query and selected place                | Verify account, API key restrictions, monthly quota, failed lookup fallback, and actual usage cost.  |
| Google Calendar              | Customer/job details, address, schedule, notes  | Verify service-account access, duplicate-event behavior, reconciliation, and scheduling fallback.    |
| Quo chats and SMS            | Phone numbers, contact details, message content | Verify consent, webhook signatures, send limits, contact sync, message status, and provider outages. |
| Hostinger SMTP               | Recipient address, subject, message body        | Verify sender/domain setup, credentials, unsubscribe handling, bounce status, and send limits.       |

This inventory records what leaves the app. It does not imply any provider is live, configured, or approved by a privacy review. Use test accounts and synthetic records for staging; document the provider account owner and terms before sending live customer data. [Google Maps](https://developers.google.com/maps/security/compliance/security-compliance), [Quo](https://www.quo.com/privacy), and [Hostinger](https://www.hostinger.com/legal/privacy-policy) publish processing and privacy information to consult during that review.

## Cost and reliability controls

- Record provider, endpoint or SKU, data category, account owner, monthly budget, quota, and alert owner.
- Track requests, errors, latency, throttling, and estimated unit cost per provider without logging raw client content.
- Set provider quotas and application caps; alert before the cap and show operators a clear unavailable state.
- Reconcile the app ledger to provider billing monthly. [Google Maps quota controls](https://developers.google.com/maps/billing-and-pricing/manage-costs) limit calls, while [Google Cloud billing alert budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets) do not automatically stop usage.
- Review provider terms, credentials, and data fields whenever a feature starts sending additional information.
