import { create } from 'zustand';

/**
 * publicAuthStore — authentication for customers, workers, and admins
 * on the public-facing side of the marketplace.
 *
 * Responsibilities:
 *  - Firebase Auth sign-in / sign-up / sign-out
 *  - Sets firebase_session and user_role cookies (read by middleware)
 *  - Resolves the user's Firestore document (users/ or workers/ or admins/)
 *  - Stores the full user object including location (Part 4)
 *  - Provides updateUserLocation() to persist GPS location to profile
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ts = (v) => v?.toDate?.()?.toISOString?.() ?? v ?? null;

/**
 * Normalises a raw role string from Firestore / cookies into one of:
 * 'admin' | 'superadmin' | 'editor' | 'customer' | 'worker'
 */
function normalizeRole(raw) {
  if (!raw) return 'customer';
  const r = String(raw).toLowerCase().trim();
  if (['admin', 'superadmin', 'editor'].includes(r)) return r;
  if (r === 'worker')   return 'worker';
  return 'customer';
}

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 */
function mapAuthError(code) {
  const map = {
    // Legacy codes (Firebase SDK < 9) — kept for safety
    'auth/user-not-found':         'No account found with this email address.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    // Current codes (Firebase SDK 10+ with email-enumeration-protection)
    'auth/invalid-credential':     'Incorrect email or password.',
    // Other codes
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/email-already-in-use':   'An account with this email already exists.',
    'auth/weak-password':          'Password must be at least 8 characters.',
    'auth/too-many-requests':      'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/user-disabled':          'This account has been disabled. Contact support.',
    'auth/popup-closed-by-user':   'Sign-in was cancelled.',
    'auth/operation-not-allowed':  'Email/password login is not enabled. Contact support.',
    'auth/missing-password':       'Please enter your password.',
  };

  // Firestore error codes — surface a meaningful message instead of the
  // generic fallback when resolveUserDoc() encounters a backend error
  const firestoreMap = {
    'permission-denied':  'You do not have permission to access this account.',
    'unavailable':        'Service temporarily unavailable. Please try again.',
    'deadline-exceeded':  'Request timed out. Check your connection and try again.',
    'cancelled':          'Request was cancelled. Please try again.',
    'not-found':          'Account data not found. Please sign up first.',
    'resource-exhausted': 'Too many requests. Please wait and try again.',
    'internal':           'An internal error occurred. Please try again.',
  };

  const resolved = map[code] ?? firestoreMap[code];
  if (resolved) return resolved;

  // Last resort: try to extract auth/ code from raw Firebase error strings
  // e.g. "Firebase: Error (auth/invalid-credential). (auth/invalid-credential)"
  const match = typeof code === 'string' && code.match(/auth\/[\w-]+/);
  if (match) return map[match[0]] ?? 'Authentication failed. Please try again.';

  return 'Authentication failed. Please try again.';
}

/**
 * After Firebase returns auth/invalid-credential (which covers both wrong
 * email AND wrong password in SDK 10+), call the server-side check-email
 * endpoint to determine which case it is and return a specific message.
 * Falls back to the generic message if the request fails.
 * @param {string} email
 * @returns {Promise<string>}
 */
