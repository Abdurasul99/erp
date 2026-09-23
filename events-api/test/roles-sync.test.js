'use strict';

// Список ролей «Мероприятий» живёт в трёх местах, потому что это три разных
// приложения: backend Wave (админка заводит учётки), events-api (решает доступ)
// и интерфейс (меню и подписи). Разойдись копии — админка создавала бы учётки,
// которые не могут войти, или интерфейс рисовал бы меню для несуществующей роли.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const service = require('../src/access');
const waveBackend = require(path.join(ROOT, 'backend', 'products.js'));

// Интерфейс — ES-модуль под Vite; читаем массив из исходника.
function frontendRoles() {
  const src = fs.readFileSync(path.join(ROOT, 'frontend', 'src', 'events', 'access.js'), 'utf8');
  const m = src.match(/export const EVENTS_ROLES = (\[[^\]]*\])/);
  assert.ok(m, 'в frontend/src/events/access.js нет EVENTS_ROLES');
  return JSON.parse(m[1].replace(/'/g, '"'));
}

function frontendLabels() {
  const src = fs.readFileSync(path.join(ROOT, 'frontend', 'src', 'events', 'access.js'), 'utf8');
  const block = src.match(/export const ROLE_LABELS = \{([^}]*)\}/);
  assert.ok(block, 'в frontend/src/events/access.js нет ROLE_LABELS');
  return Object.fromEntries([...block[1].matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
}

test('роли совпадают: сервис мероприятий ↔ backend Wave', () => {
  assert.deepEqual(waveBackend.EVENTS_ROLES, service.EVENTS_ROLES);
});

test('роли совпадают: сервис мероприятий ↔ интерфейс', () => {
  assert.deepEqual(frontendRoles(), service.EVENTS_ROLES);
});

test('подписи ролей в интерфейсе совпадают с сервисом', () => {
  assert.deepEqual(frontendLabels(), service.ROLE_LABELS);
});

test('«войти как» разрешён одним и тем же ролям в Wave и в сервисе', () => {
  const { IMPERSONATABLE_EVENTS_ROLES } = require('../src/auth');
  assert.deepEqual(waveBackend.IMPERSONATABLE_ROLES.events, IMPERSONATABLE_EVENTS_ROLES);
});

test('в матрице доступа описана каждая роль и только известные разделы', () => {
  for (const role of service.EVENTS_ROLES) {
    const screens = service.DEFAULT_ACCESS[role];
    assert.ok(Array.isArray(screens), `нет доступа для роли ${role}`);
    for (const s of screens) assert.ok(service.SCREEN_GROUPS.includes(s), `${role}: неизвестный раздел ${s}`);
  }
});

test('роли продуктов не пересекаются, кроме учредителя', () => {
  // founder — единственная общая роль; из-за неё граница проходит по продукту,
  // а не по роли. Появись ещё одна общая — это надо увидеть и осмыслить.
  const shared = waveBackend.WAVE_ROLES.filter((r) => waveBackend.EVENTS_ROLES.includes(r));
  assert.deepEqual(shared, ['founder']);
});
