'use strict';

const { HttpError } = require('./errors');
const { isValidDate } = require('./rental');

// Разбор полей тела запроса. Одни правила на весь сервис — чтобы «1 200 000»,
// «1 200 000,50» и пустая строка значили одно и то же в каждой ручке.
// Каждая функция возвращает undefined, если поле не передано вовсе: так PUT
// отличает «не трогать» от «очистить» (null).

const bad = (message) => new HttpError(400, message);

function text(value, { field, max = 500, required = false } = {}) {
  if (value === undefined) {
    if (required) throw bad(`Заполните поле «${field}»`);
    return undefined;
  }
  if (value === null) {
    if (required) throw bad(`Заполните поле «${field}»`);
    return null;
  }
  const s = String(value).trim();
  if (!s) {
    if (required) throw bad(`Заполните поле «${field}»`);
    return null;
  }
  if (s.length > max) throw bad(`Поле «${field}» длиннее ${max} символов`);
  return s;
}

// Число из формы: пробелы-разделители (в т.ч. неразрывные — их вставляет
// toLocaleString('ru-RU')), запятая как десятичный знак.
function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  const s = String(value).replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return Number.NaN;
  return Number(s);
}

function amount(value, { field, required = false, nullable = false, positive = false } = {}) {
  if (value === undefined) {
    if (required) throw bad(`Заполните поле «${field}»`);
    return undefined;
  }
  if (value === null || value === '') {
    if (required) throw bad(`Заполните поле «${field}»`);
    if (nullable) return null;
    throw bad(`Заполните поле «${field}»`);
  }
  const n = parseNumber(value);
  if (!Number.isFinite(n)) throw bad(`Поле «${field}» должно быть числом`);
  if (n < 0) throw bad(`Поле «${field}» не может быть отрицательным`);
  if (positive && n === 0) throw bad(`Поле «${field}» должно быть больше нуля`);
  if (n > 999999999999) throw bad(`Поле «${field}» слишком большое`);
  return Math.round(n * 100) / 100;
}

function id(value, { field, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw bad(`Не указано поле «${field}»`);
    return value === undefined ? undefined : null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw bad(`Поле «${field}» указано неверно`);
  return n;
}

function oneOf(value, allowed, { field, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw bad(`Выберите значение поля «${field}»`);
    return undefined;
  }
  if (!allowed.includes(value)) throw bad(`Недопустимое значение поля «${field}»`);
  return value;
}

function date(value, { field, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw bad(`Укажите дату «${field}»`);
    return value === undefined ? undefined : null;
  }
  if (!isValidDate(value)) throw bad(`Дата «${field}» должна быть в формате ГГГГ-ММ-ДД`);
  return value;
}

// Момент времени: полная ISO-строка, в т.ч. с часовым поясом. Строку без пояса
// («2026-09-30T18:00») трактуем как ташкентское время, а не как время сервера.
function moment(value, { field, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw bad(`Укажите дату и время «${field}»`);
    return value === undefined ? undefined : null;
  }
  let s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s += '+05:00';
  const t = Date.parse(s);
  if (!Number.isFinite(t)) throw bad(`Неверная дата и время «${field}»`);
  const d = new Date(t);
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) throw bad(`Дата «${field}» вне допустимого диапазона`);
  return d.toISOString();
}

module.exports = { text, amount, id, oneOf, date, moment, parseNumber };
