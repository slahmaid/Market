# Square Market Phase 4a (My Squares Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in users open `/dashboard`, see a view-only list of squares they own (`owned` / `listed`), and click through to the board with that square selected.

**Architecture:** Auth-gated `GET /api/me/squares` returns the session user’s squares. A light `/dashboard` page renders the list. Board chrome links to Dashboard when logged in. Homepage reads `?square=<id>` to open `SquarePanel`.

**Tech Stack:** Next.js 15 App Router, Auth.js, Prisma/PostgreSQL, Vitest, existing light UI patterns.

## Global Constraints

- View-only dashboard — no list/unlist/customize actions here.
- Only return squares where `ownerId === session.user.id` and status is `owned` or `listed`.
- Guests → `/login` with return to `/dashboard`.
- Click → `/?square=<id>` opens board panel for that id.
- Light theme; mobile-friendly; no wallet/earnings/Stripe.
- Spec: `docs/superpowers/specs/2026-09-14-square-market-phase-4a-my-squares-design.md`.
- Commits: conventional; author `Cam <slahmaid@gmail.com>` via `GIT_*` env only (never `git config`).
- Do not commit `.env` secrets.
- Branch: `feat/phase-4a-my-squares` off `master` unless user directs otherwise.

---

## File structure (create/modify)

```
src/app/api/me/squares/route.ts          # GET owned squares
src/app/dashboard/page.tsx               # server auth gate + page shell
src/app/dashboard/my-squares-list.tsx    # client list UI (optional split)
src/components/board/BoardChrome.tsx     # Dashboard link
src/app/page.tsx                         # ?square= deep link
tests/me/mySquares.test.ts               # API helper / route logic tests
```

---

### Task 1: GET /api/me/squares (TDD)

**Files:**
- Create: `src/app/api/me/squares/route.ts`
- Optional extract: `src/lib/me/listMySquares.ts` for pure query orchestration if easier to test
- Test: `tests/me/mySquares.test.ts`

**Interfaces:**
- `GET` → `{ squares: Array<{ id, x, y, status, imageUrl, linkUrl, listPriceCents }> }`
- `401` if `!session?.user?.id`
- Order: `[{ y: "asc" }, { x: "asc" }]`
- Filter: `ownerId: userId`, `status: { in: ["owned", "listed"] }`
- No preview fallback

- [ ] **Step 1: Failing tests** (mock `auth` + `prisma`)

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Cases:
// 1. no session → 401
// 2. session → findMany called with ownerId + status in owned|listed
// 3. returns mapped squares JSON
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/me/mySquares.test.ts
```

- [ ] **Step 3: Implement route**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const squares = await prisma.square.findMany({
      where: {
        ownerId: session.user.id,
        status: { in: ["owned", "listed"] },
      },
      select: {
        id: true,
        x: true,
        y: true,
        status: true,
        imageUrl: true,
        linkUrl: true,
        listPriceCents: true,
      },
      orderBy: [{ y: "asc" }, { x: "asc" }],
    });
    return NextResponse.json({ squares });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 4: PASS + commit**

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"
$env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git commit -m "feat: add API for current user owned squares"
```

---

### Task 2: Dashboard page UI

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/dashboard/my-squares-client.tsx` (client fetch + list) if page is server component for auth redirect

**Interfaces:**
- Server page: `const session = await auth(); if (!session?.user) redirect("/login?callbackUrl=/dashboard")`
- Client: fetch `/api/me/squares`, show loading / error / empty / list
- Format USD with existing `Intl.NumberFormat` pattern from SquarePanel
- Each item: `<Link href={/?square=${id}}>` or `router.push`
- Empty copy: “You don’t own any squares yet.” + link to `/`
- Header: “My squares” + “← Board”

- [ ] **Step 1: Implement page + list**

Light styling consistent with login (`bg-[#f6f7f9]`, white cards, `min-h-11` touch targets). Prefer a vertical list of rows (thumb + text), not a dashboard of KPI cards.

- [ ] **Step 2: Commit**

```powershell
git commit -m "feat: add My squares dashboard page"
```

---

### Task 3: Board chrome Dashboard link

**Files:**
- Modify: `src/components/board/BoardChrome.tsx`

**Interfaces:**
- When `email` present, show `Link href="/dashboard"` labeled **Dashboard** (visible on mobile too — short label OK)

- [ ] **Step 1: Add link next to email chip**

```tsx
{email ? (
  <>
    <Link
      href="/dashboard"
      className="sm-press min-h-11 inline-flex items-center px-3 py-2 text-neutral-800 font-medium ..."
    >
      Dashboard
    </Link>
    <span className="truncate ..." title={email}>...</span>
  </>
) : ( ... login/register ...)}
```

- [ ] **Step 2: Commit**

```powershell
git commit -m "feat: link Dashboard from board chrome"
```

---

### Task 4: Homepage `?square=` deep link

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- On mount (client): read `new URLSearchParams(window.location.search).get("square")` or `useSearchParams()` from `next/navigation`
- After squares load (or when squares + param available): if id exists in `squares`, `setSelectedId(id)`
- Do not clear param required; optional `router.replace("/")` after select to clean URL — prefer **keep** query or replace once selected (either OK; document choice: **replace to `/` after select** to avoid re-select on refresh loops — actually keep `?square=` until user closes panel is fine. Spec: open panel. Implement: set selectedId when squares contain id; run once per id.)

- [ ] **Step 1: Wire useSearchParams**

```tsx
import { useSearchParams } from "next/navigation";

const searchParams = useSearchParams();
const deepSquareId = searchParams.get("square");

useEffect(() => {
  if (!deepSquareId || squares.length === 0) return;
  if (squares.some((s) => s.id === deepSquareId)) {
    setSelectedId(deepSquareId);
  }
}, [deepSquareId, squares]);
```

Wrap page in `Suspense` if Next requires it for `useSearchParams`.

- [ ] **Step 2: Commit**

```powershell
git commit -m "feat: open square panel from dashboard deep link"
```

---

### Task 5: Acceptance

- [ ] **Step 1: Checklist**

1. `npm test` passes  
2. `tsc --noEmit` clean  
3. Guest `/dashboard` → login  
4. Logged-in empty owner → empty state  
5. Logged-in with owned/listed squares → list shows thumbs/status/price  
6. Click → board opens with panel for that square  
7. Chrome shows Dashboard when logged in  
8. No wallet / Stripe / mutate actions on dashboard  

- [ ] **Step 2: Fix gaps; commit if needed**

- [ ] **Step 3: Stop** — ready to merge; Phase 4b later

---

## Plan self-review

1. **Spec coverage:** API ✓, dashboard UI ✓, chrome link ✓, deep link ✓, auth gate ✓, empty state ✓, view-only ✓  
2. **Placeholders:** None; manual owned-square check may need seed/DB user with ownership (Stripe deferred — may use prisma studio / SQL to set owner for manual test)  
3. **Types:** Response square shape matches board fields + `linkUrl`  

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-14-square-market-phase-4a-my-squares.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  

**2. Inline Execution** — run tasks in this session with checkpoints  

**Which approach?**
