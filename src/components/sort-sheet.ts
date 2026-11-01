import { SortField, SortOptionDefinition } from '../types';
import { SORT_OPTIONS } from '../utils/sort';

export class SortSheet {
  private overlayEl: HTMLElement;
  private menuEl: HTMLElement;
  private currentActive: SortField = 'tca_asc';
  private onSelectCallback: ((sort: SortField) => void) | null = null;
  private previousActiveElement: HTMLElement | null = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'sort-dropdown-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Sort Records');

    this.overlayEl.innerHTML = `
      <div class="sort-dropdown-menu" id="sort-dropdown-container">
        <div class="sort-dropdown-header">
          <span class="sort-dropdown-title">Sort By</span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Close sort menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="sort-options-list" id="sort-options-list" role="radiogroup" aria-label="Sort options"></div>
      </div>
    `;

    this.menuEl = this.overlayEl.querySelector('#sort-dropdown-container') as HTMLElement;
    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

  private bindEvents(): void {
    this.overlayEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target === this.overlayEl || target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    // Reposition on window resize if open
    window.addEventListener('resize', () => {
      if (this.isOpen() && this.previousActiveElement) {
        this.positionMenu(this.previousActiveElement);
      }
    });
  }

  private positionMenu(triggerEl?: HTMLElement): void {
    if (!triggerEl) return;

    const isDesktop = window.innerWidth >= 480;
    if (isDesktop) {
      const rect = triggerEl.getBoundingClientRect();
      const menuWidth = Math.min(300, window.innerWidth - 24);
      let left = rect.right - menuWidth;
      if (left < 12) left = 12;

      let top = rect.bottom + 6;
      const maxHeight = Math.max(200, window.innerHeight - top - 16);

      // If near bottom of screen, flip upwards
      if (top + 280 > window.innerHeight && rect.top > 300) {
        top = Math.max(12, rect.top - 320);
      }

      this.menuEl.style.position = 'fixed';
      this.menuEl.style.top = `${top}px`;
      this.menuEl.style.left = `${left}px`;
      this.menuEl.style.right = 'auto';
      this.menuEl.style.bottom = 'auto';
      this.menuEl.style.width = `${menuWidth}px`;
      this.menuEl.style.maxHeight = `${maxHeight}px`;
      this.menuEl.classList.add('is-anchored');
      this.menuEl.classList.remove('is-sheet');
    } else {
      // Small mobile: smooth bottom sheet anchored to bottom
      this.menuEl.style.position = 'fixed';
      this.menuEl.style.top = 'auto';
      this.menuEl.style.bottom = '0';
      this.menuEl.style.left = '0';
      this.menuEl.style.right = '0';
      this.menuEl.style.width = '100%';
      this.menuEl.style.maxHeight = '75vh';
      this.menuEl.classList.add('is-sheet');
      this.menuEl.classList.remove('is-anchored');
    }
  }

  private renderOptions(): void {
    const container = this.overlayEl.querySelector('#sort-options-list');
    if (!container) return;

    container.innerHTML = '';
    SORT_OPTIONS.forEach((option: SortOptionDefinition) => {
      const isSelected = option.id === this.currentActive;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `sort-dropdown-item ${isSelected ? 'is-active' : ''}`;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      btn.innerHTML = `
        <span class="sort-item-label">${option.label}</span>
        ${
          isSelected
            ? `<svg class="sort-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
               </svg>`
            : ''
        }
      `;

      btn.addEventListener('click', () => {
        this.currentActive = option.id;
        if (this.onSelectCallback) {
          this.onSelectCallback(option.id);
        }
        this.close();
      });

      container.appendChild(btn);
    });
  }

  public open(current: SortField, onSelect: (sort: SortField) => void, triggerEl?: HTMLElement): void {
    this.currentActive = current;
    this.onSelectCallback = onSelect;
    this.previousActiveElement = triggerEl || (document.activeElement as HTMLElement);

    this.renderOptions();
    this.positionMenu(this.previousActiveElement);
    this.overlayEl.classList.add('is-open');

    // Safe focus with preventScroll so browser never jumps or scrolls viewport
    const activeBtn = this.overlayEl.querySelector('.sort-dropdown-item.is-active') as HTMLElement;
    if (activeBtn) {
      activeBtn.focus({ preventScroll: true });
    }
  }

  public close(): void {
    if (!this.isOpen()) return;
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus({ preventScroll: true });
    }
  }

  public isOpen(): boolean {
    return this.overlayEl.classList.contains('is-open');
  }
}
