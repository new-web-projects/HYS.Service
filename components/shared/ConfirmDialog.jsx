'use client';

import { create } from 'zustand';

export const useConfirm = create((set) => ({
  open:    false,
  title:   '',
  message: '',
  _resolve: null,

  /**
   * Shows the dialog and returns a Promise that resolves to true (confirmed) or false (cancelled).
   * @param {string} title
   * @param {string} message
   * @returns {Promise<boolean>}
   */
  confirm(title, message) {
    return new Promise((resolve) => {
      set({ open: true, title, message, _resolve: resolve });
    });
  },

  _answer(value) {
    set((s) => {
      s._resolve?.(value);
      return { open: false, _resolve: null };
    });
  },
}));

export function ConfirmDialog() {
  const { open, title, message, _answer } = useConfirm();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => _answer(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="bg-admin-card border border-admin-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-semibold text-admin-text mb-2">
          {title}
        </h2>
        <p className="text-admin-muted text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => _answer(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-admin-muted
                       bg-admin-bg border border-admin-border hover:border-admin-muted
                       transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => _answer(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white
                       bg-red-600 hover:bg-red-700 active:bg-red-800 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}