import "dotenv/config";
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
