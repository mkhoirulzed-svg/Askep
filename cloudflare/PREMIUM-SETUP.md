# ASKEP Premium — Cloudflare D1 preparation

This branch prepares the database schema for the Rp9,000 one-time lifetime Premium plan.

## Architecture boundary
- R2 remains the source of truth for SDKI, SLKI, SIKI, relations, and case data.
- D1 stores account entitlement, Midtrans transaction state, and AI daily usage only.
- Firebase Google Authentication remains the identity provider.
- Midtrans Snap Production is created server-side by the Worker.
- Premium is activated only after a valid Midtrans notification is verified server-side.

## D1 schema
Apply `schema.sql` to a NEW D1 database named `askep-premium`.
Do not run it against or replace the R2 dataset.

## Worker binding and secrets (not yet configured)
Binding:
- D1 binding variable: `ASKEP_DB`
- Database: `askep-premium`

Secrets / variables to configure in Cloudflare Worker:
- Secret `MIDTRANS_SERVER_KEY` — Production Server Key; never put in frontend or Git.
- Variable `MIDTRANS_IS_PRODUCTION` = `true`
- Variable `FIREBASE_PROJECT_ID` = `sdki-a3960`
- Variable `PREMIUM_PRICE_IDR` = `9000`
- Variable `FREE_AI_DAILY_LIMIT` = `5`
- Variable `PREMIUM_AI_DAILY_LIMIT` — choose a finite initial limit before enabling paid AI access.
- Variable `ALLOWED_ORIGINS` — exact production website origin(s), comma-separated.

Do not paste any secret into chat or commit it to the repository. Use Cloudflare Worker Settings → Variables and Secrets.

## Planned API contract
- `POST /api/payment/create` — authenticated Firebase ID token; creates a pending D1 order and requests a Snap Production token.
- `POST /api/payment/notification` — public Midtrans webhook; validates signature and amount/order mapping; idempotently updates transaction and Premium entitlement.
- `GET /api/account/status` — authenticated; returns server-derived Premium state and remaining AI quota.
- `POST /api/ai/chat` — require Firebase ID token, atomically consume daily quota, then call existing KiosAPI flow.

## Important activation rules
- Never activate Premium from a browser redirect or client-side callback.
- Verify Firebase ID tokens (signature, issuer, audience, expiry) in the Worker.
- Verify Midtrans signature using SHA-512 of `order_id + status_code + gross_amount + ServerKey`.
- Confirm order exists in D1, belongs to the same UID, and amount is exactly IDR 9000.
- Only `settlement`, or `capture` with `fraud_status=accept`, grants lifetime Premium.
- Make notifications idempotent. A repeated webhook must not duplicate or downgrade an already valid entitlement.
- Do not store Server Key, Client Key, access tokens, or payment credentials in D1 or frontend source.

## Deployment status
This is a preparation branch only. No Worker deployment, D1 creation, Midtrans key setup, or production payment has been performed by this change.
