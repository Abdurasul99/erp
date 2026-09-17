// Verify all t('key') calls reference keys that exist in i18n.js
// Usage: node test/verify_translations.js
// Exits with code 0 if all keys are defined, 1 if any missing.

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

// В проекте ДВА независимых словаря: общий для панели (src/i18n.js) и свой
// у публичной витрины (src/store/storeI18n.mjs). Раньше сверка шла только с
// первым, и все ключи витрины числились «отсутствующими» — на фоне этих 97
// строк шума 4 настоящие дыры (loginMin, passwordRule, birthDate,
// birthDateHint) никто не разглядел. Теперь файл сверяется со СВОИМ словарём.
function keysOf(file) {
  const set = new Set();
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)) {
    set.add(match[1]);
  }
  return set;
}

const storeDir = path.join(srcDir, 'store');
const appKeys = keysOf(path.join(srcDir, 'i18n.js'));
const storeKeys = keysOf(path.join(storeDir, 'storeI18n.mjs'));
const dictFor = (file) => (file.startsWith(storeDir + path.sep) ? storeKeys : appKeys);
const definedKeys = new Set([...appKeys, ...storeKeys]);

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
    if (!usedKeys.has(match[1])) usedKeys.set(match[1], new Map());
    usedKeys.get(match[1]).set(path.relative(srcDir, file), dictFor(file));
  }
}

const missing = [];
for (const [key, files] of usedKeys) {
  // Ключ считается дырой только там, где файл сверяется со словарём без него:
  // одно и то же имя может жить в словаре витрины и отсутствовать в общем.
  const orphans = [...files].filter(([, dict]) => !dict.has(key)).map(([name]) => name);
  if (orphans.length) missing.push({ key, files: orphans });
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
