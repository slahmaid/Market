# App Chrome + Owner Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shared glass AppChrome on marketplace pages (Board, Search, Messages, Store, Dashboard) with Board + My squares links, and always-visible View/Edit store links on My squares rows.

**Architecture:** Extract `AppChrome` from current `BoardChrome` (centered glass bar). Mount on listed pages. Extend `MySquaresList` with stopPropagation-safe View/Edit store links. Remove redundant “← Board” on chrome pages only.

**Tech Stack:** Next.js 15 App Router, existing NextAuth session in chrome, Tailwind/`sm-glass` tokens.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-16-square-market-app-chrome-owner-hub-design.md`.
- Chrome pages: `/`, `/search`, `/messages`, `/messages/[id]`, `/store/[squareId]`, `/store/[squareId]/edit`, `/dashboard`.
- No chrome on `/login`, `/register`, `/buy/success`, `/buy/cancel`.
- Logged-in nav: Search form + Board + Messages + My squares + email + Log out.
- Owner hub: always-visible View store + Edit store on each `MySquaresList` row.
- Preserve centered glass bar (`justify-center`, `w-full max-w-[95%] sm:max-w-[85%]`).
- Commits: conventional; author `Cam <slahmaid@gmail.com>` via `GIT_*` env only.
- Include any uncommitted `BoardChrome` centering fix into `AppChrome`.

---

## File structure

```
src/components/board/AppChrome.tsx          # shared chrome (new)
src/components/board/BoardChrome.tsx        # re-export AppChrome OR delete after rename
src/app/page.tsx                            # use AppChrome active=board
src/app/search/page.tsx
src/app/messages/page.tsx
src/app/messages/[id]/page.tsx
src/app/store/[squareId]/page.tsx
src/app/store/[squareId]/edit/store-edit-client.tsx
src/app/dashboard/my-squares-client.tsx
src/components/board/MySquaresList.tsx      # View/Edit store links
```

---

### Task 1: Create `AppChrome`

**Files:**
- Create: `src/components/board/AppChrome.tsx`
- Modify: `src/components/board/BoardChrome.tsx` → re-export `AppChrome` (compat)
- Modify: `src/app/page.tsx` → `<AppChrome active="board" />`

**Interfaces:**
- Produces: `export function AppChrome(props?: { active?: "board" | "search" | "messages" | "dashboard" })`
- Nav link helper: `active === key` → add `font-semibold` (keep `font-medium` otherwise)

- [ ] **Step 1: Write `AppChrome.tsx`**

Base on current `BoardChrome` (including centered header). Logged-in order after search form:

```tsx
<Link href="/" className={navClass(active === "board")}>Board</Link>
<Link href="/messages" className={navClass(active === "messages")}>Messages</Link>
<Link href="/dashboard" className={navClass(active === "dashboard")}>My squares</Link>
{/* email span unchanged */}
{/* Log out button unchanged */}
```

```ts
function navClass(isActive: boolean) {
  return `sm-press min-h-11 shrink-0 inline-flex items-center px-3 py-2 text-neutral-800 active:bg-white/50 rounded-xl touch-manipulation ${
    isActive ? "font-semibold" : "font-medium"
  }`;
}
```

Guest links unchanged. Search form unchanged.

- [ ] **Step 2: Compat re-export**

`BoardChrome.tsx`:

```tsx
export { AppChrome as BoardChrome } from "./AppChrome";
```

Or update `page.tsx` to import `AppChrome` directly and leave re-export for safety.

- [ ] **Step 3: Board home**

```tsx
import { AppChrome } from "@/components/board/AppChrome";
// ...
<AppChrome active="board" />
```

- [ ] **Step 4: Commit**

```powershell
$env:GIT_AUTHOR_NAME="Cam"; $env:GIT_AUTHOR_EMAIL="slahmaid@gmail.com"
$env:GIT_COMMITTER_NAME="Cam"; $env:GIT_COMMITTER_EMAIL="slahmaid@gmail.com"
git add src/components/board/AppChrome.tsx src/components/board/BoardChrome.tsx src/app/page.tsx
git commit -m "feat: extract AppChrome with Board and My squares links"
```

---

### Task 2: Mount chrome on marketplace pages

**Files:**
- Modify: `src/app/search/page.tsx`
- Modify: `src/app/messages/page.tsx`
- Modify: `src/app/messages/[id]/page.tsx`
- Modify: `src/app/store/[squareId]/page.tsx`
- Modify: `src/app/store/[squareId]/edit/store-edit-client.tsx`
- Modify: `src/app/dashboard/my-squares-client.tsx`

**Interfaces:**
- Each page: render `<AppChrome active="…" />` at top of `<main>` (or above content wrapper)
- Remove “← Board” link blocks on these pages only
- Keep “← Inbox” / store link on message thread

- [ ] **Step 1: Search** (`active="search"`)

```tsx
import { AppChrome } from "@/components/board/AppChrome";

