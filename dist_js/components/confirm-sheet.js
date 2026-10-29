                                 
                
                  
                        
                       
                          
 

export class ConfirmSheet {
          overlayEl             ;
          resolvePromise                                        = null;
          previousActiveElement                     = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'alertdialog');
    this.overlayEl.setAttribute('aria-modal', 'true');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet" style="max-width: 400px; text-align: center;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-body" style="padding: 24px 20px 16px 20px; align-items: center;">
          <h3 class="sheet-title" id="confirm-title" style="font-size: 18px; margin-bottom: 8px;"></h3>
          <p id="confirm-message" style="font-size: 14.5px; line-height: 1.45;"></p>
        </div>
        <div class="sheet-footer" style="flex-direction: column; gap: 8px; padding: 12px 20px 16px 20px;">
          <button type="button" id="confirm-action-btn" class="btn-destructive" style="width: 100%; height: 44px;"></button>
          <button type="button" id="confirm-cancel-btn" class="btn-secondary" style="width: 100%; height: 44px; font-weight: 600;">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

          bindEvents()       {
    const actionBtn = this.overlayEl.querySelector('#confirm-action-btn')                     ;
    const cancelBtn = this.overlayEl.querySelector('#confirm-cancel-btn')                     ;

    actionBtn.addEventListener('click', () => {
      this.close(true);
    });

    cancelBtn.addEventListener('click', () => {
      this.close(false);
    });

    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.close(false);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close(false);
      }
    });
  }

         show(options                , triggerEl              )                   {
    this.previousActiveElement = triggerEl || (document.activeElement               );

    const titleEl = this.overlayEl.querySelector('#confirm-title')               ;
    const messageEl = this.overlayEl.querySelector('#confirm-message')               ;
    const actionBtn = this.overlayEl.querySelector('#confirm-action-btn')                     ;
    const cancelBtn = this.overlayEl.querySelector('#confirm-cancel-btn')                     ;

    titleEl.textContent = options.title;
    messageEl.textContent = options.message;
    actionBtn.textContent = options.confirmLabel || 'Confirm';
    cancelBtn.textContent = options.cancelLabel || 'Cancel';

    if (options.isDestructive !== false) {
      actionBtn.className = 'btn-destructive';
    } else {
      actionBtn.className = 'btn-primary';
    }

    this.overlayEl.classList.add('is-open');
    cancelBtn.focus();

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

          close(result         )       {
    if (!this.isOpen()) return;
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }

    if (this.resolvePromise) {
      this.resolvePromise(result);
      this.resolvePromise = null;
    }
  }

         isOpen()          {
    return this.overlayEl.classList.contains('is-open');
  }
}

export const confirmSheet = new ConfirmSheet();
