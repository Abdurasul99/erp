// Узбекская кириллица «Декора»: словарь собирается из латиницы (src/decor/cyrillic.js).
// Проверяем правила на трудных местах и весь словарь целиком: ни одной латинской буквы, кроме названий,
// подстановки {…} — те же, что в латинице, ключи — все.
import test from 'node:test';
import assert from 'node:assert/strict';
import { toCyrillic } from '../src/decor/cyrillic.js';
import { TEXTS } from '../src/decor/texts.js';
import { fday, fdm, ftoday, fsum, fmonth, LANGS } from '../src/decor/i18n.js';

test('правила: ў ғ ш ч, ъ, ё/йў, е/э, ц, заимствования', () => {
  const cases = [
    ['O‘zgartirish', 'Ўзгартириш'], ['yig‘ish', 'йиғиш'], ['shoshilinch', 'шошилинч'],
    ['Ta’sischi', 'Таъсисчи'], ['ma’lumotlar', 'маълумотлар'],
    ['yo‘q', 'йўқ'], ['yopildi', 'ёпилди'], ['yuklash', 'юклаш'], ['yangi', 'янги'],
    ['yetishmaydi', 'етишмайди'], ['ekran', 'экран'], ['kerak', 'керак'],
    ['inventarizatsiya', 'инвентаризация'], ['pozitsiya', 'позиция'], ['ketsa', 'кетса'],
    ['Kalkulyatorda', 'Калькуляторда'], ['obyektlardan', 'объектлардан'], ['funksiyasi', 'функцияси'],
    ['PMda', 'ПМда'], ['MB', 'МБ'], ['qabul', 'қабул'], ['Xato', 'Хато'], ['hisobot', 'ҳисобот'],
  ];
  for (const [latin, cyr] of cases) assert.equal(toCyrillic(latin), cyr, latin);
});

test('названия, номера заказов и подстановки остаются как есть', () => {
  assert.equal(toCyrillic('Dora Decor’ga kirish'), 'Dora Decor’га кириш');
  assert.equal(toCyrillic('Uni Wave administratori yoqadi'), 'Уни Wave администратори ёқади');
  assert.equal(toCyrillic('masalan, D-101 yoki mijoz ismi'), 'масалан, D-101 ёки мижоз исми');
  assert.equal(toCyrillic('«{name}» funksiyasi — {n} ta'), '«{name}» функцияси — {n} та');
  assert.equal(toCyrillic('1920 px gacha'), '1920 px гача');
});

test('словарь uzc — все ключи, без латиницы, те же подстановки', () => {
  assert.deepEqual(LANGS, ['ru', 'uz', 'uzc']);
  assert.deepEqual(Object.keys(TEXTS.uzc), Object.keys(TEXTS.uz));
  const names = /\{\w+\}|Dora Decor|Wave Intelligence|Wave|AI|ERP|px|D-\d+/g;
  const holes = (s) => [...String(s).matchAll(/\{\w+\}/g)].map(m => m[0]).sort();
  const latin = [], vars = [];
  for (const [k, v] of Object.entries(TEXTS.uzc)) {
    if (/[A-Za-z]/.test(v.replace(names, ''))) latin.push(`${k}: ${v}`);
    if (holes(v).join() !== holes(TEXTS.uz[k]).join()) vars.push(k);
  }
  assert.deepEqual(latin, [], 'латиница в кириллице');
  assert.deepEqual(vars, [], 'подстановки разошлись');
});

test('даты и суммы на кириллице — формат «число-месяц», как у латиницы', () => {
  assert.equal(fday('2026-10-25', 'uzc'), '25-окт, якш');
  assert.equal(fday('2026-10-25', 'uz'), '25-okt, yak');
  assert.equal(fdm('2026-09-01', 'uzc'), '1-сен');
  assert.equal(ftoday('2026-11-05', 'uzc'), 'пайшанба, 5-ноябр');
  assert.equal(fmonth('2026-09', 'uzc'), 'сентябр 2026');
  assert.equal(fsum(1450000, 'uzc'), fsum(1450000, 'ru').replace('сум', 'сўм')); // разряды — тем же пробелом, что у RU
  assert.match(fsum(1450000, 'uzc'), /^1\s450\s000 сўм$/);
});
