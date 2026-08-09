import { z } from "zod";

/**
 * Validates process.env once at startup so a missing/malformed variable
 * fails fast with a clear message instead of surfacing as a confusing
 * runtime error deep in some unrelated code path.
 *
 * Extend this schema as each Part introduces the service it needs —
 * e.g. Part 3 adds DATABASE_URL, Part 4 adds the auth secret, Part 8
 * adds the three payment gateways. Keep it to variables the app
 * actually reads today; an unused entry here just makes local setup
 * harder for no benefit.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "Invalid environment variables:",
      z.treeifyError(parsed.error),
    );
    throw new Error("Invalid environment variables — see log above.");
  }
  return parsed.data;
}

export const env = loadEnv();
