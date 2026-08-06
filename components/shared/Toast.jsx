'use client';
import { create }    from 'zustand';
import { useEffect } from 'react';
import { CheckIcon, XIcon, WarningIcon, InfoIcon } from '@/components/icons';

// ── Toast store ────────────────────────────────────────────────────────────
/**
 * BUG FIX (Bug 3): show() is synchronous — it updates the store immediately.
 * Components can call useToast.getState().show() from anywhere including
 * inside try/catch blocks and async callbacks without any delay.
 */
export const useToast = create((set, get) => ({
  toasts: [],
  /**
   * Shows a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration — ms until auto-dismiss. 0 = manual only.
   */
  show(message, type = 'success', duration = 4000) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Synchronous state update — no delay, shows immediately
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  dismissAll() {
    set({ toasts: [] });
  },
}));

// ── Toast styles ───────────────────────────────────────────────────────────
const STYLES = {
  success: { wrapper: 'bg-emerald-900/95 border-emerald-500/40 text-emerald-100' },
  error:   { wrapper: 'bg-red-900/95 border-red-500/40 text-red-100'             },
  warning: { wrapper: 'bg-amber-900/95 border-amber-500/40 text-amber-100'       },
  info:    { wrapper: 'bg-blue-900/95 border-blue-500/40 text-blue-100'          },
};

// ── Toast icons ────────────────────────────────────────────────────────────
const ICONS = {
  success: <CheckIcon   className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
  error:   <XIcon       className="w-4 h-4 text-red-400    shrink-0 mt-0.5" />,
  warning: <WarningIcon className="w-4 h-4 text-amber-400  shrink-0 mt-0.5" />,
  info:    <InfoIcon    className="w-4 h-4 text-blue-400   shrink-0 mt-0.5" />,
};

// ── Toast container ────────────────────────────────────────────────────────
export function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;
  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const style = STYLES[toast.type] ?? STYLES.info;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-xl
                        border shadow-2xl backdrop-blur-sm animate-fade-in
                        ${style.wrapper}`}
          >
            {ICONS[toast.type] ?? ICONS.info}
            <p className="text-sm flex-1 leading-snug">{toast.message}</p>
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity
                         text-lg leading-none -mt-0.5"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}