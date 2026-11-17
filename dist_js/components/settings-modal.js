                                                         
import { exportRecordsToJSON, validateImportJSON } from '../utils/export-import.js';
                                                          
import { googleDriveService, GDRIVE_FOLDER_ID, GDRIVE_FOLDER_URL } from '../utils/google-drive.js';
import { themeManager } from '../utils/theme.js';
import {
  AUTO_LOCK_OPTIONS,
  getAutoLockSeconds,
  hasPin,
  isValidPinFormat,
  MAX_PIN_LENGTH,
  MIN_PIN_LENGTH,
  removePin,
  setAutoLockSeconds,
  setPin,
  verifyPin
} from '../utils/app-lock.js';
import {
  changeBackupPassphrase,
  ensureBackupPassphrase,
  hasPassphraseVerifier,
  isBackupEncryptionEnabled,
  openBackupText,
  setBackupEncryptionEnabled
} from '../utils/backup-passphrase.js';
import { DELETE_RETENTION_DAYS } from '../utils/merge.js';
import { MessageGenerator } from './message-generator.js';
import { confirmSheet } from './confirm-sheet.js';
import { toast } from './toast.js';
import { formatDisplayDate } from '../utils/date.js';

                                                                                                     

                                   
                                                                               
                                
                                              
                                                  
                                                
                        
 

