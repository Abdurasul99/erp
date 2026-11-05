// Узбекская латиница → кириллица (пара алфавитов 1995 г.). Из латинских текстов (texts.js, uz) собирается
// словарь кириллицы — переводить каждую строку второй раз не нужно, и кириллица не отстаёт от латиницы.
// Латиница теряет часть сведений о русских заимствованиях (ь, ц, ъ, ё/йо) — их возвращают основы STEMS.
// Не трогаются: подстановки {name}, названия (Dora Decor, Wave, AI, ERP), числа и знаки.

// Основа слова → кириллица; остаток слова (окончание) переводится по правилам: «kalkulyatorda» → «калькуляторда».
const STEMS = [
  ['kalkulya', 'калькуля'], ['kompyuter', 'компьютер'], ['obyekt', 'объект'], ['subyekt', 'субъект'],
  ['funksiya', 'функция'], ['aksiya', 'акция'], ['seksiya', 'секция'], ['stansiya', 'станция'],
  ['sentabr', 'сентябр'], ['oktabr', 'октябр'], ['rayon', 'район'], ['mayonez', 'майонез'],
  ['film', 'фильм'], ['filtr', 'фильтр'], ['albom', 'альбом'], ['oktyabr', 'октябр'],
];
// номера заказов (D-101) и px — как в латинице
const KEEP = /\{\w+\}|\b(?:Dora Decor|Wave Intelligence|Wave|AI|ERP|px)\b|\bD-\d+/g;
const VOWELS = 'aeiouAEIOUўЎ';
const OKINA = /[‘ʻ`]/; // o‘ g‘
const TUTUQ = /[’ʼ']/; // ma’lumot → маълумот

const ONE = {
  a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о',
  p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', c: 'ц', w: 'в',
};
const up = (cyr, latin) => (latin === latin.toUpperCase() && latin !== latin.toLowerCase() ? cyr.toUpperCase() : cyr);

// Одно слово (буквы и знаки ‘ ’ внутри). Регистр — по первой латинской букве каждого звука.
function word(w) {
  const low = w.toLowerCase();
  for (const [stem, cyr] of STEMS) {
    if (low.startsWith(stem)) {
      const head = w[0] === w[0].toUpperCase() ? cyr[0].toUpperCase() + cyr.slice(1) : cyr;
      return head + rest(w.slice(stem.length), true);
    }
  }
  return rest(w, false);
}

function rest(w, afterStem) {
  let out = '';
  for (let i = 0; i < w.length; i++) {
    const ch = w[i], lo = ch.toLowerCase(), next = (w[i + 1] || '').toLowerCase();
    const start = i === 0 && !afterStem;
    const prev = i > 0 ? w[i - 1] : (afterStem ? 'x' : '');
    if ((lo === 'o' || lo === 'g') && OKINA.test(w[i + 1] || '')) { out += up(lo === 'o' ? 'ў' : 'ғ', ch); i++; continue; }
    if (TUTUQ.test(ch)) { out += i > 0 && i < w.length - 1 ? 'ъ' : ch; continue; }
    if (lo === 's' && next === 'h') { out += up('ш', ch); i++; continue; }
    if (lo === 'c' && next === 'h') { out += up('ч', ch); i++; continue; }
    // ц: в начале слова и в -tsiya/-tsion/-tsent (inventarizatsiya, tsex); «ketsa» остаётся «кетса»
    if (lo === 't' && next === 's' && (start || /^s(iy|io|ent|ex|ikl)/i.test(w.slice(i + 1)))) { out += up('ц', ch); i++; continue; }
    if (lo === 'y' && 'aoue'.includes(next) && next && !(next === 'o' && OKINA.test(w[i + 2] || ''))) {
      out += up({ a: 'я', o: 'ё', u: 'ю', e: 'е' }[next], ch); i++; continue;
    }
    if (lo === 'e') { out += up(start || (prev && VOWELS.includes(prev)) ? 'э' : 'е', ch); continue; }
    out += ONE[lo] ? up(ONE[lo], ch) : ch;
  }
  return out;
}

function plain(s) {
  return s.replace(/[A-Za-z][A-Za-z‘’ʻʼ`']*/g, (w) => {
    // ’ на конце слова — кавычка или апостроф перед названием, не буква
    const tail = w.match(/[’ʼ']+$/)?.[0] || '';
    return word(w.slice(0, w.length - tail.length)) + tail;
  });
}

export function toCyrillic(s) {
  if (typeof s !== 'string' || !s) return s;
  let out = '', last = 0;
  for (const m of s.matchAll(KEEP)) {
    out += plain(s.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
    // «Dora Decor’ga» → «Dora Decor’га»: апостроф после названия остаётся, окончание — кириллицей
    const suffix = s.slice(last).match(/^[’ʼ'][a-z]+/);
    if (suffix) { out += suffix[0][0] + plain(suffix[0].slice(1)); last += suffix[0].length; }
  }
  return out + plain(s.slice(last));
}
