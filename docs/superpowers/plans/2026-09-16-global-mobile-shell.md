# Global mobile shell Implementation Plan

> **For agentic workers:** Implement task-by-task.

**Goal:** Shared mobile AppChrome (hamburger + account FAB) and consistent content page shells.

**Architecture:** Extend `AppChrome` with mobile drawer + `AccountFab`; add thin `PageShell` wrapper; apply across app pages.

**Tech Stack:** Next.js client components, Tailwind, next-auth session.

---

### Task 1: AppChrome mobile + AccountFab
- [x] Hamburger drawer links
- [x] AccountFab red/green + popover
- [x] Desktop top links retained

### Task 2: PageShell + apply to content pages
- [x] Shared padding/safe-area wrapper
- [x] Wire search, messages, store, dashboard, auth, buy pages
