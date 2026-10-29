import type { ThemeMode, ActiveTab } from '../types';
import { themeManager } from '../utils/theme';

export interface HeaderCallbacks {
  activeTab: ActiveTab;
  onTabSelect: (tab: ActiveTab) => void;
  onAddClick: () => void;
  onDataClick: () => void;
  onThemeToggle: () => void;
}

export function createHeader(callbacks: HeaderCallbacks): HTMLElement {
  const header = document.createElement('header');
  header.className = 'app-header';

  function getThemeIcon(mode: ThemeMode): string {
    if (mode === 'light') {
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>`;
    }
    if (mode === 'dark') {
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>`;
    }
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
    </svg>`;
  }

  header.innerHTML = `
    <div class="header-inner">
      <div class="brand-group">
        <h1 class="app-title">ARV KKBK</h1>
        <span class="brand-badge">Personal</span>

        <!-- Desktop Segmented Navigation (>= 900px) -->
        <div class="desktop-nav-tabs" id="header-desktop-tabs" role="tablist" aria-label="Desktop Views">
          <button type="button" class="desktop-tab-btn ${callbacks.activeTab === 'records' ? 'is-active' : ''}" data-tab="records" role="tab" aria-selected="${callbacks.activeTab === 'records'}">
            Records
          </button>
          <button type="button" class="desktop-tab-btn ${callbacks.activeTab === 'tca' ? 'is-active' : ''}" data-tab="tca" role="tab" aria-selected="${callbacks.activeTab === 'tca'}">
            TCA
          </button>
        </div>
      </div>

      <div class="header-actions">
        <button type="button" class="btn-icon" id="btn-theme-toggle" aria-label="Toggle theme mode" title="Current: ${themeManager.getMode()}">
          ${getThemeIcon(themeManager.getMode())}
        </button>

        <button type="button" class="btn-pill" id="btn-open-data" aria-label="Open data backup and restore">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Data</span>
        </button>

        <button type="button" class="btn-pill btn-desktop-add" id="btn-header-add" aria-label="Add new record">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Add Record</span>
        </button>
      </div>
    </div>
  `;

  const themeBtn = header.querySelector('#btn-theme-toggle') as HTMLButtonElement;
  const dataBtn = header.querySelector('#btn-open-data') as HTMLButtonElement;
  const addBtn = header.querySelector('#btn-header-add') as HTMLButtonElement;
  const desktopTabs = header.querySelector('#header-desktop-tabs') as HTMLElement;

  themeBtn.addEventListener('click', () => {
    callbacks.onThemeToggle();
    const newMode = themeManager.getMode();
    themeBtn.innerHTML = getThemeIcon(newMode);
    themeBtn.title = `Current: ${newMode}`;
  });

  dataBtn.addEventListener('click', () => {
    callbacks.onDataClick();
  });

  addBtn.addEventListener('click', () => {
    callbacks.onAddClick();
  });

  desktopTabs.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.desktop-tab-btn') as HTMLButtonElement;
    if (!btn) return;
    const tab = btn.getAttribute('data-tab') as ActiveTab;
    callbacks.onTabSelect(tab);
  });

  return header;
}
