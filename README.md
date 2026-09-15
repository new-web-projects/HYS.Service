# HYS Services — Version 2

A production-grade rebuild of the HYS Services marketplace (customers booking
verified local service workers) on a single PostgreSQL-backed architecture —
no Firebase. See the Part 1 audit/architecture document for the full
rationale and the complete Part-by-part build plan; this README tracks the
project as it actually exists today.

**Status: Part 10 — Admin Panel + Configuration.** Everything through
Part 9 (booking, chat, payments, earnings/withdrawals, reviews) plus a
full admin panel — customers, workers, categories, bookings, payments,
withdrawals, reviews, notifications, error logs/reports, audit logs,
and platform settings (fees, GST, gateway toggles, storage provider,
maintenance mode, now actually enforced via `proxy.ts`) — are real and
build-verified (build fails only at the one expected, sandbox-only
Prisma-generate point — see Verifying this Part). Document/media upload
doesn't exist yet — Part 11 — so worker verification stays a manual
admin toggle until then.

## Stack

| Layer | Choice | Status |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript | ✅ Part 2 |
| Styling | Tailwind CSS v4 | ✅ Part 2 |
| Database | PostgreSQL, Prisma ORM 7 (driver-adapter mode via `@prisma/adapter-pg`) | ✅ Part 3 |
| Cache / rate limiting | Redis (`ioredis`) | ✅ Part 4 |
| Auth | Better Auth (email/password, bcrypt, RBAC) | ✅ Part 4 |
| Real-time | Socket.IO (custom server; polling fallback on Vercel) | ✅ Part 7 |
| Booking + chat | Unified direct/job-post booking model, price negotiation | ✅ Part 7 |
| Payments | Razorpay, PhonePe, Paytm (all three, gateway-agnostic completion) | ✅ Part 8 |
| Earnings / withdrawals | Allocation-ledger balance model, admin approve/reject API | ✅ Part 9 |
| Reviews | Rating + comment, recomputed worker average | ✅ Part 9 |
| Admin Panel | Customers, workers, categories, bookings, payments, withdrawals, reviews, notifications, errors, audit logs, settings | ✅ Part 10 |
| Maintenance mode | Redis-cached read in `proxy.ts`, admin-toggled | ✅ Part 10 |
| Storage | Cloudinary, Amazon S3 (admin-selectable) | Part 11 |
| Icons | `lucide-react` | ✅ Part 6 |

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
- **Part 6 specifically:** the verification stub itself had a real bug —
  `findMany` returned `null` instead of `[]` two Proxy levels deep, which
  only crashed a real request (`/api/workers/search`), not the build. Fixed
  in the stub, confirmed via a real request afterward, and confirmed
  `/api/categories` (built back in Part 4, using the same buggy stub the
  whole time but masked by its own `?? []` fallback) still works
  unchanged. Also confirmed directly in the compiled CSS output — not
  assumed from the build succeeding — that Tailwind v4 actually generated
  real utility classes (`fill-rating`, `text-accent`, etc.) from the new
  `@theme` tokens in `globals.css`.

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
  upload it to. Verification status now shows three states (not started /
  pending review / verified), not a plain verified/not-verified binary —
  a completeness re-check against the spec's exact "Document Verification
  status" wording caught that the original binary version undersold what
  the schema already tracks.
