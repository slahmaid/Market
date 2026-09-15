# Square Market — Commission Ledger Design (v1)

**Date:** 2026-09-15  
**Status:** Draft for user review  
**Parent specs:**  
- `docs/superpowers/specs/2026-09-10-square-market-design.md`  
- `docs/superpowers/specs/2026-09-15-square-market-store-profile-products-design.md`  
- `docs/superpowers/specs/2026-09-15-square-market-buy-click-tracking-design.md`

## 1. Summary

Turn buy-click attribution into an **immutable per-click commission ledger**. On each successful `GET /go/[productId]` hop, Square Market snapshots the product price and fee rate and stores computed `feeCents` on the `ProductClick` row. Store owners see a **lifetime estimated commission owed** to Square Market on the store edit page. No Stripe collection or payouts in this slice — display and audit trail only.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Trigger | Per outbound Buy click (`ProductClick` / `/go`) |
| Fee formula | Percent of product `priceCents` at click time |
| Default rate | **7%** (`700` bps), same as secondary-sale fee in main SM spec |
| Debtor / visibility | Store owner owes SM; owner sees estimated owed (`mine=1` / edit UI) |
| Persistence | Snapshot `priceCents` + fee % + `feeCents` at click time (immutable) |
| Aggregation | Lifetime total (no monthly periods UI in v1) |
| Approach | Extend `ProductClick` on write; sum on owner read |
| Collection | Report / estimate only — no Stripe invoice or charge |
| Legacy clicks | Rows without snapshots contribute **0** (no backfill) |

## 3. Goals & non-goals

### Goals

- On each successful `/go` hop, persist `priceCentsAtClick`, `feeBps`, and `feeCents`.
- Env-configurable rate: `COMMISSION_FEE_BPS` (default `700`).
- Owner-only lifetime `estimatedOwedCents` at store level; `mine=1` product payloads always include per-product `estimatedOwedCents` alongside `clickCount` (edit UI may show or omit the per-product dollars).
- Pure helpers for fee math and bps resolution (unit-tested).
- Preserve redirect-anyway behavior if click insert fails.

### Non-goals

- Stripe (or any) payment collection / Connect payout.
- Admin console or platform-wide commission reports.
- Bot / double-click deduplication beyond existing `/go` behavior.
- Monthly invoices, statements, or a dedicated `/earnings` route.
- Backfilling fee snapshots onto historical `ProductClick` rows.
- Exposing owed amounts on public store or search payloads.

## 4. Approaches considered

1. **Snapshot on `/go` (chosen)** — write fee fields onto `ProductClick`; owner API sums `feeCents`. Matches immutable-ledger requirement; cheap reads; minimal new surface.
2. **Nightly aggregate job** — rollups into day tables. Extra infra and stale totals; overkill for v1.
3. **Compute on read only** — live `price × env%` from clicks. Breaks snapshot immutability when prices or rates change.

**Decision:** Approach **1**.

## 5. Data model

### `ProductClick` (extended)

| Field | Type | Notes |
|-------|------|--------|
| `id` | cuid | Existing PK |
| `productId` | string | Existing FK |
| `storeId` | string | Existing FK |
| `createdAt` | DateTime | Existing |
| `priceCentsAtClick` | `Int?` | Snapshot of product `priceCents`; `null` = legacy / no fee |
| `feeBps` | `Int?` | Snapshot rate in basis points (`700` = 7%) |
| `feeCents` | `Int?` | `floor(priceCentsAtClick * feeBps / 10000)`; legacy `null` → treat as 0 in sums |

- New clicks always set all three fields (non-null integers; `feeCents` may be `0`).
- Lifetime owed for a store = `SUM(COALESCE(feeCents, 0))` filtered by `storeId` (equivalently: sum where `feeCents IS NOT NULL`, since null legacy rows contribute 0).
- Per-product owed = same sum grouped by `productId`.
- No separate `CommissionEntry` table in v1.

### Env

| Name | Default | Meaning |
|------|---------|---------|
| `COMMISSION_FEE_BPS` | `700` | Basis points applied **at write time** on `/go` |

Invalid, missing, non-integer, or negative values → fall back to `700`.

## 6. Flow

1. Visitor clicks **Buy** → `GET /go/[productId]`.
2. Server loads product including `priceCents`, `active`, `buyUrl`, `storeId`.
3. Validate active + https `buyUrl` (unchanged); else `404`.
4. `feeBps = getCommissionFeeBps()`; `feeCents = computeClickFeeCents(priceCents, feeBps)`.
5. `prisma.productClick.create` with snapshots. On failure: log server-side, continue.
6. `302` to stored `buyUrl`.
7. Owner loads `/store/[squareId]/edit` via `GET /api/stores/[squareId]?mine=1` and sees lifetime + optional per-product owed.

## 7. API & helpers

### Helpers

- `computeClickFeeCents(priceCents: number, feeBps: number): number` — `Math.floor(priceCents * feeBps / 10000)`; assume non-negative ints from callers.
- `getCommissionFeeBps(): number` — parse `process.env.COMMISSION_FEE_BPS`; fallback `700`.

### `GET /go/[productId]`

- Select `priceCents` in addition to existing fields.
- Create click with `priceCentsAtClick`, `feeBps`, `feeCents`.
- Redirect-anyway and open-redirect safety unchanged.

### `GET /api/stores/[squareId]?mine=1`

- Store payload includes `estimatedOwedCents: number` (lifetime sum).
- Each product includes existing `clickCount` plus `estimatedOwedCents: number`.
- Public GET (no `mine=1`) **omits** all owed fields.

### UI (`store-edit-client`)

- Near top of edit page: “Estimated commission owed: $X.XX” via `Intl.NumberFormat` USD from cents.
- Per-product row may append owed when useful (e.g. after click count); keep UI minimal.
- No new routes in v1.

## 8. Auth & safety

- Never trust client-supplied price or fee rate.
- Owed fields only after existing square-store owner / `mine=1` checks.
- Guests and non-owners never see commission totals.
- Destination URL remains DB `buyUrl` only.
- Zero-price products still log clicks with snapshots and `feeCents = 0`.

## 9. Testing

- Unit: `computeClickFeeCents` — e.g. `1999 × 700` → floor result; `0` price → `0`; rounding edges.
- Unit: `getCommissionFeeBps` — default, valid override, invalid → `700`.
- `/go`: create includes snapshots; create throw → still `302`.
- Owner `mine=1`: store and product `estimatedOwedCents`; public GET omits them.
- Legacy `null` fee rows do not increase the sum.
- Manual: Buy click → edit page lifetime owed increases by expected cents.

## 10. Implementation order

1. Prisma migrate: add nullable snapshot columns on `ProductClick`.
2. Fee helpers + unit tests.
3. Update `/go` to write snapshots.
4. Owner store serialization / `mine=1` aggregates.
5. Store edit UI lifetime owed line.
6. Suite + manual smoke.

## 11. Roadmap note

Later slices can add Stripe collection, monthly statements, admin reports, or conversion-based billing. This v1 only makes click fees durable and visible to the debtor (store owner).
