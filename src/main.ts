import './styles/theme.css';
import './styles/main.css';
import './styles/components.css';
import './styles/redesign.css';

import type {
  PatientRecord,
  SortField,
  PatientTypeFilter,
  ActiveTab,
  PatientType,
  TCAAppointment,
  AppointmentStatus,
  BloodCollectionAppointment,
  ProgramId,
  MMTProfile
} from './types';
import { recordStorage } from './storage/indexeddb-storage';
import { migrateLegacySafetySnapshot } from './storage/safety-snapshot';
import { themeManager } from './utils/theme';
import { getSavedSort, saveSortPreference, sortRecords, SORT_OPTIONS } from './utils/sort';
import { filterRecords } from './utils/search';
import { generateDemoRecords } from './utils/demo-data';
import { getDaysDifference } from './utils/date';
import { googleDriveBackupService } from './utils/google-drive';
import { LockScreen } from './components/lock-screen';
import { hasPin } from './utils/app-lock';

import { createHeader } from './components/header';
import { createRecordCard, RecordCardActions } from './components/record-card';
import { RecordModal } from './components/record-modal';
import { DetailsModal, DetailsModalHandlers } from './components/details-modal';
import { SortSheet } from './components/sort-sheet';
import { SettingsModal } from './components/settings-modal';
import { AppointmentModal } from './components/appointment-modal';
import { BloodCollectionModal, BloodModalAction } from './components/blood-collection-modal';
import { confirmSheet } from './components/confirm-sheet';
import { toast } from './components/toast';
import { NavigationBar, getSavedTab } from './components/nav-bar';
import { renderTCAView } from './components/tca-view';
import { MMTModal } from './components/mmt-modal';
import { MMTEnrolModal } from './components/mmt-enrol-modal';
import type { MMTEnrolData } from './components/mmt-enrol-modal';
import { createMMTCard } from './components/mmt-card';
import { renderMMTReviewView } from './components/mmt-view';
import { inProgram, newMMTProfile, doseStatusOn, followUpReasons, urineDue, programsOf } from './utils/mmt';
import { getLocalTodayISO } from './utils/date';

const PROGRAM_KEY = 'arv_kkbk_program';
function getSavedProgram(): ProgramId {
  try { return localStorage.getItem(PROGRAM_KEY) === 'MMT' ? 'MMT' : 'ARV'; } catch { return 'ARV'; }
}

class App {
  private records: PatientRecord[] = [];
  private searchQuery: string = '';
  private currentSort: SortField = getSavedSort();
  private currentFilter: PatientTypeFilter = 'all';
  private activeTab: ActiveTab = getSavedTab();

  private lockScreen!: LockScreen;
  private program: ProgramId = getSavedProgram();
  private mmtModal!: MMTModal;
  private mmtEnrolModal!: MMTEnrolModal;
  private navBar!: NavigationBar;
  private recordModal!: RecordModal;
  private detailsModal!: DetailsModal;
  private sortSheet!: SortSheet;
  private settingsModal!: SettingsModal;
  private appointmentModal!: AppointmentModal;
  private bloodCollectionModal!: BloodCollectionModal;

  private recordCountEl!: HTMLElement;
  private sortTriggerEl!: HTMLButtonElement;
  private viewContainerEl!: HTMLElement;
  private searchInputEl!: HTMLInputElement;
  private searchClearBtn!: HTMLButtonElement;
  private segmentedFilterEl!: HTMLElement;
  private summaryStripEl!: HTMLElement;

  constructor() {
    // 1. Initial theme setup
    themeManager.applyTheme();

    // 1b. PIN lock: shown before anything else when a PIN is set
    this.lockScreen = new LockScreen(() => { void this.loadRecords(); });
    this.lockScreen.lockIfNeeded();

    // 2. Initialize modal and sheet components
    this.recordModal = new RecordModal();
    this.detailsModal = new DetailsModal();
    this.sortSheet = new SortSheet();
    this.mmtModal = new MMTModal();
    this.mmtEnrolModal = new MMTEnrolModal();
    this.settingsModal = new SettingsModal();
    this.settingsModal.configure({
      onSync: () => this.syncWithDrive(),
      listDeleted: () => recordStorage.listDeleted(),
      onRestoreDeleted: async (id) => {
        await recordStorage.restore(id);
        await this.reloadFromStorage();
      },
      onPurgeDeleted: async (id) => {
        await recordStorage.delete(id);
      },
      onLockNow: () => this.lockScreen.lock()
    });
    this.appointmentModal = new AppointmentModal();
    this.bloodCollectionModal = new BloodCollectionModal();

    // 3. Initialize navigation bar
    this.navBar = new NavigationBar(this.activeTab, (newTab) => {
      this.activeTab = newTab;
      this.renderCurrentView();
    });

    // 4. Render base DOM structure
    this.renderLayout();

    this.applyProgramLabels();

    // 5. Load records from IndexedDB (after unlock when a PIN is set)
    if (!hasPin()) void this.loadRecords();
    void this.startupHousekeeping();

    // 6. Register simple Service Worker for offline app shell
    this.registerServiceWorker();

    (window as any).__ARV_APP_INITIALIZED__ = true;
  }

