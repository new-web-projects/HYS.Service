"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  // Type-only import above — makes authClient.getSession()'s TypeScript
  // types include role/phone/gender (auth.ts's additionalFields) without
  // pulling any server code (Prisma, bcrypt) into the client bundle.
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signOut, useSession } = authClient;

// Sign-in and sign-up deliberately do NOT export Better Auth's own
// signIn.email()/signUp.email() here — this app posts to the custom
// /api/auth/login, /api/auth/customer/signup, and /api/auth/worker/signup
// routes instead, because those add the brute-force lock (login) and the
// CustomerProfile/WorkerProfile creation (signup) that Better Auth's own
// endpoints don't know about. See lib/auth.ts and those route files for why.
