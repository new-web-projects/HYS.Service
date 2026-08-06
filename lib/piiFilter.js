/**
 * PII Filter — blocks personally identifiable information in chat messages.
 *
 * Specification:
 * - Phone numbers, email addresses, Aadhaar, PAN, social handles: BLOCKED
 * - Explicit contact-sharing phrases: BLOCKED
 * - Normal work-related conversation: ALLOWED
 * - After confirmed booking payment, sharing is unlocked at the application layer
 *   (this filter always runs; the app decides when to call it)
 */

const RULES = [
  // ── Indian mobile numbers ───────────────────────────────────────────────
  {
    re:    /(\+?91[\s\-]?)?[6-9]\d{9}/,
    label: 'phone number',
    hint:  'Phone numbers cannot be shared before booking is confirmed.',
  },
  // ── International phone (e.g. +1-800-555-1234) ─────────────────────────
  {
    re:    /\+[1-9]\d{0,2}[\s\-]?\d{6,12}/,
    label: 'phone number',
    hint:  'Phone numbers cannot be shared before booking is confirmed.',
  },
  // ── Email addresses ─────────────────────────────────────────────────────
  {
    re:    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}/,
    label: 'email address',
    hint:  'Email addresses cannot be shared before booking is confirmed.',
  },
  // ── Aadhaar (12-digit, optionally spaced/dashed) ────────────────────────
  {
    re:    /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/,
    label: 'Aadhaar number',
    hint:  'Aadhaar numbers cannot be shared in chat. Use the document verification section.',
  },
  // ── PAN card (5 letters + 4 digits + 1 letter) ──────────────────────────
  {
    re:    /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,
    label: 'PAN card number',
    hint:  'PAN card numbers cannot be shared in chat.',
  },
  // ── UPI / payment handles ────────────────────────────────────────────────
  {
    re:    /\b[a-zA-Z0-9._\-]+@(?:upi|paytm|gpay|phonepe|ybl|okaxis|okhdfcbank|okicici|oksbi|axl|ibl)\b/i,
    label: 'UPI ID',
    hint:  'UPI IDs cannot be shared before payment is confirmed.',
  },
  // ── Explicit contact-sharing phrases ─────────────────────────────────────
  {
    re:    /(?:(?:my|our|the)\s+)?(?:number|phone|mobile|whatsapp|contact|email|gmail)\s*(?:is|:|=)\s*[\d@]/i,
    label: 'contact information',
    hint:  'Sharing personal contact information is not allowed before booking.',
  },
  // ── "Call me / text me at" patterns ──────────────────────────────────────
  {
    re:    /(?:call|text|message|whatsapp|ping|dm|contact)\s+(?:me|us)\s+(?:at\s+)?[\d@+]/i,
    label: 'contact request',
    hint:  'Requesting personal contact information is not allowed before booking.',
  },
];

/**
 * Checks if a message contains PII.
 *
 * @param {string} text
 * @returns {{ blocked: boolean, label: string|null, hint: string|null }}
 */
export function checkPII(text) {
  if (!text || typeof text !== 'string') {
    return { blocked: false, label: null, hint: null };
  }

  for (const rule of RULES) {
    // Reset lastIndex for safety with global-like patterns
    if (rule.re.global) rule.re.lastIndex = 0;

    if (rule.re.test(text)) {
      return { blocked: true, label: rule.label, hint: rule.hint };
    }
  }

  return { blocked: false, label: null, hint: null };
}

/**
 * Returns whether the text is safe to send.
 * @param {string} text
 * @returns {{ safe: boolean, warning: string|null }}
 */
export function validateChatMessage(text) {
  const { blocked, hint } = checkPII(text);
  return {
    safe:    !blocked,
    warning: blocked ? (hint ?? 'Personal information is not allowed in chat.') : null,
  };
}