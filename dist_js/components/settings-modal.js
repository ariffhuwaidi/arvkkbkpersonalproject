                                              
import { exportRecordsToJSON, validateImportJSON } from '../utils/export-import.js';
import { googleDriveService, GDRIVE_FOLDER_ID, GDRIVE_FOLDER_URL } from '../utils/google-drive.js';
import { MessageGenerator } from './message-generator.js';
import { confirmSheet } from './confirm-sheet.js';
import { toast } from './toast.js';
import { formatDisplayDate } from '../utils/date.js';

                                                                            

export class SettingsModal {
          overlayEl             ;
          activeTab              = 'message_gen';
          messageGenerator                  ;
          getRecordsCallback                                          = null;
          onImportCallback                                                                                  = null;
          previousActiveElement                     = null;

  constructor() {
    this.messageGenerator = new MessageGenerator();

    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Settings and Utilities');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet settings-sheet" style="max-width: 680px; max-height: 90vh;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <div>
            <span class="sheet-title">Settings / More</span>
            <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 2px;">
              Clinical Utilities & Data Management
            </div>
          </div>
          <button type="button" class="btn-icon" data-action="close" aria-label="Close settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Top Segmented Navigation -->
        <div class="settings-nav-bar" style="padding: 0 20px 10px 20px;">
          <div class="segmented-control settings-seg-ctrl" role="tablist">
            <button type="button" class="segment-btn is-active" data-set-tab="message_gen">Message Generator</button>
            <button type="button" class="segment-btn" data-set-tab="gdrive">Google Drive</button>
            <button type="button" class="segment-btn" data-set-tab="local_data">Local Data</button>
            <button type="button" class="segment-btn" data-set-tab="about">About</button>
          </div>
        </div>

        <div class="sheet-body settings-body" id="settings-content" style="padding-top: 8px;">
          <!-- Tab 1: Message Generator (Default) -->
          <div id="tab-pane-message_gen" class="settings-tab-pane"></div>

          <!-- Tab 2: Google Drive Backup -->
          <div id="tab-pane-gdrive" class="settings-tab-pane" style="display: none;"></div>

          <!-- Tab 3: Local Data Backup -->
          <div id="tab-pane-local_data" class="settings-tab-pane" style="display: none;"></div>

          <!-- Tab 4: About & Privacy -->
          <div id="tab-pane-about" class="settings-tab-pane" style="display: none;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);

    // Attach message generator element
    const msgPane = this.overlayEl.querySelector('#tab-pane-message_gen')               ;
    msgPane.appendChild(this.messageGenerator.getElement());

    this.bindEvents();
    this.renderGDrivePane();
    this.renderLocalDataPane();
    this.renderAboutPane();
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

    // Top Segment Switching
    const segContainer = this.overlayEl.querySelector('.settings-seg-ctrl')               ;
    segContainer.addEventListener('click', (e) => {
      const btn = (e.target               ).closest('.segment-btn')                     ;
      if (!btn) return;
      const targetTab = btn.getAttribute('data-set-tab')               ;
      this.switchTab(targetTab);
    });

    // Listen to Google Drive Service status changes
    googleDriveService.setStatusListener((status, lastTime, lastError) => {
      this.updateGDriveStatusUI(status, lastTime, lastError);
    });
  }

         switchTab(tab             )       {
    this.activeTab = tab;
    const segContainer = this.overlayEl.querySelector('.settings-seg-ctrl')               ;
    segContainer.querySelectorAll('.segment-btn').forEach(btn => {
      const isMatch = btn.getAttribute('data-set-tab') === tab;
      btn.classList.toggle('is-active', isMatch);
    });

    this.overlayEl.querySelectorAll('.settings-tab-pane').forEach((pane     ) => {
      pane.style.display = pane.id === `tab-pane-${tab}` ? 'block' : 'none';
    });

    if (tab === 'gdrive') {
      this.refreshGDriveFileList();
    }
  }

