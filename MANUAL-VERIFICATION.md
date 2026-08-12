# Manual Verification — Parts 2, 3 & 4

Required whenever something can't be automatically verified. Everything
below needs real internet access this sandboxed environment doesn't have
(only package-registry domains are reachable here — not
`binaries.prisma.sh`, which Prisma's CLI needs for `generate`/`migrate`).
Nothing here is expected to fail — it's the same first-run experience any
fresh clone of a Prisma project has — but it hasn't been run for real yet,
so it isn't claimed as verified until you (or Codespaces) run it.

**How Part 4 was verified despite this**, briefly, since it's a different
technique than Part 3 used: `better-auth generate` doesn't need the blocked
binary (it's pure Node), so it *could* run — but it still imports
`lib/auth.ts` → `lib/prisma.ts` → the missing generated client. A minimal
temporary stub (deleted after) let it run for real, and its output was
diffed against the hand-written `User`/`Session`/`Account`/`Verification`
models line by line — several real differences turned up and are now fixed
in `schema.prisma` (see its own comment above the `User` model). The same
stub technique, made deliberately loose-typed, then let a full
`npm run build` get past the known missing-client error and catch real
TypeScript and runtime bugs unrelated to Prisma's exact types — across two
build rounds (initial + a completeness re-check), that caught: Better
Auth's client not knowing about the custom `role` field, an implicit-`any`
transaction parameter, an eagerly-connecting Redis client opening
connections during `next build` itself, a wrong client method name
(`forgetPassword` vs. the actually-installed version's
`requestPasswordReset` — confirmed empirically, not guessed), and a missing
Suspense boundary around `useSearchParams()`. All fixed. Everything that
*could* run against real local Postgres/Redis was run against real local
Postgres/Redis, not stubbed — see the README's verification section.

**A completeness re-check also caught one real bug** the build couldn't:
`proxy.ts` was redirecting `/admin/login` itself to `/auth/login` (it
matched the `/admin` protected prefix), making the admin login page
unreachable — `next build` has no way to catch a logic bug like this, only
an actual request does. Verified fixed with a real HTTP request against the
running server: `/admin/login` now returns `200`, `/admin` (no session)
still correctly redirects. Also added in that pass: CSRF/same-origin
protection on the three custom auth routes (V1 had this on every mutating
route; the new custom routes didn't yet), verified by sending a real
cross-origin POST (rejected, `403`) and a real same-origin one (processed
normally, `401` for bad credentials) against the running server.

---

### 1. Prisma Client generation

**What to test:** `npx prisma generate` reads `prisma/schema.prisma` and
`prisma.config.ts` and writes the generated client.
**Where:** project root, after `npm install`.
**Expected result:** completes with no errors; creates
`lib/generated/prisma/` (gitignored — regenerated, never committed). No
network needed beyond the one-time engine download on first run.
**Actual result:** not run — blocked by this sandbox's network allowlist.
**Status:** ⬜ PASS / ⬜ FAIL — *to be filled in after you run it.*
**Required config:** none beyond what's already in `.env.example`.

### 2. Initial migration

**What to test:** `npx prisma migrate dev --name init` diffs the (empty)
database against `schema.prisma` and applies the first migration.
**Where:** project root, `DATABASE_URL`/`DIRECT_URL` pointing at a running
Postgres (`docker compose up -d` gives you one on `localhost:5432` with the
credentials already in `.env.example`).
**Expected result:** creates `prisma/migrations/<timestamp>_init/`, applies
it, and reports success. The resulting schema should match what this Part
verified by hand: **24 tables, 15 enum types** (see the table list under
"How this Part was verified" in the README — `skills`/`gender` are new
columns on existing tables, not new tables; `Gender` is the one new enum).
**Actual result:** not run — same network limitation as above.
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** `DATABASE_URL` and `DIRECT_URL` in `.env.local`.

### 3. Full production build

**What to test:** `npm run build` after steps 1–2 have run.
**Where:** project root.
**Expected result:** succeeds cleanly with zero errors — this was already
proven true against a temporary stub client (see the note above); the real
generated client only needs to match the stub's shape closely enough for
TypeScript to agree, which `prisma generate` guarantees since it's
generated directly from the same `schema.prisma`.
**Actual result:** verified against a temporary stub, not the real
generated client (see above). If this *still* fails after a real
`prisma generate`, that's new information worth reporting back.
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** same as above.

### 4. Local services via Docker Compose

**What to test:** `docker compose up -d` brings up Postgres and Redis with
passing healthchecks.
**Where:** project root.
**Expected result:** `docker compose ps` shows both `postgres` and `redis`
as `healthy` within ~10 seconds.
**Actual result:** not run — this sandbox has no Docker daemon. (Postgres
and Redis themselves *were* verified directly, just installed as native
packages rather than through Compose — see the README's verification
section for what that covered.)
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** Docker / Docker Compose installed (already true in
Codespaces).

### 5. Codespaces end-to-end

**What to test:** opening the repo in a fresh GitHub Codespace runs
`postCreateCommand` (`npm install && npx prisma generate`) automatically
and the dev server comes up clean.
**Where:** GitHub Codespaces.
**Expected result:** container builds, both extra services in
`docker-compose.yml` are healthy, `npm run dev` serves the homepage and
`/api/health` on the forwarded port.
**Actual result:** not run — this was built and verified outside Codespaces
itself.
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** a GitHub account with Codespaces access; no other
credentials needed for this Part specifically.

### 6. Seed the first Super Admin

**What to test:** `npm run db:seed` creates the initial admin account via
Better Auth's own signup path (see `prisma/seed.ts`'s comment for why not a
raw insert).
**Where:** project root, after migration.
**Expected result:** logs `Super Admin created: <email>`; that account can
then log in at `/admin/login` and reach role `SUPER_ADMIN`.
**Actual result:** not run — depends on steps 1–2.
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** `SEED_SUPERADMIN_EMAIL` and `SEED_SUPERADMIN_PASSWORD`
in `.env.local`. Rotate or remove the password after first login.

### 7. Email verification / password reset links

**What to test:** signing up (customer or worker) triggers a verification
email; requesting a password reset triggers a reset email.
**Where:** `/auth/signup/customer`, `/auth/signup/worker`, and a
forgot-password flow (page not yet built — Part 5).
**Expected result:** without `SMTP_HOST` set, the email is logged to the
server console instead of sent (`lib/email.ts`) — enough to copy the link
by hand and confirm it verifies the account / resets the password
correctly. With real SMTP credentials, an actual email arrives.
**Actual result:** not run — depends on steps 1–2 for a real user to exist.
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** none for the console-log path; SMTP credentials for a
real send.

---

If step 1 or 2 fails with something other than a plain network/timeout
error, paste the output back — that would mean something in
`prisma.config.ts` or `schema.prisma` needs adjusting against whatever the
installed Prisma version actually expects, which this sandbox couldn't
confirm directly (see the Part 3 summary).
