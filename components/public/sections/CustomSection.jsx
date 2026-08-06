'use client';

import { useEffect, useState } from 'react';

/**
 * Sanitizes HTML using DOMPurify in the browser.
 * Returns empty string during SSR — content is injected after hydration.
 * This is intentional: DOMPurify requires a real DOM and must not run on
 * the server. Server-rendered custom HTML would bypass sanitization.
 *
 * Stripped tags: <script>, <iframe>, <object>, <embed>, <base>
 * Stripped attributes: all event handlers (onclick, onload, etc.)
 *
 * @param {string} html
 * @returns {{ clean: string, wasStripped: boolean }}
 */
function sanitize(html) {
  if (typeof window === 'undefined') {
    return { clean: '', wasStripped: false };
  }

  // Require at call-site so this module is never evaluated server-side
  // with a DOMPurify that would need jsdom (an unnecessary dependency).
  const DOMPurify = require('dompurify');

  const FORBID_TAGS = ['script', 'iframe', 'object', 'embed', 'base', 'form'];
  const FORBID_ATTR = [
    'onerror', 'onload', 'onclick', 'ondblclick', 'onmouseover', 'onmouseout',
    'onmouseenter', 'onmouseleave', 'onfocus', 'onblur', 'onchange',
    'onsubmit', 'onreset', 'onkeydown', 'onkeyup', 'onkeypress',
    'oncontextmenu', 'ondragstart', 'ondrop', 'onpaste',
  ];

  const clean      = DOMPurify.sanitize(html, { FORBID_TAGS, FORBID_ATTR });
  const wasStripped = clean !== html;
  return { clean, wasStripped };
}

/**
 * Calls POST /api/audit-logs to record the XSS attempt.
 * Uses the API route (not direct Firestore write) so the Admin SDK can
 * perform the write on the server — bypassing Firestore security rules
 * that correctly deny unauthenticated client writes.
 * Non-fatal: failure does not affect page rendering.
 *
 * @param {string} originalHtml
 */
async function reportStrippedAttempt(originalHtml) {
  try {
    await fetch('/api/audit-logs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:     'xss_attempt_blocked',
        collection: 'pages',
        documentId: 'custom-section',
        before:     { html: originalHtml.slice(0, 500) }, // cap payload size
      }),
    });
  } catch (err) {
    // Audit logging must never crash the renderer
    console.warn('[CustomSection] Failed to record XSS attempt:', err.message);
  }
}

export default function CustomSection({ html = '' }) {
  const [cleanHtml, setCleanHtml] = useState('');

  useEffect(() => {
    if (!html) {
      setCleanHtml('');
      return;
    }

    const { clean, wasStripped } = sanitize(html);
    setCleanHtml(clean);

    if (wasStripped) {
      console.warn('[CustomSection] Potentially unsafe HTML was stripped.');
      reportStrippedAttempt(html);
    }
  }, [html]);

  if (!cleanHtml) return null;

  return (
    <div className="px-6 py-12 max-w-6xl mx-auto">
      <div
        className="prose prose-gray max-w-none"
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    </div>
  );
}