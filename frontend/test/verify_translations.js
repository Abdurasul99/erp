// Verify all t('key') calls reference keys that exist in i18n.js
// Usage: node test/verify_translations.js
// Exits with code 0 if all keys are defined, 1 if any missing.

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const i18nPath = path.join(srcDir, 'i18n.js');

// Collect defined keys from both ru and uz blocks
const i18nSrc = fs.readFileSync(i18nPath, 'utf8');
const definedKeys = new Set();
for (const match of i18nSrc.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)) {
  definedKeys.add(match[1]);
}

// Walk source directory and find t('key') calls
function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(p));
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(p);
  }
  return files;
}

const usedKeys = new Map(); // key → [files where used]
for (const file of walk(srcDir)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const match of src.matchAll(/\bt\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\s*\)/g)) {
    if (!usedKeys.has(match[1])) usedKeys.set(match[1], new Set());
    usedKeys.get(match[1]).add(path.relative(srcDir, file));
  }
}

const missing = [];
for (const [key, files] of usedKeys) {
  if (!definedKeys.has(key)) missing.push({ key, files: [...files] });
}

console.log(`Defined keys: ${definedKeys.size}`);
console.log(`Used keys:    ${usedKeys.size}`);
console.log(`Missing:      ${missing.length}`);

if (missing.length > 0) {
  console.log('\nMissing translation keys:');
  for (const m of missing) {
    console.log(`  ✗ t('${m.key}') used in: ${m.files.join(', ')}`);
  }
  process.exit(1);
}

console.log('\n✓ All translation keys are defined');
process.exit(0);
