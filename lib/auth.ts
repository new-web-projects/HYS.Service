import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * bcrypt instead of Better Auth's default hashing: the spec calls for
 * "bcrypt or argon2" by name, and it keeps V2 hash-compatible with V1's
 * existing Admin table (also bcrypt) if those accounts are ever migrated
 * instead of reset.
 *
 * Role/phone/gender live on the base User model (see schema.prisma) rather
 * than only on the role-specific profile tables, because every account has
 * them regardless of role — additionalFields is Better Auth's supported way
 * to extend the core user table without forking its schema.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    password: {
      hash: (password) => bcrypt.hash(password, 12),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your HYS Services password",
        text: `Reset your password: ${url}\n\nIf you didn't request this, ignore this email.`,
      });
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your HYS Services email",
        text: `Verify your email: ${url}`,
      });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "CUSTOMER",
        input: true,
      },
      phone: { type: "string", required: false, input: true },
      gender: { type: "string", required: false, input: true },
      banned: { type: "boolean", required: false, defaultValue: false },
      banReason: { type: "string", required: false },
    },
  },

  session: {
    // Matches V1's access-token lifetime; Better Auth handles rolling
    // refresh itself rather than needing a separate refresh-token dance.
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
    // secondaryStorage below also caches sessions in Redis for fast reads —
    // these two flags keep Postgres authoritative regardless, so it's a
    // cache, not the only copy. Matters for the same reason the whole
    // rebuild moved off Firestore: one durable source of truth.
    storeSessionInDatabase: true,
    preserveSessionInDatabase: true,
  },

  // Redis as a read-through cache/store for sessions and rate-limit
  // counters — the get/set/delete shape here is Better Auth's documented
  // secondaryStorage contract, wrapping the same ioredis client
  // lib/rate-limit.ts uses directly for the custom brute-force lock below.
  secondaryStorage: {
    get: (key) => redis.get(key),
    set: (key, value, ttl) => (ttl ? redis.set(key, value, "EX", ttl) : redis.set(key, value)),
    delete: (key) => redis.del(key).then(() => undefined),
  },

  // Covers every Better Auth endpoint this app doesn't have a custom
  // wrapper for — password-reset requests, verification-email resends,
  // session refresh, etc. — with Redis-backed limits instead of V1's
  // in-memory ones. /sign-in/email gets a tighter rule here mainly for
  // request-volume throttling; the *5-failed-passwords → 15-minute lock*
  // behavior is a separate, complementary mechanism in
  // app/api/auth/login/route.ts (lib/rate-limit.ts's isLockedOut), not a
  // duplicate of this.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    storage: "secondary-storage",
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/forget-password": { window: 60 * 15, max: 3 },
      "/send-verification-email": { window: 60 * 15, max: 3 },
    },
  },

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
});
