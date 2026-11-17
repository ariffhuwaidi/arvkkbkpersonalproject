import type { ActiveTab, ThemeMode, ProgramId } from '../types';
import { themeManager } from '../utils/theme';

export interface HeaderCallbacks {
  activeTab: ActiveTab;
  onTabSelect: (tab: ActiveTab) => void;
  onAddClick: () => void;
  onThemeToggle: () => void;
  program: ProgramId;
  onProgramChange: (program: ProgramId) => void;
}

function themeIcon(mode: ThemeMode): string {
  const attrs = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  if (mode === 'light') return `<svg ${attrs}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
  if (mode === 'dark') return `<svg ${attrs}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
  return `<svg ${attrs}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>`;
}

export function createHeader(callbacks: HeaderCallbacks): HTMLElement {
  const header = document.createElement('header');
  header.className = 'app-header ios-header';


  header.innerHTML = `
    <div class="header-inner">
      <div class="brand-group">
        <div class="brand-title-wrap">
          <h1 class="app-title">ARV KKBK</h1>
        </div>

        <!-- Desktop Segmented Navigation (>= 900px) -->
        <div class="desktop-nav-tabs" id="header-desktop-tabs" role="tablist" aria-label="Desktop Views">
          <button type="button" class="desktop-tab-btn ${callbacks.activeTab === 'records' ? 'is-active' : ''}" data-tab="records" role="tab" aria-selected="${callbacks.activeTab === 'records'}">
            Records
          </button>
          <button type="button" class="desktop-tab-btn ${callbacks.activeTab === 'tca' ? 'is-active' : ''}" data-tab="tca" role="tab" aria-selected="${callbacks.activeTab === 'tca'}">
            TCA
          </button>
          <button type="button" class="desktop-tab-btn ${callbacks.activeTab === 'more' ? 'is-active' : ''}" data-tab="more" role="tab" aria-selected="${callbacks.activeTab === 'more'}">
            More
          </button>
        </div>
      </div>

      <div class="header-actions">
        <div class="program-switch" id="program-switch" role="radiogroup" aria-label="Program">
          <button type="button" role="radio" data-program="ARV" class="${callbacks.program === 'ARV' ? 'is-active' : ''}" aria-checked="${callbacks.program === 'ARV'}">ARV</button>
          <button type="button" role="radio" data-program="MMT" class="${callbacks.program === 'MMT' ? 'is-active' : ''}" aria-checked="${callbacks.program === 'MMT'}">MMT</button>
        </div>

        <button type="button" class="btn-icon header-icon-btn" id="btn-theme-toggle" aria-label="Change theme" title="Theme: ${themeManager.getMode()}">
          ${themeIcon(themeManager.getMode())}
        </button>

        <button type="button" class="btn-pill btn-desktop-add" id="btn-header-add" aria-label="Add Patient">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Add Patient</span>
        </button>
      </div>
    </div>
  `;

  const addBtn = header.querySelector('#btn-header-add') as HTMLButtonElement;
  const desktopTabs = header.querySelector('#header-desktop-tabs') as HTMLElement;

  const themeBtn = header.querySelector('#btn-theme-toggle') as HTMLButtonElement;
  themeBtn.addEventListener('click', () => {
    callbacks.onThemeToggle();
    const mode = themeManager.getMode();
    themeBtn.innerHTML = themeIcon(mode);
    themeBtn.title = `Theme: ${mode}`;
  });

  header.querySelector('#program-switch')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-program]') as HTMLElement | null;
    if (!btn) return;
    const program = btn.getAttribute('data-program') as ProgramId;
    header.querySelectorAll('#program-switch button').forEach(b => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
    callbacks.onProgramChange(program);
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
