# Square Market — Commission Collection Design (v1)

**Date:** 2026-09-16  
**Status:** Draft for user review  
**Parent specs:**  
- `docs/superpowers/specs/2026-09-15-square-market-commission-ledger-design.md`  
- `docs/superpowers/specs/2026-09-10-square-market-design.md`

## 1. Summary

Let store owners **pay Square Market** the full **unpaid click-commission balance** via **Stripe Checkout**. Unpaid = lifetime Σ `ProductClick.feeCents` − Σ succeeded `CommissionPayment.amountCents`. Checkout freezes the unpaid amount at session create; the webhook records a succeeded payment. Pay is available on store edit when unpaid ≥ **50¢**. No partial pays, auto-charge, or Connect in this slice.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Settlement | Pay **full unpaid** balance in one Checkout |
| Payment ledger | `CommissionPayment` rows; unpaid = fees − succeeded payments |
| Stripe minimum | Disable Pay when unpaid &lt; **50¢** |
| Amount during open Checkout | Frozen at **Checkout create** |
| Approach | Stripe Checkout + webhook (same pattern as primary square buy) |
| Concurrent Pay guard | Reject new checkout if store has `pending` payment newer than **1 hour** |
| `estimatedOwedCents` meaning | **Unpaid** balance on owner `mine=1` (UI: “Unpaid” / “Estimated commission owed”) |

## 3. Goals & non-goals

### Goals

- Owner-only `POST …/commission/checkout` → hosted Checkout URL.
- Webhook credits `CommissionPayment` on `checkout.session.completed` with `metadata.type=commission`.
- Owner payload: `lifetimeFeesCents`, `paidCents`, `estimatedOwedCents` (unpaid), `canPayCommission`.
- Store edit: Pay button + under-minimum hint; soft success message via query param.
- Idempotent on `stripeCheckoutSessionId`; amount verified against `amount_total`.

### Non-goals

- Partial payments, custom amounts, scheduled auto-charge.
- Stripe Invoices, Payment Element on-page, Stripe Connect.
- Marking individual `ProductClick` rows paid.
- Admin billing console or email digests.
- Changing `/go` fee snapshot rules or `COMMISSION_FEE_BPS`.

## 4. Approaches considered

1. **Stripe Checkout + webhook (chosen)** — matches primary square buy; hosted UI; session-id idempotency.  
2. **Payment Element on-page** — stays in-app; more UI/PCI surface.  
3. **Stripe Invoices** — formal billing; heavier and slower for v1.

**Decision:** Approach **1**.

## 5. Data model

### `CommissionPayment`

| Field | Type | Notes |
|-------|------|--------|
| `id` | cuid | PK |
| `storeId` | string | FK → `Store`, `onDelete: Cascade` |
| `amountCents` | int | Frozen unpaid at create; ≥ 50 when created for Checkout |
| `stripeCheckoutSessionId` | string | **Unique** |
| `status` | string | `pending` \| `succeeded` \| `canceled` |
| `createdAt` | DateTime | Default now |
| `succeededAt` | DateTime? | Set when webhook marks succeeded |

Relation: `Store.commissionPayments CommissionPayment[]`.  
Indexes: `storeId`; unique `stripeCheckoutSessionId`.

### Balance definitions

```
lifetimeFeesCents = SUM(COALESCE(ProductClick.feeCents, 0)) WHERE storeId
paidCents         = SUM(amountCents) WHERE storeId AND status = 'succeeded'
unpaidCents       = max(0, lifetimeFeesCents - paidCents)
```

Constants: `MIN_COMMISSION_CHECKOUT_CENTS = 50`.

Pending payments **do not** reduce unpaid (only `succeeded` counts).

## 6. Flow

