import { SORT_OPTIONS } from '../utils/sort.js';

export class SortSheet {
          overlayEl             ;
          currentActive            = 'tca_asc';
          onSelectCallback                                     = null;
          previousActiveElement                     = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Sort Records');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet" style="max-width: 420px;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <span class="sheet-title">Sort Records</span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Close sort sheet">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="sheet-body" style="padding: 12px 16px;">
          <div class="action-sheet-options" id="sort-options-list"></div>
        </div>
        <div class="sheet-footer" style="justify-content: center; padding: 10px 16px;">
          <button type="button" class="btn-secondary" style="width: 100%; font-weight: 600;" data-action="close">Done</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

          bindEvents()       {
    this.overlayEl.addEventListener('click', (e) => {
      const target = e.target               ;
      if (target === this.overlayEl || target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

          renderOptions()       {
    const container = this.overlayEl.querySelector('#sort-options-list');
    if (!container) return;

    container.innerHTML = '';
    SORT_OPTIONS.forEach((option                      ) => {
      const isSelected = option.id === this.currentActive;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `action-sheet-item ${isSelected ? 'is-active' : ''}`;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      btn.innerHTML = `
        <span>${option.label}</span>
        ${
          isSelected
            ? `<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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

         open(current           , onSelect                           , triggerEl              )       {
    this.currentActive = current;
    this.onSelectCallback = onSelect;
    this.previousActiveElement = triggerEl || (document.activeElement               );

    this.renderOptions();
    this.overlayEl.classList.add('is-open');

    // Auto-focus first active option or close button
    const activeBtn = this.overlayEl.querySelector('.action-sheet-item.is-active')               ;
    if (activeBtn) {
      activeBtn.focus();
    }
  }

         close()       {
    if (!this.isOpen()) return;
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

         isOpen()          {
    return this.overlayEl.classList.contains('is-open');
  }
}
