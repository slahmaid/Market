# Square Market — Design Spec

**Date:** 2026-09-10  
**Status:** Draft for user review  
**Working name:** Square Market (rename anytime)

## 1. Summary

Square Market is a light-themed web marketplace where a **50×50 grid (2,500 squares)** fills the homepage. Users sign up with email/password, buy unsold squares from the platform with **Stripe (USD)**, customize each owned square with a **tiny image + link**, and later **resell** to other users. Secondary sales take a **7% platform fee** paid out via **Stripe Connect**. Dynamic pricing and Fair / Balanced / Unfair comments guide buyers. Auctions, Google OAuth, and crypto (MetaMask) are explicitly **out of v1**.

## 2. Goals & non-goals

### Goals (v1 product)

- Full-viewport homepage of squares only; fits desktop and mobile.
- Zoom only via on-screen **+ / −** (and fit/reset); no pinch/scroll zoom as the control model.
- Auth: email + password.
- Primary purchase from platform; secondary fixed-price listings from owners.
- Location-based + multi-factor smart pricing with price comments.
- Dashboard: my squares, wallet/earnings, recent buyers, market stats.
- Real money via Stripe + Stripe Connect.

### Non-goals (later phases)

- Timed auctions + instant-buy.
- Google / social OAuth.
- Crypto wallets (MetaMask, etc.).
- Multi-currency.
- Heavy content moderation beyond basic upload validation (flag for later).

## 3. Build phases

Each phase ships usable software.

| Phase | Deliverable |
|-------|-------------|
| **1 – Board** | Auth, canvas homepage, zoom controls, square select panel, all squares unsold |
| **2 – Primary buy** | Stripe Checkout for platform squares, ownership transfer, image + link upload |
| **3a – Listing** | Owner list/unlist + list price + Fair/Balanced/Unfair (no secondary Checkout; Connect later) |
| **3b – Secondary buy** | Buy from owner, 7% fee, Stripe Connect onboarding |
| **4a – My squares** | Auth dashboard: view owned/listed squares; open on board (no wallet yet) |
| **4b – Wallet / market** | Wallet/earnings, recent buyers, market overview (after Stripe/Connect as needed) |
| **5a – Google Auth** | Google sign-in/register + account linking (Stripe still deferred) |
| **5b – Later** | Auctions + instant-buy, more OAuth, crypto |

## 4. Architecture

**Approach:** Canvas-rendered grid + Next.js full-stack API + PostgreSQL.

| Layer | Choice |
|-------|--------|
| App | Next.js (App Router) |
| DB | PostgreSQL + Prisma |
| Payments | Stripe Checkout + Stripe Connect |
| Images | Object storage (S3-compatible, e.g. R2/S3) |
| Auth | Email/password (credentials + session/JWT as implemented in NextAuth or equivalent) |

**Why Canvas (not DOM grid / WebGL):** Smooth fit + button zoom for 2,500 cells on mobile; WebGL is overkill at this size; DOM cells are heavier and harder to keep “fullscreen squares only.”

### High-level flow

1. Client loads board snapshot (`GET /api/squares`).
2. Canvas draws all cells; owned cells show thumbnails.
3. User selects a cell → detail panel loads price quote + comment.
4. Buy → Stripe Checkout → webhook → ownership update → client refreshes cell.
5. Owner uploads image/link; may list for sale after Connect onboarding.
6. Secondary buy → Checkout with application fee → ownership transfer.

## 5. Data model

### User

- `id`, `email`, `passwordHash`, `createdAt`
- `stripeCustomerId` (nullable)
- `stripeConnectAccountId` (nullable)
- `connectOnboardingComplete` (boolean)

### Square

- `id`
- `x`, `y` — integers **0–49**; unique `(x, y)`
- `status` — `platform` | `owned` | `listed`
- `ownerId` — nullable FK → User
- `imageUrl`, `linkUrl` — nullable
- `listPriceCents` — nullable (set when `listed`)
- Exactly **2,500** rows seeded once; coordinates immutable; rows not deleted

### PriceQuote (computed / cached)

- `squareId`
- `suggestedPriceCents`
- `label` — `fair` | `balanced` | `unfair`
- `reason` — short human-readable string
- `computedAt`

Quotes are recalculated on a schedule and after relevant events (sales, listings near a cell).

### Transaction

- `id`, `squareId`, `buyerId`
- `sellerId` — null means platform (primary sale)
- `amountCents`, `feeCents` (0 on primary; 7% of amount on secondary)
- `type` — `primary` | `secondary`
- `stripePaymentIntentId` / Checkout session id
- `createdAt`

### MarketSnapshot (Phase 4)

- Daily aggregates: sales count, average price, optional hot-zone summary for dashboard.

## 6. Pricing engine

### Base location price (platform ask)