async function getSpecificCredentialError(email) {
  try {
    const res  = await fetch('/api/auth/check-email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    const data = await res.json();
    if (data.exists === false) return 'No account found with this email address.';
    if (data.exists === true)  return 'Incorrect password. Please try again.';
  } catch {
    // Network failure — fall through to generic message
  }
  return 'Incorrect email or password.';
}

/**
 * Sets a browser cookie (read by Next.js middleware for route protection).
 */
function setCookie(name, value, maxAgeDays = 7) {
  if (typeof document === 'undefined') return;
  const maxAge = maxAgeDays * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Deletes a browser cookie.
 */
function deleteCookie(name) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Resolves a user's Firestore document.
 * Tries admins/ → users/ → workers/ in order (fallback chain).
 */
async function resolveUserDoc(uid, collections = ['users', 'workers', 'admins']) {
  const { db }          = await import('@/lib/firebase/config');
  const { doc, getDoc } = await import('firebase/firestore');

  for (const col of collections) {
    try {
      const snap = await getDoc(doc(db, col, uid));
      if (snap.exists()) {
        return { collection: col, data: snap.data() };
      }
    } catch (err) {
      // Skip collections we don't have permission to read (e.g. a customer
      // trying to read admins/) — Firestore throws permission-denied instead
      // of returning a "document not found". Continue to the next collection.
      if (err.code === 'permission-denied') continue;
      throw err; // re-throw unexpected errors
    }
  }
  return null;
}

/**
 * Builds the normalized user object stored in Zustand state.
 * Includes the location field for Part 4.
 */
function buildUserObject(uid, email, firestoreData, role) {
  const d = firestoreData ?? {};
  return {
    uid,
    email:           email                  ?? d.email          ?? '',
    name:            d.name                 ?? '',
    role:            normalizeRole(role     ?? d.role),
    phone:           d.phone                ?? '',
    profileImageUrl: d.profileImageUrl      ?? '',
    avatarUrl:       d.avatarUrl            ?? '',
    categoryId:      d.categoryId           ?? '',
    categoryName:    d.categoryName         ?? '',
    isVerified:      d.isVerified           ?? false,
    isAvailable:     d.isAvailable          ?? false,
    ordersCompleted: d.ordersCompleted       ?? 0,
    gender:          d.gender               ?? '',
    // PART 4: location field — lat, lng, address, updatedAt
    location:        d.location             ?? null,
    createdAt:       ts(d.createdAt),
  };
}

// ─── Where to redirect after login per role ───────────────────────────────────

export const ROLE_REDIRECTS = {
  admin:      '/dashboard',
  superadmin: '/dashboard',
  editor:     '/dashboard',
  worker:     '/worker-dashboard',
  customer:   '/customer-dashboard',
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePublicAuthStore = create((set, get) => ({
  user:        null,
  loading:     true,  // true until Firebase onAuthStateChanged fires
  initialized: false,

  // ── Initialize auth listener ──────────────────────────────────────────────

  /**
   * Call once on app mount (e.g. in root layout or _app).
   * Listens to Firebase Auth state changes and resolves the Firestore profile.
   */
  async init() {
    if (get().initialized) return;
    set({ initialized: true });

    try {
      const { auth }          = await import('@/lib/firebase/config');
      const { onAuthStateChanged } = await import('firebase/auth');

      onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          deleteCookie('firebase_session');
          deleteCookie('user_role');
          set({ user: null, loading: false });
          return;
        }

        try {
          // Get fresh ID token for the session cookie
          const token = await firebaseUser.getIdToken();

          const resolved = await resolveUserDoc(firebaseUser.uid);
          const role     = normalizeRole(resolved?.data?.role);
          const userObj  = buildUserObject(
            firebaseUser.uid,
            firebaseUser.email,
            resolved?.data ?? {},
            role,
          );

          // Set cookies for middleware route protection
          setCookie('firebase_session', token);
          setCookie('user_role',        role);

          set({ user: userObj, loading: false });
        } catch (err) {
          console.error('[publicAuthStore] onAuthStateChanged resolve:', err.message);
          set({ user: null, loading: false });
        }
      });
    } catch (err) {
      console.error('[publicAuthStore] init:', err.message);
      set({ loading: false });
    }
  },

  // ── Customer / Worker login ───────────────────────────────────────────────

  /**
   * Signs in with email + password.
   * Rejects admin accounts (they must use /admin/login).
   * Rejects workers trying to use the customer login (and vice versa) when
   * expectedRole is provided.
   *
   * @param {string}               email
   * @param {string}               password
   * @param {'customer'|'worker'}  [expectedRole]
   * @returns {Promise<{ user: object, redirectTo: string }>}
   */
  async login(email, password, expectedRole) {
    set({ loading: true });
    try {
      const { auth }                   = await import('@/lib/firebase/config');
      const { signInWithEmailAndPassword } = await import('firebase/auth');

      const credential = await signInWithEmailAndPassword(auth, email, password);
      const token      = await credential.user.getIdToken();

      const resolved = await resolveUserDoc(credential.user.uid);
      if (!resolved) {
        throw new Error('Account not found. Please sign up first.');
      }

      const role    = normalizeRole(resolved.data?.role);
      const isAdmin = ['admin', 'superadmin', 'editor'].includes(role);

      // Block admin accounts from the public login form
      if (isAdmin) {
        throw new Error('Admin accounts must use the Admin Login page.');
      }

      // Enforce role match when expectedRole is provided
      if (expectedRole && role !== expectedRole) {
        const expected = expectedRole === 'worker' ? 'Worker' : 'Customer';
        throw new Error(
          `This account is registered as a ${role}. ` +
          `Please use the ${expected} login page.`,
        );
      }

      const userObj = buildUserObject(
        credential.user.uid,
        credential.user.email,
        resolved.data,
        role,
      );

      setCookie('firebase_session', token);
      setCookie('user_role',        role);

      set({ user: userObj, loading: false });
      return { user: userObj, redirectTo: ROLE_REDIRECTS[role] ?? '/customer-dashboard' };
    } catch (err) {
      set({ loading: false });
      let message;
      if (err.code === 'auth/invalid-credential') {
        message = await getSpecificCredentialError(email);
      } else {
        message = err.code ? mapAuthError(err.code) : err.message;
      }
      throw new Error(message);
    }
  },

  // ── Admin login (separate — used by /admin/login page) ───────────────────

  async adminLogin(email, password) {
    set({ loading: true });
    try {
      const { auth }                   = await import('@/lib/firebase/config');
      const { signInWithEmailAndPassword } = await import('firebase/auth');

      const credential = await signInWithEmailAndPassword(auth, email, password);
      const token      = await credential.user.getIdToken();

      const resolved = await resolveUserDoc(credential.user.uid, ['admins', 'users']);
      const role     = normalizeRole(resolved?.data?.role);
      const isAdmin  = ['admin', 'superadmin', 'editor'].includes(role);

      if (!isAdmin) {
        throw new Error('Access denied. This login is for admin accounts only.');
      }

      const userObj = buildUserObject(
        credential.user.uid,
        credential.user.email,
        resolved?.data ?? {},
        role,
      );

      setCookie('firebase_session', token);
      setCookie('user_role',        role);

      set({ user: userObj, loading: false });
      return { user: userObj, redirectTo: '/dashboard' };
    } catch (err) {
      set({ loading: false });
      let message;
      if (err.code === 'auth/invalid-credential') {
        message = await getSpecificCredentialError(email);
      } else {
        message = err.code ? mapAuthError(err.code) : err.message;
      }
      throw new Error(message);
    }
  },

  // ── Sign up ───────────────────────────────────────────────────────────────

  /**
   * Creates a new Firebase Auth account and matching Firestore documents.
   *
   * For customers : creates users/{uid}
   * For workers   : creates users/{uid} (base) + workers/{uid} (profile)
   *
   * @param {{
   *   name:         string,
   *   email:        string,
   *   password:     string,
   *   role:         'customer' | 'worker',
   *   categoryId?:  string,
   *   categoryName?: string,
   * }} data
   * @returns {Promise<{ user: object, redirectTo: string }>}
   */
  async signup(data) {
    set({ loading: true });
    try {
      const { auth }                    = await import('@/lib/firebase/config');
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const { db }                      = await import('@/lib/firebase/config');
      const { doc, setDoc, Timestamp }  = await import('firebase/firestore');

      const role = normalizeRole(data.role);

      const credential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password,
      );
      const token = await credential.user.getIdToken();
      const uid   = credential.user.uid;
      const now   = Timestamp.now();

      // Base user document (all roles get one in users/)
      const userDoc = {
        uid,
        name:      data.name,
        email:     data.email,
        role,
        phone:     data.phone  ?? '',
        gender:    data.gender ?? '',
        location:  null,
        isActive:  true,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'users', uid), userDoc);

      // Worker-specific profile document
      if (role === 'worker') {
        const workerDoc = {
          uid,
          name:            data.name,
          email:           data.email,
          role:            'worker',
          categoryId:      data.categoryId   ?? '',
          categoryName:    data.categoryName ?? '',
          bio:             '',
          skills:          [],
          location:        null,
          rating:          0,
          reviewCount:     0,
          ordersCompleted: 0,
          isAvailable:     false,
          isVerified:      false,
          startingPrice:   0,
          profileImageUrl: '',
          phone:           data.phone  ?? '',
          gender:          data.gender ?? '',
          createdAt:       now,
          updatedAt:       now,
        };
        await setDoc(doc(db, 'workers', uid), workerDoc);
      }

      const userObj = buildUserObject(uid, data.email, userDoc, role);

      setCookie('firebase_session', token);
      setCookie('user_role',        role);

      set({ user: userObj, loading: false });

      // Send welcome notification (non-blocking)
      try {
        const { createNotification } = await import('@/lib/notifications');
        await createNotification(uid, 'welcome', { name: data.name }, uid);
      } catch { /* non-critical */ }

      return { user: userObj, redirectTo: ROLE_REDIRECTS[role] };
    } catch (err) {
      set({ loading: false });
      const message = err.code ? mapAuthError(err.code) : err.message;
      throw new Error(message);
    }
  },

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout() {
    try {
      const { auth }    = await import('@/lib/firebase/config');
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch (err) {
      console.error('[publicAuthStore] logout:', err.message);
    } finally {
      deleteCookie('firebase_session');
      deleteCookie('user_role');
      set({ user: null, loading: false });
    }
  },

  // ── Password reset ────────────────────────────────────────────────────────

  async sendPasswordReset(email) {
    const { auth }                  = await import('@/lib/firebase/config');
    const { sendPasswordResetEmail } = await import('firebase/auth');

    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      throw new Error(mapAuthError(err.code) ?? err.message);
    }
  },

  // ── PART 4: Update user location ─────────────────────────────────────────

  /**
   * Persists the customer's detected GPS location to their Firestore profile.
   * Updates local Zustand state immediately so the services page can use it
   * without waiting for the next onAuthStateChanged event.
   *
   * Called automatically by the services page after successful GPS detection.
   *
   * @param {number}       lat
   * @param {number}       lng
   * @param {string|null}  address  — city name or human-readable area
   */
  async updateUserLocation(lat, lng, address = null) {
    const user = get().user;
    if (!user?.uid) return;

    const location = {
      lat,
      lng,
      address: address ?? null,
      // updatedAt added by Firestore Timestamp below
    };

    try {
      const { db }                        = await import('@/lib/firebase/config');
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

      const firestoreLocation = { ...location, updatedAt: Timestamp.now() };

      // Determine which collection the user's document lives in
      const collection =
        user.role === 'worker'
          ? 'workers'
          : ['admin', 'superadmin', 'editor'].includes(user.role)
          ? 'admins'
          : 'users';

      await updateDoc(doc(db, collection, user.uid), {
        location: firestoreLocation,
      });

      // Update local state immediately — services page reads user.location
      set((s) => ({
        user: s.user
          ? { ...s.user, location: firestoreLocation }
          : null,
      }));
    } catch (err) {
      // Location save is non-critical — never crash the user experience
      console.warn('[publicAuthStore] updateUserLocation failed:', err.message);
    }
  },

  // ── Refresh user profile from Firestore ──────────────────────────────────

  /**
   * Re-reads the user's Firestore document and updates local state.
   * Useful after profile edits (name, profileImageUrl, etc.) to sync the
   * nav/header without requiring a full page reload.
   */
  async refreshUser() {
    const user = get().user;
    if (!user?.uid) return;

    try {
      const resolved = await resolveUserDoc(user.uid);
      if (!resolved) return;

      const updated = buildUserObject(
        user.uid,
        user.email,
        resolved.data,
        user.role,
      );
      set({ user: updated });
    } catch (err) {
      console.error('[publicAuthStore] refreshUser:', err.message);
    }
  },
}));