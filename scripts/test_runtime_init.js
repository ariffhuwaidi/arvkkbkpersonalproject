import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const domMock = {
  window: {},
  document: {
    readyState: 'complete',
    addEventListener: () => {},
    getElementById: (id) => ({
      innerHTML: '',
      appendChild: () => {},
      querySelector: () => null,
      querySelectorAll: () => []
    }),
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      setAttribute: () => {},
      getAttribute: () => '',
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      style: {},
      addEventListener: () => {},
      appendChild: () => {},
      querySelectorAll: () => [],
      querySelector: () => null
    }),
    body: {
      classList: { add: () => {}, remove: () => {} },
      appendChild: () => {}
    }
  },
  navigator: { userAgent: 'test' },
  localStorage: { getItem: () => null, setItem: () => {} },
  indexedDB: { open: () => ({ onsuccess: () => {}, onerror: () => {}, onupgradeneeded: () => {} }) },
  console: console
};
domMock.window = domMock;

const code = fs.readFileSync(path.join(rootDir, 'app.bundle.js'), 'utf-8');
const context = vm.createContext(domMock);

try {
  vm.runInContext(code, context);
  console.log('[SUCCESS] app.bundle.js runs without any runtime error!');
} catch (e) {
  console.error('[RUNTIME ERROR]:', e);
  process.exit(1);
}