return (
  <main className="min-h-screen bg-[#f6f7f9] text-zinc-900">
    <AppChrome active="search" />
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* remove ← Board block */}
      ...
```

- [ ] **Step 2: Messages inbox** (`active="messages"`) — same pattern; remove ← Board.

- [ ] **Step 3: Message thread** (`active="messages"`) — add chrome; keep ← Inbox + store link.

- [ ] **Step 4: Public store** (`active` omit or none) — add chrome; remove ← Board.

- [ ] **Step 5: Store edit client** — add `<AppChrome />` at top of `<main>`; remove ← Board from the mb-6 link row (keep “My squares” / “View store” if present).

- [ ] **Step 6: Dashboard client** (`active="dashboard"`) — chrome at top; remove ← Board from header card (optional keep a muted Board text link inside card — prefer remove duplicate).

- [ ] **Step 7: Commit**

```powershell
git add src/app/search/page.tsx src/app/messages/page.tsx src/app/messages/[id]/page.tsx src/app/store/[squareId]/page.tsx src/app/store/[squareId]/edit/store-edit-client.tsx src/app/dashboard/my-squares-client.tsx
git commit -m "feat: mount AppChrome on marketplace pages"
```

---

### Task 3: Owner hub View/Edit store links

**Files:**
- Modify: `src/components/board/MySquaresList.tsx`

**Interfaces:**
- Always-visible links: `/store/${square.id}` and `/store/${square.id}/edit`
- Clicks must not toggle expand (`e.stopPropagation()` on link click, or place links outside the expand `<button>`)

- [ ] **Step 1: Restructure row**

Preferred structure:

```tsx
<li>
  <div className={`flex w-full items-start gap-3 ${rowPad}`}>
    <button type="button" aria-expanded={open} onClick={...} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left ...">
      {/* thumb + coords + status — existing */}
      <span>▾</span>
    </button>
  </div>
  <div className={`flex flex-wrap gap-3 pb-2 text-sm ${compact ? "px-3" : "px-4"}`}>
    <Link
      href={`/store/${square.id}`}
      className="text-neutral-700 underline-offset-2 hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      View store
    </Link>
    <Link
      href={`/store/${square.id}/edit`}
      className="text-neutral-700 underline-offset-2 hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      Edit store
    </Link>
  </div>
  {open && <SquareDetailsDropdown ... />}
</li>
```

Import `Link` from `next/link`.

Empty state: add optional

```tsx
<Link href="/" className="text-sm text-neutral-700 underline-offset-2 hover:underline">
  Buy a square on the Board
</Link>
```

- [ ] **Step 2: Manual check**

Rail + `/dashboard`: links visible without expand; expand still opens dropdown; links navigate.

- [ ] **Step 3: Commit**

```powershell
git add src/components/board/MySquaresList.tsx
git commit -m "feat: add View and Edit store links on My squares rows"
```

---

### Task 4: Smoke + suite

- [ ] **Step 1: Run tests**

```powershell
npx vitest run
```

Expected: existing suite still green (UI-only change).

- [ ] **Step 2: Manual checklist**

1. `/` — chrome centered; Board active; My squares + Messages present when logged in.  
2. `/search`, `/messages`, `/store/…`, `/store/…/edit`, `/dashboard` — chrome present; Board works.  
3. Login/register — **no** AppChrome.  
4. My squares row — View/Edit without expand; expand still works.  
5. Narrow viewport — bar usable, email truncated.

- [ ] **Step 3: Final commit only if stray fixes** — otherwise done.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| AppChrome + Board/My squares | 1 |
| Mount on marketplace pages | 2 |
| Remove ← Board where chrome exists | 2 |
| Keep thread ← Inbox | 2 |
| View/Edit on MySquaresList | 3 |
| No chrome on auth/buy | 2 (by omission) |

---

## Self-review notes

- No route-group moves; board shell unchanged aside from chrome props.
- `stopPropagation` / links outside expand button required so hub links don’t fight accordion.
- Login/register keep their own ← Board (out of scope to change).