1. Owner on `/store/[squareId]/edit` sees unpaid; if ≥ 50¢, **Pay commission** enabled.  
2. Client `POST /api/stores/[squareId]/commission/checkout`.  
3. Server verifies owner; if unpaid &lt; 50 → `400`; if pending payment for store with `createdAt` within last hour → `409`.  
4. Create Stripe Checkout session (`mode: payment`, USD, one line item “Square Market commission”, `unit_amount = unpaidCents`).  
5. Metadata: `type=commission`, `storeId`, `squareId`, `amountCents` (string), `payerId`.  
6. Insert `CommissionPayment` (`pending`, session id, amount).  
7. Return `{ url }`; client redirects.  
8. Success URL: `/store/[squareId]/edit?commission=success`; cancel: `?commission=cancel`.  
9. Webhook `checkout.session.completed` + `type=commission` → mark payment `succeeded` (idempotent).  
10. Subsequent `mine=1` loads show lower unpaid; new clicks increase unpaid again.

## 7. API & helpers

### Helpers (`src/lib/commission/…`)

- Reuse fee helpers from ledger v1.
- `MIN_COMMISSION_CHECKOUT_CENTS = 50`.
- `computeUnpaidCents(lifetimeFeesCents, paidCents): number`.
- Store-scoped queries (or single function) returning `{ lifetimeFeesCents, paidCents, unpaidCents, canPayCommission }`.

### `POST /api/stores/[squareId]/commission/checkout`

- Auth required; `requireSquareStoreOwner`.  
- Body: empty or `{}` (no client amount).  
- Responses: `{ url }` 200; 401/403; 400 under minimum; 409 pending checkout; 503 DB/Stripe errors.  
- App base URL: same `NEXT_PUBLIC_APP_URL` pattern as primary checkout.

### Webhook (`src/app/api/stripe/webhook/route.ts`)

- Existing signature verify unchanged.  
- On `checkout.session.completed`:  
  - `metadata.type === "primary"` → existing handler.  
  - `metadata.type === "commission"` → new handler:  
    - Load payment by `session.id`.  
    - If missing → log, return received.  
    - If already `succeeded` → no-op.  
    - If `session.payment_status` not paid → no-op / leave pending.  
    - If `session.amount_total !== payment.amountCents` → log; do **not** mark succeeded; **refund** using the same helper pattern as primary checkout when a PaymentIntent is available.  
    - Else set `status=succeeded`, `succeededAt=now()`.

### Owner `GET /api/stores/[squareId]?mine=1`

- `store.estimatedOwedCents` = unpaid (breaking semantic from “lifetime fees only” — documented).  
- `store.lifetimeFeesCents`, `store.paidCents`, `store.canPayCommission`.  
- Per-product `estimatedOwedCents` remains **product fee sum** (lifetime fees for that product, not net of payments — payments are store-scoped). Document that product line is fee accrual, store line is unpaid balance.

### UI (`store-edit-client`)

- Copy: “Estimated commission owed” / unpaid amount; optional “Lifetime fees” / “Paid”.  
- Button **Pay commission** when `canPayCommission`; disabled + “Balance too small to pay yet” when `0 < unpaid < 50`.  
- On `commission=success`: brief note that balance updates when Stripe confirms.  
- On `commission=cancel`: optional muted note.

## 8. Auth & safety

- Never trust client-supplied amount or store id beyond URL + ownership check.  
- Open redirect: Checkout URLs from Stripe only.  
- Webhook signature required.  
- One active pending checkout per store per hour (guard).  
- Guests never see pay controls or money fields.

## 9. Testing

- Unit: `computeUnpaidCents`; `canPay` threshold at 49 vs 50.  
- Checkout route: unauthorized; non-owner; unpaid 49 → 400; happy path creates pending + returns url (mock Stripe); pending within 1h → 409.  
- Webhook: commission succeed; duplicate webhook; amount mismatch does not succeed; primary path still works.  
- Store GET: owner unpaid/paid/lifetime/canPay; public omits.  
- Manual: Stripe test card pay ≥50¢ → unpaid drops after webhook.

## 10. Implementation order

1. Prisma `CommissionPayment` + migrate.  
2. Balance helpers + tests.  
3. Checkout POST route + tests.  
4. Webhook commission branch + tests.  
5. Owner serialize / `mine=1` unpaid fields.  
6. Store edit Pay UI + query-param messaging.  
7. Suite + Stripe test-mode smoke.

## 11. Roadmap note

Later: expire/cancel stale pending sessions, partial pay, invoices, auto-debit, admin reports. This v1 only closes the “display owed → pay full balance” loop.
