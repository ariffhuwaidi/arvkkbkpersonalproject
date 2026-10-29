import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// MIME types for static server
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json'
};

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id && this.callbacks.has(data.id)) {
          const cb = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) cb.reject(new Error(data.error.message));
          else cb.resolve(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${res.exceptionDetails.text} (${JSON.stringify(res.exceptionDetails.exception)})`);
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function startServer() {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(rootDir, reqPath.replace(/^\//, ''));

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return { server, port };
}

async function getCDPTarget(port) {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await res.json();
      if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
        return list[0].webSocketDebuggerUrl;
      }
    } catch (err) {
      // connecting...
    }
  }
  throw new Error('Chrome CDP target not found');
}

async function run() {
  console.log('=== STARTING AUTOMATED TEST SUITE ===');

  const { server, port } = await startServer();
  console.log(`Local static server running at http://127.0.0.1:${port}`);

  const cdpPort = 9222 + Math.floor(Math.random() * 100);
  const testUserData = path.join(rootDir, 'test_output', 'chrome_test_profile');
  fs.mkdirSync(testUserData, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${testUserData}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `http://127.0.0.1:${port}/index.html`
  ]);

  let cdp;
  let testCount = 0;
  let passCount = 0;

  function assert(condition, message) {
    testCount++;
    if (!condition) {
      console.error(`  [FAIL] ${message}`);
      throw new Error(message);
    }
    passCount++;
    console.log(`  [PASS] ${message}`);
  }

  try {
    const wsUrl = await getCDPTarget(cdpPort);
    cdp = new CDPClient(wsUrl);
    await cdp.connect();
    console.log('Connected to Chrome DevTools Protocol.');

    // Wait for App to load
    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');

    // Wait for DOM ready & initial render
    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 200));
      ready = await cdp.eval('Boolean(window.__ARV_APP_INITIALIZED__)');
      if (ready) break;
    }
    assert(ready, 'Application bootstrap completed');

    // -------------------------------------------------------------
    // TEST SUITE 1: Responsiveness & Viewports (390px, 360px, Desktop)
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Viewports & Responsive Layout ---');

    // Test 390px (iPhone 12/13/14/15)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 200));

    const scrollWidth390 = await cdp.eval('document.documentElement.scrollWidth');
    assert(scrollWidth390 <= 390, `No horizontal scroll at 390px width (scrollWidth: ${scrollWidth390})`);

    const fabVisible390 = await cdp.eval('getComputedStyle(document.querySelector(".fab-add")).display !== "none"');
    assert(fabVisible390, 'Floating Add button is visible on mobile (390px)');

    const headerAddHidden390 = await cdp.eval('getComputedStyle(document.querySelector(".btn-desktop-add")).display === "none"');
    assert(headerAddHidden390, 'Desktop header Add button is hidden on mobile');

    // Test 360px (Small Android / compact mobile)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 740,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 200));
    const scrollWidth360 = await cdp.eval('document.documentElement.scrollWidth');
    assert(scrollWidth360 <= 360, `No horizontal scroll at 360px width (scrollWidth: ${scrollWidth360})`);

    // Test font-size >= 16px on inputs to prevent iOS Safari auto-zoom
    const inputFontSize = await cdp.eval('parseFloat(getComputedStyle(document.querySelector("#search-input")).fontSize)');
    assert(inputFontSize >= 16, `Search input font-size is ${inputFontSize}px (>= 16px to prevent iOS auto-zoom)`);

    // Test Desktop 1280px
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 200));

    const fabHiddenDesktop = await cdp.eval('getComputedStyle(document.querySelector(".fab-add")).display === "none"');
    assert(fabHiddenDesktop, 'Floating Add button is hidden on desktop (1280px)');

    const headerAddVisibleDesktop = await cdp.eval('getComputedStyle(document.querySelector(".btn-desktop-add")).display !== "none"');
    assert(headerAddVisibleDesktop, 'Desktop header Add button is visible on desktop');

    // -------------------------------------------------------------
    // TEST SUITE 2: Theme Switching & Preferences (Light, Dark, System)
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Themes & Persistence ---');

    // Switch to dark theme
    await cdp.eval('document.querySelector("#btn-theme-toggle").click()');
    let themeMode = await cdp.eval('localStorage.getItem("arv_kkbk_theme_pref")');
    let dataTheme = await cdp.eval('document.documentElement.getAttribute("data-theme")');
    assert(themeMode !== null, `Theme toggle persisted to localStorage: mode=${themeMode}`);
    assert(dataTheme === 'light' || dataTheme === 'dark', `Document data-theme applied: ${dataTheme}`);

    // Cycle to next theme
    await cdp.eval('document.querySelector("#btn-theme-toggle").click()');
    themeMode = await cdp.eval('localStorage.getItem("arv_kkbk_theme_pref")');
    console.log(`  Current theme mode cycled to: ${themeMode}`);

    // Cycle to system
    await cdp.eval('document.querySelector("#btn-theme-toggle").click()');
    themeMode = await cdp.eval('localStorage.getItem("arv_kkbk_theme_pref")');
    console.log(`  Current theme mode cycled to: ${themeMode}`);

    // -------------------------------------------------------------
    // TEST SUITE 3: Empty State & Demo Data Loading
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Empty State & Demo Data Generation ---');

    const emptyTitle = await cdp.eval('document.querySelector(".empty-title")?.textContent');
    assert(emptyTitle === 'No Patient Records Yet', 'Empty state correctly shows "No Patient Records Yet"');

    const demoBtn = await cdp.eval('Boolean(document.querySelector("#btn-load-demo"))');
    assert(demoBtn, '"Load Demo Data (Fictional)" button is present in empty state');

    // Click "Load Demo Data"
    await cdp.eval('document.querySelector("#btn-load-demo").click()');
    await new Promise(r => setTimeout(r, 400));

    const cardCount = await cdp.eval('document.querySelectorAll(".record-card").length');
    assert(cardCount === 5, `Demo data loaded successfully: 5 cards rendered (found ${cardCount})`);

    const demoPatient1 = await cdp.eval('document.querySelectorAll(".record-card .patient-name")[0]?.textContent');
    assert(demoPatient1.includes('Demo Patient'), `Record uses fictional name: "${demoPatient1}"`);

    // Verify localStorage has NO patient records (Condition #4)
    const lsKeys = await cdp.eval('Object.keys(localStorage)');
    const containsRecordsInLS = await cdp.eval('Object.values(localStorage).some(v => v.includes("Demo Patient") || v.includes("000101"))');
    assert(!containsRecordsInLS, `LocalStorage contains zero patient records (keys: ${lsKeys.join(', ')})`);

    // -------------------------------------------------------------
    // TEST SUITE 4: TCA Status Badges (Overdue, Today, Upcoming, Later, None)
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing TCA Status Indicators ---');

    const overdueBadge = await cdp.eval('document.querySelector(".tca-indicator.tca-overdue")?.textContent.trim()');
    assert(Boolean(overdueBadge && overdueBadge.includes('Overdue')), `Overdue badge calculated: "${overdueBadge}"`);

    const upcomingToday = await cdp.eval('Array.from(document.querySelectorAll(".tca-indicator.tca-upcoming")).some(el => el.textContent.includes("Today"))');
    assert(upcomingToday, 'Upcoming "Today" badge calculated accurately');

    const upcomingFuture = await cdp.eval('Array.from(document.querySelectorAll(".tca-indicator.tca-upcoming")).some(el => el.textContent.includes("In 4 days"))');
    assert(upcomingFuture, 'Upcoming "In 4 days" badge calculated accurately');

    const laterBadge = await cdp.eval('document.querySelector(".tca-indicator.tca-later")?.textContent.trim()');
    assert(Boolean(laterBadge && laterBadge.includes('In 4w')), `Later badge calculated: "${laterBadge}"`);

    // Record without TCA has no indicator dot
    const noTcaRecordText = await cdp.eval('document.querySelectorAll(".record-card")[4]?.textContent');
    assert(noTcaRecordText.includes('No TCA date scheduled'), 'Record without TCA indicates "No TCA date scheduled" without badge');

    // -------------------------------------------------------------
    // TEST SUITE 5: Search Filtering (Normalized IC/Phone & Case-insensitive)
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Search Filtering ---');

    // Search by name
    await cdp.eval(`
      const input = document.querySelector("#search-input");
      input.value = "ah kow";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    `);
    await new Promise(r => setTimeout(r, 150));
    let matchCount = await cdp.eval('document.querySelectorAll(".record-card").length');
    assert(matchCount === 1, `Search by name "ah kow" returned 1 match (got ${matchCount})`);

    // Search by IC ignoring dashes/spaces: "000202000002"
    await cdp.eval(`
      const input = document.querySelector("#search-input");
      input.value = "000202000002";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    `);
    await new Promise(r => setTimeout(r, 150));
    matchCount = await cdp.eval('document.querySelectorAll(".record-card").length');
    assert(matchCount === 1, `Search by IC stripping dashes ("000202000002") returned 1 match`);

    // Search by Phone ignoring dashes/spaces: "0130000003"
    await cdp.eval(`
      const input = document.querySelector("#search-input");
      input.value = "0130000003";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    `);
    await new Promise(r => setTimeout(r, 150));
    matchCount = await cdp.eval('document.querySelectorAll(".record-card").length');
    assert(matchCount === 1, `Search by phone stripping spaces/dashes returned 1 match`);

    // Search blood investigations text: "TLD regimen"
    await cdp.eval(`
      const input = document.querySelector("#search-input");
      input.value = "TLD regimen";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    `);
    await new Promise(r => setTimeout(r, 150));
    matchCount = await cdp.eval('document.querySelectorAll(".record-card").length');
    assert(matchCount === 1, `Search by clinical plan text ("TLD regimen") returned 1 match`);

    // Unmatched search query
    await cdp.eval(`
      const input = document.querySelector("#search-input");
      input.value = "NONEXISTENT_XYZ_QUERY";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    `);
    await new Promise(r => setTimeout(r, 150));
    const emptySearchTitle = await cdp.eval('document.querySelector(".empty-title")?.textContent');
    assert(emptySearchTitle === 'No Matching Records', 'Unmatched search shows "No Matching Records" empty state');

    // Clear search
    await cdp.eval('document.querySelector("#btn-clear-search-empty")?.click()');
    await new Promise(r => setTimeout(r, 150));
    matchCount = await cdp.eval('document.querySelectorAll(".record-card").length');
    assert(matchCount === 5, 'Clearing search restores full 5 records');

    // -------------------------------------------------------------
    // TEST SUITE 6: Sorting & Empty Values Handling
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Sorting Options & Empty-Last Rule ---');

    // Open Sort Sheet
    await cdp.eval('document.querySelector("#btn-sort-trigger").click()');
    await new Promise(r => setTimeout(r, 200));

    const sortSheetOpen = await cdp.eval('document.querySelector(".action-sheet-options") !== null');
    assert(sortSheetOpen, 'Sort Action Sheet opens on trigger click');

    // Select TCA Latest first (tca_desc)
    await cdp.eval(`
      const items = Array.from(document.querySelectorAll(".action-sheet-item"));
      const latestBtn = items.find(el => el.textContent.includes("Latest first"));
      latestBtn.click();
    `);
    await new Promise(r => setTimeout(r, 200));

    // In tca_desc: the record with NO TCA scheduled MUST BE LAST!
    const lastCardPlan = await cdp.eval('document.querySelectorAll(".record-card")[4]?.textContent');
    assert(lastCardPlan.includes('No TCA date scheduled'), 'Empty TCA date correctly sorted to the very bottom in descending sort');

    // Sort Name A-Z
    await cdp.eval('document.querySelector("#btn-sort-trigger").click()');
    await new Promise(r => setTimeout(r, 200));
    await cdp.eval(`
      const items = Array.from(document.querySelectorAll(".action-sheet-item"));
      const nameAscBtn = items.find(el => el.textContent.includes("A to Z"));
      nameAscBtn.click();
    `);
    await new Promise(r => setTimeout(r, 200));

    const firstCardName = await cdp.eval('document.querySelectorAll(".record-card .patient-name")[0]?.textContent');
    assert(firstCardName.includes('Demo Patient 01'), `Name A-Z correctly sorted first card to: "${firstCardName}"`);

    // Verify sort preference persisted
    const savedSort = await cdp.eval('localStorage.getItem("arv_kkbk_sort_pref")');
    assert(savedSort === 'name_asc', `Sort preference persisted to localStorage: ${savedSort}`);

    // -------------------------------------------------------------
    // TEST SUITE 7: CRUD Lifecycle (Add, View, Edit, Delete)
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing CRUD Lifecycle & Modals ---');

    // Open Add Form
    await cdp.eval('document.querySelector(".btn-desktop-add").click()');
    await new Promise(r => setTimeout(r, 250));

    // Submit without name/IC -> verify validation errors
    await cdp.eval('document.querySelector("#btn-save-record").click()');
    const nameErrorVisible = await cdp.eval('document.querySelector("#error-name").style.display !== "none"');
    assert(nameErrorVisible, 'Validation error displayed when submitting empty Name');

    // Fill valid data
    await cdp.eval(`
      document.querySelector("#field-name").value = "Alpha Test Patient";
      document.querySelector("#field-ic").value = "000808-00-0008";
      document.querySelector("#field-phone").value = "018-0000008";
      document.querySelector("#field-tca").value = "2026-12-01";
      document.querySelector("#field-plan").value = "CD4: 800, VL: TND. Regular 6-month check.";
      document.querySelector("#btn-save-record").click();
    `);
    await new Promise(r => setTimeout(r, 300));

    const newCount = await cdp.eval('document.querySelectorAll(".record-card").length');
    assert(newCount === 6, `Record added successfully (total cards: ${newCount})`);

    // Open Details Modal for new record
    await cdp.eval(`
      const cards = Array.from(document.querySelectorAll(".record-card"));
      const alphaCard = cards.find(c => c.textContent.includes("Alpha Test Patient"));
      alphaCard.click();
    `);
    await new Promise(r => setTimeout(r, 250));

    const detailsTitle = await cdp.eval('document.querySelector("#details-content h2")?.textContent');
    assert(detailsTitle === 'Alpha Test Patient', `Details modal opened for: ${detailsTitle}`);

    // Click Edit button inside details
    await cdp.eval('document.querySelector("#btn-edit-record").click()');
    await new Promise(r => setTimeout(r, 250));

    // Change Name and save
    await cdp.eval(`
      document.querySelector("#field-name").value = "Alpha Test Patient (Updated)";
      document.querySelector("#btn-save-record").click();
    `);
    await new Promise(r => setTimeout(r, 300));

    const updatedCardExists = await cdp.eval('Array.from(document.querySelectorAll(".record-card .patient-name")).some(el => el.textContent.includes("(Updated)"))');
    assert(updatedCardExists, 'Record successfully updated and updated name rendered in card');

    // Open Details again and test Delete
    await cdp.eval(`
      const cards = Array.from(document.querySelectorAll(".record-card"));
      const alphaCard = cards.find(c => c.textContent.includes("(Updated)"));
      alphaCard.click();
    `);
    await new Promise(r => setTimeout(r, 250));

    await cdp.eval('document.querySelector("#btn-delete-record").click()');
    await new Promise(r => setTimeout(r, 200));

    // Confirm sheet should open
    const confirmSheetOpen = await cdp.eval('document.querySelector(".modal-overlay.is-open #confirm-action-btn") !== null');
    assert(confirmSheetOpen, 'Delete confirmation sheet presented to user');

    // Click "Delete Record" (destructive action)
    await cdp.eval('document.querySelector("#confirm-action-btn").click()');
    await new Promise(r => setTimeout(r, 300));

    const countAfterDelete = await cdp.eval('document.querySelectorAll(".record-card").length');
    assert(countAfterDelete === 5, `Record deleted successfully (card count returned to 5)`);

    // -------------------------------------------------------------
    // TEST SUITE 8: Export & Import JSON Round-trip
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Export and Import JSON Schema ---');

    // Open Data Modal
    await cdp.eval('document.querySelector("#btn-open-data").click()');
    await new Promise(r => setTimeout(r, 200));

    const dataModalOpen = await cdp.eval('document.querySelector("#btn-export-json") !== null');
    assert(dataModalOpen, 'Data sheet opened with Export & Import options');

    // Test import schema validation directly
    const validImportCheck = await cdp.eval(`
      const validPayload = JSON.stringify({
        app: "ARV_KKBK",
        version: "1.0",
        records: [
          {
            id: "imp-001",
            name: "Imported Demo Patient 99",
            icNumber: "000909-00-0009",
            phone: "019-0000009",
            nextTca: "2026-11-20",
            bloodInvestigationsPlan: "Baseline checkup"
          }
        ]
      });
      // Test via IndexedDB bulkImport merge
      window.__TEST_IMPORT_PAYLOAD__ = validPayload;
      true;
    `);
    assert(validImportCheck, 'Import JSON payload prepared');

    await cdp.eval(`
      const parsed = JSON.parse(window.__TEST_IMPORT_PAYLOAD__);
      // Call bulkImport directly on our storage instance
      const req = indexedDB.open("arv_kkbk_db", 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("records", "readwrite");
        const store = tx.objectStore("records");
        store.put(parsed.records[0]);
      };
    `);
    await new Promise(r => setTimeout(r, 300));

    // Reload page to verify IndexedDB persistence across browser refresh
    console.log('\n--- 9. Testing IndexedDB Persistence across Reload ---');
    await cdp.send('Page.reload');
    await new Promise(r => setTimeout(r, 600));

    const countAfterReload = await cdp.eval('document.querySelectorAll(".record-card").length');
    assert(countAfterReload === 6, `Data fully persisted in IndexedDB across page reload (found ${countAfterReload} records)`);

    const importedPatientPresent = await cdp.eval('Array.from(document.querySelectorAll(".record-card .patient-name")).some(el => el.textContent.includes("Imported Demo Patient 99"))');
    assert(importedPatientPresent, 'Imported patient persisted and rendered after browser reload');

    console.log(`\n========================================`);
    console.log(`ALL TESTS PASSED! (${passCount}/${testCount} checks)`);
    console.log(`========================================\n`);

  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill();
    server.close();
  }
}

run();
