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
  const importLines = content.match(/from\s+['"][^'"]+['"]/g) || [];
  for (const imp of importLines) {
    const mod = imp.replace(/from\s+['"]/, '').replace(/['"]/, '');
    if (mod.startsWith('.')) {
      const resolved = path.resolve(path.dirname(f), mod);
      const existsTs = fs.existsSync(resolved + '.ts');
      const existsCss = fs.existsSync(resolved);
      const existsExact = fs.existsSync(resolved);
      if (!existsTs && !existsCss && !existsExact) {
        console.error(`BROKEN IMPORT in ${path.relative(rootDir, f)}: "${mod}" -> cannot find ${resolved}`);
        hasError = true;
      }
    }
  }

  // Also check direct style imports like import './styles/main.css';
  const directImports = content.match(/import\s+['"][^'"]+['"]/g) || [];
  for (const dimp of directImports) {
    const mod = dimp.replace(/import\s+['"]/, '').replace(/['"]/, '');
    if (mod.startsWith('.')) {
      const resolved = path.resolve(path.dirname(f), mod);
      if (!fs.existsSync(resolved)) {
        console.error(`BROKEN DIRECT IMPORT in ${path.relative(rootDir, f)}: "${mod}" -> cannot find ${resolved}`);
        hasError = true;
      }
    }
  }
}

if (!hasError) {
  console.log('ALL IMPORTS RESOLVE OK across all', files.length, 'TypeScript files!');
} else {
  process.exit(1);
}
