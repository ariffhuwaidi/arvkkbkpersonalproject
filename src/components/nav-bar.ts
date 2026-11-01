import type { ActiveTab } from '../types';

export const TAB_STORAGE_KEY = 'arv_kkbk_active_tab';

export function getSavedTab(): ActiveTab {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (saved === 'records' || saved === 'tca') {
      return saved;
    }
  } catch {}
  return 'records';
}

export function saveActiveTab(tab: ActiveTab): void {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {}
}

export class NavigationBar {
  private activeTab: ActiveTab;
  private onTabChangeCallback: (tab: ActiveTab) => void;
  private mobileNavEl!: HTMLElement;

  constructor(initialTab: ActiveTab, onTabChange: (tab: ActiveTab) => void) {
    this.activeTab = initialTab;
    this.onTabChangeCallback = onTabChange;
    this.createMobileBar();
  }

  private createMobileBar(): void {
    this.mobileNavEl = document.createElement('nav');
    this.mobileNavEl.className = 'bottom-tab-bar ios-tab-bar';
    this.mobileNavEl.setAttribute('role', 'tablist');
    this.mobileNavEl.setAttribute('aria-label', 'Main Navigation');

    this.mobileNavEl.innerHTML = `
      <button type="button" class="tab-item ${this.activeTab === 'records' ? 'is-active' : ''}" data-tab="records" role="tab" aria-selected="${this.activeTab === 'records'}">
        <div class="tab-icon-wrapper">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="2" ry="2"></rect>
            <line x1="8" y1="8" x2="16" y2="8"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
            <line x1="8" y1="16" x2="12" y2="16"></line>
          </svg>
        </div>
        <span class="tab-label">Records</span>
      </button>

      <button type="button" class="tab-item ${this.activeTab === 'tca' ? 'is-active' : ''}" data-tab="tca" role="tab" aria-selected="${this.activeTab === 'tca'}">
        <div class="tab-icon-wrapper">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2.5"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <circle cx="12" cy="15" r="1.5"></circle>
          </svg>
        </div>
        <span class="tab-label">TCA</span>
      </button>
    `;

    document.body.appendChild(this.mobileNavEl);

    this.mobileNavEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.tab-item') as HTMLButtonElement;
      if (!btn) return;
      const tab = btn.getAttribute('data-tab') as ActiveTab;
      this.setActiveTab(tab);
    });
  }

  public setActiveTab(tab: ActiveTab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    saveActiveTab(tab);

    // Update mobile tab items
    this.mobileNavEl.querySelectorAll('.tab-item').forEach(btn => {
      const matches = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('is-active', matches);
      btn.setAttribute('aria-selected', matches ? 'true' : 'false');
    });

    // Update desktop header segment if present
    const desktopSegment = document.querySelector('#header-desktop-tabs');
    if (desktopSegment) {
      desktopSegment.querySelectorAll('.desktop-tab-btn').forEach(btn => {
        const matches = btn.getAttribute('data-tab') === tab;
        btn.classList.toggle('is-active', matches);
        btn.setAttribute('aria-selected', matches ? 'true' : 'false');
      });
    }

    this.onTabChangeCallback(tab);
  }

  public getActiveTab(): ActiveTab {
    return this.activeTab;
  }

  public hideMobileBar(hide: boolean): void {
    this.mobileNavEl.classList.toggle('tab-bar-hidden', hide);
  }
}
