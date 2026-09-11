# Square Market Phase 3a (List / Unlist) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let owners list and unlist owned squares at any positive USD ask, show Fair/Balanced/Unfair guidance, mark listed cells on the board, and block secondary buy until Phase 3b — with no Stripe Connect and no secondary Checkout.

**Architecture:** Reuse existing `Square.status` (`owned` ↔ `listed`) and `listPriceCents`. Add pure listing + listing-quote helpers (TDD), auth-gated list/unlist APIs, detail quote that classifies the list ask, panel List/Unlist UI, and a small canvas marker for `listed` cells. Primary buy and customize paths stay unchanged.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, Auth.js, Vitest, existing `classifyPrice` / `buildPlatformQuote`.

## Global Constraints

- Currency **USD**; amounts in **cents**.
- List price: any integer **≥ 1** cent; **do not** block Unfair listings.
- Fair ±10%, Balanced 10–25%, Unfair >25% vs suggested (existing `classifyPrice`).
- Only the **owner** may list / unlist / update list price.
- Transitions: `owned` → `listed` (set price); `listed` → `owned` (clear price); `listed` may update price in place.
- Customize remains allowed while `listed`.
- Primary buy: only `status = platform` (unchanged).
- Secondary Checkout / Connect / `Transaction` type `secondary`: **out of scope**.
- Light theme; keep mobile bottom sheet / desktop slide-over.
- Spec: `docs/superpowers/specs/2026-09-11-square-market-phase-3a-listing-design.md`.
- Commits: conventional; author `Cam <slahmaid@gmail.com>` via `GIT_*` env only (never `git config`).
- Do not commit `.env` secrets.
- Work on a feature branch off `master` (e.g. `feat/phase-3a-listing`) unless user directs otherwise.

---

## File structure (create/modify)

```
src/lib/pricing/quoteSquare.ts              # + buildListingQuote
src/lib/pricing/index.ts                    # re-export
src/lib/listing.ts                          # assertCanList / assertCanUnlist helpers
src/app/api/squares/[id]/list/route.ts      # POST list / update price
src/app/api/squares/[id]/unlist/route.ts    # POST unlist
src/app/api/squares/[id]/route.ts           # GET quote uses list ask when listed
src/lib/listing/listSquare.ts               # client fetch helpers
src/components/board/SquarePanel.tsx        # List / Unlist UI + secondary CTA copy
src/components/board/BoardCanvas.tsx        # listed cell marker
src/app/page.tsx                            # refresh status/listPrice on panel update
tests/pricing/listingQuote.test.ts
tests/listing/listingGuards.test.ts
```

---

### Task 1: Listing quote helper (TDD)

**Files:**
- Modify: `src/lib/pricing/quoteSquare.ts`
- Modify: `src/lib/pricing/index.ts`
- Test: `tests/pricing/listingQuote.test.ts`

**Interfaces:**
- Produces: `buildListingQuote({ x, y, listPriceCents }) => PlatformQuote` where `askCents = listPriceCents`, `suggestedPriceCents` from location base, `label`/`reason` from `classifyPrice(ask, suggested)`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { buildListingQuote } from "@/lib/pricing/quoteSquare";
import { buildPlatformQuote } from "@/lib/pricing/quoteSquare";

