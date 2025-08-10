# BI-3 — Subscription cancel via Stripe Portal

This implements user story BI-3: "L’utilisateur peut annuler son abonnement" with a Customer Portal entry point and real-time status sync from Stripe webhooks.

## Endpoints

- POST /billing/portal
  - Purpose: Start a Stripe Customer Portal session so users can manage/cancel their subscription.
  - Auth: Requires a logged-in dashboard session (edge_og_session cookie).
  - Response (dev/test): `{ url: "<BASE_URL>/dashboard?portal=started" }`
  - Production: Replace stub with Stripe Customer Portal session creation using STRIPE_SECRET_KEY.

- POST /webhooks/stripe
  - On upgrade events (`invoice.paid`, `checkout.session.completed`, `customer.subscription.created`): plan → `starter`.
  - On cancellation (`customer.subscription.deleted` or `customer.subscription.updated` with `status=canceled` or `cancel_at_period_end=true`): plan → `free` immediately.
  - Signature verification honors STRIPE_WEBHOOK_SECRET when set.

## KV Effects

- `account:{UUID}` → `plan` updated to `starter` or `free` via `updateAccountPlan()`.

## Environment

- STRIPE_SECRET_KEY (prod): Required to create real portal sessions.
- STRIPE_WEBHOOK_SECRET (prod): Required to verify webhook signatures.
- BASE_URL: Used for redirect stub in dev/test.

## Notes

- Observability: logs events `billing_portal_created`, `stripe_subscription_canceled` with `request_id`.
- Security: Cookie-based session guard matches existing checkout endpoint behavior.
- Tests: `packages/worker/test/billing.spec.ts` covers portal endpoint and cancel webhook downgrade.
