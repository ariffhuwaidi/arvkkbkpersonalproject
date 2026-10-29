import './styles/theme.css';
import './styles/main.css';
import './styles/components.css';

import type { PatientRecord, SortField, PatientTypeFilter, ActiveTab } from './types';
import { recordStorage } from './storage/indexeddb-storage';
import { themeManager } from './utils/theme';
import { getSavedSort, saveSortPreference, sortRecords, SORT_OPTIONS } from './utils/sort';
import { filterRecords } from './utils/search';
import { generateDemoRecords } from './utils/demo-data';

import { createHeader } from './components/header';
import { createRecordCard } from './components/record-card';
import { RecordModal } from './components/record-modal';
import { DetailsModal } from './components/details-modal';
import { SortSheet } from './components/sort-sheet';
import { DataModal } from './components/data-modal';
import { confirmSheet } from './components/confirm-sheet';
import { toast } from './components/toast';
import { NavigationBar, getSavedTab } from './components/nav-bar';
import { renderTCAView } from './components/tca-view';

class App {
  private records: PatientRecord[] = [];
  private searchQuery: string = '';
  private currentSort: SortField = getSavedSort();
  private currentFilter: PatientTypeFilter = 'all';
  private activeTab: ActiveTab = getSavedTab();

  private navBar!: NavigationBar;
  private recordModal!: RecordModal;
  private detailsModal!: DetailsModal;
  private sortSheet!: SortSheet;
  private dataModal!: DataModal;

  private recordCountEl!: HTMLElement;
  private sortTriggerEl!: HTMLButtonElement;
  private viewContainerEl!: HTMLElement;
  private searchInputEl!: HTMLInputElement;
  private searchClearBtn!: HTMLButtonElement;
  private segmentedFilterEl!: HTMLElement;

