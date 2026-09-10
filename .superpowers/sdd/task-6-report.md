# Task 6 Report: Auth.js credentials + register API

Status: DONE_WITH_CONCERNS

## Implemented

- Installed Auth.js v5 beta, bcryptjs, Zod, and bcryptjs type declarations.
- Added bcrypt password hashing and verification helpers with cost factor 12.
- Added the Auth.js Credentials provider with JWT sessions, normalized email lookup, password verification, and session user IDs.
- Added Auth.js route handlers at `/api/auth/[...nextauth]`.
- Added `POST /api/auth/register` validation, duplicate-email handling, password hashing, and safe user response.
- Added Auth.js session type augmentation.
- Updated `.env.example` with an `AUTH_SECRET` placeholder and created an ignored local `.env`.

## Verification

- TDD red: `npm test -- tests/auth/register.test.ts` failed because `@/lib/auth-credentials` did not exist.
- TDD green: password helper test passed.
- Full tests: `npm test` passed, 5 files and 14 tests.
- Type check: `npx tsc --noEmit` passed.
- Lint: `npm run lint` passed.
- Production build: `npm run build` passed and emitted both auth API routes.

## Concerns

- Manual register API verification was not run because PostgreSQL is unavailable (`localhost:5432` is closed). The expected `201` response and duplicate `409` response remain to be checked once the database is running.
- npm reports 6 dependency vulnerabilities (1 moderate, 5 high); these were pre-existing or dependency-tree findings and were not changed with a potentially breaking forced audit fix.
- Vitest reports an existing Vite native config-loader compatibility warning.
