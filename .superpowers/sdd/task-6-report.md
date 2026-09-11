# Phase 5a Acceptance (Task 6)

Date: 2026-09-11
Branch: feat/phase-5a-google-auth
Range: bc334f5..a462396

## Checklist

1. npm test — PASS (see run)
2. tsc --noEmit — PASS
3. Migration google_auth_accounts — applied in Task 1
4. Credentials password users — CODE PASS
5. Null-password credentials reject — PASS (unit)
6. ensureGoogleUser create+link — PASS (unit)
7. Google button on login/register — CODE PASS
8. Live Google E2E — BLOCKED (no AUTH_GOOGLE_* in env)
9. No Stripe code changes in auth slice — PASS

## Follow-up fix — Phase 5a final review Important items

Date: 2026-09-11
Branch: feat/phase-5a-google-auth

### Important fixes

1. **email_verified fail-closed** — `isGoogleEmailVerified` requires `=== true`; missing/false denied in `signIn`.
2. **JWT authoritative Google user id** — `jwt` callback calls `ensureGoogleUser` when `account.provider === "google"` and sets `token.sub` to DB id.
3. **Google button gated** — login/register server pages pass `googleEnabled` from `AUTH_GOOGLE_*`; UI + helper copy hidden when unset. Documented `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` in `.env.example`.
4. **OAuth errors** — `pages.error: "/login"`; login reads `?error=` and shows a short friendly message.
5. **Google-only hint** — credentials error stays generic; login helper “Used Google before? Continue with Google.” when Google enabled.

### Verification

- `npm test` — PASS (75)
- `npx tsc --noEmit` — PASS
