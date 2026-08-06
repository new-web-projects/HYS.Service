import { NextResponse } from 'next/server';

// ─── Maintenance cache (30s TTL) ──────────────────────────────────────────────

const maintenanceCache = { mode: false, message: '', expiresAt: 0 };
const MAINTENANCE_TTL  = 30_000;

async function getMaintenanceStatus(origin) {
  const now = Date.now();
  if (now < maintenanceCache.expiresAt) {
    return { mode: maintenanceCache.mode };
  }
  try {
    const res = await fetch(`${origin}/api/system/status`, {
      headers: { 'x-internal-check': '1' },
    });
    if (res.ok) {
      const data = await res.json();
      maintenanceCache.mode      = data.maintenanceMode    ?? false;
      maintenanceCache.message   = data.maintenanceMessage ?? '';
      maintenanceCache.expiresAt = now + MAINTENANCE_TTL;
      return { mode: maintenanceCache.mode };
    }
  } catch {
    // Fail open — never block traffic if status check fails
  }
  return { mode: maintenanceCache.mode };
}

// ─── Route classification ─────────────────────────────────────────────────────

const ADMIN_PREFIXES = [
  '/dashboard',
  '/pages',
  '/media',
  '/settings',
  '/categories',
  '/users',
  '/workers-admin',
  '/bookings',
  '/admin-job-requests',
  '/withdrawals',    // Part 7 FIX: was missing — admin withdrawals page unprotected
  '/error-center',   // Part 7 FIX: was missing — admin Error Center page unprotected
];

const CUSTOMER_PREFIXES = [
  '/customer-dashboard',
  '/customer-bookings',
  '/customer-profile',
  '/job-requests',
  '/jobs',
  '/chats',
];

const WORKER_PREFIXES = [
  '/worker-dashboard',
  '/worker-profile',
  '/job-board',
  '/worker-chats',
];

// Routes that bypass maintenance check
const MAINTENANCE_BYPASS = [
  '/_next',
  '/favicon',
  '/maintenance',
  '/api/system',
  '/api/auth',
  '/admin/login',
  '/auth/forgot-password',
  ...ADMIN_PREFIXES,
];

const ROLE_HOME = {
  superadmin: '/dashboard',
  editor:     '/dashboard',
  admin:      '/dashboard',
  customer:   '/customer-dashboard',
  worker:     '/worker-dashboard',
};

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const mode         = process.env.NEXT_PUBLIC_BACKEND_MODE;

  // Always allow static assets
  if (/\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next();

  // ── Maintenance check ─────────────────────────────────────────────────────
  const shouldBypass = MAINTENANCE_BYPASS.some((p) => pathname.startsWith(p));

  if (!shouldBypass) {
    const { mode: isMaintenance } = await getMaintenanceStatus(req.nextUrl.origin);
    if (isMaintenance) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { status: 'maintenance', message: 'App is under maintenance.' },
          { status: 503 },
        );
      }
      return NextResponse.redirect(new URL('/maintenance', req.url));
    }
  }

  // ── Route protection ──────────────────────────────────────────────────────
  const isAdmin    = ADMIN_PREFIXES.some((p)    => pathname.startsWith(p));
  const isCustomer = CUSTOMER_PREFIXES.some((p) => pathname.startsWith(p));
  const isWorker   = WORKER_PREFIXES.some((p)   => pathname.startsWith(p));

  if (!isAdmin && !isCustomer && !isWorker) return NextResponse.next();

  const loginUrl = new URL('/auth/login', req.url);
  loginUrl.searchParams.set('redirect', pathname);

  // ── Firebase mode ─────────────────────────────────────────────────────────
  if (mode === 'firebase') {
    const session  = req.cookies.get('firebase_session')?.value;
    const userRole = req.cookies.get('user_role')?.value;

    if (!session || !userRole) {
      if (isAdmin)  return NextResponse.redirect(new URL('/admin/login',   req.url));
      if (isWorker) return NextResponse.redirect(new URL('/worker/login',  req.url));
      return NextResponse.redirect(loginUrl);
    }

    const isAdminRole    = ['admin', 'superadmin', 'editor'].includes(userRole);
    const isCustomerRole = userRole === 'customer';
    const isWorkerRole   = userRole === 'worker';

    if (isAdmin    && !isAdminRole)    return NextResponse.redirect(new URL(ROLE_HOME[userRole] ?? '/auth/login', req.url));
    if (isCustomer && !isCustomerRole) return NextResponse.redirect(new URL(ROLE_HOME[userRole] ?? '/auth/login', req.url));
    if (isWorker   && !isWorkerRole)   return NextResponse.redirect(new URL(ROLE_HOME[userRole] ?? '/auth/login', req.url));

    return NextResponse.next();
  }

  // ── Server mode ───────────────────────────────────────────────────────────
  if (mode === 'server') {
    const { verifyAccessToken } = await import('@/lib/auth/jwt');
    const accessToken = req.cookies.get('access_token')?.value;

    if (!accessToken) {
      if (req.cookies.has('refresh_token')) loginUrl.searchParams.set('refresh', '1');
      return NextResponse.redirect(loginUrl);
    }

    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      loginUrl.searchParams.set('refresh', '1');
      return NextResponse.redirect(loginUrl);
    }

    const role        = String(payload.role ?? 'customer').toLowerCase();
    const isAdminRole = ['admin', 'superadmin', 'editor'].includes(role);

    if (isAdmin    && !isAdminRole)        return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/auth/login', req.url));
    if (isCustomer && role !== 'customer') return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/auth/login', req.url));
    if (isWorker   && role !== 'worker')   return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/auth/login', req.url));

    const forwarded = new Headers(req.headers);
    forwarded.set('x-user-uid',   String(payload.uid));
    forwarded.set('x-user-email', String(payload.email));
    forwarded.set('x-user-role',  String(payload.role));
    return NextResponse.next({ request: { headers: forwarded } });
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Admin routes
    '/dashboard/:path*',
    '/pages/:path*',
    '/media/:path*',
    '/settings/:path*',
    '/categories/:path*',
    '/users/:path*',
    '/workers-admin/:path*',
    '/bookings/:path*',
    '/admin-job-requests/:path*',
    '/withdrawals/:path*',       // Part 7 FIX: was missing from matcher
    '/error-center/:path*',      // Part 7 FIX: was missing from matcher
    // Customer routes
    '/customer-dashboard/:path*',
    '/customer-bookings/:path*',
    '/customer-profile/:path*',
    '/job-requests/:path*',
    '/jobs/:path*',
    '/chats/:path*',
    // Worker routes
    '/worker-dashboard/:path*',
    '/worker-profile/:path*',
    '/job-board/:path*',
    '/worker-chats/:path*',
    // API + auth (for maintenance check)
    '/api/:path*',
    '/auth/:path*',
    '/worker/login',
    // Public pages that need maintenance check
    // NOTE: '/' is NOT here — root is always public
    '/services',
    '/service',
  ],
};