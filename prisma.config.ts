// Verified against the actual @next/env package (not assumed): bare
// `dotenv/config` only ever looks for a file literally named `.env` by
// default — but this project's own README/.env.example convention is
// `.env.local`, so DIRECT_URL was silently undefined for any Prisma CLI
// command (`prisma migrate`, `prisma studio`, …) run outside `next dev`,
// which does its own separate env loading. loadEnvConfig is Next's own
// real .env → .env.local → .env.$(NODE_ENV) → .env.$(NODE_ENV).local
// precedence logic, exported specifically for scripts like this one.
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

import { defineConfig, env } from "prisma/config";

// Prisma 7 moved the connection URL out of schema.prisma and into this
// config file. DIRECT_URL is used for `prisma migrate` (schema changes need
// a non-pooled connection); DATABASE_URL — the pooled one — is what the
// running app uses via the driver adapter in lib/prisma.ts. If your
// provider doesn't require separate pooled/direct URLs, point both at the
// same value.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});