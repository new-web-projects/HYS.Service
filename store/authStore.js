import { create } from 'zustand';

// Time before token expiry at which the warning banner appears (2 minutes)
const WARN_BEFORE_MS = 2 * 60 * 1000;

// Full token lifespans
const TOKEN_LIFE = {
  server:   15 * 60 * 1000,   // JWT access token: 15 minutes
  firebase: 60 * 60 * 1000,   // Firebase ID token: 1 hour
};

export const useAuthStore = create((set, get) => ({
  /** @type {{ uid:string, email:string, name:string, role:string }|null} */
  user: null,

  /** True while getSession() is in-flight on first mount. */
  isLoading: true,

  /** Whether the session-expiry warning banner is visible. */
  sessionWarning: false,

  /** Seconds remaining until auto-logout. Only meaningful when sessionWarning=true. */
  countdown: 0,

  // Internal timer handles — stored in state so _clearTimers() can reach them
  _warnTimer:      null,
  _countdownTimer: null,

  // ─── Public actions ───────────────────────────────────────────────────────

  /**
   * Called once on AdminLayout mount. Resolves the current session from
   * the active adapter and starts the expiry timer if authenticated.
   */
  initialize: async () => {
    set({ isLoading: true });
    try {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      const session = await adapter.getSession();
      set({ user: session, isLoading: false });
      if (session) get()._startExpiryTimer();
    } catch (err) {
      console.error('[authStore] initialize failed:', err);
      set({ user: null, isLoading: false });
    }
  },

  /**
   * Authenticates the user via the active adapter.
   * Throws on failure — callers handle the error and track brute-force state.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<import('@/lib/adapters/types').AuthResult>}
   */
  login: async (email, password) => {
    const { getAdapter } = await import('@/lib/adapters/index');
    const adapter = await getAdapter();
    const result  = await adapter.login(email, password);
    set({ user: result });
    get()._startExpiryTimer();
    return result;
  },

  /**
   * Signs out via the adapter, clears timers, and redirects to /auth/login.
   */
  logout: async () => {
    get()._clearTimers();
    set({ user: null, sessionWarning: false, countdown: 0 });
    try {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      await adapter.logout();
    } catch (err) {
      console.error('[authStore] logout error (non-fatal):', err);
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
  },

  /**
   * "Stay signed in" button handler.
   * Refreshes the token (server mode: via API; firebase mode: via SDK).
   * Falls back to logout if refresh fails.
   */
  extendSession: async () => {
    get()._clearTimers();
    set({ sessionWarning: false, countdown: 0 });

    const mode = process.env.NEXT_PUBLIC_BACKEND_MODE;

    try {
      if (mode === 'server') {
        const res = await fetch('/api/auth/refresh', {
          method:      'POST',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Server refresh rejected');
        // New httpOnly access_token cookie set by server — restart the timer
        get()._startExpiryTimer();

      } else if (mode === 'firebase') {
        const { auth } = await import('@/lib/firebase/config');
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) throw new Error('No active Firebase user');
        const newToken = await firebaseUser.getIdToken(/* forceRefresh= */ true);
        // Renew the middleware presence cookie
        if (typeof document !== 'undefined') {
          const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
          document.cookie = `firebase_session=${newToken}; Max-Age=3600; path=/; SameSite=Lax${secure}`;
        }
        get()._startExpiryTimer();
      }
    } catch (err) {
      console.error('[authStore] extendSession failed — logging out:', err);
      get().logout();
    }
  },

  // ─── Internal helpers ─────────────────────────────────────────────────────

  _startExpiryTimer: () => {
    get()._clearTimers();

    const mode     = process.env.NEXT_PUBLIC_BACKEND_MODE;
    const life     = TOKEN_LIFE[mode] ?? TOKEN_LIFE.server;
    const warnAt   = life - WARN_BEFORE_MS;

    const warnTimer = setTimeout(() => {
      // Start countdown
      let remaining = Math.floor(WARN_BEFORE_MS / 1000);
      set({ sessionWarning: true, countdown: remaining });

      const countdownTimer = setInterval(() => {
        remaining -= 1;
        set({ countdown: remaining });
        if (remaining <= 0) {
          clearInterval(countdownTimer);
          set({ _countdownTimer: null });
          get().logout();
        }
      }, 1000);

      set({ _countdownTimer: countdownTimer });
    }, warnAt);

    set({ _warnTimer: warnTimer });
  },

  _clearTimers: () => {
    const { _warnTimer, _countdownTimer } = get();
    if (_warnTimer)      clearTimeout(_warnTimer);
    if (_countdownTimer) clearInterval(_countdownTimer);
    set({ _warnTimer: null, _countdownTimer: null });
  },
}));