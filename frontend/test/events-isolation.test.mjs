// Интерфейс «Мероприятий» не должен зависеть от кода Wave. Иначе обещание
// «продукты не имеют отношения друг к другу» перестанет быть правдой при первой
// же удобной правке: изменили компонент Wave — сломали чужой продукт.
//
// Разрешено: библиотеки, свои файлы внутри src/events и ровно один мост —
// AuthContext из App.jsx (общий вход — это и есть единственная точка связи).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const eventsDir = path.join(here, '..', 'src', 'events');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : (/\.(jsx?|mjs|css)$/.test(e.name) ? [p] : []);
  });
}

const PACKAGES = new Set(['react', 'react-dom', 'react-router-dom', 'axios']);

function importsOf(src) {
  const out = [];
  for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) out.push(m[1]);
  return out;
}

test('файлы интерфейса мероприятий найдены', () => {
  assert.ok(walk(eventsDir).length >= 5);
});

test('интерфейс мероприятий импортирует только своё, библиотеки и общий вход', () => {
  const offenders = [];
  for (const file of walk(eventsDir)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const spec of importsOf(src)) {
      if (PACKAGES.has(spec)) continue;
      if (spec.startsWith('https://')) continue; // шрифт в CSS
      if (!spec.startsWith('.')) { offenders.push(`${path.relative(eventsDir, file)} → ${spec} (пакет не из списка)`); continue; }
      const target = path.resolve(path.dirname(file), spec);
      const insideEvents = target.startsWith(eventsDir + path.sep) || target === eventsDir;
      const isAuthBridge = path.relative(path.join(eventsDir, '..'), target).replace(/\\/g, '/') === 'App.jsx';
      if (!insideEvents && !isAuthBridge) offenders.push(`${path.relative(eventsDir, file)} → ${spec}`);
    }
  }
  assert.deepEqual(offenders, [], `интерфейс мероприятий тянет код Wave:\n${offenders.join('\n')}`);
});

test('из App.jsx берётся только AuthContext', () => {
  for (const file of walk(eventsDir)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.\.\/)+App\.jsx['"]/g)) {
      const names = m[1].split(',').map((s) => s.trim()).filter(Boolean);
      assert.deepEqual(names, ['AuthContext'], `${path.relative(eventsDir, file)} берёт из App.jsx лишнее: ${names.join(', ')}`);
    }
  }
});

test('стили мероприятий не протекают в Wave: каждое правило внутри .ev-app или @-блока', () => {
  // Все CSS-файлы папки, а не только events.css: новый файл стилей — ровно то
  // место, где правило без префикса проскочит незаметно.
  const cssFiles = walk(eventsDir).filter((f) => f.endsWith('.css'));
  assert.ok(cssFiles.length > 0);
  const css = cssFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  // Селекторы верхнего уровня (вне @media/@keyframes) обязаны начинаться с .ev-
  const leaks = [];
  let depth = 0;
  let buf = '';
  let atBlock = 0;
  for (const ch of css) {
    if (ch === '{') {
      const sel = buf.trim();
      if (depth === 0 && sel.startsWith('@')) atBlock = 1;
      if (!sel.startsWith('@') && !(atBlock && /^(\d+%|from|to)(\s*,\s*(\d+%|from|to))*$/.test(sel))) {
        for (const part of sel.split(',').map((s) => s.trim()).filter(Boolean)) {
          if (!part.startsWith('.ev-')) leaks.push(part);
        }
      }
      depth += 1;
      buf = '';
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) atBlock = 0;
      buf = '';
    } else if (ch === ';' && depth === 0) {
      buf = '';
    } else {
      buf += ch;
    }
  }
  assert.deepEqual(leaks, [], `селекторы вне .ev-*:\n${leaks.join('\n')}`);
});
