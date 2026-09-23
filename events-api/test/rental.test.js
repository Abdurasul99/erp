'use strict';

// Занятость проката. Проверяется то, на чём прокат обычно ломается: сложение
// непересекающихся броней, невозвращённые вещи и даты на границе суток.

const test = require('node:test');
const assert = require('node:assert/strict');
const { peakOccupancy, availability, dayNumber, isValidDate, todayIso, isOverdue } = require('../src/rental');

const R = (date_from, date_to, qty, status = 'reserved') => ({ date_from, date_to, qty, status });
const TODAY = '2026-09-23';

test('непересекающиеся брони не складываются', () => {
  // Запас 5: брони 1–2 и 3–4 числа по 5 штук — конфликта нет.
  const res = [R('2026-10-01', '2026-10-02', 5), R('2026-10-03', '2026-10-04', 5)];
  const a = availability(5, res, '2026-10-01', '2026-10-04', TODAY);
  assert.equal(a.occupied, 5);
  assert.equal(a.free, 0);
});

test('пересекающиеся брони складываются в день пересечения', () => {
  const res = [R('2026-10-01', '2026-10-03', 3), R('2026-10-03', '2026-10-05', 4)];
  const p = peakOccupancy(res, '2026-10-01', '2026-10-05', TODAY);
  assert.equal(p.peak, 7);
  assert.equal(p.peak_day, '2026-10-03');
});

test('границы брони включительные с обеих сторон', () => {
  const res = [R('2026-10-05', '2026-10-05', 2)];
  assert.equal(peakOccupancy(res, '2026-10-05', '2026-10-05', TODAY).peak, 2);
  assert.equal(peakOccupancy(res, '2026-10-04', '2026-10-04', TODAY).peak, 0);
  assert.equal(peakOccupancy(res, '2026-10-06', '2026-10-06', TODAY).peak, 0);
});

test('возвращённые и отменённые брони вещь не занимают', () => {
  const res = [R('2026-10-01', '2026-10-02', 5, 'returned'), R('2026-10-01', '2026-10-02', 5, 'cancelled')];
  assert.equal(peakOccupancy(res, '2026-10-01', '2026-10-02', TODAY).peak, 0);
});

test('выданная и не возвращённая к сроку вещь занята и после срока', () => {
  // Выдана на 10–12 сентября, сегодня 23-е, не вернули: на октябрь её нет.
  const res = [R('2026-09-10', '2026-09-12', 3, 'issued')];
  assert.equal(peakOccupancy(res, '2026-10-15', '2026-10-15', TODAY).peak, 3);
  assert.equal(isOverdue(res[0], TODAY), true);
});

test('выданная вещь в пределах срока освобождается после срока', () => {
  const res = [R('2026-09-22', '2026-09-25', 3, 'issued')];
  assert.equal(isOverdue(res[0], TODAY), false);
  assert.equal(peakOccupancy(res, '2026-09-26', '2026-09-26', TODAY).peak, 0);
});

test('несуществующие даты отвергаются', () => {
  assert.equal(isValidDate('2026-02-31'), false, 'Date.UTC перенёс бы на март');
  assert.equal(isValidDate('2026-13-01'), false);
  assert.equal(isValidDate('2026-9-1'), false);
  assert.equal(isValidDate('2028-02-29'), true, 'високосный год');
  assert.equal(isValidDate('2026-02-29'), false);
});

test('обратный или слишком длинный диапазон — ошибка, а не тихий ноль', () => {
  assert.throws(() => peakOccupancy([], '2026-10-05', '2026-10-01', TODAY), /диапазон/i);
  assert.throws(() => peakOccupancy([], '2026-01-01', '2027-06-01', TODAY), /больше/);
});

test('дни считаются без сдвига часового пояса', () => {
  assert.equal(dayNumber('2026-10-02') - dayNumber('2026-10-01'), 1);
  assert.equal(dayNumber('2026-03-30') - dayNumber('2026-03-29'), 1, 'через переход на летнее время в Европе');
});

test('«сегодня» — по Ташкенту, а не по UTC', () => {
  // 20:30 UTC 23-го — в Ташкенте уже 01:30 24-го.
  assert.equal(todayIso(new Date('2026-09-23T20:30:00Z')), '2026-09-24');
  assert.equal(todayIso(new Date('2026-09-23T18:59:00Z')), '2026-09-23');
});
