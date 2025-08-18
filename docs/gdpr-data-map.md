# GDPR Data Map

This document describes the personal data processed by Edge-OG, the purposes, legal bases, retention, processors, and data subject rights, in line with SC-2.

## 1. Services and Purposes

- Magic-link authentication: process email address to create/send authentication links.
- API usage and quotas: process API key identifiers and usage counts to enforce plan limits.
- Billing (Pro): process billing identifiers via Stripe for subscription management.
- Observability: process request metadata for reliability and abuse prevention.

## 2. Data Categories

- Identification: email (hashed with pepper), account ID (UUID), API key prefix (kid), session JWT (httpOnly cookie), IP (CF-Connecting-IP for rate limiting/security).
- Usage: monthly counters per API key/account, overage aggregates.
- Billing: Stripe customer ID and related events (no card details stored by Edge-OG).

## 3. Storage Locations

- Cloudflare KV Namespaces: ACCOUNTS, API_KEYS, USAGE, TEMPLATES.
- Durable Objects: QuotaCounter (ephemeral increments flushed to KV).
- Logs: Cloudflare Logpush destinations (if configured).

## 4. Retention

- Accounts: while active + 12 months.
- API keys: until revoked + 12 months (hashed only).
- Usage counters: 24 months for analytics and disputes.
- Logs with IP: 30 days unless legal hold.

## 5. Processors

- Cloudflare (infrastructure, email via MailChannels), Resend (optional dev email), Stripe (billing), HelloSign (DPA signature for Pro).

## 6. Security Measures

- HTTPS everywhere (HSTS 1 year), strict input validation, SVG sanitization via resvg, scoped KV access, rate limiting for auth, structured logs without secrets, CSP on HTML responses.

## 7. Data Subject Rights

- Access/Export: via support request.
- Rectification: update email by re-signup.
- Erasure: delete account on request (soft-delete then purge after 30 days).
- Objections/Restrictions: contact DPO.

## 8. International Transfers

- Data processed on Cloudflare global edge network. Standard Contractual Clauses apply with processors where required.

Last updated: 2025-08-18
