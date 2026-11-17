import type { PatientRecord, ThemeMode } from '../types';
import { exportRecordsToJSON, validateImportJSON } from '../utils/export-import';
import type { ExportScope } from '../utils/export-import';
import { googleDriveService, GDRIVE_FOLDER_ID, GDRIVE_FOLDER_URL } from '../utils/google-drive';
import { themeManager } from '../utils/theme';
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
} from '../utils/app-lock';
import {
  changeBackupPassphrase,
  ensureBackupPassphrase,
  hasPassphraseVerifier,
  isBackupEncryptionEnabled,
  openBackupText,
  setBackupEncryptionEnabled
} from '../utils/backup-passphrase';
import { DELETE_RETENTION_DAYS } from '../utils/merge';
import { saveSafetySnapshot } from '../storage/safety-snapshot';
import { MessageGenerator } from './message-generator';
import { confirmSheet } from './confirm-sheet';
import { toast } from './toast';
import { formatDisplayDate } from '../utils/date';

export type SettingsTab = 'message_gen' | 'gdrive' | 'local_data' | 'security' | 'deleted' | 'about';

export interface SettingsHandlers {
  /** Pull the newest Drive backup, merge it, then upload the merged result. */
  onSync: () => Promise<string>;
  listDeleted: () => Promise<PatientRecord[]>;
  onRestoreDeleted: (id: string) => Promise<void>;
  onPurgeDeleted: (id: string) => Promise<void>;
  onLockNow: () => void;
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class SettingsModal {
  private overlayEl: HTMLElement;
  private activeTab: SettingsTab = 'message_gen';
  private messageGenerator: MessageGenerator;
  private getRecordsCallback: (() => Promise<PatientRecord[]>) | null = null;
  private onImportCallback: ((records: PatientRecord[], mode: 'merge' | 'replace') => Promise<void>) | null = null;
  private handlers: SettingsHandlers | null = null;
  private pinMode: 'set' | 'change' | 'remove' | null = null;

  public configure(handlers: SettingsHandlers): void {
    this.handlers = handlers;
  }

  constructor() {
    this.messageGenerator = new MessageGenerator();

    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'settings-page';
    this.overlayEl.setAttribute('aria-label', 'Settings');

    const chevron = '<svg class="settings-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    const row = (id: SettingsTab, title: string, sub: string) => `
      <button type="button" class="settings-row" data-set-tab="${id}">
        <span class="settings-row-text"><span class="settings-row-title">${title}</span><span class="settings-row-sub">${sub}</span></span>
        ${chevron}
      </button>`;

    this.overlayEl.innerHTML = `
      <div class="settings-shell">
        <section class="settings-home" id="settings-home">
          <h2 class="settings-page-title">More</h2>
          <div class="settings-list">
            ${row('message_gen', 'Message Generator', 'Appointment reminders in Bahasa Melayu')}
            ${row('gdrive', 'Google Drive', 'Backups and Sync Now')}
            ${row('local_data', 'Local Data', 'Export files or load a backup file')}
            ${row('security', 'Security', 'PIN lock and backup encryption')}
            ${row('deleted', 'Recently Deleted', 'Restore patients for 30 days')}
            ${row('about', 'About', 'Privacy and data notes')}
          </div>
        </section>

        <section class="settings-detail" id="settings-detail" hidden>
          <div class="settings-detail-head">
            <button type="button" class="settings-back" data-action="back" aria-label="Back to More">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              <span>More</span>
            </button>
            <h2 class="settings-detail-title" id="settings-detail-title"></h2>
          </div>
          <div class="settings-body" id="settings-content">
            <div id="tab-pane-message_gen" class="settings-tab-pane"></div>
            <div id="tab-pane-gdrive" class="settings-tab-pane" style="display: none;"></div>
            <div id="tab-pane-local_data" class="settings-tab-pane" style="display: none;"></div>
            <div id="tab-pane-security" class="settings-tab-pane" style="display: none;"></div>
            <div id="tab-pane-deleted" class="settings-tab-pane" style="display: none;"></div>
            <div id="tab-pane-about" class="settings-tab-pane" style="display: none;"></div>
          </div>
        </section>
      </div>
    `;

    document.body.appendChild(this.overlayEl);

    // Attach message generator element
    const msgPane = this.overlayEl.querySelector('#tab-pane-message_gen') as HTMLElement;
    msgPane.appendChild(this.messageGenerator.getElement());

    this.bindEvents();
    this.renderGDrivePane();
    this.renderLocalDataPane();
    this.renderSecurityPane();
    this.renderDeletedPane();
    this.renderAboutPane();
  }

  private bindEvents(): void {
    this.overlayEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-action="back"]')) {
        this.showHome();
        return;
      }
      const rowBtn = target.closest('.settings-row') as HTMLElement | null;
      if (rowBtn) {
        this.switchTab(rowBtn.getAttribute('data-set-tab') as SettingsTab);
      }
    });

    // Listen to Google Drive Service status changes
    googleDriveService.setStatusListener((status, lastTime, lastError) => {
      this.updateGDriveStatusUI(status, lastTime, lastError);
    });
  }

  private static TITLES: Record<SettingsTab, string> = {
    message_gen: 'Message Generator',
    gdrive: 'Google Drive',
    local_data: 'Local Data',
    security: 'Security',
    deleted: 'Recently Deleted',
    about: 'About'
  };

  public showHome(): void {
    (this.overlayEl.querySelector('#settings-home') as HTMLElement).hidden = false;
    (this.overlayEl.querySelector('#settings-detail') as HTMLElement).hidden = true;
    this.overlayEl.scrollTop = 0;
  }

  public switchTab(tab: SettingsTab): void {
    this.activeTab = tab;
    (this.overlayEl.querySelector('#settings-home') as HTMLElement).hidden = true;
    (this.overlayEl.querySelector('#settings-detail') as HTMLElement).hidden = false;
    (this.overlayEl.querySelector('#settings-detail-title') as HTMLElement).textContent = SettingsModal.TITLES[tab];
    this.overlayEl.scrollTop = 0;

    this.overlayEl.querySelectorAll('.settings-tab-pane').forEach((pane: any) => {
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

  private renderGDrivePane(): void {
    const pane = this.overlayEl.querySelector('#tab-pane-gdrive') as HTMLElement;
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

  private bindGDrivePaneEvents(): void {
    const pane = this.overlayEl.querySelector('#tab-pane-gdrive') as HTMLElement;

    // Save Client ID
    const saveIdBtn = pane.querySelector('#btn-save-gdrive-client-id') as HTMLButtonElement;
    const idInput = pane.querySelector('#gdrive-client-id-input') as HTMLInputElement;
    if (saveIdBtn && idInput) {
      saveIdBtn.addEventListener('click', () => {
        const val = idInput.value.trim();
        googleDriveService.setClientId(val);
        toast.show('Client ID saved');
      });
    }

    // Backup Now
    const backupNowBtn = pane.querySelector('#btn-gdrive-backup-now') as HTMLButtonElement;
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
    const syncBtn = pane.querySelector('#btn-gdrive-sync-now') as HTMLButtonElement;
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
        } catch (err: any) {
          toast.show(`Sync failed: ${err.message || 'Error'}`, 4000);
        } finally {
          syncBtn.disabled = false;
          if (label) label.textContent = 'Sync Now';
        }
      });
    }

    // Refresh Files
    const refreshBtn = pane.querySelector('#btn-refresh-gdrive-files') as HTMLButtonElement;
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshGDriveFileList());
    }
  }

  private updateGDriveStatusUI(status: string, lastTime?: string, lastError?: string): void {
    const pane = this.overlayEl.querySelector('#tab-pane-gdrive') as HTMLElement;
    if (!pane) return;

    const dot = pane.querySelector('#gdrive-status-dot') as HTMLElement;
    const label = pane.querySelector('#gdrive-status-label') as HTMLElement;
    const authActions = pane.querySelector('#gdrive-auth-actions') as HTMLElement;
    const lastText = pane.querySelector('#gdrive-last-backup-text') as HTMLElement;
    const errorBanner = pane.querySelector('#gdrive-error-banner') as HTMLElement;

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

  private async refreshGDriveFileList(): Promise<void> {
    const listEl = this.overlayEl.querySelector('#gdrive-file-list') as HTMLElement;
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

  private async handleRestoreGDriveFile(fileId: string, fileName: string): Promise<void> {
    try {
      toast.show('Downloading backup from Google Drive...');
      const downloaded = await googleDriveService.downloadBackupRecords(fileId);
      if (!downloaded) return; // passphrase prompt cancelled

      const records = downloaded.records;
      const count = records.filter(r => !(r as PatientRecord).deletedAt).length;
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
        await saveSafetySnapshot(await this.getRecordsCallback());
      }

      if (this.onImportCallback) {
        await this.onImportCallback(records, 'replace');
        toast.show(`Restored ${count} patient records`);
        this.close();
      }
    } catch (err: any) {
      console.error(err);
      toast.show(`Restore failed: ${err.message || 'Error'}`);
    }
  }

  private renderLocalDataPane(): void {
    const pane = this.overlayEl.querySelector('#tab-pane-local_data') as HTMLElement;
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

    // Wire the local export and file-load buttons
    const exportBtn = pane.querySelector('#btn-export-local-json') as HTMLButtonElement;
    const importBtn = pane.querySelector('#btn-trigger-local-import') as HTMLButtonElement;
    const fileInput = pane.querySelector('#local-file-import-input') as HTMLInputElement;

    exportBtn?.addEventListener('click', async () => {
      if (!this.getRecordsCallback) return;
      const scope = (pane.querySelector('#export-scope') as HTMLSelectElement).value as ExportScope;
      const encrypt = (pane.querySelector('#export-encrypt') as HTMLInputElement).checked;

      let passphrase: string | undefined;
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
      } catch (err: any) {
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

        const mode: 'merge' | 'replace' = modeChoice ? 'merge' : 'replace';

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
            await saveSafetySnapshot(await this.getRecordsCallback());
          }
        }

        if (this.onImportCallback) {
          await this.onImportCallback(records, mode);
          toast.show(`Imported ${live.length} patients (${mode})`);
          this.close();
        }
      } catch (err: any) {
        toast.show(`Failed to parse file: ${err.message || 'Error'}`);
      } finally {
        fileInput.value = '';
      }
    });
  }

  private refreshLocalDataHint(): void {
    const hint = this.overlayEl.querySelector('#local-data-hint') as HTMLElement | null;
    if (!hint) return;
    hint.textContent = 'Older ARV-only backups load as ARV patients. Encrypted files ask for their passphrase.';
  }

  // ---------------------------------------------------------------- Security
  private renderSecurityPane(): void {
    const pane = this.overlayEl.querySelector('#tab-pane-security') as HTMLElement;
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
            ${(['system', 'light', 'dark'] as ThemeMode[]).map(m => `<button type="button" class="segment-btn ${m === theme ? 'is-active' : ''}" role="radio" aria-checked="${m === theme}" data-theme-mode="${m}">${m.charAt(0).toUpperCase() + m.slice(1)}</button>`).join('')}
          </div>
        </div>
      </div>
    `;

    this.bindSecurityPane(pane);
  }

  private bindSecurityPane(pane: HTMLElement): void {
    const form = pane.querySelector('#pin-form') as HTMLFormElement;
    const errorEl = pane.querySelector('#pin-error') as HTMLElement;
    const currentWrap = pane.querySelector('#pin-current-wrap') as HTMLElement;
    const newWrap = pane.querySelector('#pin-new-wrap') as HTMLElement;
    const warning = pane.querySelector('#pin-warning') as HTMLElement;
    const actions = pane.querySelector('#pin-actions') as HTMLElement;

    const openForm = (mode: 'set' | 'change' | 'remove') => {
      this.pinMode = mode;
      form.hidden = false;
      actions.hidden = true;
      errorEl.textContent = '';
      currentWrap.hidden = mode === 'set';
      newWrap.hidden = mode === 'remove';
      warning.hidden = mode === 'remove';
      (form.querySelector('#pin-save') as HTMLElement).textContent = mode === 'remove' ? 'Turn off PIN' : 'Save PIN';
      const first = (mode === 'set' ? form.querySelector('#pin-new') : form.querySelector('#pin-current')) as HTMLInputElement;
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

    (pane.querySelector('#pin-cancel') as HTMLElement | null)?.addEventListener('click', closeForm);

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      const val = (id: string) => (form.querySelector(id) as HTMLInputElement | null)?.value || '';
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

    (pane.querySelector('#auto-lock-select') as HTMLSelectElement | null)?.addEventListener('change', (e) => {
      setAutoLockSeconds(Number((e.target as HTMLSelectElement).value));
      toast.show('Auto-lock updated');
    });

    (pane.querySelector('#backup-encrypt-toggle') as HTMLInputElement | null)?.addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
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

    (pane.querySelector('#btn-change-passphrase') as HTMLElement | null)?.addEventListener('click', async () => {
      const ok = await changeBackupPassphrase();
      if (ok) {
        toast.show('Backup passphrase updated');
        this.renderSecurityPane();
      }
    });

    pane.querySelectorAll('[data-theme-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-theme-mode') as ThemeMode;
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
  private renderDeletedPane(): void {
    const pane = this.overlayEl.querySelector('#tab-pane-deleted') as HTMLElement;
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

  private async refreshDeletedList(): Promise<void> {
    const listEl = this.overlayEl.querySelector('#deleted-list') as HTMLElement | null;
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

  private renderAboutPane(): void {
    const pane = this.overlayEl.querySelector('#tab-pane-about') as HTMLElement;
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

  /** Shows the settings page (the More tab). Call switchTab afterwards to jump to a section. */
  public open(
    getRecords: () => Promise<PatientRecord[]>,
    onImport: (records: PatientRecord[], mode: 'merge' | 'replace') => Promise<void>
  ): void {
    this.getRecordsCallback = getRecords;
    this.onImportCallback = onImport;
    if (!this.isOpen()) this.showHome();
    this.overlayEl.classList.add('is-open');
  }

  /** Leaves the current section and returns to the list. The page itself stays on the More tab. */
  public close(): void {
    this.showHome();
  }

  /** Hides the page when another tab is chosen. */
  public hide(): void {
    this.overlayEl.classList.remove('is-open');
  }

  public isOpen(): boolean {
    return this.overlayEl.classList.contains('is-open');
  }
}
