# Mobile panel stack Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** On mobile, stack board as Header → collapsed My squares → Sphere → open Notifications, with independent expand/collapse.

**Architecture:** `page.tsx` owns `mySquaresOpen` / `notificationsOpen` state and switches the board body to a column flex under `md`. Rails accept `collapsed` + `onToggle` and hide body when collapsed. Desktop unchanged via `md:` classes.

**Tech Stack:** Next.js client components, Tailwind responsive utilities.

## Global Constraints

- Mutual exclusive open: NO (independent)
- Default: My squares closed, Notifications open
- Open heights: My squares `min(40vh,280px)`, Notifications `min(42vh,320px)`
- Sphere: `flex-1 min-h-[30vh]`
- Desktop three-column layout unchanged

---

### Task 1: Wire mobile shell + collapse props

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/board/BoardDashboardRail.tsx`
- Modify: `src/components/board/BoardNotificationsRail.tsx`

- [x] Add open state defaults; column layout `<md`, row `md+`
- [x] Header row with chevron toggles; body height when open
- [x] Verify desktop still three equal columns
