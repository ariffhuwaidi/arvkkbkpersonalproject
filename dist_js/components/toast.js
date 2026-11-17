                               
                      
                                                   
                       
                        
 

class ToastManager {
          el             ;
          textEl             ;
          timeoutId                = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'toast-container';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');

    this.textEl = document.createElement('span');
    this.textEl.className = 'toast-text';
    this.el.appendChild(this.textEl);

    document.body.appendChild(this.el);
  }

  /** `show(message)`, `show(message, 4000)` or `show(message, { actionLabel, onAction })`. */
  show(message        , options                        = 2400)       {
    const opts               = typeof options === 'number' ? { durationMs: options } : options;

    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
    }

    this.textEl.textContent = message;
    this.el.querySelector('.toast-action')?.remove();
    this.el.classList.toggle('has-action', !!opts.actionLabel);

    if (opts.actionLabel && opts.onAction) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action';
      btn.textContent = opts.actionLabel;
      btn.addEventListener('click', () => {
        this.hide();
        opts.onAction?.();
      });
      this.el.appendChild(btn);
    }

    this.el.classList.add('is-visible');

    // A toast with an action stays long enough to be tapped
    const duration = opts.durationMs ?? (opts.actionLabel ? 7000 : 2400);
    this.timeoutId = window.setTimeout(() => this.hide(), duration);
  }

  hide()       {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.el.classList.remove('is-visible');
  }
}

export const toast = new ToastManager();
