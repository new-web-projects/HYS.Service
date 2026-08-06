import admin from 'firebase-admin';

let _app = null;

/**
 * Initializes the Firebase Admin SDK once and returns the app instance.
 * Safe to call multiple times — returns the existing app on subsequent calls.
 * @returns {admin.app.App}
 */
function initAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error(
      '[firebase/admin] FIREBASE_SERVICE_ACCOUNT_JSON is not set. ' +
      'Add the service account JSON string to .env.local.',
    );
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error(
      '[firebase/admin] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. ' +
      'Ensure it is the raw service account object as a single-line JSON string.',
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

/**
 * Returns the Admin Firestore instance.
 * Bypasses client-facing security rules — only call from API routes.
 * @returns {admin.firestore.Firestore}
 */
export function getAdminDb() {
  if (!_app) _app = initAdminApp();
  return admin.firestore();
}

/**
 * Returns the Admin Auth instance.
 * @returns {admin.auth.Auth}
 */
export function getAdminAuth() {
  if (!_app) _app = initAdminApp();
  return admin.auth();
}