/**
 * Returns the BackendAdapter for the current NEXT_PUBLIC_BACKEND_MODE.
 * Import this function everywhere — never import an adapter directly.
 *
 * Works in both server components/API routes and client components.
 * Adapters are loaded lazily so Node-only deps (bcrypt, multer) are
 * never bundled into the client when running in firebase mode.
 *
 * @returns {import('./types').BackendAdapter}
 */

let _adapter = null;

export async function getAdapter() {
  if (_adapter) return _adapter;

  const mode = process.env.NEXT_PUBLIC_BACKEND_MODE;

  if (mode === 'firebase') {
    const mod = await import('./firebase-adapter');
    _adapter = mod.firebaseAdapter;
  } else if (mode === 'server') {
    const mod = await import('./server-adapter');
    _adapter = mod.serverAdapter;
  } else {
    throw new Error(
      `[BackendAdapter] NEXT_PUBLIC_BACKEND_MODE must be "firebase" or "server". ` +
        `Got: "${mode}". Check your .env.local file.`
    );
  }

  return _adapter;
}

/**
 * Resets the cached singleton — useful after mode-switch warning in Settings.
 */
export function resetAdapter() {
  _adapter = null;
}