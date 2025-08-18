# Data Processing Addendum (DPA) Template

Note: This is a template DPA for Edge‑OG Pro customers. It can be executed via e‑signature (e.g., HelloSign). Replace bracketed fields before signature.

1. Parties
- Controller: [Customer legal name], registered at [address].
- Processor: Edge‑OG (Vincent Boillot Devalliere), registered at [address].

2. Subject Matter
Processor provides Open Graph image generation and related API, dashboard, and analytics services.

3. Duration
Effective as of [date] until termination of the Master Services Agreement (MSA).

4. Nature and Purpose of Processing
- Authentication via magic‑link
- Image generation requests
- Usage/quotas and billing
- Observability/security monitoring

5. Categories of Personal Data
- Email (hashed with pepper), account ID, API key prefix (kid), session cookie, IP address (for security/rate limiting), billing identifiers via Stripe.

6. Data Subjects
- Customer’s end users and authorized personnel.

7. Sub‑processors
- Cloudflare (edge network, KV, MailChannels), Resend (optional email dev), Stripe (billing), HelloSign (e‑signature only), others listed at https://edge-og.example.com/subprocessors.

8. International Transfers
Standard Contractual Clauses (SCCs) apply where required.

9. Security Measures
- HTTPS with HSTS (1 year), strict parameter validation, SVG sanitization (resvg), scoped KV access, DoS/rate limiting, structured logs without secrets, least-privileged access.

10. Data Subject Requests
Processor assists Controller in fulfilling rights requests within legally required timeframes.

11. Confidentiality
Personnel with access to personal data are bound by confidentiality.

12. Breach Notification
Processor notifies Controller without undue delay upon becoming aware of a personal data breach.

13. Deletion/Return of Data
Upon termination, Processor deletes or returns personal data except where retention is required by law.

14. Audits
Processor provides reasonable information to demonstrate compliance and allows audits under mutually agreed scope and frequency.

15. Liability
As per MSA; DPA does not expand liability beyond the MSA except as required by law.

16. Governing Law
[Jurisdiction].

Signed:
- Controller: __________________  Date: __________
- Processor: ___________________ Date: __________

Appendix A: Technical and Organizational Measures (TOMs)
- Encryption in transit (TLS 1.2+), HSTS 1 year
- Access control and audit logging
- Isolation of environments; no production data in development
- Backups for critical KV namespaces; recovery procedures
- Incident response playbook

Appendix B: Sub‑processors
- Cloudflare, Resend (optional), Stripe, HelloSign

Appendix C: Data Map
- See docs/gdpr-data-map.md
