# Admin Premium Console (Phase 2)

## Admin console
Open `pages/admin-premium.html`. The page:
- Requires a signed-in Google Firebase Auth account.
- Forces token refresh and checks Firebase Custom Claim `admin === true`.
- Hides the management area when the claim is absent.
- Calls a configurable backend API only; no entitlement writes are performed directly by the browser.
- Backend URL is intentionally empty (`ADMIN_API_BASE`) until a trusted API is deployed.

## Bootstrap the developer/admin claim
A trusted operator using Firebase Admin SDK must set the custom claim on the developer account UID. Do not set claims from client code. Example (run in a secure local/admin environment, not in the browser):
```js
await admin.auth().setCustomUserClaims(UID, { admin: true });
```
After the claim is set, user must sign out/in or force-refresh ID token. Verify the claim by checking `getIdTokenResult(true)`.

## Backend contract (to implement/deploy)
The Admin page expects a trusted backend with these routes:
- `POST /admin/user/lookup` JSON `{email}` -> user record (email, plan, status)
- `POST /admin/premium/grant` JSON `{email, durationDays}` -> grant result. `durationDays: 0` means permanent.
- `POST /admin/premium/revoke` JSON `{email}` -> revoke result.

Each request sends `Authorization: Bearer <Firebase ID token>`. Backend MUST:
1. Verify ID token using Firebase Admin SDK.
2. Require verified custom claim `admin === true`.
3. Resolve user by email using Admin SDK, never trust a client UID.
4. Write entitlement fields server-side only: `plan`, `isPremium`, `subscriptionStatus`, `premiumUntil`, `premiumGrantedBy`, `updatedAt`.
5. For permanent Premium, set `premiumUntil: null`; for timed Premium, calculate expiry server-side.
6. Log grant/revoke audit events.
7. Rate-limit requests and return generic errors for sensitive lookup failures.
8. Ensure Firestore Security Rules prevent users from changing entitlement fields themselves.

## Current state
The UI is a scaffold only. Since the API base URL is blank, lookup/grant/revoke are disabled and no Premium can be activated through this page yet. Admin claim provisioning and backend API deployment are the next implementation/deployment steps.