- **A completeness re-check also added what the spec calls "Account
  Settings"** as its own dashboard section (`/customer-account`,
  `/worker-account`), distinct from the profile/location page — mainly
  change-password (`components/shared/ChangePasswordForm.tsx`, via Better
  Auth's own `changePassword`), since nothing let a *signed-in* user change
  their password before this (only the signed-out forgot-password flow
  existed). Both dashboard navs also gained a link back to the public site
  and to this new page — neither existed before, a real (if minor) nav gap
  for a spec that explicitly cares about "no hidden important options."
- **Location was missing from both signup forms.** The spec lists it under
  "Worker Signup must support," and it was only reachable via profile edit
  after this Part's first pass. Added as an optional step on both customer
  and worker signup now that `lib/geolocation.ts` exists to build it with.
- Fixed a real lint error the first pass introduced: internal navigation
  used raw `<a href="...">` instead of `next/link`'s `Link` — caught by
  `next lint`, not by inspection, and applied consistently across every
  internal link in the app, not just the ones the linter happened to flag
  first.

## Categories, location & service marketplace (Part 6)

- **`/services`** — search, filters (category, distance, rating, starting
  price, experience, verification), and a worker-card grid. Uses the
  signed-in customer's saved location automatically if there is one
  ("shouldn't need to enter location repeatedly," per the spec), otherwise
  offers the same browser-geolocation prompt as the profile pages.
- **`lib/worker-search.ts`** does a bounding-box pre-filter (indexed
  `latitude`/`longitude` range query) then an exact Haversine distance and
  a composite ranking score: available workers always sort before
  unavailable ones (badged, not hidden — an unavailable worker can't be
  booked, but hiding real profiles entirely would be worse than showing
  them clearly marked); within that, distance leads 70/30 over rating when
  a location is known, rating plus review count leads when it isn't. This
  is a documented, reasonable heuristic — the spec asks for "intelligent"
  ranking without pinning down exact weights, and says so plainly rather
  than presenting one specific formula as more authoritative than it is.
- **Real design pass, not a placeholder this time.** `app/globals.css`'s
  tokens are revised from Part 2's explicitly-provisional set — Part 2 had
  nothing real to design *for* yet; this Part does. Kept the teal primary
  from Part 2 (already a deliberate, non-generic choice) and paired it with
  a warm amber reserved for price and rating, since those are the two
  numbers a customer scans a worker card for first.
- **`lib/distance-pricing.ts` ports V1's exact travel-surcharge tiers**
  (0% ≤5km / 5% 5–15km / 10% 15–30km / 20% beyond), confirmed with real
  confidence in the Part 1 audit — unlike V1's city-auto-detection bounding
  boxes, which weren't, and so still aren't ported (see Part 5's notes).
  Wired into the reference price shown at booking creation as of Part 7
  (`computeBookingBasePrice` in `lib/pricing.ts`).
- **The public worker profile page's "Book worker" button is real but
  disabled**, with a visible note saying why, rather than either omitting
  it or wiring it to something that doesn't work yet.
- **Public profiles deliberately don't show phone or email.** V1 only
  reveals contact details to each side after payment (confirmed in the
  Part 1 audit) — nothing about that changed just because this is a new
  endpoint built fresh.
- A stub bug in this sandbox's own verification tooling — not the
  application — turned up here and is worth knowing about if you're
  reading `MANUAL-VERIFICATION.md`: the temporary Prisma-client stub used
  to unblock builds returned `null` instead of `[]` for every `findMany`,
  two Proxy levels deep. Harmless for endpoints that happened to have a
  defensive `?? []` (like `/api/categories` since Part 4), but it crashed
  `/api/workers/search` outright the moment a real request hit it, which a
  clean build gave zero signal about. Fixed in the stub itself, which
  benefits every earlier Part's verification too, not just this one.
- **A completeness re-check against the spec's exact Service Page field
  list found two real gaps**, now fixed: "Availability" is explicitly
  listed as one of the page's filters, alongside rating/price/experience/
  verification — the first pass only used availability as a ranking/badge
  signal, with no way to actually filter unavailable workers out
  (`availableOnly` on `searchWorkers`/the search API/the filter panel now
  covers this). And the spec's exact phrases — "Starting Price" and "Price
  may increase based on the work" — are now literal, visible text on both
  the worker card and public profile page, not paraphrased as "From ₹X".
- Also added on that re-check: a brief note on the public worker profile
  page that distant workers may carry a travel surcharge, shown before
  payment (informational only on this page — the real figure is computed
  once an actual booking exists, as of Part 7).

## Booking, chat, payments & earnings (Parts 7–9, brief)

Full narrative write-ups for Parts 7 and 8 were never added here even
though the work was completed and verified in `MANUAL-VERIFICATION.md`
at the time — a documentation gap, not a functional one, caught and
partly closed while completing Part 9. In short: Part 7 unified direct
bookings and job-post bookings into one `Booking` model and state
machine (`origin: DIRECT | JOB_POST`, distinguished only by which status
they start at), built the price-negotiation flow inside each
conversation, and added Socket.IO with a polling fallback for
deployments (like Vercel) that can't hold a persistent WebSocket. Part 8
added all three payment gateways behind one gateway-agnostic,
idempotent completion function, with active reconciliation polling as a
webhook backstop for all three.

**Part 9** closes two things: first, a dependency gap from Parts 7/8 —
nothing had ever built a route to verify the completion OTP those Parts
issue, so no booking could reach `COMPLETED` and no earning could leave
`HELD` (`/api/bookings/[id]/complete`, rate-limited against brute-forcing
a 6-digit code). Second, the actual Part 9 scope: worker earnings and
withdrawals, and customer reviews.

The one real design problem here: withdrawal amounts are fixed to round
₹1,000 multiples, but individual job earnings are arbitrary amounts, so
a withdrawal essentially never divides evenly across whole earnings.
Locking whole earnings against a withdrawal (the simplest reading of the
Part 3 schema's original `Earning.withdrawalId` field) either forfeits
the leftover — the exact bug this project's V1 audit found in V1's own
withdrawal-approval code — or requires splitting an earning row, which
breaks its one-row-per-booking shape. Fixed with one addition,
`WithdrawalAllocation` (withdrawal ↔ earning ↔ amount): an earning's true
remaining balance is always `amount − SUM(its allocations)`, so a
₹4,000 earning can fund ₹2,000 of one withdrawal now and still have a
genuinely free ₹2,000 for a later one, with no row ever split and no
rupee ever silently lost. See `lib/earnings.ts` for the allocation,
release, and finalize logic, and `MANUAL-VERIFICATION.md` items 24–29
for what still needs a real database to confirm.

Admin approval/rejection of a withdrawal is a real, working, role-gated
API (`/api/admin/withdrawals[/[id]]`) with no UI yet — same "build the
capability ahead of the panel that will call it" pattern Part 8 already
established for payment-gateway settings. Part 10 gives both a real
interface.

## Data model

`prisma/schema.prisma` — grouped into: Better Auth core (`User`/`Session`/
`Account`/`Verification` — cross-checked against Better Auth's own CLI
output, see "Verifying this Part"), role profiles (`CustomerProfile`/
`WorkerProfile`), `Category`, booking + job-posting + chat (`JobPost`/
`Booking`/`Conversation`/`Message`), `Review`/`Earning`/`Withdrawal`/
`WithdrawalAllocation` (Part 9 — see below for why the last one exists),
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
- `WorkerProfile` gained a `[latitude, longitude]` index in Part 6 for the
  service-search bounding-box query.

See `MANUAL-VERIFICATION.md` for the steps that need to be run somewhere
with real internet access before this Part counts as fully verified.

## Backups & migration safety

Postgres is the single source of truth for every table in this app — there
is no Firebase (or any other) fallback store, so losing the database means
losing everything. Set this up once, before real data exists:

- **Automated backups**: turn on your provider's automated daily backups —
  Neon, Supabase, RDS, Railway, and Render all offer this as a one-click
  setting; on a self-managed VPS, a nightly `pg_dump` to off-box storage
  (e.g. a small cron job piping to S3/Backblaze) is the equivalent. Point
  it at whatever `DIRECT_URL` resolves to, not the pooled connection.
- **Point-in-time recovery (PITR)**, if your provider supports it — restores
  to any point in the last N days, not just the last nightly snapshot.
  Worth enabling for production; adds cost, so optional for dev/staging.
- **Before any destructive migration** (a column/table drop, a type change
  that can lose data) — take a manual, named snapshot first, separate from
  the automated schedule, and confirm you can restore it *before* running
  the migration. `npx prisma migrate deploy` doesn't ask for confirmation.
- **Restore procedure** (drill this at least once outside of an emergency):
  1. Provision a fresh database (or a scratch branch, if your provider
     supports branching — Neon does).
  2. Restore the backup/snapshot into it.
  3. Point a *non-production* `DATABASE_URL`/`DIRECT_URL` at it and run the
     app's own health check (`/api/health`) plus a manual login, to confirm
     the restored data is actually queryable before touching production.
  4. Only then repoint production's connection strings, if that's the goal.
- **Migrations were additive-only through Part 8** — every Part up to
  that point only added tables/columns. **Part 9 is the first exception**:
  `Earning.withdrawalId` (a plain FK) was removed in favor of the new
  `WithdrawalAllocation` join table, which supersedes it (see "Booking,
  chat, payments & earnings" above for why). If a dev/staging database
  already has data in `Earning.withdrawalId` from before Part 9, back it
  up before migrating — that specific column's data does not carry
  forward automatically; it would need a one-off script to backfill
  `WithdrawalAllocation` rows from it first.

## Structure

```
app/
  layout.tsx, page.tsx, globals.css      # root shell + real homepage (Part 6) + design tokens (Part 6)
  chat/[conversationId]/, chats/                    # dedicated chat page (Part 7) + conversation list
  job-board/, notifications/
  post-job/                                          # under (customer) below; listed for visibility
  api/health/                            # liveness check
  api/categories/                        # minimal read-only list (Part 10 owns full category management)
  api/workers/search/                    # service-page search + ranking
  api/workers/[id]/                      # public worker profile (no phone/email)
  api/workers/[id]/reviews/              # public reviews list (Part 9)
  api/auth/[...all]/                     # Better Auth's own routes (session, verify, reset)
  api/auth/login/                        # custom: adds brute-force lock + CSRF check
  api/auth/customer/signup/              # custom: adds CustomerProfile creation + CSRF check
  api/auth/worker/signup/                # custom: adds WorkerProfile + category resolution + CSRF check
  api/customer/profile/                  # GET/PATCH, role-gated
  api/worker/profile/                    # GET/PATCH, role-gated
  api/worker/availability/               # PATCH, quick toggle
  api/worker/earnings/                   # balance summary + ledger (Part 9)
  api/worker/withdrawals/                # GET history / POST request (Part 9)
  api/admin/withdrawals/[[id]]/          # approve/reject — API only, no UI until Part 10 (Part 9)
  api/bookings/                          # create (direct booking)
  api/bookings/mine/                     # the signed-in user's own bookings
  api/bookings/[id]/                     # GET (contact reveal post-payment) / PATCH (cancel)
  api/bookings/[id]/respond/             # worker accept/reject
  api/bookings/[id]/complete/            # worker submits completion OTP (Part 9 — see README body)
  api/bookings/[id]/review/              # customer submits a review (Part 9)
  api/bookings/[id]/payment/[[gateway]]/ # per-gateway order/payment creation + status poll
  api/payments/razorpay/[[verify,webhook]]/, api/payments/phonepe/webhook/, api/payments/paytm/callback/
  api/job-posts/                         # list/create
  api/job-posts/[id]/, [id]/interest/, [id]/select/   # detail, worker quotes, customer picks one
  api/conversations/mine/, [id]/, [id]/messages/, [id]/read/
  api/notifications/
  auth/login/, auth/forgot-password/, auth/reset-password/, auth/verify-email/,
  auth/signup/customer/, auth/signup/worker/   # functional, minimal styling — Part 15 designs these
  admin/login/                           # role-gated separately from customer/worker login
  (customer)/customer-dashboard/, customer-profile/, customer-account/, customer-bookings/,
             customer-bookings/[id]/pay/, [id]/payment-result/, post-job/, customer-job-posts/[id]/
  (worker)/worker-dashboard/, worker-profile/, worker-account/, worker-bookings/, worker-earnings/
                                          # all role-gated, flat URLs
  (public)/services/                     # the service marketplace search page
  worker/[id]/                           # public worker profile (no phone/email)
components/
  shared/
    LogoutButton.tsx, ChangePasswordForm.tsx, CustomerNav.tsx, WorkerNav.tsx, PublicNav.tsx
  public/
    WorkerCard.tsx      # the marketplace's signature card, per the spec's required fields
    ServiceFilters.tsx  # search/filter panel used by the service page
  booking/
    BookingRequestModal.tsx  # direct-booking creation, from a public worker profile
  chat/
    ChatWindow.tsx  # the whole booking lifecycle lives here: negotiation, cancel, pay-now link,
                     # OTP completion (Part 9), review submission (Part 9)
lib/
  env.ts                  # validated environment variables (extended every Part)
  utils.ts                 # cn() class-name helper
  prisma.ts                 # Prisma Client singleton (driver-adapter mode) + shared TransactionClient type
  redis.ts                   # Redis client singleton (lazy-connecting)
  auth.ts                     # Better Auth server config
  auth-client.ts                # Better Auth React client
  auth-guard.ts                  # requireUser()/requireRole() — the real authorization check
  same-origin.ts                  # CSRF defense-in-depth for custom mutating routes
  rate-limit.ts                    # Redis-backed brute-force lockout (login + OTP attempts)
  settings.ts                       # singleton Settings row upsert
  email.ts                          # console-log in dev, real SMTP once configured
  geolocation.ts                     # browser geolocation wrapper (client-side)
  profile-completion.ts               # completion-percentage calculators
  distance.ts                          # Haversine + bounding-box helpers
  distance-pricing.ts                   # V1's travel-surcharge tiers, wired into booking base price (Part 7)
  worker-search.ts                       # service-page search/ranking query
  pricing.ts                              # booking base price + platform-fee/GST breakdown
  chat-validators.ts                       # Zod schemas: booking, chat, job-post, OTP, review lifecycle
  notifications.ts                          # persisted + live (socket) + optional email, one call site
  socket-server.ts, socket-client.ts         # Redis-adapter Socket.IO server + shared client singleton
  earnings.ts                                 # Part 9: balance + withdrawal-allocation ledger logic
  earnings-validators.ts                       # Part 9: withdrawal request Zod schema
  payment-gateways/
    credentials.ts, validate-request.ts, mark-paid.ts   # shared across all three gateways
    razorpay.ts, phonepe.ts, paytm.ts                     # per-gateway order/verify/webhook logic
  generated/                              # prisma generate output — gitignored, not committed
prisma/
  schema.prisma   # the full data model
  seed.ts         # creates the first Super Admin
server.ts          # custom Node server: Next.js + Socket.IO (dev/VPS/Codespaces; not used by Vercel)
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