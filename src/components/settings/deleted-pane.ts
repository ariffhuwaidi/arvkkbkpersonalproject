import type { PatientRecord } from '../../types';
import { DELETE_RETENTION_DAYS } from '../../utils/merge';
import { programsOf } from '../../utils/mmt';
import { escapeHtml } from '../../utils/escape';
import { confirmSheet } from '../confirm-sheet';
import { toast } from '../toast';

export interface DeletedPaneHandlers {
  listDeleted: () => Promise<PatientRecord[]>;
  onRestoreDeleted: (id: string) => Promise<void>;
  onPurgeDeleted: (id: string) => Promise<void>;
}

/** More > Recently Deleted: the frame. Call refreshDeletedList to fill it. */
export function renderDeletedPane(pane: HTMLElement): void {
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

/** Lists patients in Recently Deleted with Restore and Delete now. */
export async function refreshDeletedList(pane: HTMLElement, handlers: DeletedPaneHandlers): Promise<void> {
  const listEl = pane.querySelector('#deleted-list') as HTMLElement | null;
  if (!listEl) return;

  const deleted = await handlers.listDeleted();
  if (deleted.length === 0) {
    listEl.innerHTML = `<div style="font-size: 13px; color: var(--color-text-secondary);">Nothing here. Deleted patients will appear in this list.</div>`;
    return;
  }

  const now = Date.now();
  listEl.innerHTML = deleted.map(r => {
    const when = r.deletedAt ? Date.parse(r.deletedAt) : now;
    const daysLeft = Math.max(0, Math.ceil(DELETE_RETENTION_DAYS - (now - when) / 86400000));
    return `
      <div class="deleted-row">
        <div class="deleted-row-main">
          <div class="deleted-row-name">${escapeHtml(r.name)}</div>
          <div class="deleted-row-meta">${escapeHtml(programsOf(r).join(' + '))} · deleted ${new Date(when).toLocaleDateString()} · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left</div>
        </div>
        <div class="deleted-row-actions">
          <button type="button" class="btn-secondary" data-restore="${escapeHtml(r.id)}" style="font-weight: 600;">Restore</button>
          <button type="button" class="btn-secondary" data-purge="${escapeHtml(r.id)}" data-name="${escapeHtml(r.name)}" style="font-weight: 600; color: var(--color-destructive);">Delete now</button>
        </div>
      </div>`;
  }).join('');

  const refresh = () => void refreshDeletedList(pane, handlers);

  listEl.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await handlers.onRestoreDeleted(btn.getAttribute('data-restore') || '');
      toast.show('Patient restored');
      refresh();
    });
  });
  listEl.querySelectorAll('[data-purge]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.getAttribute('data-name') || 'this patient';
      const sure = await confirmSheet.show({
        title: 'Delete permanently?',
        message: `"${name}" and all of their history will be erased now. This cannot be undone.\n\nOnly their IC number is kept, for up to ${DELETE_RETENTION_DAYS} days, so your other devices delete them too on their next sync.`,
        confirmLabel: 'Delete Permanently',
        cancelLabel: 'Keep',
        isDestructive: true
      });
      if (!sure) return;
      await handlers.onPurgeDeleted(btn.getAttribute('data-purge') || '');
      toast.show('Permanently deleted');
      refresh();
    });
  });
}
