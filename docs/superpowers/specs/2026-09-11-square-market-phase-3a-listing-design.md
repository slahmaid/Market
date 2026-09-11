# Square Market — Phase 3a Design (List / Unlist)

**Date:** 2026-09-11  
**Status:** Draft for user review  
**Parent spec:** `docs/superpowers/specs/2026-09-10-square-market-design.md`

## 1. Summary

Phase **3a** adds **owner listing** so owned squares can be put on the secondary market at a fixed USD ask — **without** Stripe Connect and **without** secondary Checkout.

Buyers can see listed squares, prices, and Fair / Balanced / Unfair guidance. They **cannot** complete a secondary purchase yet. Full secondary buy + Connect is **Phase 3b** (later).

## 2. Why split Phase 3

| Slice | Ships | Defers |
|-------|--------|--------|
| **3a – Listing** | List / unlist, list price, labels, board/panel UX | Money movement, Connect |
| **3b – Secondary buy** | Checkout to seller, 7% fee, Connect onboarding | — |

**Chosen money model for 3a:** none. Platform does not hold seller funds. Listing is inventory + discovery only until Connect exists.

## 3. Goals & non-goals

### Goals

- Owner of an `owned` square can **List** with a positive USD price (cents).
- Owner can **Unlist** anytime → back to `owned`, clear `listPriceCents`.
- List price may be **any integer ≥ 1 cent**; no hard Fair/Unfair ban.
- Panel shows suggested price + Fair / Balanced / Unfair for the list ask (same ±10% / ±25% bands as primary).
- Board distinguishes listed cells (subtle visual, not a card-heavy chrome).
- Non-owners / guests see list price + label; Buy for secondary shows **“Buying listed squares comes later”** (or equivalent), not primary Buy.
- Customize (image/link) remains allowed while `listed`.

### Non-goals (3a)

- Stripe Connect onboarding.
- Secondary Checkout / webhooks / `Transaction` type `secondary`.
- Requiring Connect before list (overrides parent spec §8 for 3a only; restored in 3b).
- Dashboard market pages (Phase 4).
- Auctions / OAuth / crypto.

## 4. Approaches considered

1. **List UI only, no board cue** — fastest; discovery weak.  
2. **List API + panel + board listed cue** — recommended.  
3. **+ dedicated market browse page** — premature without buy.

**Decision:** Approach **2**.

## 5. Data & status rules

Existing fields suffice:

- `status`: `owned` ↔ `listed`
- `listPriceCents`: set on list; **null** on unlist

### Transitions

| From | Action | To | `listPriceCents` |
|------|--------|-----|------------------|
| `owned` | List (valid price) | `listed` | ask cents |
| `listed` | Unlist | `owned` | `null` |
| `listed` | Re-list / update price | `listed` | new ask |
| `platform` | — | — | N/A |

- Only the **owner** may list / unlist / update list price.
- Auth required.
- Primary buy path unchanged: only `platform` squares.

### Quote while listed

Reuse location-based **suggested** price (`buildPlatformQuote` / location base). Classify the owner’s **list ask** with `classifyPrice(askCents, suggestedPriceCents)` → `fair` | `balanced` | `unfair` + reason.

Optional later (not 3a): persist `PriceQuote` rows on list events.

## 6. API

### `POST /api/squares/[id]/list`

- Auth + owner.
- Body: `{ listPriceCents: number }` (zod: int ≥ 1).
- Square must be `owned` or already `listed` (update price).
- Sets `status = listed`, `listPriceCents`.
- Returns square + quote for the ask.

### `POST /api/squares/[id]/unlist`

- Auth + owner.
- Square must be `listed`.
- Sets `status = owned`, `listPriceCents = null`.
- Returns square + platform-style quote (suggested only).

### `GET /api/squares` / `GET /api/squares/[id]`

- Already expose `status` and `listPriceCents`.
- Detail quote: if `listed`, classify **list** ask vs suggested; if `owned`/`platform`, keep current behavior.

No secondary checkout routes in 3a.

## 7. UI / UX

### Square panel (owner)

- If `owned`: **List for sale** — amount input (USD), live Fair/Balanced/Unfair preview, confirm List.
- If `listed`: show ask + label; **Update price**; **Unlist**.
- Customize block unchanged.

### Square panel (visitor / other user)

- If `listed`: show ask, label, reason; CTA disabled copy: secondary buy not available yet (not “Buy” → primary checkout).
- **Open link** still available when `linkUrl` set.
- If `owned` (not listed): no buy CTA (already true).

### Board canvas

- Listed cells: keep thumbnail if present; add a **small corner marker** or slightly stronger border tint so listed stock is scannable at a glance.
- Click still selects (opens panel); does not open external link.

### Light theme / mobile

- Preserve bottom sheet / desktop slide-over; no new dashboard chrome.

## 8. Pricing display rules

- Currency **USD**; amounts in **cents** in API; UI may show dollars.
- Fair: within ±10% of suggested.  
- Balanced: beyond ±10% and within ±25%.  
- Unfair: beyond ±25%.  
- Always show one-line reason.
- **Do not** block Unfair listings.

## 9. Safety & errors

- 401 unauthenticated; 403 not owner; 404 missing square; 409 wrong status; 400 invalid price.
- Clear copy when secondary buy is unavailable.
- No change to primary webhook / ownership guards.

## 10. Testing

- Unit: list price classification against suggested; list/unlist state transitions (pure helpers if extracted).
- API: owner list/unlist/update; reject non-owner; reject `platform`; reject `listPriceCents < 1`.
- Manual: list → board marker + panel label → unlist; visitor sees disabled secondary CTA.

## 11. Phase 3b preview (out of scope now)

- Require Connect before list (or before buy — product choice at 3b time; parent spec required Connect before list).
- Secondary Checkout + 7% `application_fee` + webhook ownership transfer.
- Replace disabled CTA with real Buy.

## 12. Parent spec amendments (3a)

- Phase table: split **3** into **3a Listing** and **3b Secondary buy + Connect**.
- §8 “Seller must complete Connect before listing” applies starting **3b**, not 3a.
- §7 panel “List/Unlist” ships in 3a; secondary Buy ships in 3b.
