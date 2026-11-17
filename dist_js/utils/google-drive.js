             
                          
                        
               
                  
import { encryptJSON } from './crypto.js';
import { ensureBackupPassphrase, isBackupEncryptionEnabled, openBackupPayload } from './backup-passphrase.js';
import { CURRENT_SCHEMA_VERSION } from './export-import.js';

export const GDRIVE_FOLDER_ID = '1KSu4II21PraMavPwi6q2Y3ZUdPnedMVS';
export const GDRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${GDRIVE_FOLDER_ID}`;
export const GDRIVE_CLIENT_ID_KEY = 'arv_kkbk_gdrive_client_id';
export const GDRIVE_TOKEN_KEY = 'arv_kkbk_gdrive_access_token';
export const GDRIVE_TOKEN_EXP_KEY = 'arv_kkbk_gdrive_token_exp';
export const GDRIVE_LAST_BACKUP_KEY = 'arv_kkbk_gdrive_last_backup_time';
export const GDRIVE_LAST_FILE_KEY = 'arv_kkbk_gdrive_last_backup_file';
export const PRE_RESTORE_SAFETY_KEY = 'arv_kkbk_pre_restore_safety_backup';

export class GoogleDriveBackupService {
          status                          = 'Not Connected';
          isBackingUp = false;
          autoBackupTimer      = null;
          onStatusChangeCallback                                                                                            = null;
          lastError = '';

  constructor() {
    this.checkInitialConnection();
  }

         setStatusListener(callback                                                                                  )       {
    this.onStatusChangeCallback = callback;
    this.notifyStatus();
  }

          notifyStatus()       {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(this.status, this.getLastBackupTime(), this.lastError);
    }
  }

         getStatus()                          {
    return this.status;
  }

         getClientId()         {
    try {
      return localStorage.getItem(GDRIVE_CLIENT_ID_KEY) || '';
    } catch {
      return '';
    }
  }

         setClientId(clientId        )       {
    try {
      localStorage.setItem(GDRIVE_CLIENT_ID_KEY, clientId.trim());
      this.checkInitialConnection();
    } catch {}
  }

         getLastBackupTime()         {
    try {
      return localStorage.getItem(GDRIVE_LAST_BACKUP_KEY) || '';
    } catch {
      return '';
    }
  }

         getLastBackupFile()         {
    try {
      return localStorage.getItem(GDRIVE_LAST_FILE_KEY) || '';
    } catch {
      return '';
    }
  }

          getAccessToken()                {
    try {
      const token = sessionStorage.getItem(GDRIVE_TOKEN_KEY);
      const exp = Number(sessionStorage.getItem(GDRIVE_TOKEN_EXP_KEY) || '0');
      if (token && exp > Date.now()) {
        return token;
      }
    } catch {}
    return null;
  }

          saveAccessToken(token        , expiresInSeconds        )       {
    try {
      const exp = Date.now() + (expiresInSeconds - 60) * 1000;
      sessionStorage.setItem(GDRIVE_TOKEN_KEY, token);
      sessionStorage.setItem(GDRIVE_TOKEN_EXP_KEY, String(exp));
      this.status = 'Connected';
      this.lastError = '';
      this.notifyStatus();
    } catch {}
  }

         disconnect()       {
    try {
      sessionStorage.removeItem(GDRIVE_TOKEN_KEY);
      sessionStorage.removeItem(GDRIVE_TOKEN_EXP_KEY);
      this.status = 'Not Connected';
      this.notifyStatus();
    } catch {}
  }

          checkInitialConnection()       {
    const token = this.getAccessToken();
    if (token) {
      this.status = 'Connected';
    } else {
      this.status = 'Not Connected';
    }
    this.notifyStatus();
  }

  /**
   * Authorizes Google Drive access via Google Identity Services (GIS) token client.
   */
         async authorize(customClientId         )                   {
    const clientId = customClientId || this.getClientId();
    if (!clientId) {
      this.lastError = 'OAuth Client ID not configured. Please enter your Google OAuth 2.0 Web Client ID in Settings.';
      this.status = 'Not Connected';
      this.notifyStatus();
      return false;
    }

    if (customClientId) {
      this.setClientId(customClientId);
    }

    return new Promise((resolve) => {
      // Check if Google Identity Services script is loaded
      const win = window       ;
      if (win.google && win.google.accounts && win.google.accounts.oauth2) {
        try {
          const client = win.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (response     ) => {
              if (response.error) {
                this.lastError = response.error_description || response.error;
                this.status = 'Not Connected';
                this.notifyStatus();
                resolve(false);
                return;
              }
              if (response.access_token) {
                this.saveAccessToken(response.access_token, Number(response.expires_in) || 3600);
                resolve(true);
              } else {
                resolve(false);
              }
            }
          });
          client.requestAccessToken({ prompt: 'consent' });
        } catch (err     ) {
          this.lastError = err.message || 'Google OAuth initialization failed';
          this.status = 'Not Connected';
          this.notifyStatus();
          resolve(false);
        }
      } else {
        // Fallback: standard OAuth 2.0 token popup
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(window.location.origin + window.location.pathname)}&response_type=token&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file')}&include_granted_scopes=true&prompt=consent`;

        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(authUrl, 'GoogleAuth', `width=${width},height=${height},left=${left},top=${top}`);

        if (!popup) {
          this.lastError = 'Popup blocked by browser. Please allow popups for Google sign-in.';
          this.status = 'Not Connected';
          this.notifyStatus();
          resolve(false);
          return;
        }

        const pollTimer = window.setInterval(() => {
          try {
            if (popup.closed) {
              window.clearInterval(pollTimer);
              resolve(this.status === 'Connected');
              return;
            }
            if (popup.location && popup.location.hash) {
              const hash = popup.location.hash.substring(1);
              const params = new URLSearchParams(hash);
              const token = params.get('access_token');
              const exp = Number(params.get('expires_in')) || 3600;
              if (token) {
                this.saveAccessToken(token, exp);
                popup.close();
                window.clearInterval(pollTimer);
                resolve(true);
              }
            }
          } catch {
            // Cross-origin access expected before redirect
          }
        }, 500);
      }
    });
  }

  /**
   * Generates formatted backup filename: arv-kkbk-backup-YYYY-MM-DD-HH-mm.json
   */
         generateBackupFilename(encrypted = false)         {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `arv-kkbk-backup-${YYYY}-${MM}-${DD}-${HH}-${mm}${encrypted ? '.enc' : ''}.json`;
  }

  /**
   * Uploads a complete backup JSON to the designated Google Drive folder.
   */
         async uploadBackup(records                 )                   {
    if (this.isBackingUp) return false;

    const token = this.getAccessToken();
    if (!token) {
      this.status = 'Not Connected';
      this.notifyStatus();
      return false;
    }

    if (!navigator.onLine) {
      this.status = 'Backup Failed';
      this.lastError = 'Device is currently offline. Will retry when connection returns.';
      this.notifyStatus();
      return false;
    }

    // Ask for the passphrase before the upload starts, so the status is not stuck on "Backing Up"
    const encrypt = isBackupEncryptionEnabled();
    let passphrase                = null;
    if (encrypt) {
      passphrase = await ensureBackupPassphrase();
      if (!passphrase) {
        this.status = 'Backup Failed';
        this.lastError = 'Backup passphrase needed. Open Settings, Google Drive, then Backup Now.';
        this.notifyStatus();
        return false;
      }
    }

    if (this.isBackingUp) return false;
    this.isBackingUp = true;
    this.status = 'Backing Up';
    this.notifyStatus();

    const filename = this.generateBackupFilename(encrypt);
    const backupPayload = {
      app: 'ARV_KKBK',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      clinic: 'Klinik Kesihatan Bandar Kulim',
      programs: ['ARV', 'MMT'],
      destinationFolderId: GDRIVE_FOLDER_ID,
      patientCount: records.filter(r => !r.deletedAt).length,
      records
    };

    let fileBody        ;
    try {
      fileBody = encrypt && passphrase
        ? JSON.stringify(await encryptJSON(backupPayload, passphrase))
        : JSON.stringify(backupPayload, null, 2);
    } catch (err     ) {
      this.isBackingUp = false;
      this.status = 'Backup Failed';
      this.lastError = `Could not encrypt the backup: ${err.message || 'error'}`;
      this.notifyStatus();
      return false;
    }

    const boundary = '-------arvkkbkboundary' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: filename,
      mimeType: 'application/json',
      parents: [GDRIVE_FOLDER_ID]
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileBody +
      closeDelimiter;

    try {
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errMessage = errorBody.error?.message || `HTTP ${response.status} ${response.statusText}`;
        if (response.status === 401) {
          this.disconnect();
          this.lastError = 'Google Drive session expired. Please reconnect.';
        } else {
          this.lastError = `Google Drive upload error: ${errMessage}`;
        }
        this.status = 'Backup Failed';
        this.notifyStatus();
        return false;
      }

      const result = await response.json();
      if (result && result.id) {
        const nowIso = new Date().toISOString();
        try {
          localStorage.setItem(GDRIVE_LAST_BACKUP_KEY, nowIso);
          localStorage.setItem(GDRIVE_LAST_FILE_KEY, filename);
        } catch {}

        this.status = 'Backup Successful';
        this.lastError = '';
        this.notifyStatus();
        return true;
      }

      this.status = 'Backup Failed';
      this.lastError = 'Incomplete response from Google Drive.';
      this.notifyStatus();
      return false;
    } catch (err     ) {
      this.status = 'Backup Failed';
      this.lastError = err.message || 'Network error during Google Drive upload';
      this.notifyStatus();
      return false;
    } finally {
      this.isBackingUp = false;
    }
  }

  /**
   * Schedules an automatic debounced backup (3 seconds after data changes).
   */
         scheduleAutoBackup(getRecords                                )       {
    if (this.status !== 'Connected' && this.status !== 'Backup Successful') return;

    if (this.autoBackupTimer) {
      clearTimeout(this.autoBackupTimer);
    }

    this.autoBackupTimer = setTimeout(async () => {
      try {
        const records = await getRecords();
        await this.uploadBackup(records);
      } catch (err) {
        console.warn('Auto-backup execution warning:', err);
      }
    }, 3000);
  }

  /**
   * Lists available backup JSON files in the designated Google Drive folder.
   */
         async listBackups()                                   {
    const token = this.getAccessToken();
    if (!token) return [];

    try {
      const q = encodeURIComponent(`'${GDRIVE_FOLDER_ID}' in parents and trashed=false and name contains 'arv-kkbk-backup'`);
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,size)&orderBy=createdTime+desc&pageSize=20`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data.files) ? data.files : [];
    } catch (err     ) {
      console.error('List backups failed:', err);
      return [];
    }
  }

  /**
   * Downloads a backup file from Google Drive.
   */
         async downloadBackup(fileId        )               {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not connected to Google Drive');

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to download backup: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Downloads a backup and returns its records, decrypting if needed.
   * Returns null if the person cancels the passphrase prompt.
   */
         async downloadBackupRecords(fileId        )                                                                    {
    const raw = await this.downloadBackup(fileId);
    const opened = await openBackupPayload(raw);
    if (!opened.ok) {
      if (opened.cancelled) return null;
      throw new Error(opened.error);
    }
    const payload = opened.payload                                                          ;
    const records = Array.isArray(payload) ? payload : (Array.isArray((payload       )?.records) ? (payload       ).records : null);
    if (!records) throw new Error('Invalid backup file: no records found');
    return { records: records                   , exportedAt: Array.isArray(payload) ? undefined : (payload       ).exportedAt };
  }

  /** Time of the newest backup in the Drive folder, or null if none or not connected. */
         async getNewestBackup()                                        {
    const files = await this.listBackups();
    return files.length > 0 ? files[0] : null;
  }

  /**
   * Creates an emergency pre-restore safety snapshot of current local records.
   */
         savePreRestoreSafetySnapshot(records                 )       {
    try {
      const snapshot = {
        snapshotTime: new Date().toISOString(),
        recordsCount: records.length,
        records
      };
      localStorage.setItem(PRE_RESTORE_SAFETY_KEY, JSON.stringify(snapshot));
    } catch (err) {
      console.warn('Failed to save pre-restore safety snapshot to localStorage:', err);
    }
  }
}

export const googleDriveService = new GoogleDriveBackupService();
export const googleDriveBackupService = googleDriveService;
