const BASE = process.env.NEXT_PUBLIC_APP_URL ?? '';

// In-memory access token — survives tab session; server sets it in the httpOnly cookie
// too, which is what middleware reads. This copy is for the Authorization header on XHR.
let _token = null;

// ─── Internal fetch wrapper ───────────────────────────────────────────────────

/**
 * Fetch wrapper that:
 * 1. Attaches Authorization header from the in-memory token.
 * 2. On 401, silently refreshes via the httpOnly refresh_token cookie.
 * 3. Retries the original request once.
 * 4. On refresh failure, redirects to /auth/login.
 *
 * @param {string} path
 * @param {RequestInit} opts
 * @param {boolean} isFormData — set true to skip Content-Type header (FormData sets its own)
 */
async function apiFetch(path, opts = {}, isFormData = false) {
  const buildHeaders = (token) => {
    const h = { ...(opts.headers ?? {}) };
    if (!isFormData) h['Content-Type'] = 'application/json';
    if (token)       h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  const doFetch = (token) =>
    fetch(`${BASE}${path}`, { ...opts, credentials: 'include', headers: buildHeaders(token) });

  let res = await doFetch(_token);

  if (res.status !== 401) return res;

  // ── Silent refresh ──────────────────────────────────────────────────────────
  const refreshRes = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST', credentials: 'include',
  });

  if (!refreshRes.ok) {
    _token = null;
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login?reason=session_expired';
    }
    throw new Error('Session expired — redirecting to login.');
  }

  const { accessToken: newToken } = await refreshRes.json();
  _token = newToken;

  return doFetch(_token);
}

// ─── Route helpers ────────────────────────────────────────────────────────────

const ROUTE_MAP = {
  pages:      '/api/pages',
  media:      '/api/media',
  settings:   '/api/settings',
  audit_logs: '/api/audit-logs',
};

function baseRoute(collectionName) {
  return ROUTE_MAP[collectionName] ?? `/api/${collectionName}`;
}

function itemRoute(collectionName, id) {
  if (collectionName === 'settings') return baseRoute(collectionName);
  return `${baseRoute(collectionName)}/${id}`;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/** @type {import('./types').BackendAdapter} */
export const serverAdapter = {

  // ── AUTH ────────────────────────────────────────────────────────────────────

  async login(email, password) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err  = new Error(body.message ?? 'Login failed');
      err.status = res.status;
      err.locked = body.locked ?? false;
      throw err;
    }

    const data = await res.json();
    _token = data.accessToken;
    return data;
  },

  async logout() {
    _token = null;
    await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  },

  async getSession() {
    if (!_token) return null;
    try {
      const res = await apiFetch('/api/auth/session');
      return res.ok ? res.json() : null;
    } catch {
      return null;
    }
  },

  // ── CONTENT ─────────────────────────────────────────────────────────────────

  async getAll(collectionName) {
    const res = await apiFetch(baseRoute(collectionName));
    if (!res.ok) throw new Error(`Failed to fetch ${collectionName} (HTTP ${res.status})`);
    return res.json();
  },

  async getById(collectionName, id) {
    const res = await apiFetch(itemRoute(collectionName, id));
    if (!res.ok) throw new Error(`${collectionName}/${id} not found`);
    return res.json();
  },

  async create(collectionName, data) {
    const res = await apiFetch(baseRoute(collectionName), {
      method: 'POST',
      body:   JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? `Failed to create ${collectionName}`);
    }
    return res.json();
  },

  async update(collectionName, id, data) {
    const res = await apiFetch(itemRoute(collectionName, id), {
      method: 'PUT',
      body:   JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? `Failed to update ${collectionName}/${id}`);
    }
    return res.json();
  },

  async softDelete(collectionName, id) {
    const res = await apiFetch(itemRoute(collectionName, id), { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? `Failed to delete ${collectionName}/${id}`);
    }
  },

  // ── MEDIA ───────────────────────────────────────────────────────────────────

  /**
   * Uploads a file to the server, which processes it with Sharp and saves it to disk.
   * Returns UploadResult. Does NOT create a DB record (caller calls create('media',...)).
   *
   * @param {File} file
   * @returns {Promise<import('./types').UploadResult>}
   */
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiFetch(
      '/api/media?action=upload',
      { method: 'POST', body: formData },
      true, // isFormData — skip Content-Type header
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? 'File upload failed');
    }

    return res.json();
  },

  /**
   * Deletes the physical file from the server's uploads directory.
   * Soft-deleting the DB record is handled separately by softDelete('media', id).
   *
   * @param {string} url — The file URL returned by uploadFile
   */
  async deleteFile(url) {
    await apiFetch(`/api/media?deleteUrl=${encodeURIComponent(url)}`, { method: 'DELETE' });
  },

  // ── REAL-TIME ───────────────────────────────────────────────────────────────

  /**
   * Polls the collection every 30 seconds.
   * Returns an unsubscribe function (sets a flag to stop polling).
   *
   * @param {string} collectionName
   * @param {function(import('./types').ContentItem[]): void} callback
   * @returns {import('./types').Unsubscribe}
   */
  subscribe(collectionName, callback) {
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      try {
        const items = await serverAdapter.getAll(collectionName);
        callback(items);
      } catch (err) {
        console.error(`[server-adapter] subscribe poll error (${collectionName}):`, err.message);
      }
      if (!stopped) setTimeout(poll, 30_000);
    };

    poll();
    return () => { stopped = true; };
  },
};