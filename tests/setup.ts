// Gives every test an in-memory IndexedDB, so storage code runs for real.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach } from 'vitest';

beforeEach(() => {
  // A fresh, empty database for each test.
  globalThis.indexedDB = new IDBFactory();
});