- Center reference: `(24.5, 24.5)`.
- Smooth falloff from **center ≈ $100** to **edge ≈ $5** (no hard concentric rings).
- Corners cheapest; dead center most expensive.
- Stored/displayed in **USD cents**.

### Dynamic multipliers

Applied on top of base location price:

| Factor | Direction |
|--------|-----------|
| Neighbor activity (owned/listed nearby) | ↑ |
| Recent sales velocity (local / board) | ↑ |
| Scarcity (fewer platform squares left) | ↑ |
| Listing competition nearby | ↓ suggested ask |
| Time decay (stale unsold areas) | mild ↓ |
| Liquidity (recent resales near cell) | ↑ |

Exact formula coefficients are implementation details but must remain configurable constants in one module.

### Owner listings

- Owner may set **any** `listPriceCents`.
- Platform does not block prices; it only comments.

### Price comments

- Compare displayed ask (platform ask or owner list price) to **suggested fair value**.
- **Fair:** within ±10% of suggested.
- **Balanced:** more than ±10% and within ±25% of suggested.
- **Unfair:** more than ±25% above or below suggested.
- Always include a one-line reason (e.g. neighbor listings cheaper, high center demand).

### Fees

- Primary: platform receives full sale amount (minus Stripe processing).
- Secondary: **7%** platform `application_fee`; remainder to seller via Connect.

## 7. UI / UX

### Homepage

- Light theme.
- First viewport: **grid only** as the dominant surface.
- Floating minimal chrome: zoom +/−, fit/reset, Login/Avatar, Dashboard link.
- Board fits entirely on load (desktop and mobile).
- Zoom exclusively via buttons (and fit); pinching/scroll must not be the intended zoom control.
- Unsold: empty light tiles; owned: tiny image thumbnails.

### Square panel

- Desktop: slide-over; mobile: bottom sheet.
- Shows: coordinates, status, price, Fair/Balanced/Unfair + reason.
- Actions: Buy; if owner — Edit image/link, List/Unlist (Phase 3).
- Guests attempting Buy → login/register wall.

### Dashboard (authenticated, Phase 4)

- **My squares**
- **Wallet / earnings** — Connect status, payouts/earnings history
- **Recent buyers**
- **Market** — averages, sales activity, hot zones

### Image / link rules

- Small square image (e.g. max 128×128 or heavily compressed equivalent).
- Optional `https` link.
- Basic validation (type, size, URL scheme); deeper moderation later.

## 8. Payments & safety

### Primary purchase

1. Create Stripe Checkout for current platform ask.
2. Webhook confirms payment.
3. Assign `ownerId`, set `status = owned`, clear any list fields.
4. Idempotent webhook handling (no double assign on retries).

### Secondary purchase

1. Seller must complete Stripe Connect onboarding before listing.
2. Checkout with `application_fee_amount` = 7% of list price.
3. On success: transfer ownership, set `status = owned`, clear listing, write `Transaction`.

### Race conditions

- Two buyers on same square: first successful payment wins.
- Loser: Checkout fails or payment is refunded; UI shows “already sold.”

### Other rules

- Cannot buy own square.
- Owner can unlist anytime.
- Clear user-facing errors: Connect incomplete, sold race, upload failure, invalid link.

## 9. API surface (high level)

- Auth: register, login, logout, session.
- `GET /api/squares` — board snapshot for canvas.
- `GET /api/squares/:id` — detail + price quote/comment.
- Checkout session create (primary / secondary).
- Stripe webhooks.
- List / unlist square (owner + Connect ready).
- Upload image / set link (owner).
- Connect onboarding link.
- Dashboard aggregates (Phase 4).

## 10. Testing strategy

- Unit: pricing formula, fee math (7%), fair/balanced/unfair bands.
- Integration: webhook → ownership transfer; secondary fee split.
- Manual: Stripe test-mode buy primary, Connect onboarding, secondary buy, double-buy race.

## 11. Future extension points (schema-ready, not built)

- Auction tables / fields and instant-buy price.
- OAuth account linking.
- Crypto wallet addresses / chain ids.

## 12. Decisions log

| Topic | Decision |
|-------|----------|
| Grid size | 50×50 (2,500) |
| Ownership content | Tiny image + link (ad-style) |
| Payments v1 | Stripe USD |
| Payments later | Crypto / MetaMask |
| Auth v1 | Email + password |
| Auth later | Google / social OAuth |
| Marketplace v1 | Fixed price only |
| Marketplace later | Auctions + instant-buy |
| Secondary fee | 7% |
| Currency | USD only |
| Seller payouts | Stripe Connect |
| Base prices | Edge ~$5, center ~$100 |
| Stack | Next.js + PostgreSQL + Stripe |
| Grid rendering | Canvas + button zoom |

## 13. Open implementation details (allowed flexibility)

- Exact NextAuth (or alternative) session library.
- Exact object-storage vendor.
- Exact pricing coefficient values (must match bands above).
- Project public brand name.
