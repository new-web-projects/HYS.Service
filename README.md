# HYS Services — Version 2

A production-grade rebuild of the HYS Services marketplace (customers booking
verified local service workers) on a single PostgreSQL-backed architecture —
no Firebase. See the Part 1 audit/architecture document for the full
rationale and the complete Part-by-part build plan; this README tracks the
project as it actually exists today.

**Status: Part 5 — Customer + Worker Systems.** Both roles have a real
dashboard shell, profile view/edit, and (worker-only) an availability
toggle — all role-gated two ways (see "Authentication architecture" below).
No booking/chat/payment/earnings features exist yet — those are Parts 7–9.
Each later Part updates this README as it lands.

## Stack

| Layer | Choice | Status |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript | ✅ Part 2 |
| Styling | Tailwind CSS v4 | ✅ Part 2 |
| Database | PostgreSQL, Prisma ORM 7 (driver-adapter mode via `@prisma/adapter-pg`) | ✅ Part 3 |
| Cache / rate limiting | Redis (`ioredis`) | ✅ Part 4 (rate limiting live; Part 7 adds pub/sub) |
| Auth | Better Auth (email/password, bcrypt, RBAC) | ✅ Part 4 |
| Real-time | Socket.IO | Part 7 |
| Payments | Razorpay, PhonePe, Paytm | Part 8 |
| Storage | Cloudinary, Amazon S3 (admin-selectable) | Part 11 |

## Getting started

### GitHub Codespaces (recommended)
Open this repo in a Codespace. `.devcontainer/devcontainer.json` points at
`docker-compose.yml`, which brings up the app container **plus Postgres and
Redis** together — `postCreateCommand` runs `npm install && npx prisma
generate` automatically. Then:

```bash
npx prisma migrate dev --name init   # first time only — creates the tables
cp .env.example .env.local            # fill in BETTER_AUTH_SECRET, SEED_SUPERADMIN_*
npm run db:seed                       # creates the first Super Admin
npm run dev
```

### Local, with Docker
```bash
docker compose up -d          # Postgres on 5432, Redis on 6379
cp .env.example .env.local    # fill in BETTER_AUTH_SECRET, SEED_SUPERADMIN_*
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32` — the app won't
boot without it (`lib/env.ts` fails fast rather than starting insecurely).

### Local, without Docker
Point `DATABASE_URL`/`DIRECT_URL`/`REDIS_URL` in `.env.local` at your own
Postgres 16+ and Redis instead, then run the same commands above.

## Scripts

```bash
npm run dev              # start the dev server (Turbopack)
npm run build             # production build
npm run start              # run a production build locally
npm run lint               # ESLint
npm run db:seed            # create the first Super Admin (see .env.example)
npx prisma generate        # regenerate the Prisma Client from schema.prisma
npx prisma migrate dev     # create/apply a migration in development
npx prisma studio          # browse the database in a GUI
```

## Verifying this Part

Same sandbox network limitation as Part 3 (`binaries.prisma.sh` isn't
reachable here, so `prisma generate`/`migrate` can't run) — full detail and
what to run yourself is in `MANUAL-VERIFICATION.md`. What *was* verified for
real in this sandbox:

- **The auth schema is checked against Better Auth's own CLI, not
  hand-written from memory.** `npx @better-auth/cli generate` actually ran
  against this project's real `lib/auth.ts` (via a temporary stub just to
  get past the missing-Prisma-client problem above) and its output was
  diffed field-by-field against the schema — several real corrections came
  out of that (see the comment above `model User` in `schema.prisma`).
- **A full `npm run build` passes with zero errors**, verified against a
  deliberately loose-typed temporary stub client (deleted before delivery —
  never shipped or committed). That proves everything *except* whether
  Prisma-specific calls (e.g. `prisma.category.findMany(...)`) match the
  real generated types exactly — only a real `prisma generate` can prove
  that part, which is what step 1 in `MANUAL-VERIFICATION.md` is for. Four
  real bugs unrelated to Prisma's types were caught and fixed this way
  (Better Auth's client not knowing about the custom `role` field, an
  implicit-`any` transaction parameter).
