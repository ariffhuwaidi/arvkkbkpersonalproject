import { ThemeMode } from '../types';

export const THEME_STORAGE_KEY = 'arv_kkbk_theme_pref';
export const DEFAULT_THEME: ThemeMode = 'system';

class ThemeManager {
  private currentMode: ThemeMode = DEFAULT_THEME;
  private mediaQuery: MediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    this.currentMode = this.getSavedTheme();
    this.mediaQuery.addEventListener('change', () => {
      if (this.currentMode === 'system') {
        this.applyTheme();
      }
    });
  }

  getSavedTheme(): ThemeMode {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // LocalStorage unavailable
    }
    return DEFAULT_THEME;
  }

  getMode(): ThemeMode {
    return this.currentMode;
  }

  isDark(): boolean {
    if (this.currentMode === 'dark') return true;
    if (this.currentMode === 'light') return false;
    return this.mediaQuery.matches;
  }

  setTheme(mode: ThemeMode): void {
    this.currentMode = mode;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // LocalStorage unavailable
    }
    this.applyTheme();
  }

  applyTheme(): void {
    const isDark = this.isDark();
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Update iOS Safari / browser theme-color meta tag
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', isDark ? '#1C1C1E' : '#F2F2F7');
  }
}

export const themeManager = new ThemeManager();
