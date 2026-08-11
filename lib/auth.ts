import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
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
  },

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
});