- **Redis-backed rate limiting was proven against a real local Redis, not
  just read as correct.** Six rapid login attempts: the first four returned
  `401` (wrong password), the fifth and sixth returned `429` — exactly
  matching the configured 5-per-15-minutes limit. This is the direct fix
  for the V1 limitation flagged in the Part 1 audit (in-memory rate
  limiting that silently stops working across multiple server instances).
- Found and fixed one real bug via the build itself, not by inspection: an
  eagerly-connecting Redis client was opening a connection during
  `next build`'s page-data collection (visible as `ECONNREFUSED` in build
  output) even though nothing was actually requesting data yet — fixed with
  `lazyConnect: true` in `lib/redis.ts`.
- **Part 5 specifically: every route-protection claim was checked against
  real HTTP requests to a running server, not inferred from reading the
  code.** That's exactly how `proxy.ts`'s broken matcher (see "Customer +
  worker systems" below) turned up — a clean build gives zero signal about
  whether a matcher pattern actually matches a route, only a real request
  does. All four new pages, the admin-login regression, and the new API
  routes were each hit directly (signed-out → redirect/401; public routes →
  200) after the fix.

## Authentication architecture

- **One `User` table for every role** (`role` enum: CUSTOMER/WORKER/ADMIN/
  SUPER_ADMIN), not a separate admin table like V1 had. `CustomerProfile`/
  `WorkerProfile` hold role-specific fields.
- **Password hashing is bcrypt** (`bcryptjs`, cost 12), configured
  explicitly rather than left on Better Auth's own default — matches the
  spec's "bcrypt or argon2" and keeps V2 hash-compatible with V1's existing
  Admin table if those accounts are ever migrated instead of reset.
- **No public admin signup** — `/admin/login` exists, there's no
  `/admin/signup`. The first Super Admin comes from `npm run db:seed`
  (`prisma/seed.ts`), same as V1's pattern. It signs up through Better
  Auth's own flow rather than a hand-hashed insert, so the seeded account
  isn't a special case at login time.
- **Route protection is two layers, deliberately not one.** `proxy.ts`
  (Next.js 16 renamed `middleware.ts` → `proxy.ts` and moved it off the
  Edge Runtime by default — a direct response to CVE-2025-29927, where
  Edge-Runtime middleware authorization could be bypassed under load) only
  checks whether a session cookie exists at all, to bounce obviously
  signed-out visitors early. The real, DB-backed, role-aware check is
  `lib/auth-guard.ts`'s `requireUser()`/`requireRole()`, called from every
  protected page and API route individually — the framework's own current
  guidance is not to trust the proxy layer alone for authorization.
  `/admin/login` is explicitly exempted from `proxy.ts`'s protected-prefix
  check — a completeness re-check caught that without this, the check
  redirected the login page to itself, since visiting a login page never
  comes with a session cookie.
- **CSRF/same-origin protection on every mutating custom auth route**
  (`lib/same-origin.ts`), matching V1's `enforceSameOrigin()` pattern.
  Better Auth's own catch-all route checks origin against `trustedOrigins`
  automatically, but that only covers requests it handles directly — the
  three custom routes below call `auth.api.*` as server-side functions
  instead, so they needed the same check ported explicitly.
- **Two complementary rate-limiting layers, not one doing both jobs.**
  Better Auth's own Redis-backed rate limiter (`secondaryStorage` +
  `rateLimit` in `lib/auth.ts`) covers every endpoint it handles directly —
  password-reset requests, verification-email resends, session refresh —
  with tighter `customRules` on the sensitive ones. Separately,
  `/api/auth/login` has its own Redis-backed brute-force lock (5 failed
  *passwords* for one email → 15-minute lock, not just a request-volume
  limit) — V1 had this same two-mechanism split, just in-memory.
  `session.storeSessionInDatabase`/`preserveSessionInDatabase` stay on so
  Postgres remains the durable source of truth even with Redis caching
  sessions for speed.
