# Product Completion — consumer readiness boundary

This document separates **consumer product implementation** from the stricter **PRODUCT_READY financial gate**.

## Implemented product surface

- Mobile-first public, authentication and signed-in product surfaces.
- Hourly Pulse with rolling eligibility and Treasury gating.
- Authoritative ledger and Wallet surfaces.
- Optional Turbo routes with provider/direct settlement authority separated from browser activity.
- Public Proof based on factual production aggregates.
- Quality-gated referrals and product-history-derived Trust.
- Turnstile-protected sensitive actions.
- Help Center with server-authoritative support intake and admin lifecycle.
- Account identity, privacy/support access and editable handle.
- Hosted password-recovery implementation with a separate real-world proof gate.
- Public Terms, Privacy and Rewards Policy governed by the legal-policy manifest.
- Private admin cockpits for release, product and FaucetPay evidence.

Implementation is not the same thing as proven financial readiness.

## Deliberately not claimed as PRODUCT_READY

`PRODUCT_READY` remains blocked until the provider-independent base loop is proven with real, current evidence:

```text
ACCOUNT
→ FUNDED/OPEN TREASURY
→ CURRENT HOURLY PULSE CLAIM
→ AUTHORITATIVE LEDGER CREDIT
→ WALLET
→ WITHDRAWAL LEDGER DEBIT
→ FAUCETPAY PROVIDER-PAID STATE
→ ACTUAL DESTINATION RECEIPT
```

Required external/operational proof includes:

1. Current Turnstile production evidence.
2. Supabase Auth leaked-password protection with matching hardening evidence.
3. Real hosted password-recovery completion proof.
4. Qualified legal-policy review and international-transfer review for the current operator/provider set.
5. FaucetPay read-only proof of the live settlement asset, economic pack and exact provider unit scale.
6. A real funded/open Treasury and one current-contract Hourly Pulse claim.
7. One controlled paid FaucetPay withdrawal with current provider-side payout evidence.
8. Explicit actual-receipt evidence pinned to that exact withdrawal.
9. Same-account causal continuity across claim, ledger, withdrawal and receipt.

Optional ayeT/Turbo evidence is not a base-product prerequisite. When Turbo is configured, its conversions must still be authoritative, signed/deduplicated and independently proven before any Turbo reward can be treated as real.

No growth, paid acquisition or broad claim of proven payouts should resume before the blocking base-product gates are closed.

## Password self-service recovery

The recovery implementation exists, but release authority comes only from a completed hosted proof: recovery email → recovery session → password update → later successful sign-in with the new password. Configuration or UI presence alone does not satisfy the gate.

## Legal launch identity

Policy surfaces describe the product's actual data, reward and support behavior, but broad launch still requires a real operator identity, applicable jurisdiction/contact details and qualified review. These values must come from production configuration and must never be invented in code.

## Support authority model

- Public users cannot insert directly into `support_cases` through the Data API.
- The support form is human-verified before trusted server insertion.
- Signed-in users may read only their own case metadata under RLS.
- Full case messages and operational status changes remain server/admin controlled.

## Product rule

Completion work may improve clarity, supportability and trust, but it must never convert configuration, historical evidence or synthetic activity into current financial readiness evidence.
