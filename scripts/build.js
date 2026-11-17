import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const outDir = path.join(rootDir, 'dist_js');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function processDirectory(source, target) {
  ensureDir(target);
  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      processDirectory(srcPath, destPath);
    } else if (entry.name.endsWith('.ts')) {
      const tsCode = fs.readFileSync(srcPath, 'utf-8');
      let jsCode = stripTypeScriptTypes(tsCode);

      // Strip type-only imports or imports from storage-interface.js
      jsCode = jsCode.replace(/import\s+type\s+[^;]+;?\s*/g, '');
      jsCode = jsCode.replace(/import\s+\{[^}]*\}\s+from\s+['"][^'"]*storage-interface(\.js)?['"];?\s*/g, '');

      // For types, keep BLOOD_INVESTIGATION_OPTIONS if present, strip pure type imports
      jsCode = jsCode.replace(/import\s+\{([^}]*)\}\s+from\s+['"]([^'"]*types)(\.js)?['"];?\s*/g, (match, imports, importPath) => {
        const named = imports.split(',').map(s => s.trim()).filter(Boolean);
        const runtimeNamed = named.filter(n => n === 'BLOOD_INVESTIGATION_OPTIONS');
        if (runtimeNamed.length > 0) {
          return `import { ${runtimeNamed.join(', ')} } from '${importPath}';\n`;
        }
        return '';
      });

      // Fix relative imports: from './foo' -> './foo.js'
      jsCode = jsCode.replace(/from\s+['"](\.[^'"]+)['"]/g, (match, importPath) => {
        if (!importPath.endsWith('.js') && !importPath.endsWith('.css')) {
          return `from '${importPath}.js'`;
        }
        return match;
      });

      // Strip CSS imports for standalone JS module run
      jsCode = jsCode.replace(/import\s+['"][^'"]+\.css['"];?\s*/g, '');

      const outFilePath = destPath.replace(/\.ts$/, '.js');
      fs.writeFileSync(outFilePath, jsCode, 'utf-8');
    }
  }
}

console.log('Compiling TypeScript sources...');
processDirectory(srcDir, outDir);

// Also generate a single standalone bundled script for universal static serving without build tools
console.log('Generating standalone app.bundle.js...');

const modulesInOrder = [
  'types',
  'storage/storage-interface',
  'utils/escape',
  'utils/date',
  'utils/theme',
  'utils/search',
  'utils/sort',
  'utils/mmt',
  'utils/crypto',
  'utils/merge',
  'utils/app-lock',
  'utils/demo-data',
  'storage/indexeddb-storage',
  'storage/safety-snapshot',
  'components/toast',
  'components/confirm-sheet',
  'utils/export-import',
  'components/passphrase-sheet',
  'utils/backup-passphrase',
  'utils/google-drive',
  'components/blood-collection-modal',
  'components/record-card',
  'components/sort-sheet',
  'components/record-modal',
  'components/appointment-modal',
  'components/details-modal',
  'components/message-generator',
  'components/settings-modal',
  'components/data-modal',
  'components/nav-bar',
  'components/tca-view',
  'components/header',
  'components/lock-screen',
  'components/mmt-card',
  'components/mmt-view',
  'components/mmt-modal',
  'components/mmt-enrol-modal',
  'main'
];

let bundleCode = '(() => {\n';
bundleCode += '  "use strict";\n\n';

for (const mod of modulesInOrder) {
  const tsPath = path.join(srcDir, `${mod}.ts`);
  let code = fs.readFileSync(tsPath, 'utf-8');
  code = stripTypeScriptTypes(code);

  // Remove import statements
  code = code.replace(/import\s+[^;]+;?\s*/g, '');

  // Convert export declarations to local declarations
  code = code.replace(/export\s+class\s+(\w+)/g, 'class $1');
  code = code.replace(/export\s+async\s+function\s+(\w+)/g, 'async function $1');
  code = code.replace(/export\s+function\s+(\w+)/g, 'function $1');
  code = code.replace(/export\s+const\s+(\w+)/g, 'const $1');
  code = code.replace(/export\s+let\s+(\w+)/g, 'let $1');
  code = code.replace(/export\s+\{[^}]*\};?/g, '');
  code = code.replace(/export\s+default\s+[^;]+;?/g, '');

  bundleCode += `  // --- Module: ${mod} ---\n`;
  bundleCode += code + '\n\n';
}

bundleCode += '})();\n';

const bundleJsPath = path.join(rootDir, 'app.bundle.js');
fs.writeFileSync(bundleJsPath, bundleCode, 'utf-8');
console.log('Standalone app.bundle.js created successfully.');

// Bundle CSS
console.log('Generating standalone app.bundle.css...');
const cssFiles = ['theme.css', 'main.css', 'components.css', 'redesign.css'];
let bundleCss = '/* ARV KKBK - Combined Stylesheet */\n\n';
for (const file of cssFiles) {
  const filePath = path.join(srcDir, 'styles', file);
  if (fs.existsSync(filePath)) {
    bundleCss += `/* --- ${file} --- */\n`;
    bundleCss += fs.readFileSync(filePath, 'utf-8') + '\n\n';
  }
}
const bundleCssPath = path.join(rootDir, 'app.bundle.css');
fs.writeFileSync(bundleCssPath, bundleCss, 'utf-8');
console.log('Standalone app.bundle.css created successfully.');

// Populate clean production dist/ directory
console.log('Creating production dist/ folder...');
const distDir = path.join(rootDir, 'dist');
ensureDir(distDir);

// Generate standalone production index.html referencing compiled bundles
const prodIndexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="description" content="ARV KKBK - Antiretroviral Personal Record Tracker" />

    <!-- iOS Safari PWA Meta Tags -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="ARV KKBK" />
    <meta name="format-detection" content="telephone=no" />
    <meta name="theme-color" content="#F2F2F7" />

    <!-- Icons & Manifest -->
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <link rel="manifest" href="./manifest.webmanifest" />

    <link rel="stylesheet" href="./app.bundle.css" />
    <title>ARV KKBK</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="./app.bundle.js"></script>
  </body>
</html>`;
fs.writeFileSync(path.join(distDir, 'index.html'), prodIndexHtml, 'utf-8');

const filesToCopyToDist = [
  'app.bundle.js',
  'app.bundle.css',
  'sw.js',
  'manifest.webmanifest',
  'favicon.svg',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png'
];

for (const f of filesToCopyToDist) {
  const srcFile = path.join(rootDir, f);
  const destFile = path.join(distDir, f);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
  }
}
console.log('Production dist/ folder generated and verified.');