- **Worker "Other" category signup no longer uses V1's temporary-ID
  pattern.** V1 gave a worker a placeholder `pending-{timestamp}` category
  ID and reconciled it later when an admin approved the name — the
  reconciliation step was never found during the Part 1 audit. V2 creates
  the real `Category` row immediately (`isApproved: false`), so
  `WorkerProfile.categoryId` is always a valid foreign key from the moment
  of signup.
- **Known gap, not silently glossed over:** creating the `User` (via Better
  Auth) and creating the `CustomerProfile`/`WorkerProfile` (via Prisma
  directly after) aren't one atomic transaction — Better Auth owns the
  first half internally. If the second half fails, a `User` with no profile
  is left behind. Worth hardening (e.g. detecting and repairing this on
  next login) before this handles real signups.
- Email verification and password reset both work today — without SMTP
  configured, `lib/email.ts` logs the email to the console instead of
  sending it, which is enough to click the link by hand while testing.

## Customer + worker systems (Part 5)

- **Two role-gated route groups**, `app/(customer)/` and `app/(worker)/`,
  each with its own layout calling `requireRole()` — the real check, not
  just `proxy.ts`. URLs stay flat (`/customer-dashboard`,
  `/customer-profile`, `/worker-dashboard`, `/worker-profile`) matching
  V1's naming; the route group is filesystem organization only, it doesn't
  appear in the URL.
- **`proxy.ts`'s matcher had a real bug**, found on this Part's own
  completeness re-check: `/customer/:path*` and `/worker-dashboard/:path*`
  both require a trailing slash *plus something after it* — neither ever
  matched the actual bare routes this Part builds (`/customer-dashboard`,
  `/worker-profile`, etc. — no slash, nothing after). `proxy.ts` was
  silently never invoked for any of them. No live security hole —
  `requireRole()` in each layout still caught it, just a render later, via
  a full redirect instead of an early bounce — but not what was intended.
  Confirmed both broken (old matcher) and fixed (new one) against a real
  running server, not just re-read: all four pages now correctly return a
  redirect when signed out. The matcher is now deliberately broad
  (everything except static assets) with the real prefix logic in plain JS
  instead, to avoid repeating a mistake rooted in Next.js matcher-syntax
  uncertainty.
- **Profile completion percentages are a reasonable reconstruction, not a
  byte-exact V1 port.** The Part 1 audit recorded that V1 had this feature
  but never captured its exact per-field weights.
  `lib/profile-completion.ts` documents its own weighting plainly so it's
  easy to adjust rather than presented as more authoritative than it is.
  Two fields that would normally count — profile photo, verification
  document upload — are excluded from the denominator entirely until Part
  11 (Storage) exists, rather than counted as permanently missing.
- **Location capture ported the browser-geolocation UX (V1's per-error-code
  messages), not the city auto-detection.** V1 also derived a city name
  from coordinates via static bounding boxes for a handful of Indian
  metros — the audit recorded that this existed but not the actual
  coordinate values, and inventing plausible-looking bounding boxes to fill
  that gap would be worse than leaving city as a manually-typed field for
  now.
- **Worker "Other" category via profile edit reuses the same
  immediate-real-row pattern as signup** (`app/api/worker/profile/route.ts`),
  not V1's temporary-ID pattern — see Part 4's notes for why.
- Document upload for verification isn't built — Part 11 (Storage) owns
  that. The profile edit page records which document type a worker intends
  to provide; the actual file input arrives once there's somewhere to
  upload it to.

## Data model

