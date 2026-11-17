// Gives every test an in-memory IndexedDB, so storage code runs for real.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach } from 'vitest';

// Node 26 has its own experimental localStorage that hides jsdom's in browser-like
// tests. Use the simulated page's storage instead.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (dom) {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true, writable: true });
  }
}

beforeEach(() => {
  // A fresh, empty database for each test.
  globalThis.indexedDB = new IDBFactory();
});
