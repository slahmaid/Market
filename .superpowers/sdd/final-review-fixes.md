# Phase 1 Whole-Branch Review Fixes

Date: 2026-09-10
Branch: `feat/phase-1-local`

## Fix results

- C1: Replaced the three independent camera states with one `BoardCamera` state. Zoom and fit now use pure transforms, preserve the existing exported camera API, and clamp consistently.
- I1: Removed `priceQuote.upsert` from `GET /api/squares/[id]`; the route computes and returns `buildPlatformQuote` without writing.
- I2: Changed location pricing to Chebyshev distance normalized by `CENTER`. Center remains near $100; edge midpoints and corners are $5.
- I3: Added pointer-capture drag panning and suppressed click selection after a drag. Wheel zoom remains disabled.
- I4: Made the canvas focusable and added keyboard selection. Arrow keys move an existing selection; Arrow/Enter/Space select the center when no cell is selected.
- I5: Added a process-local registration limiter: five attempts per IP per 15 minutes, checked before parsing or bcrypt, with HTTP 429 and `Retry-After`.

## Test evidence

- Focused red run before implementation: 4 test files failed for the missing camera transforms, old $52.48 edge midpoint, missing navigation helper, and missing rate limiter.
- Focused green run: 4 files passed, 11 tests passed.
- `npm test`: exit 0; 8 files passed, 21 tests passed.
- `npm run lint`: exit 0; no ESLint errors.
- `npm run build`: exit 0; Next.js 15.5.25 production build compiled, typechecked, and generated 9/9 static pages.
- `git diff --check`: exit 0.

## Commits

- `6cfafa4 fix: stabilize board camera interactions`
- `a4851cb fix: harden pricing and registration APIs`

## Remaining concerns

- The in-memory limiter is process-local and resets on restart; use a shared store before horizontally scaled production deployment.
- PostgreSQL migration/seed and live browser acceptance remain unverified because they were outside this no-Postgres fix scope.
- Test runs emit existing npm `devdir` and Vite native-config compatibility warnings.