`prisma/schema.prisma` — grouped into: Better Auth core (`User`/`Session`/
`Account`/`Verification` — cross-checked against Better Auth's own CLI
output, see "Verifying this Part"), role profiles (`CustomerProfile`/
`WorkerProfile`), `Category`, booking + job-posting + chat (`JobPost`/
`Booking`/`Conversation`/`Message`), `Review`/`Earning`/`Withdrawal`,
`Transaction`, `Notification`, `SupportTicket`/`SupportTicketMessage`, the
CMS carried over from V1 (`Page`/`Media`), one consolidated `Settings` row,
and `AuditLog`/`ErrorLog`/`ErrorReport`.

Worth knowing before Part 5+ builds on this:
- **Money is `Decimal(10,2)` in rupees everywhere in the schema.** Gateways
  that want the smallest currency unit (paise) get converted at the Part 8
  integration boundary, not baked into the data model.
- **Chat gating for Direct Booking is derived from `booking.status`**, not a
  duplicated boolean flag on `Conversation` — V1 had both and they could
  drift apart; here there's one source of truth.
- `User.gender` and `WorkerProfile.skills` were added after a Part 1
  completeness re-check found both are genuinely load-bearing in V1 (gender
  gates profile-completion on both dashboards; skills backs search and
  profile display) — see the Part 1 audit's §25 addendum.

See `MANUAL-VERIFICATION.md` for the steps that need to be run somewhere
with real internet access before this Part counts as fully verified.

## Structure

```
app/
  layout.tsx, page.tsx, globals.css      # root shell + placeholder homepage
  api/health/                            # liveness check
  api/categories/                        # minimal read-only list (Part 6 owns the real thing)
  api/auth/[...all]/                     # Better Auth's own routes (session, verify, reset)
  api/auth/login/                        # custom: adds brute-force lock + CSRF check
  api/auth/customer/signup/              # custom: adds CustomerProfile creation + CSRF check
  api/auth/worker/signup/                # custom: adds WorkerProfile + category resolution + CSRF check
  api/customer/profile/                  # GET/PATCH, role-gated
  api/worker/profile/                    # GET/PATCH, role-gated
  api/worker/availability/               # PATCH, quick toggle
  auth/login/, auth/forgot-password/, auth/reset-password/, auth/verify-email/,
  auth/signup/customer/, auth/signup/worker/   # functional, minimal styling — Part 15 designs these
  admin/login/                           # role-gated separately from customer/worker login
  (customer)/customer-dashboard/, (customer)/customer-profile/  # role-gated, flat URLs
  (worker)/worker-dashboard/, (worker)/worker-profile/          # role-gated, flat URLs
components/shared/
  LogoutButton.tsx  # used by both dashboard layouts
lib/
  env.ts                  # validated environment variables (extended every Part)
  utils.ts                 # cn() class-name helper
  prisma.ts                 # Prisma Client singleton (driver-adapter mode)
  redis.ts                   # Redis client singleton (lazy-connecting)
  auth.ts                     # Better Auth server config
  auth-client.ts                # Better Auth React client
  auth-guard.ts                  # requireUser()/requireRole() — the real authorization check
  same-origin.ts                  # CSRF defense-in-depth for custom mutating routes
  rate-limit.ts                    # Redis-backed brute-force lockout
  email.ts                          # console-log in dev, real SMTP once configured
  geolocation.ts                     # browser geolocation wrapper (client-side)
  profile-completion.ts               # completion-percentage calculators
  generated/                           # prisma generate output — gitignored, not committed
prisma/
  schema.prisma   # the full data model
  seed.ts         # creates the first Super Admin
proxy.ts           # lightweight request gate only — see "Authentication architecture"
prisma.config.ts   # Prisma 7 connection config (the URL lives here, not in schema.prisma)
docker-compose.yml # local Postgres + Redis
```

Route groups for the admin panel proper (`app/(admin)/`) are introduced
starting Part 10 alongside the pages that populate it.

## Environment variables

See `.env.example` — grouped by the Part that introduces each service. The
Part 2, 3, and 4 sections are required today; everything else is commented
out until its Part exists.
