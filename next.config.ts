import type { NextConfig } from "next";

/**
 * HYS Services — Version 2
 *
 * Kept intentionally light in Part 2 (Foundation). Sections that depend on
 * infrastructure introduced in later Parts are stubbed with a comment
 * pointing at the Part that owns them, rather than guessed at now:
 *  - images.remotePatterns: filled in during Part 11 (Cloudinary / S3)
 *  - serverExternalPackages: filled in as Parts 3/4/11 add Prisma, bcrypt, sharp
 *  - Content-Security-Policy: deferred until every external script/asset
 *    origin (Razorpay/PhonePe/Paytm checkout scripts, Cloudinary, S3) is
 *    known, so it can be written correctly once instead of loosened later
 */
const nextConfig: NextConfig = {
  // Required for Prisma 7's `prisma-client` generator + driver-adapter
  // architecture under Turbopack — without this, SSR routes that import the
  // generated client throw "Cannot find module '.prisma/client/default'".
  serverExternalPackages: ["@prisma/client", "pg"],

  images: {
    remotePatterns: [
      // Part 11 (Storage): Cloudinary + S3 host patterns go here.
    ],
  },

  async headers() {
    // Next.js/Vercel already set optimal Cache-Control on /_next/static
    // automatically — adding a custom rule for it just risks fighting dev
    // mode (Next.js warns on exactly this), so only the security headers
    // are set explicitly here.
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
