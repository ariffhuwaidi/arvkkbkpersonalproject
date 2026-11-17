// Project rules from the README that can be checked across the whole codebase.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(__dirname, '..');
const srcFiles = (dir = path.join(root, 'src')): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? srcFiles(full) : /\.(ts|css|html)$/.test(e.name) ? [full] : [];
  });
const read = (f: string) => fs.readFileSync(f, 'utf-8');

describe('project rules', () => {
  it('no decorative emojis in the app', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const offenders = srcFiles().filter(f => emoji.test(read(f))).map(f => path.relative(root, f));
    expect(offenders).toEqual([]);
  });

  it('localStorage holds only settings, never patient records', () => {
    // Every key written to localStorage must be one of these settings.
    const allowed = new Set([
      'PROGRAM_KEY', 'VERIFIER_KEY', 'FAIL_KEY', 'PIN_KEY', 'TIMEOUT_KEY',
      'GDRIVE_CLIENT_ID_KEY', 'GDRIVE_LAST_BACKUP_KEY', 'GDRIVE_LAST_FILE_KEY', 'GDRIVE_BACKUP_PENDING_KEY',
      'TAB_STORAGE_KEY', 'SORT_STORAGE_KEY', 'THEME_STORAGE_KEY'
    ]);
    const writes = srcFiles().flatMap(f => [...read(f).matchAll(/localStorage\.setItem\(\s*([^,]+),/g)].map(m => `${path.basename(f)}: ${m[1].trim()}`));
    expect(writes.length).toBeGreaterThan(0);
    expect(writes.filter(w => !allowed.has(w.split(': ')[1]))).toEqual([]);
  });

  it('buttons and chips keep 44px touch targets', () => {
    expect(read(path.join(root, 'src/styles/components.css'))).toMatch(/min-height:\s*44px/);
  });

  it('generated build output is not tracked by git', () => {
    let tracked = '';
    try {
      tracked = execFileSync('git', ['ls-files', 'app.bundle.js', 'app.bundle.css', 'live_preview.html', 'dist_js', 'dist'], { cwd: root, encoding: 'utf-8' });
    } catch { return; /* git not available */ }
    expect(tracked.trim()).toBe('');
  });
});
