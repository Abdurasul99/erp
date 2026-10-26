// Экраны «Декора» (src/decor) — код сферы, присланный пакетом: свой вход, свой токен,
// свой сервис decor-api. Они не должны тянуть код Wave (иначе правка Wave ломает сферу),
// а стили — выходить за корень .dd (иначе сфера перекрасит Wave).
// Маршрут /decor/* — отдельная ветка App без проверки входа Wave.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const decorDir = path.join(here, '..', 'src', 'decor');
const PACKAGES = new Set(['react', 'react-dom', 'react-router-dom', 'axios']);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : (/\.(jsx?|mjs|css)$/.test(e.name) ? [p] : []);
  });
}

function importsOf(src) {
  return [...src.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

test('экраны «Декора» на месте', () => {
  assert.ok(fs.existsSync(path.join(decorDir, 'DecorApp.jsx')));
  assert.ok(walk(decorDir).length >= 20);
});

test('«Декор» импортирует только своё и библиотеки', () => {
  const offenders = [];
  for (const file of walk(decorDir)) {
    for (const spec of importsOf(fs.readFileSync(file, 'utf8'))) {
      if (PACKAGES.has(spec)) continue;
      if (!spec.startsWith('.')) { offenders.push(`${path.relative(decorDir, file)} → ${spec}`); continue; }
      const target = path.resolve(path.dirname(file), spec);
      if (!target.startsWith(decorDir + path.sep)) offenders.push(`${path.relative(decorDir, file)} → ${spec}`);
    }
  }
  assert.deepEqual(offenders, [], `«Декор» тянет код Wave:\n${offenders.join('\n')}`);
});

test('стили «Декора» не выходят за .dd', () => {
  const css = fs.readFileSync(path.join(decorDir, 'decor.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const leaks = [];
  for (const m of css.matchAll(/(^|\})\s*([^{}@]+)\{/g)) {
    for (const sel of m[2].split(',').map((s) => s.trim()).filter(Boolean)) {
      if (/^(from|to|\d+%)$/.test(sel)) continue;
      if (!/(^|\s|:where\()\.dd([\s.:[>~+#)-]|$)/.test(sel) && !/^\.dd/.test(sel)) leaks.push(sel);
    }
  }
  assert.deepEqual(leaks, [], `селекторы без .dd:\n${leaks.join('\n')}`);
});

test('/decor/* — отдельная ветка App, без проверки входа Wave', () => {
  const app = fs.readFileSync(path.join(here, '..', 'src', 'App.jsx'), 'utf8');
  assert.match(app, /lazy\(\(\) => import\('\.\/decor\/DecorApp\.jsx'\)\)/, 'DecorApp грузится отдельным куском');
  assert.match(app, /if \(isDecorPath\(pathname\)\) return <DecorStandaloneApp \/>/);
  const branch = app.slice(app.indexOf('function DecorStandaloneApp'), app.indexOf('export function isDecorPath'));
  assert.doesNotMatch(branch, /RequireAuth|AuthContext|TaskInboxProvider/, 'в ветке «Декора» нет входа Wave');
});
