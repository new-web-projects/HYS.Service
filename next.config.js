/** @type {import('next').NextConfig} */
const nextConfig = {

  // ── Experimental ──────────────────────────────────────────────────────────

  experimental: {
    // Reduces bundle size by only importing the specific functions used
    // from large packages instead of the entire library.
    // Before: import { doc } from 'firebase/firestore' → whole Firestore bundle
    // After:  only the `doc` function is included
    // NOTE: firebase/app, firebase/auth, firebase/firestore intentionally
    // excluded — Firebase v9+ uses conditional exports, not barrel files.
    // Adding them here conflicts with the dynamic import() pattern in
    // publicAuthStore.js and causes signInWithEmailAndPassword to fail.
    optimizePackageImports: [
      'react-hook-form',
      '@hookform/resolvers',
      'zod',
      'zustand',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      'lucide-react',
    ],

    // Forces server components external packages to avoid Edge runtime errors
    serverComponentsExternalPackages: [
      'bcrypt',
      'sharp',
      'multer',
      'firebase-admin',
      '@prisma/client',
      'prisma',
    ],
  },

  // ── Image optimization ─────────────────────────────────────────────────────

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: `/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/**`,
      },
    ],
    // Avoid generating too many size variants — just what the UI uses
    deviceSizes:    [640, 750, 1080, 1200],
    imageSizes:     [16, 32, 48, 64, 128, 256],
  },

  // ── Security headers ───────────────────────────────────────────────────────

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',  value: 'nosniff'          },
          { key: 'X-Frame-Options',          value: 'SAMEORIGIN'       },
          { key: 'X-XSS-Protection',         value: '1; mode=block'    },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',       value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
      {
        // Aggressive cache for static assets
        source: '/(_next/static|favicon)(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // ── Webpack optimizations ──────────────────────────────────────────────────

  webpack(config, { isServer }) {
    // Reduce bundle size by aliasing unused Firebase services
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // We do not use Firebase Storage (using Cloudinary instead)
        'firebase/storage': false,
        // We do not use Firebase Analytics
        'firebase/analytics': false,
        // We do not use Firebase Realtime Database (using Firestore)
        'firebase/database': false,
        // We do not use Firebase Remote Config
        'firebase/remote-config': false,
        // We do not use Firebase Performance Monitoring
        'firebase/performance': false,
      };
    }
    return config;
  },

  // ── Compiler options ───────────────────────────────────────────────────────

  compiler: {
    // Remove console.log in production builds
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  }
};

module.exports = nextConfig;