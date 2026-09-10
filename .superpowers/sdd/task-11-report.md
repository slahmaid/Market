# Task 11 Report: SquarePanel + BoardChrome

Status: DONE

## Implemented

- Created `src/components/board/SquarePanel.tsx` — fetches `/api/squares/:id`, shows coords, status, ask USD, label + reason; logged-out users get a login link, logged-in users see a disabled “Buying comes in Phase 2” button.
- Created `src/components/board/BoardChrome.tsx` — floating top bar with `ZoomControls` (left) and session UI (right): email when authenticated, Log in / Register links otherwise.

## Verification

- Lint: `npm run lint` passed.
- Tests: `npm test` passed (5 files, 14 tests).
- Production build: `npm run build` passed.

## Concerns

- Components are standalone; homepage wiring and manual acceptance (click → panel, chrome session) deferred to Task 12.
- SquarePanel buy CTA differs slightly from brief template (“Log in to buy” vs disabled “Buy (Phase 2)”) to satisfy logged-out login-link requirement.

## Commit

- `178dbc9` — feat: add square detail panel and board chrome (Cam <slahmaid@gmail.com>)

## Fix: stale data on square change

- **Bug:** When `squareId` changed, previous `data` persisted until fetch completed, flashing stale coords/price.
- **Fix:** Call `setData(null)` and `setError(null)` at the start of the fetch effect when `squareId` is set/changed; existing `!squareId` branch still clears data.
- **Verification:** `npm run lint` and `npm test` passed (5 files, 14 tests).
