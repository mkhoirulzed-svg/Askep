# Askep Premium System (Foundation)

## Firestore user entitlement fields
The profile UI reads these fields from `users/{uid}`:
- `plan`: `free` or `premium`
- `isPremium`: boolean (legacy/compatibility flag)
- `subscriptionStatus`: `active`, `expired`, or `cancelled`
- `premiumUntil`: Firestore Timestamp or null (null means no expiry)
- `premiumGrantedBy`: administrative grant source/identifier

## Profile behavior
- Existing accounts without entitlement fields display Free.
- Premium is displayed only when plan is Premium (or isPremium true) AND status is active.
- If premiumUntil exists, profile displays its date.
- If premiumUntil is null/missing for a Premium account, UI displays permanent access.

## Security requirement (not implemented in this PR)
Do not grant Premium from client-side code or expose a client-side admin toggle.
Entitlement changes must be performed by a trusted backend (Firebase Admin SDK / Cloud Functions) or by tightly restricted Firestore security rules using a verified administrator identity.
Before activating Premium, deploy and test this trusted grant mechanism and confirm existing Firestore rules prevent users from editing entitlement fields themselves.

## Next implementation
1. Establish verified admin identity (Firebase UID allowlist or custom claims).
2. Backend grant/revoke endpoint callable only by admin.
3. Premium feature gating in the application and server/API routes.
4. Audit log for grants/revocations.
5. Subscription/payment integration if desired.
