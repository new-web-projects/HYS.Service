/**
 * lib/errorReporter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Called when a user clicks "Report to Platform Owner" in the ErrorPanel.
 *
 * Detects backend mode:
 *   • Firebase mode → writes directly to Firestore `errorReports` collection
 *   • Server  mode  → POSTs to /api/error-reports
 *
 * Returns: { success: boolean, reportId?: string, error?: string }
 *
 * NEVER throws — all errors are caught and returned as { success: false }.
 */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_MODE || 'firebase';

/**
 * Report a single error record to the platform owner's error inbox.
 *
 * @param {object} record  — a buildRecord() output from ErrorProvider
 * @returns {Promise<{ success: boolean, reportId?: string, error?: string }>}
 */
export async function reportError(record) {
  const payload = buildPayload(record);

  if (BACKEND === 'firebase') {
    return reportViaFirestore(payload);
  }
  return reportViaApi(payload);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPayload(record) {
  return {
    // ── Error details ─────────────────────────────────────────────────────
    message:        record.message        || '',
    type:           record.type           || 'Error',
    code:           record.code           || '',
    stack:          record.stack          || '',
    file:           record.file           || 'unknown',
    line:           String(record.line    || '?'),
    fn:             record.fn             || 'unknown',
    componentStack: record.componentStack || '',
    source:         record.source         || 'unknown',

    // ── Page context ──────────────────────────────────────────────────────
    route:    record.route    || '/',
    browser:  record.browser  || 'unknown',
    device:   record.device   || 'unknown',
    screen:   record.screen   || '?',
    viewport: record.viewport || '?',

    // ── User context ──────────────────────────────────────────────────────
    userId:   record.userId   || 'anonymous',
    role:     record.role     || 'unknown',

    // ── Timing ───────────────────────────────────────────────────────────
    errorOccurredAt: new Date(record.timestamp || Date.now()).toISOString(),

    // ── Admin workflow fields (set on create) ─────────────────────────────
    status:   'new',      // new | investigating | fixed | closed
    notes:    '',
    assignee: null,
  };
}

// ── Firebase mode ─────────────────────────────────────────────────────────────

async function reportViaFirestore(payload) {
  try {
    const [{ db }, { collection, addDoc, serverTimestamp }] = await Promise.all([
      import('@/lib/firebase/config'),
      import('firebase/firestore'),
    ]);

    const docRef = await addDoc(collection(db, 'errorReports'), {
      ...payload,
      reportedAt: serverTimestamp(),
    });

    return { success: true, reportId: docRef.id };
  } catch (err) {
    // Don't use console.error here — we're inside the error reporting path.
    // Using console.warn so ErrorProvider's warn-interceptor can catch it
    // but it won't create an infinite loop (reportError is not itself logged).
    console.warn('[errorReporter] Firestore write failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Server mode ───────────────────────────────────────────────────────────────

async function reportViaApi(payload) {
  try {
    const res = await fetch('/api/error-reports', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { success: true, reportId: data.id };
  } catch (err) {
    console.warn('[errorReporter] API call failed:', err.message);
    return { success: false, error: err.message };
  }
}
