import { create } from 'zustand';

const DEFAULT_SETTINGS = {
  siteName:     'My Site',
  logoUrl:      '',
  primaryColor: '#3B82F6',
  socialLinks:  { facebook: '', twitter: '', instagram: '' },
  contactEmail: '',
  footerText:   '',
  _backendMode: null,
};

export const useSettingsStore = create((set, get) => ({
  settings:       { ...DEFAULT_SETTINGS },
  isLoading:      false,
  isSaving:       false,
  showModeWarning: false,
  _unsub:         null,

  async fetchSettings() {
    set({ isLoading: true });
    try {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      const all     = await adapter.getAll('settings');
      const s       = all[0] ?? DEFAULT_SETTINGS;

      // Migration warning: settings were last saved under a different backend mode
      const currentMode = process.env.NEXT_PUBLIC_BACKEND_MODE;
      const storedMode  = s._backendMode;
      const showModeWarning = !!(storedMode && storedMode !== currentMode);

      set({ settings: s, showModeWarning });
    } catch (err) {
      console.error('[settingsStore] fetchSettings failed:', err.message);
    } finally {
      set({ isLoading: false });
    }
  },

  async subscribeSettings() {
    get()._unsub?.();
    const { getAdapter } = await import('@/lib/adapters/index');
    const adapter        = await getAdapter();
    const unsub          = adapter.subscribe('settings', ([s]) => {
      if (!s) return;
      const currentMode    = process.env.NEXT_PUBLIC_BACKEND_MODE;
      const showModeWarning = !!(s._backendMode && s._backendMode !== currentMode);
      set({ settings: s, showModeWarning });
    });
    set({ _unsub: unsub });
  },

  unsubscribeSettings() {
    get()._unsub?.();
    set({ _unsub: null });
  },

  async saveSettings(data) {
    set({ isSaving: true });
    try {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      const updated = await adapter.update('settings', 'global', data);
      set({ settings: updated, showModeWarning: false });
      return updated;
    } finally {
      set({ isSaving: false });
    }
  },

  dismissModeWarning() {
    set({ showModeWarning: false });
  },
}));