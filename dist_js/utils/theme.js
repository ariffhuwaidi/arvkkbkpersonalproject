export const THEME_STORAGE_KEY = 'arv_kkbk_theme_pref';
export const DEFAULT_THEME            = 'system';

class ThemeManager {
          currentMode            = DEFAULT_THEME;
          mediaQuery                 = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    this.currentMode = this.getSavedTheme();
    this.mediaQuery.addEventListener('change', () => {
      if (this.currentMode === 'system') {
        this.applyTheme();
      }
    });
  }

  getSavedTheme()            {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)             ;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // LocalStorage unavailable
    }
    return DEFAULT_THEME;
  }

  getMode()            {
    return this.currentMode;
  }

  isDark()          {
    if (this.currentMode === 'dark') return true;
    if (this.currentMode === 'light') return false;
    return this.mediaQuery.matches;
  }

  setTheme(mode           )       {
    this.currentMode = mode;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // LocalStorage unavailable
    }
    this.applyTheme();
  }

  applyTheme()       {
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
