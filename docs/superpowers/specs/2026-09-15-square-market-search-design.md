# Square Market — Search (Stores + Products) Design

**Date:** 2026-09-15  
**Status:** Draft for user review  
**Parent specs:**  
- `docs/superpowers/specs/2026-09-10-square-market-design.md`  
- `docs/superpowers/specs/2026-09-15-square-market-store-profile-products-design.md`

## 1. Summary

Add marketplace search for **stores** and **active products**. Users type in the board chrome; results open on `/search?q=…`. Clicks go to the public store page (products can deep-link via hash).

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | Stores + products only (not squares/coords) |
| Entry | Board chrome search field → `/search?q=…` |
| Result click | `/store/[squareId]`; products → `#product-[id]` |
| Backend | `GET /api/search?q=` with Postgres `ILIKE` |
| Non-goals | Full-text ranking, fuzzy typos, ads boost, auth-only search |

## 3. Goals & non-goals

### Goals

- Chrome form submits to `/search?q=…`.
- Results page shows **Stores** then **Products** sections.
- API returns up to 20 stores and 20 products matching the query.
- Product cards on `/store/[squareId]` have `id="product-{id}"` for hash navigation.
- Public, unauthenticated search.

### Non-goals

- Searching squares by coordinates or owner email.
- Typo tolerance / synonym search.
- Ranking by popularity or paid boost.
- Inline autocomplete dropdown (v1 is a full results page).

## 4. Approaches considered

1. **`GET /api/search` + `/search` page + ILIKE** — recommended.  
2. **Postgres full-text (`tsvector`)** — better ranking; heavier for v1.  
3. **Client-only filter of board payload** — incomplete product coverage.

**Decision:** Approach **1**.

## 5. API

### `GET /api/search?q=`

- Public.
- Trim `q`. If empty or length &lt; 2 → `{ "stores": [], "products": [] }` with 200.
- Escape `\`, `%`, `_` in `q` before wrapping with `%…%` for `ILIKE`.
- **Stores** (max 20): where `name` OR `about` ILIKE pattern; order by `name` asc.  
  Fields: `id`, `squareId`, `name`, `about` (may truncate to ~160 chars in API or UI).
- **Products** (max 20): where `active === true` and (`name` OR `description` ILIKE); order by `name` asc.  
  Include store: `storeId`, `squareId`, `storeName`; plus `id`, `name`, `priceCents`, `imageUrl` (first image by sortOrder, or null).

```json
{
  "stores": [
    { "id": "…", "squareId": "…", "name": "Corner Café", "about": "…" }
  ],
  "products": [
    {
      "id": "…",
      "name": "House Latte",
      "priceCents": 450,
      "storeId": "…",
      "squareId": "…",
      "storeName": "Corner Café",
      "imageUrl": "/uploads/products/…/….webp"
    }
  ]
}
```

## 6. UI

### Board chrome

- Add a compact search form: text input `name="q"` + submit.
- `method="GET"` `action="/search"`.
- Accessible label (visually optional but `aria-label="Search"`).

### `/search`

- Client or server page reading `searchParams.q`.
- Fetch `/api/search?q=…` (or query Prisma in RSC — prefer **RSC + prisma** or API; **API + client** is fine for consistency with dashboard patterns — prefer **server page calling shared search helper** to avoid double hop).
- Sections: **Stores**, **Products**; empty states when no hits / short query.
- Store row → `/store/[squareId]`.
- Product row → `/store/[squareId]#product-[id]`.

### Public store page

- Each product card: `id={`product-${p.id}`}`.

## 7. Auth & safety

- No session required.
- Do not return `clickCount`, owner ids, or private emails in search hits.
- Cap results at 20+20 to bound load.

## 8. Testing

- `q` empty / 1 char → empty arrays.
- Matching store name returns store; inactive product excluded.
- Escape: query containing `%` does not match everything.
- Manual: chrome search → results → click product → store page scrolls/focuses card.

## 9. Implementation order

1. Shared `searchMarketplace(q)` helper + API route + tests.  
2. `/search` page.  
3. Chrome search form.  
4. Product anchor ids on public store page.  
5. Verify suite + smoke.

## 10. Roadmap note

Later: full-text ranking, square search, filters (price), and boosted ads slots.