  private renderLayout(): void {
    const appEl = document.getElementById('app')!;
    appEl.innerHTML = '';

    // Sticky Liquid Glass Header
    const header = createHeader({
      activeTab: this.activeTab,
      onTabSelect: (tab) => this.navBar.setActiveTab(tab),
      onAddClick: () => this.openAddPatient(),
      onThemeToggle: () => {
        const modes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
        const next = modes[(modes.indexOf(themeManager.getMode()) + 1) % modes.length];
        themeManager.setTheme(next);
        toast.show(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`);
      },
      program: this.program,
      onProgramChange: (program) => this.setProgram(program)
    });
    appEl.appendChild(header);

    // Main Content Container
    const mainEl = document.createElement('main');
    mainEl.className = 'main-content';

    mainEl.innerHTML = `
      <!-- Apple App Store-Inspired Clinic Summary Overview -->
      <section id="summary-metrics-strip" class="ios-summary-grid"></section>

      <section class="toolbar-section">
        <div class="search-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="search"
            id="search-input"
            class="search-input"
            placeholder="Search name, IC, phone, date, plan..."
            autocomplete="off"
            aria-label="Search records"
          />
          <button type="button" id="search-clear-btn" class="search-clear-btn" style="display: none;" aria-label="Clear search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Patient Type Segmented Filter -->
        <div class="segmented-control" id="patient-type-filter" role="radiogroup" aria-label="Filter Patient Type">
          <button type="button" class="segment-btn is-active" data-filter="all" role="radio" aria-checked="true">All Patients</button>
          <button type="button" class="segment-btn" data-filter="New" role="radio" aria-checked="false">New</button>
          <button type="button" class="segment-btn" data-filter="Existing" role="radio" aria-checked="false">Existing</button>
        </div>

        <div class="meta-bar">
          <span id="record-count" class="record-count">Loading records...</span>
          <button type="button" id="btn-sort-trigger" class="btn-sort-trigger" aria-haspopup="dialog">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"></line>
              <line x1="4" y1="12" x2="14" y2="12"></line>
              <line x1="4" y1="18" x2="8" y2="18"></line>
            </svg>
            <span id="sort-trigger-label">Sort</span>
          </button>
        </div>
      </section>

      <section id="view-container" class="records-container"></section>
    `;

    appEl.appendChild(mainEl);

    // Floating Action Button (Mobile) - opens Add Patient from either tab
    const fabBtn = document.createElement('button');
    fabBtn.type = 'button';
    fabBtn.className = 'fab-add';
    fabBtn.setAttribute('aria-label', 'Add Patient');
    fabBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;
    fabBtn.addEventListener('click', () => {
      this.openAddPatient();
    });
    appEl.appendChild(fabBtn);

    // Cache element references
    this.recordCountEl = mainEl.querySelector('#record-count')!;
    this.sortTriggerEl = mainEl.querySelector('#btn-sort-trigger')!;
    this.viewContainerEl = mainEl.querySelector('#view-container')!;
    this.searchInputEl = mainEl.querySelector('#search-input')!;
    this.searchClearBtn = mainEl.querySelector('#search-clear-btn')!;
    this.segmentedFilterEl = mainEl.querySelector('#patient-type-filter')!;
    this.summaryStripEl = mainEl.querySelector('#summary-metrics-strip')!;

    this.bindToolbarEvents();
    this.updateSortTriggerLabel();
  }

  private bindToolbarEvents(): void {
    // Search input typing
    this.searchInputEl.addEventListener('input', () => {
      this.searchQuery = this.searchInputEl.value;
      this.searchClearBtn.style.display = this.searchQuery ? 'flex' : 'none';
      this.renderCurrentView();
    });

    // Clear search button
    this.searchClearBtn.addEventListener('click', () => {
      this.searchInputEl.value = '';
      this.searchQuery = '';
      this.searchClearBtn.style.display = 'none';
      this.searchInputEl.focus();
      this.renderCurrentView();
    });

    // Segmented Patient Type filter toggle
    this.segmentedFilterEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.segment-btn') as HTMLButtonElement;
      if (!btn) return;
      const filterVal = btn.getAttribute('data-filter') as PatientTypeFilter;
      this.currentFilter = filterVal;

      this.segmentedFilterEl.querySelectorAll('.segment-btn').forEach(b => {
        const isSelected = b === btn;
        b.classList.toggle('is-active', isSelected);
        b.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      });

      this.renderCurrentView();
    });

    // Sort trigger button -> opens Reusable SortSheet
    this.sortTriggerEl.addEventListener('click', () => {
      this.sortSheet.open(
        this.currentSort,
        (newSort) => {
          this.currentSort = newSort;
          saveSortPreference(newSort);
          this.updateSortTriggerLabel();
          this.renderCurrentView();
        },
        this.sortTriggerEl
      );
    });
  }

  private updateSortTriggerLabel(): void {
    const currentDef = SORT_OPTIONS.find(o => o.id === this.currentSort);
    const labelSpan = this.sortTriggerEl.querySelector('#sort-trigger-label');
    if (labelSpan && currentDef) {
      labelSpan.textContent = currentDef.shortLabel;
    }
  }

  private async loadRecords(): Promise<void> {
    try {
      this.records = await recordStorage.list();
      this.renderCurrentView();
      this.renderBackupBanner();
    } catch (err) {
      this.recordCountEl.textContent = 'Error loading records from IndexedDB';
      console.error(err);
    }
  }

  private get scoped(): PatientRecord[] {
    return this.records.filter(r => inProgram(r, this.program));
  }

  private setProgram(program: ProgramId): void {
    this.program = program;
    try { localStorage.setItem(PROGRAM_KEY, program); } catch { /* ignore */ }
    this.applyProgramLabels();
    this.renderCurrentView();
  }

  private applyProgramLabels(): void {
    const label = this.program === 'MMT' ? 'Review' : 'TCA';
    document.querySelectorAll('.tab-item[data-tab="tca"] .tab-label').forEach(el => { el.textContent = label; });
    document.querySelectorAll('.desktop-tab-btn[data-tab="tca"]').forEach(el => { el.textContent = label; });
    document.body.setAttribute('data-program', this.program);
  }

  private openAddPatient(): void {
    if (this.program === 'MMT') {
      const candidates = this.records.filter(r => !inProgram(r, 'MMT'));
      this.mmtEnrolModal.open(candidates, (data) => this.handleEnrolMMT(data));
    } else {
      this.recordModal.open(null, this.records, (rec) => this.handleSaveRecord(rec));
    }
  }

  private renderCurrentView(): void {
    // The More tab is a separate page, not a list of patients
    const isMore = this.activeTab === 'more';
    document.querySelector('.main-content')?.classList.toggle('is-hidden', isMore);
    document.querySelector('.fab-add')?.toggleAttribute('hidden', isMore);
    if (isMore) {
      this.settingsModal.open(() => recordStorage.listAll(), (recs, mode) => this.handleImportRecords(recs, mode));
      return;
    }
    this.settingsModal.hide();

    const isMMT = this.program === 'MMT';
    const scoped = this.scoped;
    const isTcaTab = this.activeTab === 'tca';

    this.updateSummaryMetrics();

    if (isTcaTab || isMMT) {
      this.segmentedFilterEl.style.display = 'none';
      this.sortTriggerEl.style.display = 'none';
      this.viewContainerEl.className = isTcaTab ? 'tca-view-container' : 'records-container';
    } else {
      this.segmentedFilterEl.style.display = 'flex';
      this.sortTriggerEl.style.display = 'inline-flex';
      this.viewContainerEl.className = 'records-container';
    }

    const effectiveFilter = isTcaTab || isMMT ? 'all' : this.currentFilter;
    const filtered = filterRecords(scoped, this.searchQuery, effectiveFilter);

    const labelPrefix = isTcaTab ? (isMMT ? 'patients' : 'appointments') : 'records';
    const singular = (n: number) => (n === 1 ? labelPrefix.replace(/s$/, '') : labelPrefix);
    if (scoped.length === 0) {
      this.recordCountEl.textContent = `0 ${labelPrefix}`;
    } else if (this.searchQuery || (!isTcaTab && !isMMT && this.currentFilter !== 'all')) {
      this.recordCountEl.textContent = `Showing ${filtered.length} of ${scoped.length} ${singular(scoped.length)}`;
    } else {
      this.recordCountEl.textContent = `${scoped.length} ${singular(scoped.length)}`;
    }

    this.viewContainerEl.innerHTML = '';

    // MMT empty state
    if (isMMT && scoped.length === 0) {
      const box = document.createElement('div');
      box.className = 'empty-state';
      box.innerHTML = `
        <h2 class="empty-title">No MMT Patients Yet</h2>
        <p class="empty-desc">Add a new person, or enrol someone already registered in ARV. A person in both programs stays one record.</p>
        <button type="button" id="btn-empty-add-mmt" class="btn-demo-load">Add MMT patient</button>`;
      box.querySelector('#btn-empty-add-mmt')!.addEventListener('click', () => this.openAddPatient());
      this.viewContainerEl.appendChild(box);
      return;
    }

    // MMT tabs
    if (isMMT && filtered.length > 0) {
      if (isTcaTab) {
        this.viewContainerEl.appendChild(renderMMTReviewView(filtered, (r) => this.openMMTProfile(r)));
      } else {
        const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
        for (const record of sorted) {
          this.viewContainerEl.appendChild(createMMTCard(record, {
            onView: () => this.openMMTProfile(record),
            onQuickDose: (status) => { void this.handleQuickDose(record, status); }
          }));
        }
      }
      return;
    }

    // Empty state 1: Database empty -> Show "Load Demo Data"
    if (scoped.length === 0 && !isMMT) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'empty-state';
      emptyBox.innerHTML = `
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <line x1="20" y1="8" x2="20" y2="14"></line>
          <line x1="23" y1="11" x2="17" y2="11"></line>
        </svg>
        <h2 class="empty-title">No Patient Records Yet</h2>
        <p class="empty-desc">
          Add your first patient record or load safe, fictional demo data to test tracking, blood dates, and TCA sorting.
        </p>
        <button type="button" id="btn-load-demo" class="btn-demo-load">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <polyline points="23 20 23 14 17 14"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
          </svg>
          Load Demo Data (Fictional)
        </button>
      `;

      emptyBox.querySelector('#btn-load-demo')?.addEventListener('click', async () => {
        await this.handleLoadDemoData();
      });

      this.viewContainerEl.appendChild(emptyBox);
      return;
    }

    // Empty state 2: Search or Filter yields 0 matches
    if (filtered.length === 0) {
      const emptySearchBox = document.createElement('div');
      emptySearchBox.className = 'empty-state';
      emptySearchBox.innerHTML = `
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
        <h2 class="empty-title">No Matching Records</h2>
        <p class="empty-desc">
          No records match your active search and filter selection.
        </p>
        <button type="button" id="btn-clear-search-empty" class="btn-secondary" style="font-weight: 600;">
          Reset Filters
        </button>
      `;

      emptySearchBox.querySelector('#btn-clear-search-empty')?.addEventListener('click', () => {
        this.searchInputEl.value = '';
        this.searchQuery = '';
        this.searchClearBtn.style.display = 'none';
        this.currentFilter = 'all';
        this.segmentedFilterEl.querySelectorAll('.segment-btn').forEach(b => {
          const isAll = b.getAttribute('data-filter') === 'all';
          b.classList.toggle('is-active', isAll);
          b.setAttribute('aria-checked', isAll ? 'true' : 'false');
        });
        this.renderCurrentView();
      });

      this.viewContainerEl.appendChild(emptySearchBox);
      return;
    }

    // TAB 1: Records Tab View
    if (this.activeTab === 'records') {
      const sorted = sortRecords(filtered, this.currentSort);
      for (const record of sorted) {
        const cardEl = createRecordCard(record, this.buildCardActions(record));
        this.viewContainerEl.appendChild(cardEl);
      }
      return;
    }

    // TAB 2: TCA Timeline View
    if (this.activeTab === 'tca') {
      const tcaViewEl = renderTCAView(filtered, (record) => {
        this.detailsModal.open(record, this.buildDetailsHandlers());
      });
      this.viewContainerEl.appendChild(tcaViewEl);
    }
  }

  private buildDetailsHandlers(): DetailsModalHandlers {
    return {
      onEdit: (rec) => this.recordModal.open(rec, this.records, (saved) => this.handleSaveRecord(saved)),
      onDelete: (rec) => this.handleDeleteRecord(rec),
      onToggleActive: (rec, makeActive) => this.handleToggleActive(rec, makeActive),
      onChangeCategory: (rec, newCategory) => this.handleChangeCategory(rec, newCategory),
      onScheduleTca: (rec) => this.handleScheduleTca(rec),
      onRescheduleTca: (rec, apt) => this.handleRescheduleTca(rec, apt),
      onUpdateStatus: (rec, apt, status) => this.handleUpdateStatus(rec, apt, status),
      onBloodAction: (rec, collection, action) => this.handleBloodAction(rec, collection, action),
      onScheduleBloodCollection: (rec) => this.handleScheduleBloodCollection(rec)
    };
  }

  private buildCardActions(record: PatientRecord): RecordCardActions {
    return {
      onView: () => {
        this.detailsModal.open(record, this.buildDetailsHandlers());
      },
      onEdit: () => {
        this.recordModal.open(record, this.records, (saved) => this.handleSaveRecord(saved));
      },
      onDelete: () => {
        this.handleDeleteRecord(record);
      },
      onToggleActive: (makeActive) => {
        this.handleToggleActive(record, makeActive);
      },
      onChangeCategory: (newCategory) => {
        this.handleChangeCategory(record, newCategory);
      }
    };
  }

  private async handleSaveRecord(
    recordData: Omit<PatientRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }
  ): Promise<void> {
    const isNew = !recordData.id;
    const saved = await recordStorage.save(recordData);

    if (isNew) {
      this.records.unshift(saved);
      toast.show('Patient registered');
    } else {
      this.updateRecordInState(saved);
      toast.show('Patient record updated');
    }

    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
  }

  private updateSummaryMetrics(): void {
    if (!this.summaryStripEl) return;

    const scoped = this.scoped;
    if (scoped.length === 0) {
      this.summaryStripEl.style.display = 'none';
      return;
    }
    this.summaryStripEl.style.display = 'grid';

    if (this.program === 'MMT') {
      const today = getLocalTodayISO();
      const active = scoped.filter(r => r.mmt && r.isActive !== false);
      const toDispense = active.filter(r => r.mmt!.dispensing === 'Daily' && doseStatusOn(r.mmt!, today) === null).length;
      const followUp = active.filter(r => followUpReasons(r, today).length > 0).length;
      const urine = active.filter(r => urineDue(r.mmt!, today)).length;
      this.summaryStripEl.innerHTML = `
        <div class="ios-summary-card"><span class="ios-summary-val color-accent">${active.length}</span><span class="ios-summary-lbl">Active Patients</span></div>
        <div class="ios-summary-card"><span class="ios-summary-val">${toDispense}</span><span class="ios-summary-lbl">To Dispense Today</span></div>
        <div class="ios-summary-card"><span class="ios-summary-val ${followUp > 0 ? 'color-overdue' : ''}">${followUp}</span><span class="ios-summary-lbl">Needs Follow-up</span></div>
        <div class="ios-summary-card"><span class="ios-summary-val">${urine}</span><span class="ios-summary-lbl">Urine Due</span></div>
      `;
      return;
    }

    const totalActive = scoped.filter(r => r.isActive !== false).length;
    let overdueCount = 0;
    let upcomingWeekCount = 0;
    let bloodDueCount = 0;

    for (const r of scoped) {
      if (r.isActive === false) continue;
      if (r.nextTca) {
        const diff = getDaysDifference(r.nextTca);
        if (diff < 0) overdueCount++;
        else if (diff <= 7) upcomingWeekCount++;
      }
      if (r.bloodInvestigationDate) {
        const bDiff = getDaysDifference(r.bloodInvestigationDate);
        if (bDiff <= 7) bloodDueCount++;
      }
    }

    this.summaryStripEl.innerHTML = `
      <div class="ios-summary-card">
        <span class="ios-summary-val color-accent">${totalActive}</span>
        <span class="ios-summary-lbl">Active Patients</span>
      </div>
      <div class="ios-summary-card">
        <span class="ios-summary-val ${overdueCount > 0 ? 'color-overdue' : ''}">${overdueCount}</span>
        <span class="ios-summary-lbl">Overdue TCA</span>
      </div>
      <div class="ios-summary-card">
        <span class="ios-summary-val color-upcoming">${upcomingWeekCount}</span>
        <span class="ios-summary-lbl">TCA This Week</span>
      </div>
      <div class="ios-summary-card">
        <span class="ios-summary-val">${bloodDueCount}</span>
        <span class="ios-summary-lbl">Blood Due</span>
      </div>
    `;
  }

  private async handleDeleteRecord(record: PatientRecord): Promise<void> {
    // A person in both programs is only removed from the program being viewed
    const programs = programsOf(record);
    if (programs.length > 1) {
      await this.removeFromProgram(record, this.program);
      return;
    }

    const aptCount = Array.isArray(record.appointments) ? record.appointments.length : (record.nextTca ? 1 : 0);
    const history = aptCount > 0 ? ` Their ${aptCount} ${aptCount === 1 ? 'appointment' : 'appointments'} and history go with them.` : '';

    const confirmed = await confirmSheet.show({
      title: 'Delete patient?',
      message: `"${record.name}" will move to Recently Deleted for 30 days, where you can restore them.${history}`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      isDestructive: true
    });
    if (!confirmed) return;

    await recordStorage.softDelete(record.id);
    this.records = this.records.filter(r => r.id !== record.id);
    this.detailsModal.close();
    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
    toast.show(`Deleted ${record.name}`, {
      actionLabel: 'Undo',
      onAction: async () => {
        await recordStorage.restore(record.id);
        await this.reloadFromStorage();
        googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
      }
    });
  }

  /** Removes a person from one program only, keeping the other. Undo puts everything back. */
  private async removeFromProgram(record: PatientRecord, program: ProgramId): Promise<void> {
    const other: ProgramId = program === 'ARV' ? 'MMT' : 'ARV';
    const ok = await confirmSheet.show({
      title: `Remove from ${program}?`,
      message: `"${record.name}" stays in ${other}. Only their ${program} records are taken out of the ${program} list.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      isDestructive: true
    });
    if (!ok) return;

    const before: PatientRecord = JSON.parse(JSON.stringify(record));
    // The other program's data is untouched; removing MMT also clears the MMT block
    const update: PatientRecord = { ...record, programs: [other], updatedAt: new Date().toISOString() };
    if (program === 'MMT') delete (update as any).mmt;
    await recordStorage.put(update);
    this.detailsModal.close();
    await this.reloadFromStorage();
    googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
    toast.show(`Removed from ${program}`, {
      actionLabel: 'Undo',
      onAction: async () => {
        await recordStorage.put({ ...before, updatedAt: new Date().toISOString() });
        await this.reloadFromStorage();
        googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
      }
    });
  }

  private openMMTProfile(record: PatientRecord): void {
    this.mmtModal.open(record, {
      onChange: async (rec, mmt) => {
        const saved = await recordStorage.save({ ...rec, mmt });
        this.updateRecordInState(saved);
        this.renderCurrentView();
        googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
        return saved;
      },
      onRemoveFromMMT: (rec) => {
        if (programsOf(rec).length > 1) void this.removeFromProgram(rec, 'MMT');
        else void this.handleDeleteRecord(rec);
      }
    });
  }

  private async handleQuickDose(record: PatientRecord, status: 'Dispensed' | 'Missed'): Promise<void> {
    if (!record.mmt) return;
    const today = getLocalTodayISO();
    const mmt: MMTProfile = JSON.parse(JSON.stringify(record.mmt));
    mmt.doseLog = mmt.doseLog.filter(e => e.date !== today);
    mmt.doseLog.push({ date: today, status, doseMg: status === 'Dispensed' ? mmt.currentDoseMg : undefined });
    mmt.updatedAt = new Date().toISOString();
    const saved = await recordStorage.save({ ...record, mmt });
    this.updateRecordInState(saved);
    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
    toast.show(status === 'Dispensed' ? `${record.name}: dispensed` : `${record.name}: missed`, {
      actionLabel: 'Undo',
      onAction: async () => {
        const undo: MMTProfile = JSON.parse(JSON.stringify(saved.mmt));
        undo.doseLog = undo.doseLog.filter(e => e.date !== today);
        undo.updatedAt = new Date().toISOString();
        const again = await recordStorage.save({ ...saved, mmt: undo });
        this.updateRecordInState(again);
        this.renderCurrentView();
        googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
      }
    });
  }

  /** Returns an error message to show in the sheet, or null on success. */
  private async handleEnrolMMT(data: MMTEnrolData): Promise<string | null> {
    const now = new Date().toISOString();
    const mmt = newMMTProfile({
      startDate: data.startDate,
      currentDoseMg: data.doseMg,
      dispensing: data.dispensing,
      doseHistory: data.doseMg !== undefined ? [{ id: `dose_${Date.now().toString(36)}`, date: data.startDate, doseMg: data.doseMg, reason: 'Starting dose' }] : []
    }, now);

    try {
      if (data.existingId) {
        const existing = this.records.find(r => r.id === data.existingId);
        if (!existing) return 'That patient could not be found.';
        const saved = await recordStorage.save({ ...existing, programs: ['ARV', 'MMT'], mmt });
        this.updateRecordInState(saved);
        toast.show(`${saved.name} added to MMT`);
      } else {
        const digits = (v: string) => v.replace(/\D/g, '');
        const dup = this.records.find(r => digits(r.icNumber) === digits(data.icNumber));
        if (dup) {
          return inProgram(dup, 'MMT')
            ? `${dup.name} is already in MMT.`
            : `${dup.name} is already registered (ARV). Choose them from the list above to add them to MMT.`;
        }
        const saved = await recordStorage.save({
          id: '',
          name: data.name,
          icNumber: data.icNumber,
          phone: data.phone || undefined,
          patientType: 'Existing',
          isActive: true,
          bloodInvestigations: [],
          programs: ['MMT'],
          mmt
        } as any);
        this.records.unshift(saved);
        toast.show('MMT patient added');
      }
    } catch (err: any) {
      return err?.message || 'Could not save.';
    }
    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
    return null;
  }

  private async reloadFromStorage(): Promise<void> {
    this.records = await recordStorage.list();
    this.renderCurrentView();
  }

  /** Pull the newest Drive backup, merge it by newest edit, then upload the merged set. */
  private async syncWithDrive(): Promise<string> {
    const newest = await googleDriveBackupService.getNewestBackup();
    let summary = 'Nothing to pull from Drive';
    if (newest) {
      const downloaded = await googleDriveBackupService.downloadBackupRecords(newest.id);
      if (!downloaded) throw new Error('Cancelled');
      const result = await recordStorage.mergeNewer(downloaded.records);
      summary = `${result.added} added, ${result.updated} updated`;
      await this.reloadFromStorage();
    }
    await googleDriveBackupService.uploadBackup(await recordStorage.listAll());
    return `Synced: ${summary}`;
  }

  private async startupHousekeeping(): Promise<void> {
    try { await recordStorage.purgeExpiredDeleted(); } catch (e) { console.warn(e); }
    await migrateLegacySafetySnapshot();
    try {
      if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
    } catch { /* not supported */ }
  }

  /** Banner shown when there are records but no recent backup. */
  private renderBackupBanner(): void {
    document.getElementById('backup-banner')?.remove();
    if (this.records.length === 0) return;
    const last = googleDriveBackupService.getLastBackupTime();
    const ageDays = last ? (Date.now() - Date.parse(last)) / 86400000 : Infinity;
    if (ageDays <= 7) return;
    const main = document.querySelector('.main-content');
    if (!main) return;
    const banner = document.createElement('div');
    banner.id = 'backup-banner';
    banner.className = 'backup-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `<span>${last ? `Last backup was ${Math.floor(ageDays)} days ago.` : 'This device has never been backed up.'}</span><button type="button" class="backup-banner-btn">Back up</button>`;
    banner.querySelector('button')!.addEventListener('click', () => {
      this.navBar.setActiveTab('more');
      this.settingsModal.switchTab('gdrive');
    });
    main.prepend(banner);
  }

  private async handleToggleActive(record: PatientRecord, makeActive: boolean): Promise<void> {
    if (!makeActive) {
      const confirmed = await confirmSheet.show({
        title: 'Deactivate Patient Record?',
        message: `Deactivate record for "${record.name}"? The patient will be marked inactive, but their complete TCA history and lab records will be preserved safely.`,
        confirmLabel: 'Deactivate Patient',
        cancelLabel: 'Keep Active',
        isDestructive: false
      });
      if (!confirmed) return;
    }

    const updated = await recordStorage.setPatientActiveStatus(record.id, makeActive);
    this.updateRecordInState(updated);
    toast.show(makeActive ? 'Patient reactivated' : 'Patient deactivated');
    this.detailsModal.updateRecord(updated);
    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
  }

  private async handleChangeCategory(record: PatientRecord, newCategory: PatientType): Promise<void> {
    const updated = await recordStorage.setPatientCategory(record.id, newCategory);
    this.updateRecordInState(updated);
    toast.show(`Category changed to ${newCategory} Patient`);
    this.detailsModal.updateRecord(updated);
    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
  }

  private handleScheduleTca(record: PatientRecord): void {
    this.appointmentModal.open(record, 'new', null, async (data) => {
      await recordStorage.addAppointment(record.id, {
        tcaDate: data.tcaDate,
        status: 'Scheduled',
        notes: data.notes,
        plan: data.plan,
        bloodInvestigationDate: data.bloodInvestigationDate,
        bloodInvestigations: data.bloodInvestigations,
        bloodOther: data.bloodOther
      });
      const updated = await recordStorage.get(record.id);
      if (updated) {
        this.updateRecordInState(updated);
        this.detailsModal.updateRecord(updated);
        this.renderCurrentView();
        googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
      }
      toast.show('New TCA appointment scheduled');
    });
  }

  private handleRescheduleTca(record: PatientRecord, appointment: TCAAppointment): void {
    this.appointmentModal.open(record, 'reschedule', appointment, async (data) => {
      await recordStorage.rescheduleAppointment(record.id, appointment.id, data);
      const updated = await recordStorage.get(record.id);
      if (updated) {
        this.updateRecordInState(updated);
        this.detailsModal.updateRecord(updated);
        this.renderCurrentView();
        googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
      }
      toast.show('Appointment rescheduled');
    });
  }

  private async handleUpdateStatus(
    record: PatientRecord,
    appointment: TCAAppointment,
    newStatus: AppointmentStatus
  ): Promise<void> {
    await recordStorage.updateAppointment(record.id, appointment.id, { status: newStatus });
    let updated = await recordStorage.get(record.id);
    if (!updated) return;

    this.updateRecordInState(updated);
    this.detailsModal.updateRecord(updated);
    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
    toast.show(`Appointment recorded as ${newStatus}`);

    // If marked Attended and patient was New Patient, suggest changing to Existing Patient
    if (newStatus === 'Attended' && updated.patientType === 'New') {
      const shouldSwitch = await confirmSheet.show({
        title: 'Update Patient Category?',
        message: `First visit recorded as Attended for "${updated.name}". Would you like to change their category to "Existing Patient"?`,
        confirmLabel: 'Update to Existing Patient',
        cancelLabel: 'Keep as New Patient',
        isDestructive: false
      });

      if (shouldSwitch) {
        await this.handleChangeCategory(updated, 'Existing');
      }
    }
  }

  private handleBloodAction(
    record: PatientRecord,
    collection: BloodCollectionAppointment,
    action: BloodModalAction
  ): void {
    this.bloodCollectionModal.open(record, collection, action, async (data) => {
      if (data.action === 'attend') {
        await recordStorage.updateBloodCollectionStatus(
          record.id,
          data.collectionId,
          'Attended',
          data.actualDate,
          data.actualTime,
          data.notes
        );
        toast.show('Sample collection recorded as Attended');
      } else if (data.action === 'dna') {
        await recordStorage.updateBloodCollectionStatus(
          record.id,
          data.collectionId,
          'DNA',
          undefined,
          undefined,
          data.notes
        );
        toast.show('Blood appointment recorded as DNA');
      } else if (data.action === 'reschedule') {
        if (!data.newDate) return;
        await recordStorage.rescheduleBloodCollection(
          record.id,
          data.collectionId,
          data.newDate,
          data.reason,
          data.newTime
        );
        toast.show('Blood collection date rescheduled');
      } else if (data.action === 'cancel') {
        await recordStorage.updateBloodCollectionStatus(
          record.id,
          data.collectionId,
          'Cancelled',
          undefined,
          undefined,
          data.notes
        );
        toast.show('Blood collection appointment cancelled');
      }

      const updated = await recordStorage.get(record.id);
      if (updated) {
        this.updateRecordInState(updated);
        this.detailsModal.updateRecord(updated);
        this.renderCurrentView();
        googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
      }
    });
  }

  private handleScheduleBloodCollection(record: PatientRecord): void {
    this.appointmentModal.open(record, 'new', null, async (data) => {
      if (data.bloodInvestigationDate) {
        await recordStorage.addBloodCollection(record.id, {
          scheduledDate: data.bloodInvestigationDate,
          bloodInvestigations: data.bloodInvestigations,
          bloodOther: data.bloodOther,
          notes: data.notes
        });
      }
      if (data.tcaDate) {
        await recordStorage.addAppointment(record.id, {
          tcaDate: data.tcaDate,
          status: 'Scheduled',
          notes: data.notes,
          plan: data.plan,
          bloodInvestigationDate: data.bloodInvestigationDate,
          bloodInvestigations: data.bloodInvestigations,
          bloodOther: data.bloodOther
        });
      }
      const updated = await recordStorage.get(record.id);
      if (updated) {
        this.updateRecordInState(updated);
        this.detailsModal.updateRecord(updated);
        this.renderCurrentView();
        googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
      }
      toast.show('New appointment saved');
    });
  }

  private updateRecordInState(updated: PatientRecord): void {
    const idx = this.records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      this.records[idx] = updated;
    }
  }

  private async handleLoadDemoData(): Promise<void> {
    const demo = generateDemoRecords();
    await recordStorage.bulkImport(demo, 'replace');
    this.records = await recordStorage.list();
    toast.show(`Loaded ${demo.length} demo records`);
    this.renderCurrentView();
  }

  private async handleImportRecords(records: PatientRecord[], mode: 'merge' | 'replace'): Promise<void> {
    await recordStorage.bulkImport(records, mode);
    this.records = await recordStorage.list();
    this.renderCurrentView();
    this.renderBackupBanner();
    googleDriveBackupService.scheduleAutoBackup(() => recordStorage.listAll());
  }

  private registerServiceWorker(): void {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
        console.warn('SW registration warning:', err);
      });
    }
  }
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new App());
} else {
  new App();
}
