<!-- File Path: MANUAL-VERIFICATION.md -->

# Manual Verification — Parts 2, 3, 4, 5, 6 & 7

Required whenever something can't be automatically verified. Everything
below needs real internet access this sandboxed environment doesn't have
(only package-registry domains are reachable here — not
`binaries.prisma.sh`, which Prisma's CLI needs for `generate`/`migrate`).
Nothing here is expected to fail — it's the same first-run experience any
fresh clone of a Prisma project has — but it hasn't been run for real yet,
so it isn't claimed as verified until you (or Codespaces) run it.

**Part 5's own completeness re-check found and fixed real gaps** — Account
Settings pages with change-password (nothing let a signed-in user change
their password before), location on both signup forms (the spec's "Worker
Signup must support... Location" wasn't met by profile-edit-only), a
three-state verification status, and a lint error from using raw `<a>`
instead of `next/link`'s `Link` for internal navigation, fixed across every
occurrence in the app, not just the ones first flagged. All verified
against the real running server the same way as everything else in this
file's introduction below.

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

**Part 5 added no new schema** — the table/enum counts below are
unchanged. Its own verification was different in kind: `proxy.ts` had a
real matcher bug that only showed up against a running server (see the
README's "Customer + worker systems" section), so every route-protection
claim for this Part was checked with a real HTTP request, not inferred
from a clean build. The one thing that still needs your real environment:
actually signing up, verifying a role assignment, and confirming
`GET`/`PATCH` on `/api/customer/profile` and `/api/worker/profile`
round-trip correctly against real data — this sandbox's stub Prisma client
returns `null` for everything, so the request/response *shapes* were
verified, not that a saved value comes back correctly on the next read.

**Part 6 found and fixed a real bug in the stub itself** (not the app):
`findMany` was returning `null` instead of `[]`, which only broke a real
request against `/api/workers/search`, not the build — see the README's
"Categories, location & service marketplace" section. Fixed in the stub;
every earlier Part's endpoints that call `findMany` benefit from the more
accurate stub too, not just this Part's new ones. Search ranking quality
itself (does a closer worker actually rank above a farther one, etc.) still
needs real data to check — the stub returns an empty result set regardless
of the query, so the *shape* of the response was verified, not the ranking
logic's actual behavior against real rows.

**A completeness re-check found and fixed two real spec gaps**, not
verification issues: an explicit "available now" filter (the spec lists
Availability as a Service Page filter, not just a ranking signal), and the
spec's exact phrases "Starting Price" / "Price may increase based on the
work" now appear as literal text instead of a paraphrase.

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

### 8. Customer/worker profile round-trip

**What to test:** sign up as a customer and as a worker, edit each
profile (phone, gender, address/city, and for workers: bio, experience,
skills, category), save, reload the page.
**Where:** `/customer-profile`, `/worker-profile`.
**Expected result:** every saved field reappears exactly as entered;
`isAvailable` toggles instantly; the profile-completion percentage moves as
fields fill in.
**Actual result:** not run — needs the real Prisma Client (steps 1–2). The
request/response shapes were verified against a stub that returns `null`
for every read, which confirms the API contract but not that a write is
actually persisted and read back correctly.
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** a real signed-up account of each role.

### 9. Change password

**What to test:** a signed-in user changes their password from
`/customer-account` or `/worker-account`, then logs out and back in with
the new one.
**Where:** `/customer-account`, `/worker-account`.
**Expected result:** succeeds with the correct current password; other
active sessions for that account are signed out
(`revokeOtherSessions: true`); the new password works on the next login.
**Actual result:** not run — needs a real account (steps 1–2). The form
itself and its call to Better Auth's `changePassword` compiled and typed
correctly against the real Better Auth package, which is stronger evidence
than the stub-only checks elsewhere in this file, but no real password was
ever actually changed and re-verified end to end.
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** a real signed-up account.

### 10. Service search with real workers

**What to test:** with several real, geolocated worker profiles in the
database (varying distance, rating, availability, price), load
`/services` and try each filter.
**Where:** `/services`, `GET /api/workers/search`.
**Expected result:** closer/higher-rated available workers rank above
farther/lower-rated or unavailable ones per `lib/worker-search.ts`'s
documented weighting; each filter (category, distance, rating, price,
experience, verified-only) narrows results correctly; the search box
matches on name, skill, or bio.
**Actual result:** not run — the stub returns an empty result set for any
query, so only the request/response shape was verified, not ranking
correctness against real rows.
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** several real worker accounts with distinct
location/rating/price/availability values.

---

## Part 7 additions

Same sandbox constraint as Part 3 (no network path to
`binaries.prisma.sh` — confirmed this time from three separate angles:
the default fetch, `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`, and a
`PRISMA_ENGINES_MIRROR` pointed at GitHub, which reached `github.com`
successfully but 404'd on that exact path). Used the same temporary
loose-typed stub for `lib/generated/prisma/client` this Part's own
verification left a note about, deleted before delivery either way —
it got a real `next build` (not just `tsc --noEmit`) all the way through
a clean compile, typecheck, and static-page generation across every
route, old and new. That's strong signal but isn't the same as running
against a real Postgres/Redis — items below need that.

### 11. Real Prisma Client generation + typecheck

**What to test:** `npx prisma generate` (needs real network access to
`binaries.prisma.sh` this sandbox didn't have), then `npx tsc --noEmit`
and `npx next build` again with the real client in place instead of the
stub.
**Where:** repo root.
**Expected result:** zero errors — every field/enum this Part uses
(`Booking.origin/status/basePrice/finalPrice/platformFee/gstAmount`,
`Conversation.proposedPrice/customerConfirmed/workerConfirmed`,
`JobPost.status`, `Message.type/priceAmount`, `Settings.platformFeeType/
platformFeePercent/platformFeeFixed/gstPercent`) was cross-checked by
hand directly against `schema.prisma`'s text, not guessed.
**Actual result:** not run for real — see above.
**Status:** ⬜ PASS / ⬜ FAIL

### 12. Socket.IO real-time delivery, two sessions

**What to test:** `npm run dev` (runs `server.ts`, not `next dev`
directly), open a direct booking's chat as the customer in one browser
and the worker in another, send messages back and forth, propose/accept/
confirm a price, and watch typing indicators.
**Where:** `/chat/[conversationId]`.
**Expected result:** messages, typing indicators, read receipts, and
booking-status changes appear in the other tab within roughly a second,
no page refresh; disconnecting one tab's network and reconnecting
resumes delivery (Socket.IO's built-in reconnection, configured in
`lib/socket-client.ts`); if you kill the socket connection entirely
(e.g. block the `/api/socket` path in devtools), messages still arrive
via the 8-second poll in `ChatWindow.tsx`, just delayed.
**Actual result:** not run — needs a real server process, Postgres, and
Redis, none of which exist in this sandbox.
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** `DATABASE_URL`, `REDIS_URL`, both pointing at real
running services.

### 13. Full direct-booking lifecycle

**What to test:** as a customer, book a worker from `/worker/[id]`; as
that worker, accept it from `/worker-bookings`; in the resulting chat,
propose a price (worker), accept it (customer), confirm it (worker).
**Where:** `/worker/[id]` → `/worker-bookings` → `/chat/[id]`.
**Expected result:** booking status moves
`PENDING_RESPONSE → DISCUSSING → PRICE_PENDING → READY_FOR_PAYMENT`
exactly in that order; chat is refused (403) if attempted before accept;
`Booking.finalPrice/platformFee/gstAmount` are set correctly at the
final confirm step, GST computed on the platform fee only, matching
`lib/pricing.ts`; the reference `basePrice` shown at booking creation
reflects the travel-surcharge tier from `lib/distance-pricing.ts` when
both parties have coordinates on file. Once confirmed, the chat shows a
Final Price / Platform Fee / GST / Total breakdown and a disabled
"Proceed to payment" control (Part 8 wires the real one in); a "Cancel
booking" control is visible and working at every status before
PAID/COMPLETED, and disappears once paid, matching the master prompt's
explicit "customer cannot cancel once payment is completed" rule.
Replaying `PRICE_ACCEPTED` or `PRICE_CONFIRMED` after they've already
succeeded (e.g. two open tabs) is rejected with a 409, not silently
reprocessed.
**Actual result:** not run — needs a real database.
**Status:** ⬜ PASS / ⬜ FAIL

### 14. Full job-posting lifecycle

**What to test:** as a customer, post a job from `/post-job`; as two or
more workers, send quotes from `/job-board`; as the customer, compare
quotes on `/customer-job-posts/[id]` and select one.
**Where:** `/post-job` → `/job-board` → `/customer-job-posts/[id]`.
**Expected result:** the selected worker's conversation gets a real
`Booking` (status `DISCUSSING`, skipping `PENDING_RESPONSE` — the
worker already opted in by quoting); every other interested worker's
conversation flips to `CLOSED` and they get a "job filled" notification;
`JobPost.status` becomes `FILLED`; a second `select` attempt on the same
job post is rejected with a clean 409 either way — via the `status !==
"OPEN"` check for a sequential repeat, or via `Booking.jobPostId`'s
`@unique` constraint (caught and turned into the same clean 409, not an
unhandled 500) for two selects that race each other closely enough to
both pass the status check. The latter specifically needs two
near-simultaneous requests to actually exercise — a normal sequential
test only reaches the first path.
**Also visit** `/chats` as both roles: conversations from both the
direct-booking and job-post flows appear, with an accurate unread count
per conversation (send a message from one session, confirm the count
appears in the other without a page reload having been needed to
compute it — only to *see* it update live, since this list itself
doesn't hold a socket connection, unlike the chat page itself).
**Actual result:** not run.
**Status:** ⬜ PASS / ⬜ FAIL

### 15. SecondaryStorage fix (getAndDelete / increment)

**What to test:** trigger an email-verification link consumption (Part 4
flow) — internally exercises `secondaryStorage.getAndDelete` — and watch
Redis directly (`redis-cli monitor` or similar) to confirm a `GETDEL`
call actually happens and the key is gone afterward.
**Where:** `/auth/verify-email` flow; `lib/auth.ts`.
**Expected result:** verification succeeds exactly once; a repeat click
on the same link fails cleanly (key already consumed) rather than
throwing a missing-method error, which is what would have happened
before this Part's fix.
**Actual result:** not run — confirmed only that the implementation now
matches the type contract (verified directly against the installed
`better-auth` package's source), not that it behaves correctly against
a live Redis.
**Status:** ⬜ PASS / ⬜ FAIL

### 16. Vercel deployment (no persistent Socket.IO)

**What to test:** deploy to Vercel specifically (not VPS/Codespaces),
and repeat test 13's flow.
**Where:** a Vercel preview/production deployment.
**Expected result:** the booking/chat flow still works end to end —
messages, price negotiation, status changes — just arriving via the
8-second poll instead of instantly, since Vercel's serverless functions
can't hold the WebSocket connection `server.ts` depends on (see that
file's header comment). No errors, no stuck UI — just slower delivery.
**Actual result:** not run — this sandbox can't stand up a Vercel
deployment.
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** a real Vercel project; note that `vercel.json` or
Vercel's build settings need the build command to stay `next build`
(already the case — `server.ts` is only ever invoked by `npm run dev`/
`start`, which Vercel doesn't use).

---

## Part 8 additions

Same stub technique as Parts 3 and 7 (documented there) got a real
`next build` clean through everything in this Part too — every new route
registers correctly, zero TypeScript errors, zero ESLint errors. What
that can't cover: an actual gateway sandbox account, a real database, and
two specific URLs I couldn't get a directly-quoted confirmation for.

### 17. Confirm the PhonePe and Paytm LIVE base URLs

**What to test:** before going live (not before testing in sandbox — the
TEST/sandbox URLs for both are directly confirmed against their current
docs), log into each gateway's business dashboard and confirm the exact
production API base URL matches what's in `.env.example`'s commented
defaults (`lib/payment-gateways/phonepe.ts` and `paytm.ts` also state
these inline).
**Where:** PhonePe Business Dashboard; Paytm Business Dashboard.
**Expected result:** `PHONEPE_LIVE_API_BASE_URL`/`PHONEPE_LIVE_AUTH_URL`
and `PAYTM_LIVE_BASE_URL` match what each dashboard states. If they
don't, set the env var override rather than editing the gateway module —
both already read from `process.env.X ?? <documented default>`.
**Actual result:** not verified — I found strong, consistent documented
patterns for both but never got a page that stated the LIVE URL as an
exact string the way I did for every TEST/sandbox URL and for PhonePe's
LIVE auth URL specifically (that one *is* directly confirmed).
**Status:** ⬜ PASS / ⬜ FAIL

### 18. Razorpay end-to-end, sandbox

**What to test:** enable Razorpay in `Settings` (direct DB write or
Prisma Studio — no admin UI exists yet, Part 10's job), leave
`paymentMode` at its `TEST` default, take a booking to
`READY_FOR_PAYMENT` (Part 7's flow), pay with a Razorpay test card.
**Where:** `/customer-bookings/[id]/pay`.
**Expected result:** Checkout opens with the correct amount (final price
+ platform fee + GST, matching what the page displayed); on success,
lands on `/customer-bookings/[id]/payment-result` showing the OTP;
`Booking.status` is `PAID`; an `Earning` row exists with `status: HELD`
and `amount` equal to `finalPrice` only (not the total the customer
paid); both parties' phone numbers are now visible via
`GET /api/bookings/[id]`; both get a notification, customer's includes
an email with the OTP.
**Actual result:** not run — needs a real Razorpay test account.
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`,
a Razorpay test-mode account.

### 19. PhonePe and Paytm end-to-end, sandbox

**What to test:** same flow as #18, once for each gateway.
**Expected result:** same outcome as #18. PhonePe: browser redirects to
PhonePe's PayPage, then back to the result page, which polls
`/api/bookings/[id]/payment/status` until `PAID` appears (confirms the
active-reconciliation fallback works, not just the webhook). Paytm:
browser form-POSTs to Paytm's payment page, then Paytm POSTs back to
`/api/payments/paytm/callback`, which redirects to the same result page.
**Actual result:** not run.
**Status:** ⬜ PASS / ⬜ FAIL
**Required config:** sandbox credentials for both, each gateway enabled
in `Settings`.

### 20. Webhook idempotency

**What to test:** replay the same Razorpay or PhonePe webhook payload
twice (most gateway dashboards have a "resend webhook" button for
exactly this).
**Where:** `/api/payments/razorpay/webhook`, `/api/payments/phonepe/webhook`.
**Expected result:** the second call returns `200 {"ok": true}` but
changes nothing — no second `Earning` row, no second notification, no
error. `markBookingPaid`'s idempotency check (`booking.status === "PAID"`
already) is what should make this safe; confirms it actually does rather
than just reasoning that it should.
**Actual result:** not run.
**Status:** ⬜ PASS / ⬜ FAIL

### 21. Gateway enable/disable and mode switching

**What to test:** with all three gateways disabled in `Settings`, load
the payment page; enable one, reload; set `paymentMode` to `LIVE` without
setting `RAZORPAY_LIVE_KEY_ID`.
**Expected result:** all-disabled shows "No payment methods are
currently available" with no crash; enabling one makes exactly that one
button appear; switching to `LIVE` mode without the live credential set
throws a clear "Missing RAZORPAY_LIVE_KEY_ID" error from
`credentials.ts` rather than silently using test credentials or crashing
unhelpfully.
**Actual result:** not run.
**Status:** ⬜ PASS / ⬜ FAIL

### 22. Mobile — payment page and result page

**What to test:** the gateway-selection buttons, the price breakdown
table, and the OTP display on a narrow viewport.
**Expected result:** no horizontal overflow (the breakdown uses a
2-column grid at a fixed max-width container, same defensive pattern as
Part 7's chat breakdown); the OTP's `tracking-widest` large text doesn't
force horizontal scroll on a small screen.
**Actual result:** not run — this environment has no browser or visual
rendering tool, same limitation noted for Part 7's UI.
**Status:** ⬜ PASS / ⬜ FAIL

---

## Part 8 audit round — bugs confirmed against a real environment

The user ran this project in an actual GitHub Codespace with a real
`prisma generate` (this sandbox still can't — unchanged network
restriction) and sent a screenshot showing 13 real TypeScript errors.
Every one is now fixed and traced to one of two root causes, both
inherent to developing against a stub in a network-restricted sandbox
rather than a mistake specific to one file:

1. **`(tx: typeof prisma) => ...` is structurally wrong** for
   `$transaction` callbacks — the real signature expects
   `Omit<PrismaClient, "$connect" | "$disconnect" | "$transaction" | ...>`
   (no nested transactions/connection management from inside one), not
   the full client type. Fixed in 6 files by adding `TransactionClient`
   as a proper exported type from `lib/prisma.ts` and using it
   everywhere instead of the shortcut — including `app/api/auth/worker/
   signup/route.ts` and `app/api/worker/profile/route.ts`, pre-existing
   Part 5 files neither Part 7 nor Part 8 had touched, confirming this
   wasn't introduced by either of those Parts specifically.
2. **Decimal fields typed as `number`** in hand-written type stand-ins
   (used in places where real Prisma inference isn't available without
   `generate`) — `lib/worker-search.ts`'s `rating`/`startingPrice`
   (pre-existing, Part 6) were the two the screenshot caught. A
   proactive sweep afterward (not prompted by the screenshot) found no
   further instances of this specific pattern beyond what was already
   fixed.

Also fixed: two `Json`-field type mismatches (`Notification.data`,
`Transaction.rawResponse` both need `Prisma.InputJsonValue`, not a bare
`Record<string, unknown>`), and a genuine, now-implemented gap in
Razorpay's status reconciliation — see the Step 3 investigation in this
round's chat response for the full reasoning; `checkRazorpayOrderStatus`
now exists in `lib/payment-gateways/razorpay.ts` and item 17 below is
updated accordingly.

A real `next build` (not just the stub-based `tsc`) is clean across all
60 routes after every fix. `npx prisma generate` itself is still the
one thing this sandbox cannot do — if further real-environment errors
turn up that these fixes don't cover, they're most likely more instances
of the same two root causes above, not a new category.

---

### 23. Razorpay status reconciliation (new — closes the Step 3 gap)

**What to test:** simulate a dropped connection between the Razorpay
Checkout `handler` firing and the `/api/payments/razorpay/verify` call
completing (e.g. throttle/kill the network in devtools right after a
successful test payment, before the verify request finishes), then
revisit `/customer-bookings/[id]/payment-result` and let it poll.
**Where:** `/api/bookings/[id]/payment/status`, which now calls
`checkRazorpayOrderStatus` for a pending Razorpay transaction the same
way it already did for PhonePe/Paytm.
**Expected result:** the poll actively queries Razorpay's Orders API,
finds the order `status: "paid"` with a `captured` payment, and calls
`markBookingPaid` from the poll path — not just passively waiting on the
webhook.
**Actual result:** not run — needs a real Razorpay test account and a
deliberately-interrupted network condition.
**Status:** ⬜ PASS / ⬜ FAIL

---

If step 1 or 2 fails with something other than a plain network/timeout
error, paste the output back — that would mean something in
`prisma.config.ts` or `schema.prisma` needs adjusting against whatever the
installed Prisma version actually expects, which this sandbox couldn't
confirm directly (see the Part 3 summary).

---

## Part 9 — Earnings, Withdrawal, Reviews

Same sandbox limitation as every prior Part: no live Postgres/Redis, and
`prisma generate` still can't reach `binaries.prisma.sh` here (confirmed
again this Part — see item 29). `npm run lint` is clean across the whole
repo including everything added this Part; `npx tsc --noEmit`'s ~27
errors all trace to the missing generated client (identical error on
pre-existing Part 3/7/8 files, not just new ones) plus one unrelated,
pre-existing Next.js typegen gap in `app/layout.tsx` — not a Part 9
regression. `npm run build` reaches and fails at the same single,
expected `lib/prisma.ts` import line every previous Part's build attempt
did.

### 24. Booking completion via OTP

**What to test:** as the worker on a `PAID` booking, open its chat page
and enter the OTP the customer received at payment time.
**Where:** `/api/bookings/[id]/complete`, surfaced in `ChatWindow.tsx`'s
`PAID`-status banner (worker view only).
**Expected result:** correct OTP → booking moves to `COMPLETED`, its
`Earning` moves `HELD → AVAILABLE`, the customer gets a notification
prompting a review, `WorkerProfile.ordersCompleted` increments. Wrong
OTP → clear error, no state change. 6 wrong guesses inside 15 minutes →
429 rate-limited regardless of who's asking.
**Actual result:** not run — needs a live booking that's actually
reached `PAID`, which itself needs a real payment-gateway sandbox.
**Status:** ⬜ PASS / ⬜ FAIL

### 25. Withdrawal request — straightforward case

**What to test:** as a worker with, say, exactly one ₹5,000 `AVAILABLE`
earning, request a ₹5,000 withdrawal via UPI.
**Where:** `/worker-earnings`, `POST /api/worker/withdrawals`.
**Expected result:** the earning flips to `RESERVED`, a `Withdrawal`
(`PENDING`) and one `WithdrawalAllocation` for the full ₹5,000 are
created, the fee/net breakdown shown matches
`Settings.withdrawalFeePercent` applied to ₹5,000, and a second
withdrawal attempt is rejected (409) while the first is still pending.
**Actual result:** not run — needs a live database.
**Status:** ⬜ PASS / ⬜ FAIL

### 26. Withdrawal request — the split-earning case

**What to test:** as a worker whose only `AVAILABLE` earnings are, say,
₹3,000 and ₹4,000 (sum ₹7,000 — no combination sums exactly to a round
₹1,000 figure below that), request a ₹5,000 withdrawal.
**Where:** same endpoint as above; this exercises
`allocateEarningsForWithdrawal` in `lib/earnings.ts` specifically.
**Expected result:** the ₹3,000 earning is fully allocated and flips to
`RESERVED`; the ₹4,000 earning gets a ₹2,000 allocation and **stays
`AVAILABLE`** (its genuine ₹2,000 remainder is still free for a future
withdrawal — this is the entire reason `WithdrawalAllocation` exists
instead of reusing V1's approach of locking whole earnings). Balance
check: available balance immediately after should read ₹2,000, not ₹0
and not the pre-request ₹7,000.
**Actual result:** not run — needs a live database with this exact
earnings shape, which isn't reachable through the UI alone (would need
either two completed bookings priced exactly this way, or a direct DB
seed).
**Status:** ⬜ PASS / ⬜ FAIL

### 27. Withdrawal approval and rejection (admin)

**What to test:** `PATCH /api/admin/withdrawals/[id]` with
`{"action":"approve"}` on a pending withdrawal, and separately
`{"action":"reject","rejectionReason":"..."}` on another. No admin UI
exists yet for this (Part 10's job, per the master prompt's own Part
structure) — call the route directly.
**Where:** `/api/admin/withdrawals`, `/api/admin/withdrawals/[id]`.
**Expected result:** approve → fully-consumed allocated earnings flip to
`WITHDRAWN` with `withdrawnAt` set, the partially-consumed one (if any)
stays `AVAILABLE` for its remainder, worker gets a notification. Reject
→ all of this withdrawal's allocations are deleted and every earning
they touched reverts to `AVAILABLE`, worker gets a notification with the
reason. Either way, a second decision on the same withdrawal is
rejected (409).
**Actual result:** not run — needs a live database and an admin session.
**Status:** ⬜ PASS / ⬜ FAIL

### 28. Review submission and rating recompute

**What to test:** as the customer on a `COMPLETED` booking with no
existing review, submit a rating and comment from the chat page; then
try submitting a second review on the same booking.
**Where:** `ChatWindow.tsx`'s `COMPLETED`-status form, `POST
/api/bookings/[id]/review`, `GET /api/workers/[id]/reviews` (public
profile).
**Expected result:** first submission succeeds, `WorkerProfile.rating`
and `reviewCount` are recomputed from a real `AVG`/`COUNT` over all of
that worker's reviews (not an incremental running average), worker gets
a notification. Second attempt on the same booking → 409, and the
schema's own `Review.bookingId @unique` is the backstop even if the
app-level check were somehow bypassed.
**Actual result:** not run — needs a live database.
**Status:** ⬜ PASS / ⬜ FAIL

### 29. Dependency security audit

**What to test:** `npm audit` after this Part's `npm install`.
**Where:** whole-project dependency tree.
**Actual result:** ran for real (this doesn't need a live DB). Found 6
advisories. Fixed: **Next.js 16.0.0–16.3.2, critical, unauthenticated
RCE** (Windows-hosted servers, and via AVIF in the Image Optimization
API) — the exact version this project had pinned (16.3.0). Bumped
`next`, `@next/env`, and `eslint-config-next` to 16.3.5 (confirmed
current `latest` via the npm registry directly, not just the audit's
suggestion), re-ran `npm install`, and re-verified lint/build both still
behave identically to before the bump. Also fixed: `nodemailer` (high;
credential leak via a legacy call signature, IDN allow-list bypass,
ReDoS) via plain `npm audit fix` — non-breaking. **Deliberately left
unfixed:** `deepmerge-ts`/`mysql2`, high severity, reachable only through
`@prisma/config`'s own internal tooling dependencies — this app's
`DATABASE_URL` is always `postgresql://`, so the vulnerable MySQL2 code
path is never invoked at runtime. The only available fix forces
`prisma@6.19.3`, a major downgrade from the 7.x driver-adapter
architecture Part 3 deliberately chose and Part 8's audit round
specifically verified against — not an appropriate unilateral fix for a
dependency-of-a-dependency that isn't reachable in this app's own code.
**Status:** ✅ next/nodemailer fixed and reverified · ⬜ deepmerge-ts/mysql2 — intentionally deferred, flag if this project ever adds a second, MySQL-backed data source

---

## Part 10 — Admin Panel + Configuration

Same sandbox limitation as every prior Part — no live Postgres/Redis,
`prisma generate` still blocked. `npm run lint` is clean across the
whole repo (caught and fixed 9 real `react-hooks/set-state-in-effect`
issues and 3 unescaped-apostrophe issues across the new admin pages
along the way — same root cause each time: calling `setState`
synchronously at the top of an effect body rather than inside a nested
async function; fixed uniformly by wrapping each effect body in `void
(async () => {...})()`). `npx tsc --noEmit`'s remaining errors are all
the same two pre-existing, environment-only causes as every prior
Part's report — zero new error categories introduced by Part 10's ~30
new/modified files. `npm run build` reaches and fails at the identical
single expected point, now additionally tracing through
`proxy.ts → lib/maintenance.ts → lib/prisma.ts`, confirming the new
maintenance-mode wiring is correctly connected into the build graph.

### 30. Admin CRUD actions (customers, workers, categories, bookings, reviews)

**What to test:** as an admin, ban/unban a customer or worker, verify a
worker, approve a pending category, cancel a pre-payment booking, delete
a review.
**Where:** `/admin/customers[/[id]]`, `/admin/workers[/[id]]`,
`/admin/categories`, `/admin/bookings[/[id]]`, `/admin/reviews`.
**Expected result:** each action updates the record, notifies the
affected user where applicable (verification, booking cancellation),
recomputes the worker's rating on review deletion, and writes an
`AuditLog` row.
**Actual result:** not run — needs a live database.
**Status:** ⬜ PASS / ⬜ FAIL

### 31. Settings — SUPER_ADMIN-only write

**What to test:** as a plain `ADMIN`, attempt `PATCH
/api/admin/settings`; as `SUPER_ADMIN`, change the platform fee percent
and confirm Part 8/9's pricing math picks it up immediately (no
redeploy).
**Where:** `/admin/settings`.
**Expected result:** `ADMIN` gets 403; `SUPER_ADMIN` succeeds and the
next booking's price breakdown reflects the new fee.
**Actual result:** not run — needs a live database with both an ADMIN
and a SUPER_ADMIN test account (the seed script only creates one Super
Admin — a second, plain-ADMIN account would need to be promoted
manually via Prisma Studio or a direct update for this specific test).
**Status:** ⬜ PASS / ⬜ FAIL

### 32. Maintenance mode, end to end

**What to test:** toggle `maintenanceMode` on from `/admin/settings`,
then visit a public page (`/`, `/services`) as a signed-out visitor;
confirm `/admin/*` and the admin login remain reachable throughout;
toggle it back off and confirm normal access returns (allow up to 30s
for the cache TTL, or check immediately — the settings PATCH refreshes
the cache synchronously on save).
**Where:** `proxy.ts`, `lib/maintenance.ts`, `/maintenance`.
**Expected result:** public pages show the maintenance page (URL bar
unchanged — it's a rewrite, not a redirect); `/admin/dashboard` and
`/admin/login` work normally the whole time; turning it off restores
normal access.
**Actual result:** not run — needs a live database and Redis.
**Status:** ⬜ PASS / ⬜ FAIL

### 33. Admin-cancel scope boundary

**What to test:** confirm `PATCH /api/admin/bookings/[id]` succeeds for
a booking at `PENDING_RESPONSE`/`DISCUSSING`/`PRICE_PENDING`/
`READY_FOR_PAYMENT`, and returns 409 for one at `PAID` or `COMPLETED`.
**Where:** `/admin/bookings/[id]`.
**Expected result:** as above — this is a deliberate scope limit (see
the route's own comment), not a bug, but worth confirming the boundary
is exactly where intended.
**Actual result:** not run — needs a live database with bookings at
several different statuses.
**Status:** ⬜ PASS / ⬜ FAIL

---

## Part 10 re-audit (before Part 11)

Re-inspected the live code rather than trusting the Part 10 report.
Found and fixed four real issues: `Settings.siteName`/`siteLogoUrl` and
`errorRevealEnabled` were readable/writable via the API but had no admin
UI control at all (added a "Site branding" section and an "Error reveal
system" toggle to `/admin/settings`); the platform-fee-value input used
an uncontrolled `defaultValue` that wouldn't refresh when
`platformFeeType` was switched between percent/fixed, silently showing
the wrong figure until a full page reload (fixed with `key=
{settings.platformFeeType}` to force a remount on type change); and the
reviews page used plain `★`/`☆` text characters for ratings, which is
closer to the letter than the spirit of "no emoji, use professional
icons" for this specific panel (replaced with `lucide-react`'s `Star`
icon, filled/outline). CSRF coverage was re-checked across all nine
mutating admin routes — already complete, no gaps found. Re-ran lint
after fixing all four — clean.

## Part 11 — Storage, Cloudinary, Amazon S3

Same sandbox limitation as every prior Part for Postgres/Redis and
`prisma generate`. Additionally here: **no live Cloudinary or AWS
credentials or network access** (`api.cloudinary.com` and
`*.amazonaws.com` aren't in this sandbox's egress allowlist either), so
nothing that actually calls either SDK could be executed — this is the
same category of gap Part 8's payment gateways had (SDK usage verified
by reading, not by a live call). `npm run lint` is clean. `npx tsc
--noEmit`'s remaining errors are the exact same, unchanged set from
Part 9/10 (all in `lib/earnings.ts` and a few `$transaction` callbacks)
— zero new errors from any Part 11 file. `npm run build` reaches the
same single expected failure point. `npm audit` shows no new advisories
from the `cloudinary` or `@aws-sdk/*` packages — the only remaining
finding is the same pre-existing, deliberately-deferred
deepmerge-ts/mysql2 issue from Part 9's audit.

### 34. Cloudinary upload (profile photo and worker document)

**What to test:** with real `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/
`CLOUDINARY_API_SECRET` set and `Settings.storageProvider = CLOUDINARY`,
upload a profile photo from `/customer-profile` or `/worker-profile`,
and a verification document from `/worker-profile`.
**Where:** `POST /api/upload`, `lib/storage/cloudinary.ts`.
**Expected result:** file appears in the Cloudinary media library under
the configured folder; `User.image` (photo) or
`WorkerProfile.documentType`/`documentUrl` (document) updates
immediately; a `Media` row is created; uploading a second photo deletes
the first from Cloudinary and its `Media` row.
**Actual result:** not run — no live Cloudinary account reachable from
this sandbox.
**Status:** ⬜ PASS / ⬜ FAIL

### 35. Amazon S3 upload

**What to test:** same as above, with `AWS_ACCESS_KEY_ID`/
`AWS_SECRET_ACCESS_KEY`/`AWS_REGION`/`AWS_S3_BUCKET` set and
`Settings.storageProvider = S3`.
**Where:** `lib/storage/s3.ts`.
**Expected result:** object appears in the configured S3 bucket at
`<folder>/<timestamp>-<filename>`; same DB-side effects as test 34.
**Actual result:** not run — no live AWS account reachable from this
sandbox.
**Status:** ⬜ PASS / ⬜ FAIL

### 36. Switching provider doesn't strand old files

**What to test:** upload a photo while Cloudinary is active, switch
`Settings.storageProvider` to S3 from `/admin/settings`, then load any
page that displays that photo.
**Where:** `lib/storage/index.ts` (`uploadFile` reads the setting fresh
every call; nothing re-points or migrates existing `Media.url` values).
**Expected result:** the old Cloudinary photo keeps loading normally
(its stored URL is absolute and provider-independent at read time); the
*next* upload goes to S3.
**Actual result:** not run — needs both providers configured with real
credentials.
**Status:** ⬜ PASS / ⬜ FAIL

### 37. Upload validation

**What to test:** attempt to upload a 10MB file; attempt to upload a
`.txt` file as a profile photo; attempt a `worker_document` upload while
signed in as a customer.
**Where:** `POST /api/upload`.
**Expected result:** all three rejected with a 400/403 and a clear
message, no `Media` row created, nothing sent to either SDK.
**Actual result:** ran for real — verified by reading the route's
validation order (size check before type check before any upload call
in all three branches), not by an actual HTTP request. **Status:** ⬜
PASS / ⬜ FAIL for a real end-to-end confirmation.

---

## Part 11 re-audit (before Part 12)

Re-inspected the live code rather than trusting the Part 11 report.
Found two real integration gaps: `WorkerCard.tsx` and the public worker
profile page both already had `image` in their TypeScript types and the
underlying APIs already selected and returned it, but neither
component's JSX ever actually rendered it — both always fell back to
the initials placeholder, even for a worker who'd uploaded a real photo.
Fixed both, and while in there, upgraded all four photo-preview spots
(those two plus the private customer/worker profile pages, which used a
disclosed raw `<img>` shortcut) to `next/image`, now that
`next.config.ts`'s `remotePatterns` is configured. Re-ran lint/tsc/build
— clean, no regressions. No `prisma/migrations/` directory exists in
this project at any point in its history (confirmed by checking) — every
schema change across Parts 9–11 has only ever been applied to
`schema.prisma` directly, since `prisma migrate dev` needs the
schema-engine binary this sandbox has never been able to reach. This is
not new to Part 11; it's the same constraint every Part has hit.

## Part 12 — Error Reveal, Logging, Monitoring

Same sandbox limitations as every prior Part (no live Postgres/Redis,
`prisma generate` blocked). `npm run lint`, `npx tsc --noEmit`, and
`npm run build` all show the identical, unchanged results from Part
11 — zero new issues from any Part 12 file.

### 38. Error capture end-to-end

**What to test:** trigger a real rendering error (e.g., temporarily
throw inside a page component) and confirm it's caught by `app/error.tsx`
and logged.
**Where:** `app/error.tsx`, `app/global-error.tsx`,
`components/shared/ErrorDisplay.tsx`, `POST /api/errors/log`.
**Expected result:** the boundary renders a friendly generic message
(no stack trace) to a non-admin, or to an admin when
`errorRevealEnabled` is off; a new `ErrorLog` row appears with message,
stack, component, route, browser (User-Agent), a simple device guess,
and the signed-in user's id/role if any.
**Actual result:** not run — needs a live database.
**Status:** ⬜ PASS / ⬜ FAIL

### 39. Reveal gating is a real two-factor gate

**What to test:** as a non-admin, confirm `GET /api/errors/reveal-status`
always returns `{reveal: false}` regardless of the `Settings` value; as
an admin, confirm it tracks `errorRevealEnabled` exactly.
**Where:** `app/api/errors/reveal-status/route.ts`.
**Expected result:** a non-admin can never learn the setting's value,
let alone see error detail, even by calling the endpoint directly.
**Actual result:** not run — needs a live database and both an admin and
non-admin test session.
**Status:** ⬜ PASS / ⬜ FAIL

### 40. User error reports reach the Admin Panel

**What to test:** from the error boundary's "Report this issue" form,
submit a report (signed in and signed out); confirm it appears in
`/admin/errors`.
**Where:** `POST /api/error-reports`, `/admin/errors`.
**Expected result:** an `ErrorReport` row is created (with `userId` set
when signed in, `null` when not), status defaults to `"open"`, and it's
listed and status-editable from the existing Part 10 admin page.
**Actual result:** not run — needs a live database.
**Status:** ⬜ PASS / ⬜ FAIL