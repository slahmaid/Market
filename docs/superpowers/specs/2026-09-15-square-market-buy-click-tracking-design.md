# Square Market — Buy Click Tracking Design (Commission v1)

**Date:** 2026-09-15  
**Status:** Draft for user review  
**Parent specs:**  
- `docs/superpowers/specs/2026-09-10-square-market-design.md`  
- `docs/superpowers/specs/2026-09-15-square-market-store-profile-products-design.md`

## 1. Summary

Add a **Square Market redirect hop** for product Buy links so each outbound click is logged. Owners see per-product click counts on the store edit page. No payouts, fees, or conversion proof in this slice — only attribution raw material for commission later.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Mechanism | SM redirect (`/go/[productId]`) then `302` to merchant `buyUrl` |
| Visibility | Square **owner only** (edit / `mine=1` payload) |
| Payload | Minimal: `productId`, `storeId`, `createdAt` |
| Log failure | **Redirect anyway** (shopper not blocked) |
| Non-goals | Payouts, fee %, IP/UA, admin reports, Stripe checkout |

## 3. Goals & non-goals

### Goals

- Public Buy buttons use `/go/[productId]` instead of raw `buyUrl`.
- Each successful hop attempts to insert a `ProductClick` row.
- Inactive products / missing https `buyUrl` → `404` (no redirect).
- Owners see `clickCount` per product on `/store/[squareId]/edit`.
- Guests and other users never see other stores’ click totals.

### Non-goals

- Proving a sale happened off-site.
- Calculating commission owed or paying anyone.
- Deduplicating double-clicks / bots.
- IP, user-agent, or referrer storage.
- Platform-wide admin analytics UI.

## 4. Approaches considered

1. **Redirect hop** — recommended; reliable server-side log + open redirect control.  
2. **Client beacon then `window.open`** — easy to lose; adblock sensitive.  
3. **Auth-gated Buy** — kills guest traffic.

**Decision:** Approach **1**.

## 5. Data model

### `ProductClick`

| Field | Type | Notes |
|-------|------|--------|
| `id` | cuid | PK |
| `productId` | string | FK → `Product`, cascade delete |
| `storeId` | string | FK → `Store` (denormalized for easy store-scoped counts) |
| `createdAt` | DateTime | Default now |

Indexes: `productId`, `storeId`, optionally `(storeId, createdAt)`.

Relation: `Product.clicks ProductClick[]`; optional `Store.clicks`.

## 6. Flow

1. Visitor on `/store/[squareId]` clicks **Buy**.  
2. Browser requests `GET /go/[productId]`.  
3. Server loads product (include store); requires `active` and https `buyUrl`.  
4. Try `prisma.productClick.create({ productId, storeId })`. On failure: log server-side, continue.  
5. `302` Location = `buyUrl`.  
6. Owner loads edit / `GET /api/stores/[squareId]?mine=1` and sees aggregated counts.

## 7. API & pages

### `GET /go/[productId]`

- Public App Router route (prefer `src/app/go/[productId]/route.ts` returning `NextResponse.redirect`).
- Validate product exists, `active === true`, `buyUrl` starts with `https://`.
- Never redirect to a URL that is not the stored `buyUrl` (no query override).
- On validation failure → `404` JSON or simple HTML not-found (prefer Next `notFound` / 404 response).

### Store GET (`?mine=1`)

- For each product in the owner payload, include `clickCount: number` (SQL `_count` or `groupBy`).
- Public GET (no `mine=1`) **omits** `clickCount`.

### UI

- `src/app/store/[squareId]/page.tsx`: Buy `href={`/go/${product.id}`}`.
- `store-edit-client.tsx`: show “N clicks” on each product row.

## 8. Auth & safety

- Click insert is public (by design); do not expose counts publicly.
- Owner counts only when `requireSquareStoreOwner` / existing `mine=1` owner check passes.
- Open-redirect safe: destination is always DB `buyUrl` already validated as https on write.
- Cascade delete clicks when product (or store) is deleted.

## 9. Testing

- `/go/[id]` with active product + https URL → 302 to that URL; click row created (mock prisma).
- Inactive / missing buyUrl → 404; no redirect.
- Prisma create throws → still 302 (redirect-anyway).
- Public store GET has no `clickCount`; `mine=1` owner response includes counts.
- Manual: click Buy → lands on example.com; edit page count increments.

## 10. Implementation order

1. Prisma `ProductClick` + migrate.  
2. `GET /go/[productId]` route + tests.  
3. Wire public Buy hrefs.  
4. Add `clickCount` to owner store GET + edit UI.  
5. Verify suite + manual smoke.

## 11. Roadmap note

Later commission slices can bill from these clicks (or replace with conversion webhooks). This v1 only creates the audit trail.
