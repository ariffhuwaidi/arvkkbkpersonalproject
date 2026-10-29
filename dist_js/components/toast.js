class ToastManager {
          el             ;
          timeoutId                = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'toast-container';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.el);
  }

  show(message        , durationMs = 2400)       {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
    }

    this.el.textContent = message;
    this.el.classList.add('is-visible');

    this.timeoutId = window.setTimeout(() => {
      this.el.classList.remove('is-visible');
      this.timeoutId = null;
    }, durationMs);
  }
}

export const toast = new ToastManager();
