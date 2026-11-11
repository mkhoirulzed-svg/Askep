# ASKEP Premium — Cloudflare D1 and Midtrans

This branch prepares the Rp9,000 one-time lifetime Premium plan.

## Existing production resources

- Existing D1 database: **askep-premium-db**.
- Existing tables (confirmed from the D1 Studio SQL shown by the user):
  - `payment_transactions`
  - `premium_users`
- Existing table structures are retained. Do not create a second D1 database.
- R2 binding `ASKEP_DATA` remains the source of truth for SDKI, SLKI, SIKI, relations, and case data.
- Firebase Google Authentication remains the identity provider.

## Database migration

For the existing `askep-premium-db`, apply only:

`d1/migrations/0002_existing_premium_db.sql`

This creates `ai_daily_usage` and indexes for the existing transaction table. It does not drop, rename, or recreate either existing table.

Do **not** apply `d1/schema.sql` to this existing database. That file is a reference schema for a clean, separate database and uses a different entitlement layout.

## Worker binding and configuration

Add a D1 binding to the existing ASKEP Worker:

- Variable name: `ASKEP_DB`
- Database: `askep-premium-db`

Keep the existing R2 binding `ASKEP_DATA` unchanged.

Cloudflare Worker variables/secrets to configure:

- Secret `MIDTRANS_SERVER_KEY` — Production Server Key; never put in frontend or Git.
- Variable `MIDTRANS_IS_PRODUCTION` = `true`
- Variable `FIREBASE_PROJECT_ID` = `sdki-a3960`
- Variable `PREMIUM_PRICE_IDR` = `9000`
- Variable `FREE_AI_DAILY_LIMIT` = `5`
- Variable `PREMIUM_AI_DAILY_LIMIT` = `50` (initial proposed limit; can be adjusted)
- Variable `ALLOWED_ORIGINS` = exact production website origin(s), comma-separated.

The Midtrans Client Key is public and belongs in the frontend configuration only after the Production integration is ready. Never share Server Key in chat or commit it.

## Worker source and chat authentication

- The integrated Worker source for review/deployment is `cloudflare/worker.js`. It is based on the existing uploaded Worker source and retains the R2 data routes and KiosAPI chat implementation.
- `pages/chat.html` initializes the existing Firebase project and `scripts/chat.js` sends the Firebase ID token as a Bearer token. The chat endpoint now requires a signed-in Google account.
- Review and deploy this Worker only after the D1 migration and `ASKEP_DB` binding are ready. Do not overwrite the currently deployed Worker before testing the new version.

## Planned API contract

- `POST /api/payment/create` — authenticated Firebase ID token; creates a pending D1 order and requests a Snap Production token.
- `POST /api/payment/notification` — public Midtrans webhook; validates signature, amount, and order mapping; idempotently updates transaction and Premium entitlement.
- `GET /api/account/status` — authenticated; returns server-derived Premium state and remaining AI quota.
- `POST /api/ai/chat` — requires Firebase ID token, consumes the daily quota, then calls the existing KiosAPI flow.

## Activation and security rules

- Never activate Premium from a browser redirect or client-side callback.
- Verify Firebase ID tokens (signature, issuer, audience, expiry) in the Worker.
- Verify Midtrans signature using SHA-512 of `order_id + status_code + gross_amount + ServerKey`.
- Confirm the order exists in D1, belongs to the authenticated UID, and amount is exactly IDR 9000.
- Only `settlement`, or `capture` with `fraud_status=accept`, grants lifetime Premium.
- Make notifications idempotent; repeated webhooks must not duplicate or downgrade entitlement.
- Never store Server Key, access tokens, or payment credentials in D1 or frontend source.

## Deployment status

The database itself already exists. This repository change does not apply the migration, configure Worker bindings/secrets, deploy the Worker, or initiate a real payment. Those Cloudflare dashboard actions still require the account owner.