function escapeText(value        )         {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class SettingsModal {
          overlayEl             ;
          activeTab              = 'message_gen';
          messageGenerator                  ;
          getRecordsCallback                                          = null;
          onImportCallback                                                                                  = null;
          previousActiveElement                     = null;
          handlers                          = null;
          pinMode                                     = null;

         configure(handlers                  )       {
    this.handlers = handlers;
  }

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
            <button type="button" class="segment-btn" data-set-tab="security">Security</button>
            <button type="button" class="segment-btn" data-set-tab="deleted">Recently Deleted</button>
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

          <!-- Tab 4: Security -->
          <div id="tab-pane-security" class="settings-tab-pane" style="display: none;"></div>

          <!-- Tab 5: Recently Deleted -->
          <div id="tab-pane-deleted" class="settings-tab-pane" style="display: none;"></div>

          <!-- Tab 6: About & Privacy -->
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
    this.renderSecurityPane();
    this.renderDeletedPane();
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
    if (tab === 'security') {
      this.renderSecurityPane();
    }
    if (tab === 'deleted') {
      void this.refreshDeletedList();
    }
    if (tab === 'local_data') {
      this.refreshLocalDataHint();
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
          <p style="font-size: 12.5px; color: var(--color-text-secondary); margin-bottom: 10px;">
            Sync Now brings in changes made on your other device (the newest edit to each patient wins), then uploads the combined result. Backups are encrypted with your backup passphrase.
          </p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <a href="${GDRIVE_FOLDER_URL}" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-msg-action" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span>Open in Google Drive</span>
            </a>
            <button type="button" id="btn-gdrive-sync-now" class="btn-secondary btn-msg-action" title="Pull the newest backup, merge it with this device, then upload the result">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              <span>Sync Now</span>
            </button>
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

    // Sync Now
    const syncBtn = pane.querySelector('#btn-gdrive-sync-now')                     ;
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        if (!this.handlers) return;
        if (googleDriveService.getStatus() === 'Not Connected') {
          toast.show('Connect Google Drive first');
          return;
        }
        syncBtn.disabled = true;
        const label = syncBtn.querySelector('span');
        if (label) label.textContent = 'Syncing...';
        try {
          const message = await this.handlers.onSync();
          toast.show(message, 4000);
          this.refreshGDriveFileList();
        } catch (err     ) {
          toast.show(`Sync failed: ${err.message || 'Error'}`, 4000);
        } finally {
          syncBtn.disabled = false;
          if (label) label.textContent = 'Sync Now';
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
      const downloaded = await googleDriveService.downloadBackupRecords(fileId);
      if (!downloaded) return; // passphrase prompt cancelled

      const records = downloaded.records;
      const count = records.filter(r => !(r                 ).deletedAt).length;
      const exportTime = downloaded.exportedAt ? new Date(downloaded.exportedAt).toLocaleString() : 'Unknown';

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
            Download a JSON file of the records stored on this device, including TCA histories and blood collections.
          </p>
          <label class="pp-label" for="export-scope">What to include</label>
          <select id="export-scope" class="form-input" style="margin-bottom: 10px;">
            <option value="all">Everything (ARV and MMT)</option>
            <option value="ARV">ARV patients only</option>
            <option value="MMT">MMT patients only</option>
          </select>
          <label class="settings-check">
            <input type="checkbox" id="export-encrypt" checked />
            <span>Encrypt with my backup passphrase (recommended)</span>
          </label>
          <button type="button" id="btn-export-local-json" class="btn-primary" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Export JSON File</span>
          </button>
        </div>

        <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Import Local JSON</h4>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
            Restore or merge patient records from an ARV KKBK backup file, encrypted or not. Validates the file before applying.
          </p>
          <p id="local-data-hint" style="font-size: 12.5px; color: var(--color-text-tertiary); margin-bottom: 10px;"></p>
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
      if (!this.getRecordsCallback) return;
      const scope = (pane.querySelector('#export-scope')                     ).value               ;
      const encrypt = (pane.querySelector('#export-encrypt')                    ).checked;

      let passphrase                    ;
      if (encrypt) {
        const pass = await ensureBackupPassphrase();
        if (!pass) return;
        passphrase = pass;
      } else {
        const proceed = await confirmSheet.show({
          title: 'Export without encryption?',
          message: 'The file will contain names, IC numbers and phone numbers in plain text. Anyone who opens it can read them. Do not send it by chat or email, and delete it when you are done.',
          confirmLabel: 'Export Unencrypted',
          cancelLabel: 'Cancel',
          isDestructive: true
        });
        if (!proceed) return;
      }

      try {
        const records = await this.getRecordsCallback();
        const count = await exportRecordsToJSON(records, { scope, passphrase });
        toast.show(`Exported ${count} ${count === 1 ? 'record' : 'records'}${passphrase ? ' (encrypted)' : ''}`);
      } catch (err     ) {
        toast.show(`Export failed: ${err.message || 'Error'}`);
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
        const opened = await openBackupText(text);
        if (!opened.ok) {
          if (!opened.cancelled) toast.show(`Import error: ${opened.error}`);
          return;
        }
        const { valid, records, error } = validateImportJSON(opened.payload);

        if (!valid || !records) {
          toast.show(`Import error: ${error || 'Invalid JSON format'}`);
          return;
        }

        const live = records.filter(r => !r.deletedAt);
        const arvCount = live.filter(r => (r.programs || ['ARV']).includes('ARV')).length;
        const mmtCount = live.filter(r => (r.programs || ['ARV']).includes('MMT')).length;

        const modeChoice = await confirmSheet.show({
          title: 'Import Records',
          message: `File "${file.name}" has ${live.length} patients (${arvCount} ARV, ${mmtCount} MMT).\n\nMerge combines with what is on this device and keeps the newest edit for each patient. Replace All erases everything on this device first, including patients in the other program.`,
          confirmLabel: 'Merge Records',
          cancelLabel: 'Replace All',
          isDestructive: false
        });

        const mode                      = modeChoice ? 'merge' : 'replace';

        if (mode === 'replace') {
          const sure = await confirmSheet.show({
            title: 'Replace everything?',
            message: 'All patients currently on this device will be erased and replaced by the file. A safety copy is kept for a few days.',
            confirmLabel: 'Replace Everything',
            cancelLabel: 'Cancel',
            isDestructive: true
          });
          if (!sure) return;
          if (this.getRecordsCallback) {
            googleDriveService.savePreRestoreSafetySnapshot(await this.getRecordsCallback());
          }
        }

        if (this.onImportCallback) {
          await this.onImportCallback(records, mode);
          toast.show(`Imported ${live.length} patients (${mode})`);
          this.close();
        }
      } catch (err     ) {
        toast.show(`Failed to parse file: ${err.message || 'Error'}`);
      } finally {
        fileInput.value = '';
      }
    });
  }

          refreshLocalDataHint()       {
    const hint = this.overlayEl.querySelector('#local-data-hint')                      ;
    if (!hint) return;
    hint.textContent = 'Older ARV-only backups import as ARV patients. Encrypted files ask for their passphrase.';
  }

  // ---------------------------------------------------------------- Security
          renderSecurityPane()       {
    const pane = this.overlayEl.querySelector('#tab-pane-security')               ;
    const pinOn = hasPin();
    const timeout = getAutoLockSeconds();
    const encOn = isBackupEncryptionEnabled();
    const theme = themeManager.getMode();

    const card = 'background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;';
    const h4 = 'font-size: 15px; font-weight: 600; margin-bottom: 4px;';
    const note = 'font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;';

    pane.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="${card}">
          <h4 style="${h4}">App lock</h4>
          <p style="${note}">
            ${pinOn
              ? 'A PIN is required to open the app. The screen is hidden in the app switcher, and the app locks itself after the delay below.'
              : 'Set a PIN so the app cannot be opened by anyone who picks up your phone. This does not replace your phone passcode.'}
          </p>
          <div id="pin-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${pinOn
              ? `<button type="button" class="btn-secondary" data-pin-action="change" style="font-weight: 600;">Change PIN</button>
                 <button type="button" class="btn-secondary" data-pin-action="lock" style="font-weight: 600;">Lock now</button>
                 <button type="button" class="btn-secondary" data-pin-action="remove" style="font-weight: 600; color: var(--color-destructive);">Turn off PIN</button>`
              : `<button type="button" class="btn-primary" data-pin-action="set">Set a PIN</button>`}
          </div>

          <form id="pin-form" hidden autocomplete="off" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
            <div id="pin-current-wrap" hidden>
              <label class="pp-label" for="pin-current">Current PIN</label>
              <input id="pin-current" class="form-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="${MAX_PIN_LENGTH}" autocomplete="off" />
            </div>
            <div id="pin-new-wrap">
              <label class="pp-label" for="pin-new">New PIN (${MIN_PIN_LENGTH} to ${MAX_PIN_LENGTH} digits)</label>
              <input id="pin-new" class="form-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="${MAX_PIN_LENGTH}" autocomplete="new-password" />
              <label class="pp-label" for="pin-new2" style="margin-top: 8px; display: block;">Repeat new PIN</label>
              <input id="pin-new2" class="form-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="${MAX_PIN_LENGTH}" autocomplete="new-password" />
            </div>
            <p class="pp-warning" id="pin-warning" hidden>The PIN cannot be recovered. If you forget it, the only way back in is to clear this site's data and restore from an encrypted backup.</p>
            <p class="pp-error" id="pin-error" role="alert"></p>
            <div style="display: flex; gap: 8px;">
              <button type="submit" class="btn-primary" id="pin-save" style="flex: 1;">Save</button>
              <button type="button" class="btn-secondary" id="pin-cancel" style="flex: 1; font-weight: 600;">Cancel</button>
            </div>
          </form>

          ${pinOn ? `
          <label class="pp-label" for="auto-lock-select" style="margin-top: 14px; display: block;">Lock the app</label>
          <select id="auto-lock-select" class="form-input">
            ${AUTO_LOCK_OPTIONS.map(o => `<option value="${o.seconds}" ${o.seconds === timeout ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>` : ''}
        </div>

        <div style="${card}">
          <h4 style="${h4}">Backup encryption</h4>
          <p style="${note}">
            Backups and exports are locked with a passphrase before they leave this device. ${hasPassphraseVerifier() ? 'A passphrase is set up.' : 'You will be asked to create a passphrase at your first backup.'}
          </p>
          <label class="settings-check">
            <input type="checkbox" id="backup-encrypt-toggle" ${encOn ? 'checked' : ''} />
            <span>Encrypt Google Drive backups</span>
          </label>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
            <button type="button" class="btn-secondary" id="btn-change-passphrase" style="font-weight: 600;">${hasPassphraseVerifier() ? 'Change passphrase' : 'Create passphrase'}</button>
          </div>
        </div>

        <div style="${card}">
          <h4 style="${h4}">Appearance</h4>
          <div class="segmented-control" id="theme-seg" role="radiogroup" aria-label="Theme" style="margin-top: 8px;">
            ${(['system', 'light', 'dark']               ).map(m => `<button type="button" class="segment-btn ${m === theme ? 'is-active' : ''}" role="radio" aria-checked="${m === theme}" data-theme-mode="${m}">${m.charAt(0).toUpperCase() + m.slice(1)}</button>`).join('')}
          </div>
        </div>
      </div>
    `;

    this.bindSecurityPane(pane);
  }

          bindSecurityPane(pane             )       {
    const form = pane.querySelector('#pin-form')                   ;
    const errorEl = pane.querySelector('#pin-error')               ;
    const currentWrap = pane.querySelector('#pin-current-wrap')               ;
    const newWrap = pane.querySelector('#pin-new-wrap')               ;
    const warning = pane.querySelector('#pin-warning')               ;
    const actions = pane.querySelector('#pin-actions')               ;

    const openForm = (mode                             ) => {
      this.pinMode = mode;
      form.hidden = false;
      actions.hidden = true;
      errorEl.textContent = '';
      currentWrap.hidden = mode === 'set';
      newWrap.hidden = mode === 'remove';
      warning.hidden = mode === 'remove';
      (form.querySelector('#pin-save')               ).textContent = mode === 'remove' ? 'Turn off PIN' : 'Save PIN';
      const first = (mode === 'set' ? form.querySelector('#pin-new') : form.querySelector('#pin-current'))                    ;
      first?.focus();
    };
    const closeForm = () => {
      this.pinMode = null;
      this.renderSecurityPane();
    };

    pane.querySelectorAll('[data-pin-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-pin-action');
        if (action === 'lock') {
          this.close();
          this.handlers?.onLockNow();
        } else if (action === 'set' || action === 'change' || action === 'remove') {
          openForm(action);
        }
      });
    });

    (pane.querySelector('#pin-cancel')                      )?.addEventListener('click', closeForm);

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      const val = (id        ) => (form.querySelector(id)                           )?.value || '';
      const mode = this.pinMode;
      if (!mode) return;

      if (mode === 'change' || mode === 'remove') {
        const check = await verifyPin(val('#pin-current'));
        if (!check.ok) {
          errorEl.textContent = check.reason === 'throttled'
            ? `Too many attempts. Try again in ${check.retryInSeconds}s.`
            : 'The current PIN is not correct.';
          return;
        }
      }

      if (mode === 'remove') {
        removePin();
        toast.show('PIN turned off');
        closeForm();
        return;
      }

      const next = val('#pin-new');
      if (!isValidPinFormat(next)) {
        errorEl.textContent = `Use ${MIN_PIN_LENGTH} to ${MAX_PIN_LENGTH} digits, numbers only.`;
        return;
      }
      if (next !== val('#pin-new2')) {
        errorEl.textContent = 'The two PINs do not match.';
        return;
      }
      if (/^(\d)\1+$/.test(next) || next === '1234' || next === '123456' || next === '0000') {
        errorEl.textContent = 'That PIN is too easy to guess. Choose another.';
        return;
      }
      await setPin(next);
      toast.show(mode === 'set' ? 'PIN set' : 'PIN changed');
      closeForm();
    });

    (pane.querySelector('#auto-lock-select')                            )?.addEventListener('change', (e) => {
      setAutoLockSeconds(Number((e.target                     ).value));
      toast.show('Auto-lock updated');
    });

    (pane.querySelector('#backup-encrypt-toggle')                           )?.addEventListener('change', async (e) => {
      const input = e.target                    ;
      if (!input.checked) {
        const sure = await confirmSheet.show({
          title: 'Turn off backup encryption?',
          message: 'New Google Drive backups will be readable by anyone with access to your Drive folder, including names and IC numbers.',
          confirmLabel: 'Turn Off Encryption',
          cancelLabel: 'Keep Encrypting',
          isDestructive: true
        });
        if (!sure) {
          input.checked = true;
          return;
        }
      }
      setBackupEncryptionEnabled(input.checked);
      toast.show(input.checked ? 'Backups will be encrypted' : 'Backup encryption off');
    });

    (pane.querySelector('#btn-change-passphrase')                      )?.addEventListener('click', async () => {
      const ok = await changeBackupPassphrase();
      if (ok) {
        toast.show('Backup passphrase updated');
        this.renderSecurityPane();
      }
    });

    pane.querySelectorAll('[data-theme-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-theme-mode')             ;
        themeManager.setTheme(mode);
        pane.querySelectorAll('[data-theme-mode]').forEach(b => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-checked', String(on));
        });
      });
    });
  }

  // ---------------------------------------------------------- Recently deleted
          renderDeletedPane()       {
    const pane = this.overlayEl.querySelector('#tab-pane-deleted')               ;
    pane.innerHTML = `
      <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
        <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Recently Deleted</h4>
        <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
          Deleted patients are kept for ${DELETE_RETENTION_DAYS} days so a mistake can be undone, then removed for good.
        </p>
        <div id="deleted-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
      </div>
    `;
  }

          async refreshDeletedList()                {
    const listEl = this.overlayEl.querySelector('#deleted-list')                      ;
    if (!listEl || !this.handlers) return;

    const deleted = await this.handlers.listDeleted();
    if (deleted.length === 0) {
      listEl.innerHTML = `<div style="font-size: 13px; color: var(--color-text-secondary);">Nothing here. Deleted patients will appear in this list.</div>`;
      return;
    }

    const now = Date.now();
    listEl.innerHTML = deleted.map(r => {
      const when = r.deletedAt ? Date.parse(r.deletedAt) : now;
      const daysLeft = Math.max(0, Math.ceil(DELETE_RETENTION_DAYS - (now - when) / 86400000));
      const programs = (r.programs && r.programs.length ? r.programs : ['ARV']).join(' + ');
      return `
        <div class="deleted-row">
          <div class="deleted-row-main">
            <div class="deleted-row-name">${escapeText(r.name)}</div>
            <div class="deleted-row-meta">${escapeText(programs)} · deleted ${new Date(when).toLocaleDateString()} · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left</div>
          </div>
          <div class="deleted-row-actions">
            <button type="button" class="btn-secondary" data-restore="${escapeText(r.id)}" style="font-weight: 600;">Restore</button>
            <button type="button" class="btn-secondary" data-purge="${escapeText(r.id)}" data-name="${escapeText(r.name)}" style="font-weight: 600; color: var(--color-destructive);">Delete now</button>
          </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('[data-restore]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.handlers?.onRestoreDeleted(btn.getAttribute('data-restore') || '');
        toast.show('Patient restored');
        void this.refreshDeletedList();
      });
    });
    listEl.querySelectorAll('[data-purge]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-name') || 'this patient';
        const sure = await confirmSheet.show({
          title: 'Delete permanently?',
          message: `"${name}" and all of their history will be erased now. This cannot be undone.`,
          confirmLabel: 'Delete Permanently',
          cancelLabel: 'Keep',
          isDestructive: true
        });
        if (!sure) return;
        await this.handlers?.onPurgeDeleted(btn.getAttribute('data-purge') || '');
        toast.show('Permanently deleted');
        void this.refreshDeletedList();
      });
    });
  }

          renderAboutPane()       {
    const pane = this.overlayEl.querySelector('#tab-pane-about')               ;
    pane.innerHTML = `
      <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 18px; font-size: 13.5px; line-height: 1.5;">
        <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">ARV KKBK — Personal Record Tracker</h4>
        <p style="color: var(--color-text-secondary); margin-bottom: 12px;">
          Designed for Klinik Kesihatan Bandar Kulim (KKBK) Antiretroviral and Methadone Maintenance Therapy (MMT) appointment administration.
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
          <strong>Security Notice:</strong> All data is stored locally in client-side IndexedDB on this device. Use the PIN lock, keep backups encrypted, and never upload identifiable patient records to public repositories or share unencrypted exports. Confirm with your clinic that storing patient records on a personal device is permitted.
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
