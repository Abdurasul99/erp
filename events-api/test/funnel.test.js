'use strict';

// Воронка этапов: подписи сроков обязаны совпадать с макетом «Редактор воронки
// процесса» слово в слово — по ним исполнитель понимает, когда сдавать этап.

const test = require('node:test');
const assert = require('node:assert/strict');
const { deadlineLabel, dueAt, BUILTIN_TEMPLATES } = require('../src/funnel');

test('подписи сроков свадебного шаблона — дословно как в макете', () => {
  const wedding = BUILTIN_TEMPLATES.find((t) => t.key === 'wedding').stages;
  const labels = Object.fromEntries(wedding.map((s) => [s.name, deadlineLabel(s.deadline_anchor, s.deadline_offset_hours)]));
  assert.deepEqual(labels, {
    'Заявка': 'В течение 1 дня после обращения',
    'Смета': 'За 14 дней до события',
    'Закуп': 'За 7 дней до события',
    'Подготовка': 'За 2 дня до события',
    'Монтаж': 'В день события, до начала',
    'Проведение': 'Во время события',
    'Демонтаж': 'В течение 12 часов после события',
    'Закрытие': 'В течение 2 дней после события',
  });
});

test('подписи корпоративного шаблона — как в макете', () => {
  const corp = BUILTIN_TEMPLATES.find((t) => t.key === 'corporate').stages;
  const labels = corp.map((s) => deadlineLabel(s.deadline_anchor, s.deadline_offset_hours));
  assert.deepEqual(labels, [
    'В течение 1 дня после обращения',
    'За 10 дней до события',
    'За 5 дней до события',
    'В день события, до начала',
    'В течение 12 часов после события',
    'В течение 3 дней после события',
  ]);
});

test('падежи на границах: 1, 2, 5, 11, 21 — после «в течение» и после «за»', () => {
  const inside = (d) => deadlineLabel('end', d * 24);
  assert.equal(inside(1), 'В течение 1 дня после события');
  assert.equal(inside(2), 'В течение 2 дней после события');
  assert.equal(inside(5), 'В течение 5 дней после события');
  assert.equal(inside(11), 'В течение 11 дней после события');
  assert.equal(inside(21), 'В течение 21 дня после события');
  assert.equal(deadlineLabel('end', 1), 'В течение 1 часа после события');
  assert.equal(deadlineLabel('start', -24), 'За 1 день до события');
  assert.equal(deadlineLabel('start', -11 * 24), 'За 11 дней до события');
  assert.equal(deadlineLabel('start', -22 * 24), 'За 22 дня до события');
  assert.equal(deadlineLabel('start', -3), 'За 3 часа до события');
});

test('срок считается от нужной точки: создание, начало, окончание', () => {
  const event = {
    created_at: '2026-09-01T10:00:00.000Z',
    starts_at: '2026-09-20T13:00:00.000Z',
    ends_at: '2026-09-20T18:30:00.000Z',
  };
  assert.equal(dueAt({ deadline_anchor: 'created', deadline_offset_hours: 24 }, event), '2026-09-02T10:00:00.000Z');
  assert.equal(dueAt({ deadline_anchor: 'start', deadline_offset_hours: -336 }, event), '2026-09-06T13:00:00.000Z');
  assert.equal(dueAt({ deadline_anchor: 'end', deadline_offset_hours: 12 }, event), '2026-09-21T06:30:00.000Z');
});

test('без времени окончания «после события» считается от начала', () => {
  const event = { created_at: '2026-09-01T10:00:00.000Z', starts_at: '2026-09-20T13:00:00.000Z', ends_at: null };
  assert.equal(dueAt({ deadline_anchor: 'end', deadline_offset_hours: 12 }, event), '2026-09-21T01:00:00.000Z');
});
