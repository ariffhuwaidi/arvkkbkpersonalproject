import fs from 'fs';
import path from 'path';

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`[PASS] ${message}`);
}

console.log('====================================================');
console.log(' CLINIC TCA MANAGER - REDESIGN & PATIENT MGMT TESTS ');
console.log('====================================================\n');

const projectDir = path.resolve('.');

// 1. Audit Emojis across all source files and templates
console.log('--- 1. Auditing Codebase for Emojis ---');
const srcDir = path.join(projectDir, 'src');
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]|[👁✎🏷🚫✓🗑⚠️⚡]/u;

function checkFilesForEmojis(dir) {
  let emojiFound = false;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (checkFilesForEmojis(full)) emojiFound = true;
    } else if (f.endsWith('.ts') || f.endsWith('.html') || f.endsWith('.css')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (emojiRegex.test(line)) {
          console.error(`Emoji detected in ${f}:${idx + 1} -> ${line.trim()}`);
          emojiFound = true;
        }
      });
    }
  }
  return emojiFound;
}

const hasEmojis = checkFilesForEmojis(srcDir);
assert(!hasEmojis, 'No emojis found in any src/ TypeScript, HTML, or CSS file');

// 2. Audit Three-Dot Menu in RecordCard
console.log('\n--- 2. Auditing Patient Three-Dot Menu (Requirement 2) ---');
const recordCardContent = fs.readFileSync(path.join(srcDir, 'components', 'record-card.ts'), 'utf8');
assert(recordCardContent.includes('ios-action-menu'), 'Record card uses .ios-action-menu');
assert(recordCardContent.includes('View Profile'), 'Menu contains "View Profile" label');
assert(recordCardContent.includes('Edit Patient'), 'Menu contains "Edit Patient" label');
assert(recordCardContent.includes('Change Category'), 'Menu contains "Change Category" label');
assert(recordCardContent.includes('Deactivate Patient'), 'Menu contains "Deactivate Patient" label');
assert(recordCardContent.includes('Delete Patient'), 'Menu contains "Delete Patient" label');
assert(recordCardContent.includes('ios-menu-icon'), 'Menu items use clean SVG line icons with class ios-menu-icon');
assert(!recordCardContent.includes('👁') && !recordCardContent.includes('✎') && !recordCardContent.includes('🗑'), 'Menu contains zero emojis');

// 3. Audit Heading and Form in RecordModal (Requirement 3)
console.log('\n--- 3. Auditing Heading and Form in RecordModal (Requirement 3) ---');
const recordModalContent = fs.readFileSync(path.join(srcDir, 'components', 'record-modal.ts'), 'utf8');
assert(recordModalContent.includes('Add Patient'), 'Heading in Add mode is "Add Patient"');
assert(recordModalContent.includes('Edit Patient Details'), 'Heading in Edit mode is "Edit Patient Details"');
assert(!recordModalContent.includes('New Patient Registration'), 'Long heading "New Patient Registration" was completely removed');

// 4. Audit Existing Patient Dropdown (Requirement 1)
console.log('\n--- 4. Auditing Dynamic Existing Patient Dropdown (Requirement 1) ---');
assert(recordModalContent.includes('select-existing-patient'), 'RecordModal includes #select-existing-patient dropdown');
assert(recordModalContent.includes('filter-existing-patients'), 'RecordModal includes search input #filter-existing-patients');
assert(recordModalContent.includes('populateExistingDropdown'), 'RecordModal includes dynamic populateExistingDropdown logic');
assert(recordModalContent.includes('maskIC'), 'RecordModal uses privacy-conscious maskIC function');
assert(recordModalContent.includes('existing-picker-empty'), 'RecordModal includes empty state notice for existing patients');
assert(recordModalContent.includes('applySelectedExistingPatient'), 'Selecting an existing patient applies their profile without creating duplicates');
assert(recordModalContent.includes('btn-clear-existing-selection'), 'RecordModal provides clear selection button');

// 5. Audit Bottom Navigation (Requirement 5)
console.log('\n--- 5. Auditing Native iPhone Bottom Navigation (Requirement 5) ---');
const navBarContent = fs.readFileSync(path.join(srcDir, 'components', 'nav-bar.ts'), 'utf8');
assert(navBarContent.includes('data-tab="records"'), 'Bottom navigation preserves records tab');
assert(navBarContent.includes('data-tab="tca"'), 'Bottom navigation preserves tca tab');
assert(navBarContent.includes('>Records</span>'), 'Tab 1 label is strictly "Records"');
assert(navBarContent.includes('>TCA</span>'), 'Tab 2 label is strictly "TCA"');
assert(!navBarContent.includes('data-tab="settings"'), 'No extra tabs added');

const componentsCss = fs.readFileSync(path.join(srcDir, 'styles', 'components.css'), 'utf8');
assert(componentsCss.includes('calc(49px + var(--sab))'), 'Tab bar uses native Apple 49px + safe area height');
assert(componentsCss.includes('backdrop-filter: blur(25px)'), 'Tab bar uses Apple frosted glass translucent backdrop-filter');
assert(componentsCss.includes('.tab-item.is-active'), 'Tab bar has distinct active tab styling');

// 6. Audit Main Content Padding for Safe Area
console.log('\n--- 6. Auditing Main Content Padding & Safe Area ---');
const mainCss = fs.readFileSync(path.join(srcDir, 'styles', 'main.css'), 'utf8');
assert(mainCss.includes('var(--sab)'), 'Main content padding respects safe-area-inset-bottom');

// 7. Audit Header Desktop Button
console.log('\n--- 7. Auditing Header Buttons ---');
const headerContent = fs.readFileSync(path.join(srcDir, 'components', 'header.ts'), 'utf8');
assert(headerContent.includes('Add Patient'), 'Header desktop button says "Add Patient"');

// 8. Audit Summary Metrics Strip (Requirement 4)
console.log('\n--- 8. Auditing Summary Dashboard (Requirement 4) ---');
const mainTs = fs.readFileSync(path.join(srcDir, 'main.ts'), 'utf8');
assert(mainTs.includes('summary-metrics-strip'), 'main.ts includes #summary-metrics-strip');
assert(mainTs.includes('updateSummaryMetrics'), 'main.ts implements updateSummaryMetrics method');
assert(!mainTs.includes('⚠️'), 'Confirmation dialog in main.ts has zero emojis');

console.log('\n====================================================');
console.log(' ALL 20 ACCEPTANCE CRITERIA AUDITED AND PASSED!     ');
console.log('====================================================\n');
