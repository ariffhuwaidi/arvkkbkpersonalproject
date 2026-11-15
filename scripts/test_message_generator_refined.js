import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('---------------------------------------------------------');
console.log('VERIFYING REFINED MESSAGE GENERATOR UI & DARK MODE');
console.log('---------------------------------------------------------\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`[FAIL] ${name}: ${e.message}`);
  }
}

const msgGenTs = fs.readFileSync(path.join(rootDir, 'src', 'components', 'message-generator.ts'), 'utf-8');
const compCss = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'components.css'), 'utf-8');
const themeCss = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'theme.css'), 'utf-8');
const bundleJs = fs.readFileSync(path.join(rootDir, 'app.bundle.js'), 'utf-8');

test('1. Message Type uses compact dropdown selector instead of inline chips', () => {
  assert(msgGenTs.includes('<select id="msg-select-template"'), 'Missing #msg-select-template dropdown');
  assert(!msgGenTs.includes('class="template-chip'), 'Should not contain old template-chip buttons');
  assert(msgGenTs.includes('value="blood_collection"'), 'Missing blood_collection option');
  assert(msgGenTs.includes('value="tca_reschedule"'), 'Missing tca_reschedule option');
  assert(msgGenTs.includes('value="tca_reminder"'), 'Missing tca_reminder option');
  assert(msgGenTs.includes('value="missed_appointment"'), 'Missing missed_appointment option');
  assert(msgGenTs.includes('value="general_followup"'), 'Missing general_followup option');
  assert(msgGenTs.includes('value="custom"'), 'Missing custom option');
});

test('2. Visually separated iOS grouped inset sections', () => {
  assert(msgGenTs.includes('Message Configuration'), 'Missing Message Configuration section');
  assert(msgGenTs.includes('Patient Details'), 'Missing Patient Details section');
  assert(msgGenTs.includes('Appointment Details'), 'Missing Appointment Details section');
  assert(msgGenTs.includes('Message Preview'), 'Missing Message Preview section');
  assert(compCss.includes('.msg-card-section'), 'Missing .msg-card-section CSS');
});

test('3. Form fields are full-width and optional fields clearly marked', () => {
  assert(compCss.includes('.msg-form-grid'), 'Missing .msg-form-grid');
  assert(msgGenTs.includes('(Optional)'), 'Optional fields must be clearly marked');
});

test('4. Message preview textarea has 100% width, min 220px height, and 16px font-size', () => {
  assert(compCss.includes('min-height: 220px !important'), 'Preview textarea must have min-height: 220px');
  assert(compCss.includes('font-size: 16px !important'), 'Preview textarea must have font-size: 16px');
  assert(compCss.includes('width: 100% !important'), 'Preview textarea must have width: 100%');
  assert(msgGenTs.includes('id="msg-preview-text"'), 'Missing #msg-preview-text');
});

test('5. Complete Dark Mode styling audit', () => {
  assert(themeCss.includes('color-scheme: light;'), 'Missing color-scheme: light');
  assert(themeCss.includes('color-scheme: dark;'), 'Missing color-scheme: dark');
  assert(compCss.includes('[data-theme="dark"] .msg-card-section'), 'Missing dark mode .msg-card-section');
  assert(compCss.includes('[data-theme="dark"] .msg-preview-textarea'), 'Missing dark mode .msg-preview-textarea');
  assert(compCss.includes('[data-theme="dark"] .form-select.ios-select'), 'Missing dark mode .form-select.ios-select');
  assert(compCss.includes('caret-color: var(--color-accent)'), 'Missing caret-color styling');
});

test('6. Functional capabilities preserved (templates, tones, WhatsApp, copy, reset)', () => {
  assert(msgGenTs.includes('Polite'), 'Missing Polite tone');
  assert(msgGenTs.includes('Friendly'), 'Missing Friendly tone');
  assert(msgGenTs.includes('Formal'), 'Missing Formal tone');
  assert(msgGenTs.includes('https://wa.me/'), 'Missing WhatsApp link integration');
  assert(msgGenTs.includes('clipboard.writeText'), 'Missing copy message action');
  assert(msgGenTs.includes('btn-msg-reset'), 'Missing reset button');
});

test('7. Zero decorative emojis in Message Generator', () => {
  const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;
  assert(!emojiRegex.test(msgGenTs), 'Message Generator must have zero emojis');
});

test('8. Bundled app.bundle.js contains refined Message Generator', () => {
  assert(bundleJs.includes('msg-select-template'), 'Bundle missing msg-select-template');
  assert(bundleJs.includes('msg-preview-textarea'), 'Bundle missing msg-preview-textarea');
});

console.log(`\nRESULTS: ${passed} of ${total} tests passed.`);
if (passed === total) {
  console.log('ALL VERIFICATIONS PASSED!\n');
  process.exit(0);
} else {
  console.error('FAILURES DETECTED!\n');
  process.exit(1);
}
