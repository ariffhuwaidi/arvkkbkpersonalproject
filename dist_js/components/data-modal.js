import { exportRecordsToJSON, validateImportJSON } from '../utils/export-import.js';
import { confirmSheet } from './confirm-sheet.js';
import { toast } from './toast.js';

export class DataModal {
          overlayEl             ;
          getRecordsCallback                                          = null;
          onImportCallback                                                                                  = null;
          previousActiveElement                     = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Data Management');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet" style="max-width: 480px;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <span class="sheet-title">Data Management</span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Close data sheet">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="sheet-body">
          <div style="background-color: var(--color-accent-subtle); border: 1px solid var(--color-separator); border-radius: var(--radius-md); padding: 12px; font-size: 13px; line-height: 1.45; color: var(--color-text-primary);">
            <strong>Privacy & Data Portability:</strong>
            All patient records are stored 100% locally on this device's IndexedDB. Export files allow safe, manual transfer between your phone and laptop (e.g. via AirDrop or direct USB). Do not upload exported clinical files to public clouds.
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
            <div style="border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 14px; background-color: var(--color-bg-secondary);">
              <h4 style="font-size: 15px; margin-bottom: 4px;">Export Records (JSON)</h4>
              <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
                Download an uncompressed JSON file of all records currently stored on this device.
              </p>
              <button type="button" id="btn-export-json" class="btn-primary" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export JSON File
              </button>
            </div>

            <div style="border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 14px; background-color: var(--color-bg-secondary);">
              <h4 style="font-size: 15px; margin-bottom: 4px;">Import Records (JSON)</h4>
              <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
                Import records from an ARV KKBK JSON backup. Validates schema before applying.
              </p>
              <input type="file" id="file-import-input" accept=".json,application/json" style="display: none;" />
              <button type="button" id="btn-trigger-import" class="btn-secondary" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Select JSON File to Import
              </button>
              <div id="import-status-box" style="display: none; margin-top: 12px; padding: 10px; border-radius: var(--radius-md); font-size: 13px;"></div>
            </div>
          </div>
        </div>
        <div class="sheet-footer">
          <button type="button" class="btn-secondary" data-action="close">Done</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

          bindEvents()       {
    const exportBtn = this.overlayEl.querySelector('#btn-export-json')                     ;
    const triggerImportBtn = this.overlayEl.querySelector('#btn-trigger-import')                     ;
    const fileInput = this.overlayEl.querySelector('#file-import-input')                    ;

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

    exportBtn.addEventListener('click', async () => {
      if (this.getRecordsCallback) {
        const records = await this.getRecordsCallback();
        if (records.length === 0) {
          toast.show('No records to export');
          return;
        }
        exportRecordsToJSON(records);
        toast.show(`Exported ${records.length} records`);
      }
    });

    triggerImportBtn.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const statusBox = this.overlayEl.querySelector('#import-status-box')               ;
      statusBox.style.display = 'block';
      statusBox.style.backgroundColor = 'var(--color-bg-tertiary)';
      statusBox.style.color = 'var(--color-text-primary)';
      statusBox.textContent = `Reading ${file.name}...`;

      try {
        const text = await file.text();
        const validation = validateImportJSON(text);

        if (!validation.valid || !validation.records) {
          statusBox.style.backgroundColor = 'var(--status-overdue-bg)';
          statusBox.style.color = 'var(--status-overdue-text)';
          statusBox.textContent = validation.error || 'Invalid file schema.';
          return;
        }

        const validCount = validation.records.length;
        statusBox.style.backgroundColor = 'var(--status-upcoming-bg)';
        statusBox.style.color = 'var(--status-upcoming-text)';
        statusBox.textContent = `Found ${validCount} valid record(s). Please choose how to import:`;

        // Ask Merge or Replace
        const choice = await this.promptImportChoice(validCount);
        if (!choice) {
          statusBox.textContent = 'Import cancelled.';
          return;
        }

        if (choice === 'replace') {
          const confirmed = await confirmSheet.show({
            title: 'Replace All Current Records?',
            message: `This will permanently delete all existing records and replace them with the ${validCount} imported records. This cannot be undone.`,
            confirmLabel: 'Replace Everything',
            isDestructive: true
          });

          if (!confirmed) {
            statusBox.textContent = 'Replace cancelled.';
            return;
          }
        }

        if (this.onImportCallback) {
          await this.onImportCallback(validation.records, choice);
          toast.show(`Imported ${validCount} records (${choice === 'replace' ? 'Replaced' : 'Merged'})`);
          this.close();
        }
      } catch (err) {
        statusBox.style.backgroundColor = 'var(--status-overdue-bg)';
        statusBox.style.color = 'var(--status-overdue-text)';
        statusBox.textContent = `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
      }
    });
  }

          async promptImportChoice(count        )                                      {
    return new Promise((resolve) => {
      const choiceOverlay = document.createElement('div');
      choiceOverlay.className = 'modal-overlay is-open';
      choiceOverlay.setAttribute('role', 'dialog');
      choiceOverlay.innerHTML = `
        <div class="bottom-sheet" style="max-width: 420px; text-align: center;">
          <div class="sheet-grab-bar"></div>
          <div class="sheet-body" style="padding: 24px 20px 16px 20px;">
            <h3 class="sheet-title" style="font-size: 18px; margin-bottom: 8px;">Import ${count} Records</h3>
            <p style="font-size: 14px; color: var(--color-text-secondary); line-height: 1.45;">
              Choose whether to merge the imported records with your current data or replace your entire database.
            </p>
          </div>
          <div class="sheet-footer" style="flex-direction: column; gap: 8px; padding: 12px 20px 16px 20px;">
            <button type="button" id="btn-choice-merge" class="btn-primary" style="width: 100%; height: 44px;">
              Merge (Keep existing & add new)
            </button>
            <button type="button" id="btn-choice-replace" class="btn-destructive" style="width: 100%; height: 44px;">
              Replace (Overwrite all data)
            </button>
            <button type="button" id="btn-choice-cancel" class="btn-secondary" style="width: 100%; height: 44px; font-weight: 600;">
              Cancel
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(choiceOverlay);

      const cleanup = (choice                            ) => {
        document.body.removeChild(choiceOverlay);
        resolve(choice);
      };

      choiceOverlay.querySelector('#btn-choice-merge')?.addEventListener('click', () => cleanup('merge'));
      choiceOverlay.querySelector('#btn-choice-replace')?.addEventListener('click', () => cleanup('replace'));
      choiceOverlay.querySelector('#btn-choice-cancel')?.addEventListener('click', () => cleanup(null));
      choiceOverlay.addEventListener('click', (e) => {
        if (e.target === choiceOverlay) cleanup(null);
      });
    });
  }

         open(
    getRecords                                ,
    onImport                                                                        ,
    triggerEl              
  )       {
    this.getRecordsCallback = getRecords;
    this.onImportCallback = onImport;
    this.previousActiveElement = triggerEl || (document.activeElement               );

    const statusBox = this.overlayEl.querySelector('#import-status-box')               ;
    statusBox.style.display = 'none';
    statusBox.textContent = '';

    this.overlayEl.classList.add('is-open');
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
