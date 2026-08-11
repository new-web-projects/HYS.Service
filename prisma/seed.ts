import "dotenv/config";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

/**
 * There's no public admin signup route — matches the spec (Admin Login
 * exists, Admin Signup doesn't) and V1's own pattern. This is the only way
 * to get the first Super Admin into the database.
 *
 * Goes through auth.api.signUpEmail() rather than prisma.user.create()
 * with a hand-hashed password, so the seeded account is hashed exactly the
 * way Better Auth expects and can log in through the normal /api/auth/login
 * route immediately — no special-cased account.
 */
async function main() {
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  const name = process.env.SEED_SUPERADMIN_NAME ?? "Super Admin";

  if (!email || !password) {
    console.error(
      "Set SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD in .env.local before seeding " +
        "(never hardcode them here).",
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${email} already exists — skipping.`);
    return;
  }

  const result = await auth.api.signUpEmail({
    body: { name, email, password, role: "SUPER_ADMIN" },
    asResponse: true,
  });

  if (!result.ok) {
    const data = await result.json().catch(() => null);
    throw new Error(`Seed signup failed: ${data?.message ?? result.status}`);
  }

  // Skip email verification for the seeded account — there's no one to
  // click the link, and this is the one account allowed to bootstrap
  // itself.
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  });

  console.log(`Super Admin created: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