          renderGDrivePane()       {
    const pane = this.overlayEl.querySelector('#tab-pane-gdrive')               ;
    const clientId = googleDriveService.getClientId();
    const status = googleDriveService.getStatus();
    const lastTime = googleDriveService.getLastBackupTime();

    pane.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Status Card -->
        <div class="gdrive-status-card" style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div>
              <div style="font-size: 13px; font-weight: 600; color: var(--color-text-secondary);">Backup Status</div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span id="gdrive-status-dot" class="status-dot"></span>
                <span id="gdrive-status-label" style="font-size: 16px; font-weight: 700;">${status}</span>
              </div>
            </div>
            <div id="gdrive-auth-actions"></div>
          </div>

          <div id="gdrive-last-backup-text" style="font-size: 12.5px; color: var(--color-text-secondary); margin-top: 10px;">
            ${lastTime ? `Last Successful Backup: <strong>${new Date(lastTime).toLocaleString()}</strong>` : 'No Google Drive backup recorded yet on this device.'}
          </div>

          <div id="gdrive-error-banner" style="display: none; margin-top: 10px; padding: 8px 12px; background: var(--color-destructive-bg); color: var(--color-destructive); border-radius: 8px; font-size: 12.5px;"></div>
        </div>

        <!-- Destination Folder & Manual Backup -->
        <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Designated Backup Folder</h4>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 10px;">
            Target: <code>${GDRIVE_FOLDER_ID}</code>
          </p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <a href="${GDRIVE_FOLDER_URL}" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-msg-action" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span>Open in Google Drive</span>
            </a>
            <button type="button" id="btn-gdrive-backup-now" class="btn-primary btn-msg-action">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Backup Now</span>
            </button>
          </div>
        </div>

        <!-- Google OAuth Client ID Configuration -->
        <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Google OAuth 2.0 Client ID</h4>
          <p style="font-size: 12.5px; color: var(--color-text-secondary); margin-bottom: 10px;">
            Google requires a Web Client ID configured with your GitHub Pages origin. Enter your Google OAuth Client ID below:
          </p>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="gdrive-client-id-input" class="form-input" placeholder="e.g. 123456789-xxxx.apps.googleusercontent.com" value="${clientId}" style="font-family: monospace; font-size: 12.5px;" />
            <button type="button" id="btn-save-gdrive-client-id" class="btn-secondary" style="font-weight: 600; flex-shrink: 0;">Save ID</button>
          </div>
        </div>

        <!-- Available Backups in Google Drive for Restore -->
        <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <h4 style="font-size: 15px; font-weight: 600;">Restore from Google Drive</h4>
            <button type="button" id="btn-refresh-gdrive-files" class="btn-icon" style="width: 28px; height: 28px;" title="Refresh list">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
          </div>
          <p style="font-size: 12.5px; color: var(--color-text-secondary); margin-bottom: 10px;">
            Select a verified backup file to restore. A safety local snapshot is automatically created before any database changes.
          </p>
          <div id="gdrive-file-list" style="display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 12.5px; color: var(--color-text-tertiary); font-style: italic;">
              ${status === 'Connected' ? 'Loading backups from Google Drive...' : 'Connect Google Drive above to view backups.'}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindGDrivePaneEvents();
    this.updateGDriveStatusUI(status, lastTime);
  }

