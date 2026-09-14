# Square Market — Phase 4a Design (My Squares Dashboard)

**Date:** 2026-09-14  
**Status:** Draft for user review  
**Parent spec:** `docs/superpowers/specs/2026-09-10-square-market-design.md`

## 1. Summary

Add an authenticated **My squares** dashboard: a view-only list of squares the user owns (`owned` or `listed`). Clicking a square returns to the board with that square selected. Wallet, earnings, buyers, and market stats stay out of scope until Stripe / later slices.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | **My squares only** (Phase 4a) |
| Actions | **View only** — no list/unlist/customize on the dashboard |
| Click | Open board focused on that square |
| Approach | Dedicated `/dashboard` page + chrome link |

## 3. Goals & non-goals

### Goals

- Logged-in users open `/dashboard` and see their squares.
- Guests hitting `/dashboard` are sent to `/login` (with return to dashboard).
- Each item shows: thumbnail (or placeholder), coordinates `(x, y)`, status (`owned` / `listed`), list price when listed.
- Click → homepage with that square selected (panel open).
- Empty state when the user owns nothing.
- “Dashboard” link in board chrome when logged in.
- Light theme; mobile-friendly list (not a dense data table).

### Non-goals

- Wallet / earnings / Connect status.
- Recent buyers / market overview.
- List, unlist, or customize from the dashboard (use board panel).
- Stripe / secondary buy.
- Pagination beyond a simple full list (max 2,500 but typical counts are tiny).

## 4. Approaches considered

1. **`/dashboard` page + `GET /api/me/squares`** — recommended.  
2. Modal over the board — weaker navigation / sharing.  
3. Full multi-tab dashboard shell with empty wallet — YAGNI now.

**Decision:** Approach **1**.

## 5. API

### `GET /api/me/squares`

- Auth required → `401` if no session.
- Query Prisma: `Square` where `ownerId = session.user.id` and `status in (owned, listed)`.
- Order: `y` asc, `x` asc (or `updatedAt` desc — prefer **coords** for stable scanning).
- Response:

```json
{
  "squares": [
    {
      "id": "...",
      "x": 12,
      "y": 34,
      "status": "owned",
      "imageUrl": "/uploads/squares/....webp",
      "linkUrl": "https://...",
      "listPriceCents": null
    }
  ]
}
```

No preview-board fallback (dashboard is real ownership only).

## 6. UI / UX

### `/dashboard`

- Auth gate (server redirect or client redirect to `/login?callbackUrl=/dashboard`).
- Header: title **My squares**, link **← Board**.
- List: one row/card per square — 48–64px thumb, `(x, y)`, status badge, USD list price if `listed`.
- Click / keyboard activate → `/?square=<id>`.
- Empty: short copy + **Browse the board** → `/`.

### Board chrome

- When logged in: add **Dashboard** link beside the email chip (before or after email).
- Guests: unchanged (Log in / Register).

### Deep link on homepage

- Read `square` (or `squareId`) search param on `/`.
- If present and found in loaded squares: set `selectedId` so `SquarePanel` opens.
- Invalid / missing id: ignore silently (still show board).

## 7. Auth & safety

- Only return squares owned by the session user (no IDOR).
- Do not expose other users’ inventories.
- Same session as Auth.js JWT used elsewhere.

## 8. Testing

- Unit/API-style: unauthenticated → 401; authenticated returns only that user’s squares.
- Manual: own ≥1 square (or seed) → appears on dashboard → click opens board panel; empty account → empty state; guest → login.

## 9. Parent spec amendments

- Split Phase **4** into **4a My squares** and **4b Wallet / buyers / market** (after Stripe/Connect as needed).
- Chrome “Dashboard link” ships in 4a pointing at My squares.