describe("buildListingQuote", () => {
  it("uses list price as ask and classifies vs suggested", () => {
    const platform = buildPlatformQuote({ x: 24, y: 24 });
    const fairAsk = platform.suggestedPriceCents;
    const q = buildListingQuote({
      x: 24,
      y: 24,
      listPriceCents: fairAsk,
    });
    expect(q.askCents).toBe(fairAsk);
    expect(q.suggestedPriceCents).toBe(platform.suggestedPriceCents);
    expect(q.label).toBe("fair");
  });

  it("marks clearly high asks as unfair", () => {
    const platform = buildPlatformQuote({ x: 0, y: 0 });
    const high = Math.round(platform.suggestedPriceCents * 2);
    const q = buildListingQuote({
      x: 0,
      y: 0,
      listPriceCents: high,
    });
    expect(q.label).toBe("unfair");
    expect(q.askCents).toBe(high);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/pricing/listingQuote.test.ts
```

Expected: FAIL (export / function missing).

- [ ] **Step 3: Implement**

```ts
export function buildListingQuote(input: {
  x: number;
  y: number;
  listPriceCents: number;
  multipliers?: QuoteMultipliers;
}): PlatformQuote {
  const base = buildPlatformQuote({
    x: input.x,
    y: input.y,
    multipliers: input.multipliers,
  });
  const askCents = input.listPriceCents;
  const { label, reason } = classifyPrice(askCents, base.suggestedPriceCents);
  return {
    suggestedPriceCents: base.suggestedPriceCents,
    askCents,
    label,
    reason,
  };
}
```

Re-export from `src/lib/pricing/index.ts`.

- [ ] **Step 4: Tests PASS + commit**

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"
$env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git add src/lib/pricing tests/pricing/listingQuote.test.ts
git commit -m "feat: add listing quote classification helper"
```

---

### Task 2: Listing guards (TDD)

**Files:**
- Create: `src/lib/listing.ts`
- Test: `tests/listing/listingGuards.test.ts`

**Interfaces:**
- Produces: `assertCanList(square, userId)`, `assertCanUnlist(square, userId)`
- `SquareListSnapshot = { status: "platform" | "owned" | "listed"; ownerId: string | null }`

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from "vitest";
import { assertCanList, assertCanUnlist } from "@/lib/listing";

describe("assertCanList", () => {
  it("allows owner of owned square", () => {
    expect(() =>
      assertCanList({ status: "owned", ownerId: "u1" }, "u1"),
    ).not.toThrow();
  });

  it("allows owner of listed square (price update)", () => {
    expect(() =>
      assertCanList({ status: "listed", ownerId: "u1" }, "u1"),
    ).not.toThrow();
  });

  it("rejects non-owner", () => {
    expect(() =>
      assertCanList({ status: "owned", ownerId: "u1" }, "u2"),
    ).toThrow(/owner/i);
  });

  it("rejects platform square", () => {
    expect(() =>
      assertCanList({ status: "platform", ownerId: null }, "u1"),
    ).toThrow();
  });
});

describe("assertCanUnlist", () => {
  it("allows owner of listed square", () => {
    expect(() =>
      assertCanUnlist({ status: "listed", ownerId: "u1" }, "u1"),
    ).not.toThrow();
  });

  it("rejects owned (not listed)", () => {
    expect(() =>
      assertCanUnlist({ status: "owned", ownerId: "u1" }, "u1"),
    ).toThrow(/listed/i);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/listing/listingGuards.test.ts
```

- [ ] **Step 3: Implement minimal**

```ts
export type SquareListSnapshot = {
  status: "platform" | "owned" | "listed";
  ownerId: string | null;
};

export function assertCanList(
  square: SquareListSnapshot,
  userId: string,
): void {
  if (square.ownerId !== userId) {
    throw new Error("Only the owner can list this square");
  }
  if (square.status !== "owned" && square.status !== "listed") {
    throw new Error("Square cannot be listed");
  }
}

export function assertCanUnlist(
  square: SquareListSnapshot,
  userId: string,
): void {
  if (square.ownerId !== userId) {
    throw new Error("Only the owner can unlist this square");
  }
  if (square.status !== "listed") {
    throw new Error("Square is not listed");
  }
}
```

- [ ] **Step 4: PASS + commit**

```powershell
git commit -m "feat: add list and unlist ownership guards"
```

---

### Task 3: List API

**Files:**
- Create: `src/app/api/squares/[id]/list/route.ts`

**Interfaces:**
- `POST` JSON `{ listPriceCents: number }` → `{ square, quote }`
- Auth required; zod int ≥ 1; `assertCanList`; set `status: listed`, `listPriceCents`; quote via `buildListingQuote`

- [ ] **Step 1: Implement route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertCanList } from "@/lib/listing";
import { buildListingQuote } from "@/lib/pricing";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  listPriceCents: z.number().int().min(1),
});

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "listPriceCents must be an integer ≥ 1" },
      { status: 400 },
    );
  }

  try {
    const square = await prisma.square.findUnique({ where: { id } });
    if (!square) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    try {
      assertCanList(
        { status: square.status, ownerId: square.ownerId },
        session.user.id,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cannot list";
      const status = /owner/i.test(msg) ? 403 : 409;
      return NextResponse.json({ error: msg }, { status });
    }

    const updated = await prisma.square.update({
      where: { id },
      data: {
        status: "listed",
        listPriceCents: body.listPriceCents,
      },
    });
    const quote = buildListingQuote({
      x: updated.x,
      y: updated.y,
      listPriceCents: body.listPriceCents,
    });
    return NextResponse.json({
      square: {
        id: updated.id,
        x: updated.x,
        y: updated.y,
        status: updated.status,
        imageUrl: updated.imageUrl,
        linkUrl: updated.linkUrl,
        listPriceCents: updated.listPriceCents,
        ownerId: updated.ownerId,
      },
      quote,
    });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 2: Smoke with curl/browser while logged in as owner of an owned square** (or skip if no owned square — note BLOCKED_MANUAL; unit guards still cover rules)

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat: add API to list squares at a fixed price"
```

---

### Task 4: Unlist API

**Files:**
- Create: `src/app/api/squares/[id]/unlist/route.ts`

**Interfaces:**
- `POST` (empty body ok) → `{ square, quote }` with `status: owned`, `listPriceCents: null`, quote via `buildPlatformQuote`

- [ ] **Step 1: Implement** (mirror list route; `assertCanUnlist`; update data `{ status: "owned", listPriceCents: null }`)

- [ ] **Step 2: Commit**

```powershell
git commit -m "feat: add API to unlist squares"
```

---

### Task 5: Detail GET uses listing quote when listed

**Files:**
- Modify: `src/app/api/squares/[id]/route.ts`
- Modify: `src/lib/previewBoard.ts` only if needed for consistency (preview stays non-listed)

**Interfaces:**
- When `square.status === "listed"` and `listPriceCents != null`, respond with `buildListingQuote`; else `buildPlatformQuote` as today.

- [ ] **Step 1: Update GET**

```ts
const quote =
  square.status === "listed" && square.listPriceCents != null
    ? buildListingQuote({
        x: square.x,
        y: square.y,
        listPriceCents: square.listPriceCents,
      })
    : buildPlatformQuote({ x: square.x, y: square.y });
```

- [ ] **Step 2: Commit**

```powershell
git commit -m "feat: show list-ask Fair/Balanced/Unfair on square detail"
```

---

### Task 6: Client helpers + SquarePanel List/Unlist UI

**Files:**
- Create: `src/lib/listing/listSquare.ts`
- Test: `tests/listing/listSquareClient.test.ts` (fetch mock, optional but preferred)
- Modify: `src/components/board/SquarePanel.tsx`
- Modify: `src/app/page.tsx` — extend `onSquareUpdated` to accept `status` + `listPriceCents`

**Interfaces:**
- `listSquare(id, listPriceCents)`, `unlistSquare(id)` → parsed `{ square, quote }` or throw
- Owner + `owned`: List form (USD input → cents), live preview via client-side `classifyPrice` **or** show label after successful list from response
- Owner + `listed`: show ask; Update price; Unlist
- Visitor + `listed`: disabled CTA text: `Buying listed squares comes later` (no primary Buy)
- Detail type must include `listPriceCents`

- [ ] **Step 1: Client helpers**

```ts
export async function listSquare(
  squareId: string,
  listPriceCents: number,
): Promise<{ square: ...; quote: ... }> {
  const res = await fetch(`/api/squares/${squareId}/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listPriceCents }),
  });
  // parse error/json like startPrimaryCheckout / customizeSquare
}
```

Same pattern for `unlistSquare` → `POST .../unlist`.

- [ ] **Step 2: Panel UI**

- Add state: `listPriceInput` (string dollars), `listing`, `listError`
- Prefer converting dollars → cents with `Math.round(parseFloat(s) * 100)` and reject NaN / values below 1 cent
- Live Fair/Balanced/Unfair: import `classifyPrice` and suggested from loaded `data.quote.suggestedPriceCents` while typing
- On success: `setData(result)`; call `onSquareUpdated` with id, status, listPriceCents, imageUrl, linkUrl

- [ ] **Step 3: page.tsx**

Update local `squares` map when panel reports status / listPriceCents changes so board markers update without full reload.

- [ ] **Step 4: Commit**

```powershell
git commit -m "feat: wire List and Unlist controls in square panel"
```

---

### Task 7: Board listed marker

**Files:**
- Modify: `src/components/board/BoardCanvas.tsx` — `paintGrid`

**Interfaces:**
- For each square with `status === "listed"`, draw a small corner accent (e.g. 3–4px filled triangle or rect in top-right of cell) after thumbnails, before selection stroke. Color: muted accent consistent with light theme (e.g. `#2563eb` or `#0f766e`) — **not** purple glow / pill chrome.
- Rebuild offscreen cache when square status set changes (existing paint deps should already rebuild when `squares` reference updates).

- [ ] **Step 1: Extend paint loop**

```ts
for (const s of index.values()) {
  if (s.status !== "listed") continue;
  const { px, py, pw, ph } = cellRect(layout, s.x, s.y);
  const m = Math.max(3, Math.min(pw, ph) * 0.2);
  ctx.fillStyle = "#0f766e";
  ctx.beginPath();
  ctx.moveTo(px + pw - m, py);
  ctx.lineTo(px + pw, py);
  ctx.lineTo(px + pw, py + m);
  ctx.closePath();
  ctx.fill();
}
```

- [ ] **Step 2: Manual — list a square, marker appears; unlist, marker gone** (BLOCKED_MANUAL without owned square — still ship code)

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat: mark listed squares on the board canvas"
```

---

### Task 8: Phase 3a acceptance

- [ ] **Step 1: Checklist**

1. `npm test` passes  
2. Owner can list owned square at any ≥ $0.01  
3. Unfair ask still lists; label shows unfair  
4. Board shows listed marker  
5. Visitor sees list price + “Buying listed squares comes later”  
6. Unlist clears price and marker  
7. Primary Buy still only on `platform`  
8. Customize still works while listed  
9. No Connect / secondary Checkout code added  

- [ ] **Step 2: Fix any gaps; commit if needed**

- [ ] **Step 3: Stop** — ready for Phase 3b plan when Stripe Connect is available

---

## Plan self-review

1. **Spec coverage:** List/unlist APIs ✓, free pricing + labels ✓, panel owner/visitor ✓, board marker ✓, no Connect/secondary buy ✓, customize while listed ✓, primary unchanged ✓  
2. **Placeholders:** None intentional; manual E2E may be BLOCKED without owned squares (no Stripe) — noted  
3. **Types:** `buildListingQuote` returns `PlatformQuote`; list/unlist responses share square+quote shape with detail GET  

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-11-square-market-phase-3a.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  

**2. Inline Execution** — run tasks in this session with checkpoints  

**Which approach?**
