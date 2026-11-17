                                          

                                  
                       
                                        
                         
                          
 

export function createHeader(callbacks                 )              {
  const header = document.createElement('header');
  header.className = 'app-header ios-header';


  header.innerHTML = `
    <div class="header-inner">
      <div class="brand-group">
        <div class="brand-title-wrap">
          <h1 class="app-title">ARV KKBK</h1>
        </div>

        <!-- Desktop Segmented Navigation (>= 900px) -->
        <div class="desktop-nav-tabs" id="header-desktop-tabs" role="tablist" aria-label="Desktop Views">
          <button type="button" class="desktop-tab-btn ${callbacks.activeTab === 'records' ? 'is-active' : ''}" data-tab="records" role="tab" aria-selected="${callbacks.activeTab === 'records'}">
            Records
          </button>
          <button type="button" class="desktop-tab-btn ${callbacks.activeTab === 'tca' ? 'is-active' : ''}" data-tab="tca" role="tab" aria-selected="${callbacks.activeTab === 'tca'}">
            TCA
          </button>
        </div>
      </div>

      <div class="header-actions">
        <button type="button" class="btn-pill header-pill-btn" id="btn-open-data" aria-label="Open settings, message generator and backups">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
          <span>Settings / More</span>
        </button>

        <button type="button" class="btn-pill btn-desktop-add" id="btn-header-add" aria-label="Add Patient">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Add Patient</span>
        </button>
      </div>
    </div>
  `;

  const dataBtn = header.querySelector('#btn-open-data')                     ;
  const addBtn = header.querySelector('#btn-header-add')                     ;
  const desktopTabs = header.querySelector('#header-desktop-tabs')               ;

  dataBtn.addEventListener('click', () => {
    callbacks.onDataClick();
  });

  addBtn.addEventListener('click', () => {
    callbacks.onAddClick();
  });

  desktopTabs.addEventListener('click', (e) => {
    const btn = (e.target               ).closest('.desktop-tab-btn')                     ;
    if (!btn) return;
    const tab = btn.getAttribute('data-tab')             ;
    callbacks.onTabSelect(tab);
  });

  return header;
}
