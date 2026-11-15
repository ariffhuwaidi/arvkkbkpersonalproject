import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

function getTsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getTsFiles(full));
    } else if (item.name.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

const files = getTsFiles(srcDir);
let hasError = false;

for (const f of files) {
  const content = fs.readFileSync(f, 'utf-8');
  // Match named imports: import { a, b, c } from './mod'
  const namedImportsMatches = content.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"](\.[^'"]+)['"]/g);
  for (const m of namedImportsMatches) {
    const symbols = m[1].split(',').map(s => s.trim().replace(/^type\s+/, '')).filter(Boolean);
    const mod = m[2];
    const targetPath = path.resolve(path.dirname(f), mod) + '.ts';
    if (!fs.existsSync(targetPath)) continue;

    const targetContent = fs.readFileSync(targetPath, 'utf-8');
    for (const sym of symbols) {
      // Check if symbol is exported in targetContent
      // sym might be "foo as bar"
      const originalSym = sym.split(/\s+as\s+/)[0].trim();
      const exportRegex = new RegExp(`export\\s+(?:type|interface|class|const|let|function|enum)\\s+${originalSym}\\b|export\\s*\\{[^}]*\\b${originalSym}\\b[^}]*\\}`);
      if (!exportRegex.test(targetContent)) {
        console.error(`[NAMED IMPORT ERROR] In ${path.relative(rootDir, f)}: Symbol "${originalSym}" is imported from "${mod}" but NOT exported in ${path.relative(rootDir, targetPath)}!`);
        hasError = true;
      }
    }
  }
}

if (!hasError) {
  console.log('[PASS] ALL named imports and exports match 100%!');
} else {
  console.error('[FAIL] Some named imports do not exist in their export files!');
  process.exit(1);
}
