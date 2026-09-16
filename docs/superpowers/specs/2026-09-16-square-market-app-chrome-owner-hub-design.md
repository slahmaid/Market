# Square Market — App Chrome + Owner Hub Design (v1)

**Date:** 2026-09-16  
**Status:** Draft for user review  

## 1. Summary

Ship a shared glass **AppChrome** on Board, Search, Messages, Store (public + edit), and Dashboard so users always have Search, Board, Messages, My squares, and account. On My squares (board rail + `/dashboard`), each owned square row shows always-visible **View store** and **Edit store** links. No chrome on auth/buy pages; no unread badges or My squares redesign.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | Shared chrome **and** owner hub links |
| Chrome pages | Board, Search, Messages (inbox + thread), Store public + edit, Dashboard |
| Logged-in nav | Search + **Board** + Messages + **My squares** + email + Log out |
| Owner hub | Always-visible View/Edit store on each owned row (rail + dashboard) |
| Approach | Shared `AppChrome` component mounted per page (no route-group moves) |

## 3. Goals & non-goals

### Goals

- One chrome component; consistent centered glass bar.
- Clear navigation after leaving the sphere.
- Clear path to store view/edit from My squares without expanding (expand still available for customize).
- Remove redundant “← Board” where chrome provides Board; keep contextual backs (e.g. thread → inbox).

### Non-goals

- Chrome on `/login`, `/register`, `/buy/success`, `/buy/cancel`.
- Unread message badges, commission badges on rows.
- Collapsing board side rails on mobile.
- Redesigning My squares into a card grid.
- Changing store edit / search / chat page bodies beyond chrome + link cleanup.

## 4. Approaches considered

1. **Shared `AppChrome` + per-page mount (chosen)** — extract current bar; add Board/My squares; mount on listed pages; hub links on `MySquaresList`.  
2. **Route-group layout** — automatic chrome; larger file moves and board shell special cases.  
3. **Duplicate bar markup** — drifts quickly.

**Decision:** Approach **1**.

## 5. Components

### `AppChrome` (`src/components/board/AppChrome.tsx`)

Client component. Centered glass bar (same styles as today’s `BoardChrome`).

**Props (optional):**

- `active?: "board" | "search" | "messages" | "dashboard"` — subtle emphasis on current area.

**Logged-in links:** Board `/`, Messages `/messages`, My squares `/dashboard`, email display, Log out.  
**Guest:** Log in, Register.  
**Search form:** unchanged (`GET /search`).

Replace `BoardChrome` usages with `AppChrome` (or keep `BoardChrome` as a one-line re-export of `AppChrome` for a short transition — prefer single name `AppChrome`).

### `MySquaresList`

For each owned square row, always render:

- `View store` → `/store/[squareId]`
- `Edit store` → `/store/[squareId]/edit`

Links use `stopPropagation` / are outside the expand toggle so row expand still opens `SquareDetailsDropdown`. Apply in both `compact` (rail) and full (dashboard) modes.

## 6. Page mounting

| Route | Chrome |
|-------|--------|
| `/` | Yes (inside existing board shell) |
| `/search` | Yes |
| `/messages` | Yes |
| `/messages/[id]` | Yes |
| `/store/[squareId]` | Yes |
| `/store/[squareId]/edit` | Yes |
| `/dashboard` | Yes |
| `/login`, `/register`, buy success/cancel | No |

Optional tiny `MarketplaceShell` = chrome + children for non-board pages — nice-to-have; not required if each page imports `AppChrome` directly.

## 7. UI details

- Preserve `sm-glass`, min-h-11, email truncation.
- Active route: slightly stronger font weight (or underline), not a new color system.
- Empty My squares: keep existing copy; optional “Buy a square on the Board” linking to `/`.
- Thread page: keep “← Messages”; drop “← Board” if present once chrome has Board.

## 8. Testing

- Manual: each chrome page shows bar; Board / My squares / Messages navigate correctly; active highlight sensible.
- Manual: View/Edit store from rail and `/dashboard` without expanding; expand still works.
- No mandatory new Vitest suite; optional smoke render of `AppChrome` link set if cheap.

## 9. Implementation order

1. Extract/rename `AppChrome`; add Board + My squares links + `active` prop.  
2. Wire board home to `AppChrome`.  
3. Mount on Search, Messages, Store, Dashboard; remove redundant ← Board.  
4. Add View/Edit store links on `MySquaresList`.  
5. Manual smoke on desktop + narrow width.

## 10. Roadmap note

Later: unread badge, mobile rail collapse, commission chip on hub rows, deeper owner empty states.
