# Marketplace Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone search stores and active products from board chrome and open results on `/search?q=…` linking to public store pages.

**Architecture:** Shared `searchMarketplace(q)` runs Prisma `ILIKE` queries (max 20 stores + 20 products). Exposed via `GET /api/search`. Server `/search` page renders results. Board chrome adds a GET form. Public store product cards get `id="product-{id}"`.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, Vitest, existing glass chrome.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-square-market-search-design.md`.
- Stores + active products only; no square/coord search.
- `q` trimmed; length &lt; 2 → empty results.
- Escape `%` `_` `\` for ILIKE.
- Caps: 20 stores, 20 products.
- No clickCount / private fields in hits.
- Commits: conventional; author `Cam <slahmaid@gmail.com>` via `GIT_*` env only.
- Do not mix unrelated WIP.

---

## File structure

```
src/lib/search/searchMarketplace.ts
src/lib/search/escapeIlike.ts
src/app/api/search/route.ts
src/app/search/page.tsx
src/components/board/BoardChrome.tsx          # search form
src/app/store/[squareId]/page.tsx             # product ids
tests/search/searchMarketplace.test.ts
tests/search/searchApi.test.ts
```

---

### Task 1: Search helper + API (TDD)

**Files:**
- Create: `src/lib/search/escapeIlike.ts`
- Create: `src/lib/search/searchMarketplace.ts`
- Create: `src/app/api/search/route.ts`
- Test: `tests/search/escapeIlike.test.ts`, `tests/search/searchApi.test.ts`

**Interfaces:**

```ts
export function escapeIlike(raw: string): string

export type SearchResult = {
  stores: Array<{ id: string; squareId: string; name: string; about: string | null }>
  products: Array<{
    id: string
    name: string
    priceCents: number
    storeId: string
    squareId: string
    storeName: string
    imageUrl: string | null
  }>
}

export async function searchMarketplace(q: string): Promise<SearchResult>
```

- [ ] **Step 1: Tests** — escape `%`; short q → empty; API 200 shape; inactive product excluded (mock prisma)
- [ ] **Step 2: Implement helper + GET `/api/search`**
- [ ] **Step 3: Commit** `feat: add marketplace search API`

---

### Task 2: `/search` page + chrome form + product anchors

**Files:**
- Create: `src/app/search/page.tsx`
- Modify: `src/components/board/BoardChrome.tsx`
- Modify: `src/app/store/[squareId]/page.tsx`

- [ ] **Step 1: Search page** — read `q`, call `searchMarketplace`, render sections + links
- [ ] **Step 2: Chrome** — `<form method="GET" action="/search">` with `q` input
- [ ] **Step 3: Store page** — `id={\`product-${p.id}\`}` on product cards
- [ ] **Step 4: Commit** `feat: add search page and chrome search form`

---

### Task 3: Verify

- [ ] `npm test`
- [ ] Manual: search store name → open store; search product → hash lands on card

---

## Spec coverage

| Spec | Task |
|------|------|
| escape + ILIKE search | 1 |
| GET /api/search | 1 |
| /search page | 2 |
| Chrome form | 2 |
| Product hash ids | 2 |

## Out of scope

- Full-text, fuzzy, square search, autocomplete dropdown, ads boost