          bindGDrivePaneEvents()       {
    const pane = this.overlayEl.querySelector('#tab-pane-gdrive')               ;

    // Save Client ID
    const saveIdBtn = pane.querySelector('#btn-save-gdrive-client-id')                     ;
    const idInput = pane.querySelector('#gdrive-client-id-input')                    ;
    if (saveIdBtn && idInput) {
      saveIdBtn.addEventListener('click', () => {
        const val = idInput.value.trim();
        googleDriveService.setClientId(val);
        toast.show('Client ID saved');
      });
    }

    // Backup Now
    const backupNowBtn = pane.querySelector('#btn-gdrive-backup-now')                     ;
    if (backupNowBtn) {
      backupNowBtn.addEventListener('click', async () => {
        if (!this.getRecordsCallback) return;
        backupNowBtn.disabled = true;
        backupNowBtn.textContent = 'Uploading...';
        try {
          const records = await this.getRecordsCallback();
          const ok = await googleDriveService.uploadBackup(records);
          if (ok) {
            toast.show('Backup uploaded to Google Drive');
            this.refreshGDriveFileList();
          } else {
            toast.show('Backup failed. Check connection.');
          }
        } finally {
          backupNowBtn.disabled = false;
          backupNowBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Backup Now</span>
          `;
        }
      });
    }

    // Refresh Files
    const refreshBtn = pane.querySelector('#btn-refresh-gdrive-files')                     ;
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshGDriveFileList());
    }
  }

          updateGDriveStatusUI(status        , lastTime         , lastError         )       {
    const pane = this.overlayEl.querySelector('#tab-pane-gdrive')               ;
    if (!pane) return;

    const dot = pane.querySelector('#gdrive-status-dot')               ;
    const label = pane.querySelector('#gdrive-status-label')               ;
    const authActions = pane.querySelector('#gdrive-auth-actions')               ;
    const lastText = pane.querySelector('#gdrive-last-backup-text')               ;
    const errorBanner = pane.querySelector('#gdrive-error-banner')               ;

    if (label) label.textContent = status;

    if (dot) {
      dot.className = 'status-dot';
      if (status === 'Connected') dot.classList.add('status-connected');
      else if (status === 'Backup Successful') dot.classList.add('status-success');
      else if (status === 'Backing Up') dot.classList.add('status-backingup');
      else if (status === 'Backup Failed') dot.classList.add('status-failed');
      else dot.classList.add('status-disconnected');
    }

    if (lastText && lastTime) {
      lastText.innerHTML = `Last Successful Backup: <strong>${new Date(lastTime).toLocaleString()}</strong>`;
    }

    if (errorBanner) {
      if (lastError) {
        errorBanner.textContent = lastError;
        errorBanner.style.display = 'block';
      } else {
        errorBanner.style.display = 'none';
      }
    }

    if (authActions) {
      if (status === 'Not Connected') {
        authActions.innerHTML = `
          <button type="button" id="btn-gdrive-connect" class="btn-primary" style="font-size: 13px; padding: 6px 14px;">
            Connect Account
          </button>
        `;
        authActions.querySelector('#btn-gdrive-connect')?.addEventListener('click', async () => {
          const ok = await googleDriveService.authorize();
          if (ok) {
            toast.show('Connected to Google Drive');
            this.refreshGDriveFileList();
          }
        });
      } else {
        authActions.innerHTML = `
          <button type="button" id="btn-gdrive-disconnect" class="btn-secondary" style="font-size: 12.5px; padding: 4px 10px;">
            Disconnect
          </button>
        `;
        authActions.querySelector('#btn-gdrive-disconnect')?.addEventListener('click', () => {
          googleDriveService.disconnect();
          toast.show('Disconnected from Google Drive');
        });
      }
    }
  }

          async refreshGDriveFileList()                {
    const listEl = this.overlayEl.querySelector('#gdrive-file-list')               ;
    if (!listEl) return;

    if (googleDriveService.getStatus() === 'Not Connected') {
      listEl.innerHTML = `<div style="font-size: 12.5px; color: var(--color-text-tertiary); font-style: italic;">Connect Google Drive above to list backups.</div>`;
      return;
    }

    listEl.innerHTML = `<div style="font-size: 12.5px; color: var(--color-text-secondary);">Querying Google Drive folder...</div>`;
    const files = await googleDriveService.listBackups();

    if (files.length === 0) {
      listEl.innerHTML = `<div style="font-size: 12.5px; color: var(--color-text-secondary); padding: 8px 0;">No backup files found in designated Google Drive folder yet. Tap "Backup Now" to create your first backup.</div>`;
      return;
    }

    listEl.innerHTML = files.map(f => {
      const createdDate = f.createdTime ? new Date(f.createdTime).toLocaleString() : '';
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--color-bg-primary); border-radius: var(--radius-sm); font-size: 13px;">
          <div>
            <div style="font-weight: 600; font-family: monospace; font-size: 12px;">${f.name}</div>
            <div style="font-size: 11.5px; color: var(--color-text-secondary); margin-top: 2px;">${createdDate}</div>
          </div>
          <button type="button" class="btn-secondary btn-restore-file" data-file-id="${f.id}" data-file-name="${f.name}" style="font-size: 12px; padding: 4px 10px;">
            Restore
          </button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.btn-restore-file').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fileId = btn.getAttribute('data-file-id');
        const fileName = btn.getAttribute('data-file-name');
        if (!fileId || !fileName) return;

        await this.handleRestoreGDriveFile(fileId, fileName);
      });
    });
  }

          async handleRestoreGDriveFile(fileId        , fileName        )                {
    try {
      toast.show('Downloading backup from Google Drive...');
      const payload = await googleDriveService.downloadBackup(fileId);

      const records = Array.isArray(payload.records) ? payload.records : (Array.isArray(payload) ? payload : null);
      if (!records) {
        throw new Error('Invalid backup file: no records found');
      }

      const count = records.length;
      const exportTime = payload.exportedAt ? new Date(payload.exportedAt).toLocaleString() : 'Unknown';

      // Confirmation Dialogue
      const confirmed = await confirmSheet.show({
        title: 'Restore Backup from Google Drive?',
        message: `File: "${fileName}"\nExported: ${exportTime}\nRecords Count: ${count} patients\n\nRestoring will replace current local database with this backup. A safety backup of current data will be created first.`,
        confirmLabel: 'Restore Database',
        cancelLabel: 'Cancel',
        isDestructive: true
      });

      if (!confirmed) return;

      // Create safety snapshot of local data before restoration
      if (this.getRecordsCallback) {
        const currentRecords = await this.getRecordsCallback();
        googleDriveService.savePreRestoreSafetySnapshot(currentRecords);
      }

      if (this.onImportCallback) {
        await this.onImportCallback(records, 'replace');
        toast.show(`Restored ${count} patient records`);
        this.close();
      }
    } catch (err     ) {
      console.error(err);
      toast.show(`Restore failed: ${err.message || 'Error'}`);
    }
  }

          renderLocalDataPane()       {
    const pane = this.overlayEl.querySelector('#tab-pane-local_data')               ;
    pane.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Export Local JSON</h4>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
            Download an uncompressed JSON file containing all patient records, TCA histories, and blood collection records stored on this device.
          </p>
          <button type="button" id="btn-export-local-json" class="btn-primary" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Export JSON File</span>
          </button>
        </div>

        <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Import Local JSON</h4>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
            Restore or merge patient records from an ARV KKBK JSON backup file. Validates schema before applying.
          </p>
          <input type="file" id="local-file-import-input" accept=".json,application/json" style="display: none;" />
          <button type="button" id="btn-trigger-local-import" class="btn-secondary" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Select JSON File</span>
          </button>
        </div>
      </div>
    `;

    // Wire local export/import
    const exportBtn = pane.querySelector('#btn-export-local-json')                     ;
    const importBtn = pane.querySelector('#btn-trigger-local-import')                     ;
    const fileInput = pane.querySelector('#local-file-import-input')                    ;

    exportBtn?.addEventListener('click', async () => {
      if (this.getRecordsCallback) {
        const records = await this.getRecordsCallback();
        exportRecordsToJSON(records);
        toast.show(`Exported ${records.length} records`);
      }
    });

    importBtn?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const { valid, records, error } = validateImportJSON(json);

        if (!valid || !records) {
          toast.show(`Import error: ${error || 'Invalid JSON format'}`);
          return;
        }

        const modeChoice = await confirmSheet.show({
          title: 'Import Records',
          message: `Found ${records.length} valid patient records in file "${file.name}".\n\nChoose 'Merge' to combine with existing data, or 'Replace' to overwrite all existing records.`,
          confirmLabel: 'Merge Records',
          cancelLabel: 'Replace All',
          isDestructive: false
        });

        const mode                      = modeChoice ? 'merge' : 'replace';

        if (this.onImportCallback) {
          await this.onImportCallback(records, mode);
          toast.show(`Successfully imported ${records.length} records (${mode})`);
          this.close();
        }
      } catch (err     ) {
        toast.show(`Failed to parse file: ${err.message || 'Error'}`);
      } finally {
        fileInput.value = '';
      }
    });
  }

          renderAboutPane()       {
    const pane = this.overlayEl.querySelector('#tab-pane-about')               ;
    pane.innerHTML = `
      <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 18px; font-size: 13.5px; line-height: 1.5;">
        <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">ARV KKBK — Personal Record Tracker</h4>
        <p style="color: var(--color-text-secondary); margin-bottom: 12px;">
          Designed for Klinik Kesihatan Bandar Kulim (KKBK) Antiretroviral & TCA clinical administration.
        </p>

        <div style="background: var(--color-bg-primary); border: 1px solid var(--color-separator); border-radius: var(--radius-md); padding: 12px; margin-bottom: 14px; font-size: 12.5px;">
          <strong>Laboratory Routing Rules:</strong>
          <ul style="margin-left: 18px; margin-top: 6px;">
            <li>All samples collected at: <strong>Klinik Kesihatan Bandar Kulim</strong>.</li>
            <li>CD4 samples sent to: <strong>KK Taman Intan</strong>.</li>
            <li>HIV Viral Load samples sent to: <strong>Hospital Sultanah Bahiyah (HSB)</strong>.</li>
          </ul>
        </div>

        <div style="font-size: 12px; color: var(--color-text-tertiary); line-height: 1.45;">
          <strong>Security Notice:</strong> All data is stored locally in client-side IndexedDB on this device. Never upload unencrypted identifiable patient medical records to public cloud repositories without appropriate KKM approvals.
        </div>
      </div>
    `;
  }

         open(
    getRecords                                ,
    onImport                                                                        ,
    initialTab              = 'message_gen',
    triggerEl              
  )       {
    this.getRecordsCallback = getRecords;
    this.onImportCallback = onImport;
    this.previousActiveElement = triggerEl || (document.activeElement               );

    this.switchTab(initialTab);
    document.body.classList.add('modal-open');
    this.overlayEl.classList.add('is-open');
  }

         close()       {
    if (!this.isOpen()) return;
    document.body.classList.remove('modal-open');
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

         isOpen()          {
    return this.overlayEl.classList.contains('is-open');
  }
}
