# Square Market — Store Chat Design (v1)

**Date:** 2026-09-15  
**Status:** Draft for user review  
**Parent specs:**  
- `docs/superpowers/specs/2026-09-10-square-market-design.md`  
- `docs/superpowers/specs/2026-09-15-square-market-store-profile-products-design.md`

## 1. Summary

Add **buyer ↔ store owner** messaging, one conversation per store (square) and buyer. Delivery is **HTTP polling** (no WebSockets). Login required. Safety: text length caps, rate limits, owner can archive threads. No guests, attachments, or admin moderation queue in v1.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Parties | Logged-in buyer ↔ store owner |
| Thread key | One conversation per `(storeId, buyerId)` |
| Delivery | Poll while thread UI is open |
| Start chat | Auth required (guests → login) |
| Safety | Length + rate limits + owner archive/unarchive |
| Non-goals | WebSockets, guest forms, report queue, images, group chat |

## 3. Goals & non-goals

### Goals

- From a public store page, a logged-in visitor can start or continue a conversation with that store’s owner.
- Owner and buyer share an inbox at `/messages` and a thread at `/messages/[id]`.
- Messages are plain text; polling fetches new messages via `?after=`.
- Owner can set conversation `status` to `archived` or back to `open`.
- Strict authorization: only the two parties can access a conversation.

### Non-goals

- Realtime push (WS/SSE).
- Guest / anonymous contact forms.
- Attachments, reactions, typing indicators.
- Platform admin moderation console or automated content filters beyond basic sanitization.
- Messaging about a product as a separate thread type (product can be mentioned in text only).

## 4. Approaches considered

1. **Conversation + Message models, REST + poll** — recommended.  
2. **Messages without Conversation** — weak inbox/archive.  
3. **Third-party chat widget** — leaves platform; privacy/cost tradeoffs.

**Decision:** Approach **1**.

## 5. Data model

### `Conversation`

| Field | Type | Notes |
|-------|------|--------|
| `id` | cuid | PK |
| `storeId` | string | FK → `Store`, cascade delete |
| `buyerId` | string | FK → `User` |
| `status` | enum `open` \| `archived` | Default `open` |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | Bump on each new message |

Unique: `@@unique([storeId, buyerId])`. Indexes: `buyerId`, `storeId`, `updatedAt`.

### `Message`

| Field | Type | Notes |
|-------|------|--------|
| `id` | cuid | PK |
| `conversationId` | string | FK → `Conversation`, cascade delete |
| `senderId` | string | FK → `User` |
| `body` | string | 1–2000 chars after trim |
| `createdAt` | DateTime | |

Index: `(conversationId, createdAt)`.

Relations: `Store.conversations`, `User` as buyer and as sender (separate relation names as needed).

## 6. Authorization rules

Resolve store owner via `store.square.ownerId`.

- **Buyer** of a conversation: `session.user.id === conversation.buyerId`
- **Owner** of a conversation: `session.user.id === store.square.ownerId`
- Create conversation: session required; caller must **not** be the store owner; store must exist
- Post message: must be buyer or owner; if `archived`, only owner may post after setting status back to `open` (buyer gets `403` while archived)
- List inbox: buyer sees conversations where they are buyer; owner sees conversations for stores they own

## 7. APIs

All require session → `401` if missing.

### `POST /api/stores/[squareId]/conversations`

- Resolve store by `squareId`.
- Reject if caller is owner (`403`).
- Upsert / findUnique on `(storeId, buyerId)`; if archived, return existing (buyer still can open UI read-only until owner reopens — or return 403 for create; **v1: return existing archived thread for read**).
- Response: `{ conversation: { id, storeId, buyerId, status, updatedAt } }`

### `GET /api/conversations`

- Query optional `?role=buyer|owner` (default: return both sections or merged list sorted by `updatedAt` desc).
- **v1 simpler:** single list: all conversations where user is buyer **or** owner of the store, each item annotated with `role: "buyer" | "owner"`, `storeName`, `squareId`, `peerLabel` (buyer email masked or other party email for owner), `status`, `updatedAt`, `lastMessagePreview`.

### `GET /api/conversations/[id]/messages?after=&limit=`

- Authz: party only.
- `after` = ISO timestamp or message id cursor; return messages with `createdAt > after`, ordered asc, `limit` default 50 max 100.
- Response: `{ messages: [{ id, senderId, body, createdAt }] }`

### `POST /api/conversations/[id]/messages`

- Body: `{ body: string }`
- Validate length 1–2000; reject empty.
- Rate limit: **10 messages / user / rolling 60s**; **5 new conversations / user / rolling 1h** (enforce on create).
- If conversation `archived` and sender is buyer → `403`.
- Create message; bump `conversation.updatedAt`.
- Response: `{ message }`

### `PATCH /api/conversations/[id]`

- Owner only.
- Body: `{ status: "open" | "archived" }`
- Response: `{ conversation }`

## 8. UI

### Public store `/store/[squareId]`

- Button **Message store** → if logged out, `/login?callbackUrl=/store/...` then auto-create or navigate to thread.
- Logged in: `POST` conversations then redirect `/messages/[id]`.

### `/messages`

- Auth-gated list of conversations (newest first).
- Show store name, status badge, preview, relative time.

### `/messages/[id]`

- Message list + composer.
- Poll `GET .../messages?after=` every **5s** while tab visible (`document.visibilityState`).
- Owner: Archive / Reopen control.
- Buyer: if archived, show notice and disable composer.

### Chrome (optional v1)

- Link **Messages** when logged in (beside account chip). Prefer yes for discoverability.

## 9. Safety & abuse

- Plain text only; strip null bytes; no HTML render (React text nodes).
- Rate limits as above; return `429` with clear error.
- No public listing of conversations.
- Do not expose other users’ inventories via chat APIs.
- Cascade delete conversations when store deleted.

## 10. Testing

- Unauth → 401 on all mutate/list.
- Owner cannot create conversation on own store.
- Non-party cannot read/post (`403`).
- Buyer cannot post while archived; owner can archive/reopen.
- Rate limit returns 429 (unit test with injectable clock or counter mock).
- Poll `after` returns only newer messages.
- Manual: two browsers/users — message appears within one poll interval.

## 11. Implementation order

1. Prisma models + migrate.  
2. Authz helpers + conversation create/list APIs + tests.  
3. Messages GET/POST + archive PATCH + rate limit + tests.  
4. `/messages` + `/messages/[id]` UI + store CTA + chrome link.  
5. Polling + polish + full suite.

## 12. Roadmap note

Later: SSE/WebSockets, read receipts, image attachments, report/block, product-linked threads, email digests.
