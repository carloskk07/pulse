# Product Completion — consumer readiness boundary

This document separates **consumer product completion** from the stricter **PRODUCT_READY financial gate**.

## Completed in this release

- Public story simplified to: choose → complete → verify → withdraw.
- Contextual first-reward onboarding for signed-in accounts with zero available balance.
- Public Help Center with Turnstile-protected support intake and traceable protocols.
- Signed-in users can see their own recent support protocols.
- Admin support queue with explicit open / in-review / resolved / closed lifecycle.
- Account page with identity, trust level, membership date, editable handle and direct access to support/privacy requests.
- Public Terms, Privacy and Rewards Policy pages.
- Sign-up surface links to Terms, Privacy and Rewards Policy.
- Public sitemap includes only useful public trust/help pages; financial product surfaces remain outside public marketing indexing.
- Core mobile navigation remains intentionally small: Home, Drops, Wallet and Invite.

## Deliberately not claimed as complete

### Financial proof

`PRODUCT_READY` remains blocked until the complete external loop is proven with real evidence:

`ACCOUNT → EARN → REAL CALLBACK → LEDGER CREDIT → WALLET → WITHDRAWAL → REAL PAYOUT → RECEIVED`

Required external proofs still include:

1. ayeT Sandbox Identifier preflight producing current `ayet_transport` evidence without financial writes.
2. One fresh real ayeT conversion producing the authoritative monetization event, ledger credit and current `ayet_callback` evidence.
3. Exact FaucetPay payout pack/unit configuration.
4. One controlled paid withdrawal producing current `faucetpay_payout` evidence and a paid withdrawal row.

No growth, advertiser acquisition or scale push should resume before those gates are closed.

### Password self-service recovery

Password recovery is not promoted as completed in this release. A production-grade recovery flow should only be enabled after the hosted Supabase recovery email template, redirect allowlist, SMTP delivery and full PKCE recovery session can be validated end to end. Until then, account-access problems route to the Help Center instead of exposing a partially tested recovery path.

### Legal launch identity

The policy surfaces now explain the product's actual data, reward and support behavior, but a broad public launch still requires the operator's formal legal identity, jurisdiction-specific contact/representative details where required, and professional legal review. These values must not be invented in code.

## Support authority model

- Public users cannot insert directly into `support_cases` through the Data API.
- The support form is human-verified before trusted server insertion.
- Signed-in users may read only their own case metadata under RLS.
- Full case messages and operational status changes remain server/admin controlled.

## Product rule

Completion work may improve clarity, supportability and trust, but it must never convert configuration or synthetic activity into financial readiness evidence.
