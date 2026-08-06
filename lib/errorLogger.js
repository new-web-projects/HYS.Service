/**
 * lib/errorLogger.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Called automatically from ErrorProvider.addError() for EVERY detected error.
 * This is the passive logging layer — completely transparent to the user.
 *
 * Distinction from lib/errorReporter.js:
 *   errorLogger  — automatic, silent, fires for every error    → errorLogs
 *   errorReporter — manual, user-initiated, "Report" button    → errorReports
 *
 * Rate limiting:
 *   • Max 100 log writes per browser session (sessionStorage counter)
 *   • Same-message deduplication is handled upstream in ErrorProvider
 *   • NEVER throws — all failures are silently swallowed
 *
 * Fields written match the Part 5 spec exactly:
 *   id, errorType, message, stackTrace, fileName, route,
 *   timestamp, userId, role, browser, device
 */

const BACKEND   = process.env.NEXT_PUBLIC_BACKEND_MODE || 'firebase';
const SESSION_KEY = 'hys_error_log_count';
const MAX_LOGS    = 100;   // per browser session

/**
 * Auto-log one error record to the errorLogs collection.
 * Called from ErrorProvider — never awaited at call site; failures ignored.
 *
 * @param {object} record — a buildRecord() output from ErrorProvider
 */
export async function logError(record) {
  // ── Client-side rate limit ────────────────────────────────────────────────
  try {
    const count = parseInt(sessionStorage.getItem(SESSION_KEY) || '0', 10);
    if (count >= MAX_LOGS) return;
    sessionStorage.setItem(SESSION_KEY, String(count + 1));
  } catch { /* sessionStorage blocked — continue anyway */ }

  // ── Build log payload (spec-required fields) ──────────────────────────────
  const payload = {
    errorType:  record.type     || 'Error',
    message:    record.message  || '',
    stackTrace: record.stack    || '',
    fileName:   record.file     || 'unknown',
    route:      record.route    || '/',
    userId:     record.userId   || 'anonymous',
    role:       record.role     || 'unknown',
    browser:    record.browser  || 'unknown',
    device:     record.device   || 'unknown',
    // Extended fields for admin investigation
    source:     record.source   || 'unknown',
    errorCode:  record.code     || '',
    viewport:   record.viewport || '?',
    fn:         record.fn       || 'unknown',
    line:       String(record.line || '?'),
  };

  if (BACKEND === 'firebase') {
    await logViaFirestore(payload);
  } else {
    await logViaApi(payload);
  }
}

// ─── Firebase mode ────────────────────────────────────────────────────────────

async function logViaFirestore(payload) {
  try {
    const [{ db }, { collection, addDoc, serverTimestamp }] = await Promise.all([
      import('@/lib/firebase/config'),
      import('firebase/firestore'),
    ]);
    await addDoc(collection(db, 'errorLogs'), {
      ...payload,
      timestamp: serverTimestamp(),
    });
  } catch {
    // Silent — logging should never disrupt the application
  }
}

// ─── Server mode ──────────────────────────────────────────────────────────────

async function logViaApi(payload) {
  try {
    await fetch('/api/error-logs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
      }),
      // Low priority — don't block the main thread
      keepalive: true,
    });
  } catch {
    // Silent
  }
}

/**
 * Clear the session log counter (useful for testing).
 * Does not delete Firestore documents.
 */
export function resetLogCounter() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
