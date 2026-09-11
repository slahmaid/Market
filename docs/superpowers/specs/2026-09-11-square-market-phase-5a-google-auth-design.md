# Square Market — Phase 5a Design (Google Auth)

**Date:** 2026-09-11  
**Status:** Draft for user review  
**Parent spec:** `docs/superpowers/specs/2026-09-10-square-market-design.md`

## 1. Summary

Add **Sign in / register with Google** via Auth.js, alongside existing email/password. Stripe and Connect stay deferred. Same-email Google sign-in **links** to an existing password account. Google-only users have **no password** until they set one later (out of this slice).

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Same email + Google | **Link** to existing `User` (one identity) |
| Google-only users | `passwordHash` nullable; credentials login unavailable until a password exists |
| Approach | Auth.js **Google** provider + keep **JWT** sessions (no full DB session adapter) |
| Stripe | Out of scope (setup later) |

## 3. Goals & non-goals

### Goals

- “Continue with Google” on `/login` and `/register` (same OAuth start).
- New Google user → create `User` (`email`, `passwordHash: null`) + `Account` row.
- Existing email/password user → Google with same email → attach `Account`; same `user.id` / session.
- Credentials authorize fails clearly when `passwordHash` is null.
- Email remains unique; normalized lowercase.
- Env placeholders in `.env.example`; secrets only in local `.env`.

### Non-goals

- Stripe / Connect / secondary buy.
- Password reset / “set password” flow (follow-up).
- Apple, GitHub, or other social providers.
- Switching from JWT to database sessions.
- Email verification beyond Google’s verified email trust.

## 4. Approaches considered

1. **Auth.js Google + JWT + Account table** — recommended.  
2. Full Prisma Auth.js adapter (Session/VerificationToken) — heavier than needed.  
3. Custom Google ID token verify — reinventing Auth.js.

**Decision:** Approach **1**.

## 5. Data model

### User (change)

- `passwordHash` → `String?` (nullable)

### Account (new)

Minimal Auth.js-compatible account link:

- `id` String cuid  
- `userId` → User  
- `type` String (e.g. `"oidc"`)  
- `provider` String (e.g. `"google"`)  
- `providerAccountId` String  
- `refresh_token` String?  
- `access_token` String?  
- `expires_at` Int?  
- `token_type` String?  
- `scope` String?  
- `id_token` String?  
- `session_state` String?  
- `@@unique([provider, providerAccountId])`  
- `@@index([userId])`

Migration: existing users keep password hashes; column becomes nullable without data loss.

## 6. Auth.js behavior

### Providers

- Keep `Credentials` as today (email + password ≥ 8).  
- Add `Google({ clientId, clientSecret, allowDangerousEmailAccountLinking: true })`  
  - Linking only after Google email is verified (Auth.js / Google default).  
  - Document the “dangerous” flag: intentional for product choice **A** (same email = same user).

### Credentials `authorize`

- Lookup user by email.  
- If no user → null.  
- If `passwordHash == null` → null (UI: “Use Google to sign in” or “No password set for this account”).  
- Else verify password as today.

### Google sign-in path

On successful Google OAuth:

1. Normalize email to lowercase.  
2. Find `User` by email.  
3. If missing → create `User` with `passwordHash: null`.  
4. Upsert `Account` for `provider=google` + `providerAccountId`.  
5. JWT `sub` = `user.id` (same session shape as credentials).

Implementation may use Auth.js `signIn` / `jwt` callbacks and/or Prisma writes in those callbacks (no Prisma Adapter required for JWT strategy). Prefer explicit Prisma upserts so behavior is obvious and testable.

### Session

- Unchanged: JWT strategy; `session.user.id` from `token.sub`.

## 7. UI / UX

### `/login` and `/register`

- Keep email/password forms.  
- Add divider + **Continue with Google** button → `signIn("google", { callbackUrl: "/" })`.  
- Light theme; match existing field/button styles (no purple Google branding pack — use neutral button + short label).  
- Register page copy: Google creates the account; no separate “OAuth register” API.

### Errors

- Credentials + Google-only account: clear message to use Google.  
- OAuth cancel/error: return to login with a short error query or Auth.js error page mapping to `/login`.

## 8. Configuration

`.env.example`:

```env
AUTH_GOOGLE_ID="your-google-oauth-client-id"
AUTH_GOOGLE_SECRET="your-google-oauth-client-secret"
```

Google Cloud Console: OAuth client (Web), authorized redirect URI:

`{AUTH_URL}/api/auth/callback/google`  
(e.g. `http://localhost:3000/api/auth/callback/google`)

Local `.env` must set real values; never commit secrets.

## 9. Security notes

- Trust Google’s verified email for linking; do not link on unverified email.  
- `allowDangerousEmailAccountLinking` is an explicit product decision — document in code comment.  
- No change to ownership / checkout auth gates beyond same session user id.

## 10. Testing

- Unit: credentials authorize rejects null `passwordHash`; accepts valid hash.  
- Unit/integration: link helper upserts Account onto existing User by email.  
- Manual: Google test user create → session; existing password user → Google same email → same user id; credentials still work when hash present.

## 11. Parent spec amendments

- Phase **5a – Google Auth** ships before Stripe-heavy Phase 3b if desired.  
- Auth later → Auth **now (5a)** for Google; password-reset remains later.  
- `passwordHash` optional for OAuth-only users.
