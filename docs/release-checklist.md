# Broadcast Release Checklist

Use this checklist before promoting broadcast changes from `dev` to a release branch.

## 1) Local Quality Gates (required)

Run from repo root:

1. `npm run check:rollout`

Expected result:

- Frontend lint/tests/build pass.
- Server lint/unit/e2e pass.
- No failing coverage thresholds.

## 2) Configuration Validation

Confirm required environment variables are set in the deployment target:

- Calendar: `GOOGLE_CALENDAR_CREDENTIALS_PATH` (or inline JSON) and `GOOGLE_CALENDAR_ID`
- Entries DB: `ENTRIES_DB_PATH`
- Communications DB: `COMMUNICATIONS_DB_PATH`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`
- Quo: `QUO_API_BASE_URL`, `QUO_API_KEY`, `QUO_FROM_NUMBER`, `QUO_FROM_NUMBER_ID`, `QUO_USER_ID`
- Webhook signatures (recommended): `QUO_WEBHOOK_SECRET`, `HOSTINGER_WEBHOOK_SECRET`

## 3) Staging Dry Run (required)

In staging, verify:

1. Broadcast draft can be created and preview renders merge fields.
2. Test send works for email and SMS.
3. Manager dispatch with approval enabled enters `pending_approval`.
4. Owner approval transitions campaign to `processing/completed`.
5. Suppressed recipients are excluded and counted.
6. Delivery webhook ingestion updates analytics totals.
7. Restart backend and confirm campaign/audit/analytics/suppressions remain persisted.

## 4) Production Readiness

Before release:

1. SPF, DKIM, and DMARC are configured and verified.
2. Daily caps are set (`email <= 80/day`, `sms <= 200/day`) unless formally raised.
3. One-click unsubscribe is present for email campaigns.
4. STOP/START behavior is confirmed for SMS.
5. Rollback plan is documented for this release.

## 5) Release Sign-off

Required approvals:

- Engineering owner
- Product/business owner

Record:

- Release commit SHA
- Date/time
- Approvers