  constructor() {
    // 1. Initial theme setup
    themeManager.applyTheme();

    // 2. Initialize modal and sheet components
    this.recordModal = new RecordModal();
    this.detailsModal = new DetailsModal();
    this.sortSheet = new SortSheet();
    this.dataModal = new DataModal();

    // 3. Initialize navigation bar
    this.navBar = new NavigationBar(this.activeTab, (newTab) => {
      this.activeTab = newTab;
      this.renderCurrentView();
    });

    // 4. Render base DOM structure
    this.renderLayout();

    // 5. Load records from IndexedDB
    this.loadRecords();

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
      onAddClick: () => this.recordModal.open(null, this.records, (rec) => this.handleSaveRecord(rec)),
      onDataClick: () => this.dataModal.open(
        () => Promise.resolve(this.records),
        (recs, mode) => this.handleImportRecords(recs, mode)
      ),
      onThemeToggle: () => {
        const modes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
        const current = themeManager.getMode();
        const next = modes[(modes.indexOf(current) + 1) % modes.length];
        themeManager.setTheme(next);
        toast.show(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`);
      }
    });
    appEl.appendChild(header);

    // Main Content Container
    const mainEl = document.createElement('main');
    mainEl.className = 'main-content';

    mainEl.innerHTML = `
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

    // Floating Action Button (Mobile) - opens Add Record from either tab
    const fabBtn = document.createElement('button');
    fabBtn.type = 'button';
    fabBtn.className = 'fab-add';
    fabBtn.setAttribute('aria-label', 'Add Record');
    fabBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;
    fabBtn.addEventListener('click', () => {
      this.recordModal.open(null, this.records, (rec) => this.handleSaveRecord(rec), fabBtn);
    });
    appEl.appendChild(fabBtn);

    // Cache element references
    this.recordCountEl = mainEl.querySelector('#record-count')!;
    this.sortTriggerEl = mainEl.querySelector('#btn-sort-trigger')!;
    this.viewContainerEl = mainEl.querySelector('#view-container')!;
    this.searchInputEl = mainEl.querySelector('#search-input')!;
    this.searchClearBtn = mainEl.querySelector('#search-clear-btn')!;
    this.segmentedFilterEl = mainEl.querySelector('#patient-type-filter')!;

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
    } catch (err) {
      this.recordCountEl.textContent = 'Error loading records from IndexedDB';
      console.error(err);
    }
  }

  private renderCurrentView(): void {
    const isTcaTab = this.activeTab === 'tca';

    // Requirement 2: REMOVE the All / New / Existing filter from the TCA tab only.
    if (isTcaTab) {
      this.segmentedFilterEl.style.display = 'none';
      this.sortTriggerEl.style.display = 'none';
      this.viewContainerEl.className = 'tca-view-container';
    } else {
      this.segmentedFilterEl.style.display = 'flex';
      this.sortTriggerEl.style.display = 'inline-flex';
      this.viewContainerEl.className = 'records-container';
    }

    // On TCA tab, patient type filter does not apply (shows all scheduled records); on Records tab, applies active filter
    const effectiveFilter = isTcaTab ? 'all' : this.currentFilter;
    const filtered = filterRecords(this.records, this.searchQuery, effectiveFilter);

    // Update count display
    const labelPrefix = isTcaTab ? 'appointments' : 'records';
    if (this.records.length === 0) {
      this.recordCountEl.textContent = `0 ${labelPrefix}`;
    } else if (this.searchQuery || (!isTcaTab && this.currentFilter !== 'all')) {
      this.recordCountEl.textContent = `Showing ${filtered.length} of ${this.records.length} ${labelPrefix}`;
    } else {
      this.recordCountEl.textContent = `${this.records.length} ${labelPrefix}`;
    }

    this.viewContainerEl.innerHTML = '';

    // Empty state 1: Database empty -> Show "Load Demo Data"
    if (this.records.length === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'empty-state';
      emptyBox.innerHTML = `
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <line x1="20" y1="8" x2="20" y2="14"></line>
          <line x1="23" y1="11" x2="17" y2="11"></line>
        </svg>
        <h3 class="empty-title">No Patient Records Yet</h3>
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
        <h3 class="empty-title">No Matching Records</h3>
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
        const cardEl = createRecordCard(record, () => {
          this.detailsModal.open(
            record,
            (recToEdit) => this.recordModal.open(recToEdit, this.records, (saved) => this.handleSaveRecord(saved)),
            (recToDelete) => this.handleDeleteRecord(recToDelete)
          );
        });
        this.viewContainerEl.appendChild(cardEl);
      }
      return;
    }

    // TAB 2: TCA Timeline View
    if (this.activeTab === 'tca') {
      const tcaViewEl = renderTCAView(filtered, (record) => {
        this.detailsModal.open(
          record,
          (recToEdit) => this.recordModal.open(recToEdit, this.records, (saved) => this.handleSaveRecord(saved)),
          (recToDelete) => this.handleDeleteRecord(recToDelete)
        );
      });
      this.viewContainerEl.appendChild(tcaViewEl);
    }
  }

  private async handleSaveRecord(
    recordData: Omit<PatientRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }
  ): Promise<void> {
    const isNew = !recordData.id;
    const saved = await recordStorage.save(recordData);

    if (isNew) {
      this.records.unshift(saved);
      toast.show('Record added');
    } else {
      const idx = this.records.findIndex(r => r.id === saved.id);
      if (idx !== -1) {
        this.records[idx] = saved;
      }
      toast.show('Record updated');
    }

    this.renderCurrentView();
  }

  private async handleDeleteRecord(record: PatientRecord): Promise<void> {
    const confirmed = await confirmSheet.show({
      title: 'Delete Record?',
      message: `Are you sure you want to delete the record for "${record.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete Record',
      isDestructive: true
    });

    if (confirmed) {
      await recordStorage.delete(record.id);
      this.records = this.records.filter(r => r.id !== record.id);
      this.detailsModal.close();
      toast.show('Record deleted');
      this.renderCurrentView();
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
