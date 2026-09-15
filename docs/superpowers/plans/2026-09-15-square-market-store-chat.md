# Store Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Logged-in buyers and store owners exchange plain-text messages in one conversation per store+buyer, with polling UI, rate limits, and owner archive.

**Architecture:** Prisma `Conversation` + `Message`. REST under `/api/stores/.../conversations` and `/api/conversations/...`. Pages `/messages` and `/messages/[id]` poll every 5s. In-memory sliding-window rate limiter for v1 (single Node process).

**Tech Stack:** Next.js 15, Auth.js, Prisma/PostgreSQL, Vitest, Zod.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-square-market-store-chat-design.md`
- Auth required on all chat APIs; party-only IDOR checks
- Body 1–2000 chars; 10 msgs/user/min; 5 new convos/user/hour
- Buyer cannot create thread on own store; cannot post while archived
- No WebSockets, attachments, or guest chat
- Commits: conventional; `Cam <slahmaid@gmail.com>` via `GIT_*` env only

---

## File structure

```
prisma/schema.prisma
src/lib/chat/assertConversationAccess.ts
src/lib/chat/rateLimit.ts
src/lib/chat/sanitizeMessageBody.ts
src/app/api/stores/[squareId]/conversations/route.ts
src/app/api/conversations/route.ts
src/app/api/conversations/[id]/route.ts          # PATCH status
src/app/api/conversations/[id]/messages/route.ts
src/app/messages/page.tsx
src/app/messages/[id]/page.tsx
src/app/messages/[id]/thread-client.tsx
src/app/store/[squareId]/message-store-button.tsx
src/components/board/BoardChrome.tsx
tests/chat/*.test.ts
```

---

### Task 1: Prisma models + migrate

Add enum `ConversationStatus { open archived }`, models `Conversation` / `Message`, User relations `buyerConversations`, `sentMessages`, Store `conversations`.

```bash
npx prisma migrate dev --name store_chat
```

Commit: `feat: add Conversation and Message models`

---

### Task 2: Helpers + create/list APIs (TDD)

- `sanitizeMessageBody` — trim, strip `\0`, length 1–2000
- `rateLimit` — `checkRateLimit(key, limit, windowMs)` in-memory Map
- `assertConversationAccess(conversationId, userId)` → `{ role: "buyer"|"owner", conversation, ownerId }` or fail status
- `POST /api/stores/[squareId]/conversations` — get-or-create
- `GET /api/conversations` — inbox list

Tests: 401, owner cannot create on self, list only own threads.

Commit: `feat: add conversation create and inbox APIs`

---

### Task 3: Messages + archive (TDD)

- `GET/POST .../messages`, `PATCH ...` status
- Rate limit on POST message and on create conversation
- Archived buyer POST → 403

Commit: `feat: add chat messages and archive APIs`

---

### Task 4: UI

- `/messages`, `/messages/[id]` with 5s poll
- Store **Message store** button (client)
- Chrome **Messages** link when logged in

Commit: `feat: add messages inbox and thread UI`

---

### Task 5: Verify — `npm test`, lint, smoke

---

## Out of scope

WebSockets, guests, attachments, report queue, email digests
