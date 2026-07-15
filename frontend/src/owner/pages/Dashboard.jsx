import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { AuthContext } from '../../App.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { DASH_WIDGETS, DASH_DEFAULT } from '../modules.js';
import { Tile, Card, Badge, AreaChart, BarChart, Sparkline, Progress, PageHeader, Pills, Skeleton, EmptyState, fmtMoney, fmtNum, fmtMoneyFull, fmtSum, todayLabel, shade } from '../ui.jsx';
import { RichText } from '../AiChartBlock.jsx';
import { Modal, toast } from '../Modal.jsx';
import { useTt, fmtDate } from '../tt.js';

// Дельта к прошлому периоду. Если прошлый период пуст (0) — процент роста
// не имеет смысла («▲100% от нуля» вводит в заблуждение) → возвращаем null,
// и UI показывает «нет данных за прошлый период».
function deltaPct(current, prev) {
  if (prev == null) return null;
  if (prev === 0) return current === 0 ? 0 : null;
  return Math.round(((current - prev) / Math.abs(prev)) * 100);
}

// Человекочитаемый показ дельты. При «низкой базе» (прошлый период почти ноль)
// процент раздувается до тысяч — это косяк. Вместо «▲ 10692%» показываем кратность
// «▲ ×108» (рост в 108 раз). Стрелка включена в результат; null → ничего.
function deltaDisplay(pct) {
  if (pct == null) return null;
  if (pct >= 1000) return `▲ ×${Math.round(1 + pct / 100)}`;   // огромный рост → «в N раз»
  if (pct <= -1000) return '▼ 999+%';
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%`;
}

// Русские названия ролей для списков сотрудников
const ROLE_RU = {
  seller: 'продавец', cashier: 'кассир', warehouse: 'складовщик',
  manager: 'менеджер', director: 'ген. директор', founder: 'учредитель', admin: 'админ',
};

// Метки для разбивки по способу оплаты.
// Все суммы хранятся в UZS-эквиваленте (конвертация по курсу при продаже),
// поэтому подпись валюты везде UZS — метка «Доллар» означает способ оплаты, не валюту суммы.
const METHOD_LABELS = [
  { key: 'cash_uzs', label: 'Сум',         icon: '💵', curr: 'UZS' },
  { key: 'cash_usd', label: 'Доллар',      icon: '💲', curr: 'UZS' },
  { key: 'card',     label: 'На карту',    icon: '💳', curr: 'UZS' },
  { key: 'transfer', label: 'На счёт',     icon: '🏦', curr: 'UZS' },
];

// Компактная разбивка по способам оплаты — 4 строки внизу плитки
// unit: 'money' (по умолчанию, показывает «4 150 000 UZS») | 'count' (показывает «12 шт»)
function MethodBreakdown({ data, lightOnDark = false, unit = 'money', usdOrig = 0 }) {
  const { tt } = useTt();
  if (!data) return null;
  const labelColor = lightOnDark ? 'rgba(255,255,255,.7)' : 'var(--text3)';
  const valueColor = lightOnDark ? 'rgba(255,255,255,.92)' : 'var(--text)';
  const dividerColor = 'var(--border)';
  return (
    <div style={{
      marginTop: 10, paddingTop: 8,
      borderTop: `1px solid ${dividerColor}`,
      display: 'grid', gridTemplateColumns: '1fr', gap: 2,
    }}>
      {METHOD_LABELS.map(m => {
        const v = parseFloat(data[m.key]) || 0;
        const isCount = unit === 'count';
        return (
          <div key={m.key} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 10.5,
            opacity: v > 0 ? 1 : 0.55,
          }}>
            <span style={{ color: labelColor, fontWeight: 700 }}>{tt(m.label)}</span>
            <span style={{ color: valueColor, fontWeight: 700 }}>
              {/* Долларовая касса показывается двухвалютно: сначала исходные $,
                  затем UZS-эквивалент по курсу сделки — «4 $ · 44 000 UZS». */}
              {!isCount && m.key === 'cash_usd' && usdOrig > 0 ? (
                <>
                  {fmtNum(usdOrig)} <span style={{ opacity: .6, fontSize: 9 }}>$</span>
                  <span style={{ opacity: .5, margin: '0 4px' }}>·</span>
                  {fmtMoneyFull(v)} <span style={{ opacity: .6, fontSize: 9 }}>{m.curr}</span>
                </>
              ) : (
                <>{isCount ? fmtNum(v) : fmtMoneyFull(v)} <span style={{ opacity: .6, fontSize: 9 }}>{isCount ? tt('шт') : m.curr}</span></>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Округление вверх до «красивого» числа для шкалы оси (1/2/5 × 10^k).
function niceCeil(x) {
  if (x <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * p;
}

// Диаграмма СОСТОЯНИЯ БИЗНЕСА. Линия окрашена по направлению: ЗЕЛЁНАЯ где рост,
// КРАСНАЯ где спад (только красный/зелёный). Учредитель видит суммы (ось Y + тултип)
// и тонкую линию прибыли. Менеджер видит ТОЛЬКО состояние — без сумм: ось скрыта,
// тултип показывает только ±% к предыдущему дню.
function BusinessStateChart({ data, lang, isOwner, gran }) {
  const { tt } = useTt();
  const [hover, setHover] = useState(null);
  if (!data || data.length < 2) return null;
  const n = data.length;
  // Учредитель: реальные суммы. Менеджер: бэкенд прислал только idx (форма без сумм).
  const rev = data.map(d => isOwner ? (d.revenue || 0) : (d.idx || 0));
  const prof = isOwner ? data.map(d => d.profit || 0) : [];
  const yMax = niceCeil(Math.max(...rev, 1));
  const yMin = (isOwner && Math.min(0, ...prof) < 0) ? -niceCeil(-Math.min(...prof)) : 0;
  const W = 1000, H = 200, TOP = 10, BOT = H - 4;
  const xAt = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const yAt = (v) => TOP + (1 - ((v || 0) - yMin) / (yMax - yMin)) * (BOT - TOP);
  const GREEN = '#16A34A', RED = '#DC2626';
  const seg = (a, b) => (b >= a ? GREEN : RED);
  const grid = [0, 1, 2, 3, 4].map(k => yMin + ((yMax - yMin) * k) / 4);
  const left = hover != null ? (xAt(hover) / W) * 100 : 0;
  const pctChg = (hover != null && hover > 0 && rev[hover - 1] > 0) ? Math.round(((rev[hover] - rev[hover - 1]) / rev[hover - 1]) * 100) : null;
  // Подписи дат: показываем КАЖДУЮ; если точек слишком много — прорежаем до ~31.
  const labelStep = Math.max(1, Math.ceil(n / 31));
  // Подпись точки по гранулярности: час → «14:00», день → «16.06», месяц → «июн».
  const hh = (d) => String(d.getHours()).padStart(2, '0') + ':00';
  const bucketLabel = (iso) => {
    const d = new Date(iso);
    if (gran === 'hour') return hh(d);
    if (gran === 'month') return fmtDate(iso, { month: 'short' }, lang);
    return d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0');
  };
  // Дата в подсказке: час → «16 июн, 14:00», день → «16 июн», месяц → «июнь 2026».
  const tipDate = (iso) => {
    if (gran === 'hour') return fmtDate(iso, { day: 'numeric', month: 'short' }, lang) + ', ' + hh(new Date(iso));
    if (gran === 'month') return fmtDate(iso, { month: 'long', year: 'numeric' }, lang);
    return fmtDate(iso, { day: 'numeric', month: 'short' }, lang);
  };
  const prevWord = gran === 'hour' ? tt('к прошлому часу') : gran === 'month' ? tt('к прошлому месяцу') : tt('к прошлому дню');

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, fontWeight: 700, color: 'var(--text2)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 3, borderRadius: 2, background: GREEN }} /> {tt('Рост')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 3, borderRadius: 2, background: RED }} /> {tt('Спад')}</span>
        {isOwner && <span style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: .7 }}><span style={{ width: 16, height: 0, borderTop: '2px dashed var(--text3)' }} /> {tt('Валовая прибыль')} <span style={{ opacity: .6 }}>({tt('пунктир')})</span></span>}
      </div>
      <div style={{ position: 'relative', paddingLeft: isOwner ? 54 : 8, paddingRight: 4 }}>
        {isOwner && grid.map((v, k) => (
          <div key={k} style={{ position: 'absolute', left: 0, width: 48, textAlign: 'right', top: `${(yAt(v) / H) * 100}%`, transform: 'translateY(-50%)', fontSize: 9.5, color: 'var(--text3)', pointerEvents: 'none' }}>{fmtMoney(v)}</div>
        ))}
        <div style={{ position: 'relative', height: H, cursor: 'crosshair' }}
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const rel = (e.clientX - r.left) / r.width; setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))))); }}
          onMouseLeave={() => setHover(null)}>
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
            {grid.map((v, k) => (
              <line key={k} x1="0" y1={yAt(v)} x2={W} y2={yAt(v)} stroke="rgba(0,0,0,.07)" strokeWidth="1" strokeDasharray={v === 0 ? '0' : '4 4'} vectorEffect="non-scaling-stroke" />
            ))}
            {isOwner && prof.slice(0, -1).map((v, i) => (
              <line key={'p' + i} x1={xAt(i)} y1={yAt(v)} x2={xAt(i + 1)} y2={yAt(prof[i + 1])} stroke={seg(v, prof[i + 1])} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" opacity="0.55" />
            ))}
            {rev.slice(0, -1).map((v, i) => (
              <line key={'r' + i} x1={xAt(i)} y1={yAt(v)} x2={xAt(i + 1)} y2={yAt(rev[i + 1])} stroke={seg(v, rev[i + 1])} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            ))}
            {hover != null && <line x1={xAt(hover)} y1={TOP} x2={xAt(hover)} y2={BOT} stroke="rgba(0,0,0,.2)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
          </svg>
          {hover != null && (
            <div style={{ position: 'absolute', left: `${left}%`, top: 0, transform: `translateX(${left > 70 ? '-100%' : left < 30 ? '0' : '-50%'})`, background: '#14284B', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,.25)', pointerEvents: 'none', zIndex: 2 }}>
              {isOwner ? (
                <>
                  <div>{tt('Выручка')}: {fmtMoneyFull(rev[hover])}</div>
                  <div style={{ opacity: .82 }}>{tt('Прибыль')}: {fmtMoneyFull(prof[hover])}</div>
                </>
              ) : (
                <div style={{ color: pctChg == null ? '#fff' : pctChg >= 0 ? '#4ade80' : '#f87171' }}>
                  {pctChg == null
                    ? tt('Нет сравнения')
                    : `${pctChg >= 0 ? '▲ ' : '▼ '}${tt(pctChg >= 0 ? 'Рост' : 'Спад')} ${pctChg >= 1000 ? '×' + Math.round(1 + pctChg / 100) : Math.abs(pctChg) + '%'} ${prevWord}`}
                </div>
              )}
              <div style={{ fontSize: 9, opacity: .65, fontWeight: 700, marginTop: 1 }}>{tipDate(data[hover].date)}</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', marginTop: 6, fontSize: 8.5, fontWeight: 700, color: 'var(--text3)' }}>
          {data.map((d, i) => (
            <div key={i} style={{ flex: 1, minWidth: 0, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {i % labelStep === 0 ? bucketLabel(d.date) : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// «Спросить у AI» про состояние бизнеса — ТОЛЬКО владелец (у менеджера AI нет).
// Шлёт реальный тренд выручки/прибыли + вопрос, показывает ответ.
function StateAsk({ trend, bizState, lang }) {
  const { tt } = useTt();
  const [q, setQ] = useState('');
  const [ans, setAns] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ask = async (question) => {
    if (busy) return;
    const text = (question || q).trim();
    if (!text) return;
    setBusy(true); setErr(''); setAns('');
    try {
      const r = await api.post('/ai/explain-state', { question: text, trend, biz_state: bizState, lang });
      setAns(r.data?.answer || tt('Пустой ответ от AI.'));
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    setBusy(false);
  };
  const presets = [tt('Почему упала выручка?'), tt('Что с прибылью?'), tt('Что сделать, чтобы росло?')];
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 8 }}>{tt('Спросить про график')}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {presets.map((p, i) => (
          <button key={i} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setQ(p); ask(p); }}>{p}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder={tt('Спросите про состояние бизнеса…')} disabled={busy}
          onKeyDown={e => { if (e.key === 'Enter' && !busy) ask(); }} style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" disabled={busy || !q.trim()} onClick={() => ask()}>{busy ? '…' : tt('Спросить')}</button>
      </div>
      {err && <div style={{ marginTop: 8, color: 'var(--red)', fontWeight: 600, fontSize: 12 }}>{err}</div>}
      {ans && (
        <div style={{ marginTop: 10, background: 'var(--bg-2)', borderRadius: 10, padding: '12px 14px', fontFamily: "'Inter', 'Nunito', system-ui, sans-serif", fontSize: 14, lineHeight: 1.7 }}>
          <RichText text={ans.replace(/\[\[CHART:[a-z_]+\]\]/gi, '').trim()} />
        </div>
      )}
    </div>
  );
}

// Мини-баланс: горизонтальная полоса Активы = 100%, зелёный = Капитал, красный = Обязательства.
// Учредитель видит суммы + разбивку; менеджер — только проценты (сервер прислал ratio без сумм).
function BizStateBar({ bs, isOwner, onEdit }) {
  const { tt } = useTt();
  if (!bs) return null;
  const GREEN = '#16A34A', RED = '#DC2626';
  // Нет данных для баланса — не показываем вводящий в заблуждение «Капитал 100%».
  const hasData = isOwner ? ((bs.assets || 0) > 0 || (bs.liabilities || 0) > 0)
    : ((bs.equity_ratio || 0) !== 0 || (bs.liability_ratio || 0) !== 0);
  if (!hasData) {
    return (
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', fontSize: 13 }}>
        <span>{tt('Нет данных для баланса')}</span>
        {isOwner && onEdit && <button className="btn btn-ghost btn-sm" onClick={onEdit}>✏️ {tt('Заполнить')}</button>}
      </div>
    );
  }
  const assets = isOwner ? (bs.assets || 0) : null;
  const eqR = isOwner ? (assets > 0 ? bs.equity / assets : (bs.equity >= 0 ? 1 : 0)) : (bs.equity_ratio || 0);
  const liR = isOwner ? (assets > 0 ? bs.liabilities / assets : (bs.equity >= 0 ? 0 : 1)) : (bs.liability_ratio || 0);
  let gPct = Math.max(0, eqR * 100), rPct = Math.max(0, liR * 100);
  if (gPct + rPct > 100) { const s = gPct + rPct; gPct = gPct / s * 100; rPct = rPct / s * 100; }
  const negEquity = (isOwner ? bs.equity : eqR) < 0;
  const b = bs.breakdown || {};
  return (
    <div style={{ marginBottom: 16 }}>
      {isOwner && (
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 10, alignItems: 'flex-end' }}>
          <div><div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{tt('Всего активов')}</div><div style={{ fontSize: 18, fontWeight: 600 }}>{fmtMoneyFull(bs.assets)} <span style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('сум')}</span></div></div>
          <div><div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{tt('Всего обязательств')}</div><div style={{ fontSize: 18, fontWeight: 600, color: RED }}>{fmtMoneyFull(bs.liabilities)} <span style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('сум')}</span></div></div>
          <div><div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{tt('Собственный капитал')}</div><div style={{ fontSize: 18, fontWeight: 600, color: negEquity ? RED : GREEN }}>{fmtMoneyFull(bs.equity)} <span style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('сум')}</span></div></div>
          {onEdit && <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={onEdit}>✏️ {tt('Заполнить')}</button>}
        </div>
      )}
      <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-2)' }}>
        {gPct > 0 && <div title={tt('Собственный капитал')} style={{ width: `${gPct}%`, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden' }}>{gPct > 16 ? `${tt('Капитал')} ${Math.round(gPct)}%` : ''}</div>}
        {rPct > 0 && <div title={tt('Обязательства')} style={{ width: `${rPct}%`, background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden' }}>{rPct > 16 ? `${tt('Обязательства')} ${Math.round(rPct)}%` : ''}</div>}
      </div>
      {!isOwner && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, fontWeight: 800 }}>
          <span style={{ color: GREEN }}>{tt('Капитал')} {Math.round(gPct)}%</span>
          <span style={{ color: RED }}>{tt('Обязательства')} {Math.round(rPct)}%</span>
        </div>
      )}
      {isOwner && bs.breakdown && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><b style={{ color: GREEN }}>{tt('Активы')}:</b> {fmtMoney(b.cash)} · {fmtMoney(b.inventory)} · {fmtMoney(b.receivables)} · {fmtMoney(b.fixed_assets)}</span>
          <span><b style={{ color: RED }}>{tt('Обязательства')}:</b> {fmtMoney(b.payables)} · {fmtMoney(b.loans)} · {fmtMoney(b.tax_payable)} · {fmtMoney(b.wages_payable)}</span>
        </div>
      )}
    </div>
  );
}

const FIN_TABS = [
  { key: 'fixed-assets', label: 'Основные средства', amount: 'acquisition_cost', title: 'name', fields: [
    { name: 'category', label: 'Категория', type: 'select', options: [['equipment', 'Оборудование'], ['vehicle', 'Транспорт'], ['real_estate', 'Недвижимость']] },
    { name: 'name', label: 'Название', type: 'text' },
    { name: 'acquisition_cost', label: 'Стоимость (сум)', type: 'number' },
  ] },
  { key: 'loans', label: 'Кредиты', amount: 'remaining_balance', title: 'lender', fields: [
    { name: 'lender', label: 'Кредитор', type: 'text' },
    { name: 'remaining_balance', label: 'Остаток долга (сум)', type: 'number' },
  ] },
  { key: 'tax-obligations', label: '📋 Налоги', amount: 'amount_accrued', title: 'kind', fields: [
    { name: 'kind', label: 'Вид налога', type: 'text' },
    { name: 'amount_accrued', label: 'Начислено (сум)', type: 'number' },
    { name: 'amount_paid', label: 'Оплачено (сум)', type: 'number' },
  ] },
  { key: 'payroll-liab', label: '💼 Зарплаты', amount: 'gross_accrued', title: 'employee_name', fields: [
    { name: 'employee_name', label: 'Сотрудник', type: 'text' },
    { name: 'gross_accrued', label: 'Начислено (сум)', type: 'number' },
    { name: 'amount_paid', label: 'Выплачено (сум)', type: 'number' },
  ] },
];

// Ручной ввод активов/обязательств (основные средства, кредиты, налоги, зарплаты).
function FinManualEditor({ open, onClose, onChanged }) {
  const { tt } = useTt();
  const [tab, setTab] = useState(FIN_TABS[0].key);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const cfg = FIN_TABS.find(t => t.key === tab);
  const load = async (key) => { try { const r = await api.get('/finance/' + key); setRows(r.data?.rows || []); } catch { setRows([]); } };
  useEffect(() => { if (open) { setRows([]); setForm({}); load(tab); } }, [tab, open]);
  const add = async () => {
    setBusy(true);
    try { await api.post('/finance/' + tab, form); setForm({}); await load(tab); onChanged && onChanged(); toast(tt('Добавлено')); }
    catch (e) { toast(e.response?.data?.error || e.message, 'error'); }
    setBusy(false);
  };
  const del = async (id) => { try { await api.delete('/finance/' + tab + '/' + id); await load(tab); onChanged && onChanged(); } catch (e) { toast(e.response?.data?.error || e.message, 'error'); } };
  return (
    <Modal open={open} onClose={onClose} icon="🧮" title={tt('Активы и обязательства')} width={620}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {FIN_TABS.map(t => (
          <button key={t.key} className="btn btn-sm" onClick={() => setTab(t.key)}
            style={{ background: tab === t.key ? 'var(--primary)' : 'var(--bg-2)', color: tab === t.key ? '#fff' : 'var(--text2)', border: 'none', fontWeight: 700 }}>{tt(t.label)}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        {cfg.fields.map(f => (
          <div key={f.name} style={{ flex: f.type === 'number' ? '1 1 130px' : '1 1 120px' }}>
            <label className="label">{tt(f.label)}</label>
            {f.type === 'select'
              ? <select className="input" value={form[f.name] || f.options[0][0]} onChange={e => setForm({ ...form, [f.name]: e.target.value })}>{f.options.map(o => <option key={o[0]} value={o[0]}>{tt(o[1])}</option>)}</select>
              : <input className="input" type={f.type === 'number' ? 'number' : 'text'} value={form[f.name] || ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })} />}
          </div>
        ))}
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={add}>{busy ? '…' : tt('Добавить')}</button>
      </div>
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {rows.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>{tt('Пока пусто — добавьте записи выше')}</div> :
          rows.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}><b>{r[cfg.title] || '—'}</b> <span style={{ color: 'var(--text3)', fontSize: 12 }}>{cfg.fields.filter(f => f.type === 'select').map(f => tt(((f.options.find(o => o[0] === r[f.name])) || [])[1] || '')).join(' ')}</span></div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                <span className="mono" style={{ fontWeight: 700 }}>{fmtMoneyFull(r[cfg.amount])} {tt('сум')}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => del(r.id)} title={tt('Удалить')} style={{ color: 'var(--red)' }}>🗑</button>
              </div>
            </div>
          ))}
      </div>
    </Modal>
  );
}

// Шапка карты графика — вынесена в module scope, чтобы НЕ пересоздаваться
// на каждый рендер Dashboard (иначе React ремонтирует DOM шапки каждый раз).
function ChartHead({ icon, iconBg, iconColor, label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, minHeight: 44 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

// Масштаб графика продаж (как в банковских приложениях): бар = день/неделя/месяц/год
const CHART_GRAN_OPTIONS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

// Денежный поток — 4 кликабельных таба метрик. Клик переключает дневной график ниже.
// valueKey — поле из totals для верхней цифры; barColor — цвет дневного бара.
const CASHFLOW_TABS = [
  { key: 'income',  label: 'Приход',          valueKey: 'cash_income',  sign: '+', color: 'var(--green)', sub: 'сум · в кассу',  periodTag: true,  barColor: '#16A34A' },
  { key: 'expense', label: 'Расход',          valueKey: 'cash_expense', sign: '−', color: 'var(--red)',   sub: 'сум · из кассы', periodTag: true,  barColor: '#DC2626' },
  { key: 'profit',  label: 'Валовая прибыль', valueKey: 'gross_profit', sign: '',  color: null,           sub: 'сум · продажи − себестоимость', periodTag: false, barColor: '#1D4ED8' },
  { key: 'stock',   label: 'Склад',           valueKey: 'stock_value',  sign: '',  color: 'var(--text)',  sub: 'сум · стоимость остатков',      periodTag: false, nowTag: true, barColor: '#0EA5E9' },
];

// BHI — подписи пилляров/блоков и цвета зон (для карточки на дашборде).
const BHI_ZONE = {
  normal:    { color: '#16A34A', tone: 'green',  label: 'Норма' },
  attention: { color: '#D97706', tone: 'yellow', label: 'Внимание' },
  critical:  { color: '#DC2626', tone: 'red',    label: 'Критично' },
};
const BHI_PILLAR_LABEL = { fin: 'Финансы', ops: 'Операции', people: 'Персонал', market: 'Рынок' };
const BHI_BLOCK_LABEL = {
  fin_margin: 'Маржа', fin_cashflow: 'Денежный поток',
  ops_growth: 'Рост продаж', ops_inventory: 'Склад',
  people_productivity: 'Выручка / чел', people_activity: 'Активность',
  market_growth: 'Новые клиенты', market_retention: 'Удержание',
};
const bhiScoreColor = (s) => (s == null ? '#B8C2D4' : s >= 75 ? '#16A34A' : s >= 50 ? '#D97706' : '#DC2626');
const bhiZoneColor = (v) => (v >= 75 ? '#16A34A' : v >= 50 ? '#D97706' : '#DC2626');
const fmtBhiDay = (d, lang) => fmtDate(d, { day: 'numeric', month: 'short' }, lang);

// График «Динамика BHI по дням» по макету sage-pony: градиентная шкала зон,
// сетка, пунктир «Цель», линия по сегментам (цвет по зоне), цветные точки с подсказкой.
function BhiChart({ points, goal, tt, lang }) {
  // Адаптив: меряем реальную ширину контейнера и рисуем viewBox 1:1 в пикселях,
  // чтобы шрифты задавались в px (всегда чёткие, не «великанские» на мобиле).
  const wrapRef = useRef(null);
  const [cw, setCw] = useState(700);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const update = () => setCw(el.clientWidth || 700);
    update();
    let ro;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(update); ro.observe(el); }
    else window.addEventListener('resize', update);
    return () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', update); };
  }, []);

  const valid = points && points.length >= 1;
  const single = valid && points.length < 2;  // 1 день: рисуем рамку+точку, без линии
  const W = Math.max(260, Math.round(cw));
  const narrow = W < 460;
  const tiny = W < 340;
  // высота: достаточно высокий, чтобы не было пустоты; крупные шрифты
  const H = Math.round(narrow ? Math.min(W * 0.72, 250) : Math.min(W * 0.27, 250));
  const fAxis = tiny ? 9 : narrow ? 11 : 13;   // подписи оси Y
  const fGoal = tiny ? 10 : narrow ? 12 : 14;  // подпись «Цель/Maqsad»
  const fLbl = tiny ? 9 : narrow ? 10 : 12;    // подписи зон под градиентом
  const fDay = tiny ? 8 : narrow ? 9 : 11;     // подписи дней по оси X
  const padL = tiny ? 26 : narrow ? 30 : 40;
  const padR = narrow ? 14 : 20;
  const padT = narrow ? 12 : 16;
  const padB = narrow ? 26 : 32;               // место под подписи дней
  const rDot = tiny ? 3.5 : narrow ? 4.5 : 5.5;
  const wLine = narrow ? 2.6 : 3.2;

  const vals = valid ? points.map(p => p.bhi) : [40];
  const yMax = 100;
  // Низ шкалы — динамический: чтобы стабильно высокий BHI не липнул к верхней кромке,
  // но линия «Цель» и запас снизу всегда были видны. Для низкого BHI шкала опускается к 0.
  const dataMin = Math.min(...vals);
  const yMin = Math.max(0, Math.floor((Math.min(dataMin, goal) - 12) / 10) * 10);
  const n = valid ? points.length : 1;
  const X = (i) => n <= 1 ? padL + (W - padL - padR) / 2 : padL + (i / (n - 1)) * (W - padL - padR);
  const Y = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB);
  const grids = []; for (let g = yMin; g <= yMax; g += 10) grids.push(g);
  const gridStep = (H < 160 || (yMax - yMin) > 80) ? 20 : 10;
  const gridVals = grids.filter(g => g % gridStep === 0);
  const dayStep = Math.max(1, Math.round(n / (narrow ? 5 : 9)));
  // сглаженная кривая (Catmull-Rom → bezier) + заливка под ней
  const pts = valid ? points.map((p, i) => ({ x: X(i), y: Y(p.bhi) })) : [];
  const smoothD = (a) => {
    if (a.length < 2) return '';
    let d = `M ${a[0].x.toFixed(1)} ${a[0].y.toFixed(1)}`;
    for (let i = 0; i < a.length - 1; i++) {
      const p0 = a[i - 1] || a[i], p1 = a[i], p2 = a[i + 1], p3 = a[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };
  const lineD = smoothD(pts);
  const areaD = lineD ? `${lineD} L ${pts[pts.length - 1].x.toFixed(1)} ${(H - padB).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(H - padB).toFixed(1)} Z` : '';
  const tOff = Math.max(0, Math.min(1, (Y(goal) - padT) / (H - padB - padT)));
  const goalLabel = `${tt('Цель')} ${goal}`;
  const pillW = goalLabel.length * (fGoal * 0.62) + 14;

  return (
    <div ref={wrapRef}>
      {valid && (<>
        {/* заголовок + легенда (как в макете) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
          <div style={{ fontSize: narrow ? 12 : 13, fontWeight: 800, color: 'var(--text2)' }}>{tt('Динамика BHI по дням')}{single ? <span style={{ fontWeight: 700, color: 'var(--text3)' }}> · {tt('данные накапливаются')}</span> : null}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: '#1E5AE8', display: 'inline-block' }} />BHI</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, borderTop: '2px dashed #8590A2', display: 'inline-block' }} />{tt('Цель')}</span>
            {!narrow && <span style={{ fontWeight: 600 }}>· {tt('наведи на точку — детали дня')}</span>}
          </div>
        </div>
        {/* шкала зон: критично → опасно → норма */}
        <div style={{ height: 4, borderRadius: 3, background: 'var(--bg-2)', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '50%', top: -2, width: 1, height: 8, background: 'var(--border-strong)' }} />
          <div style={{ position: 'absolute', left: '75%', top: -2, width: 1, height: 8, background: 'var(--border-strong)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fLbl, color: 'var(--text3)', fontWeight: 700, margin: '4px 0 6px' }}>
          <span>0 · {tt('Критично')}</span><span>50 · {tt('Опасно')}</span><span>75 · {tt('Норма')}</span><span>100</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
          <defs>
            <linearGradient id="bhiLine" gradientUnits="userSpaceOnUse" x1="0" y1={padT} x2="0" y2={H - padB}>
              <stop offset={tOff} stopColor={'#1E5AE8'} /><stop offset={tOff} stopColor={'#D97706'} />
            </linearGradient>
            <linearGradient id="bhiArea" gradientUnits="userSpaceOnUse" x1="0" y1={padT} x2="0" y2={H - padB}>
              <stop offset={'0'} stopColor={'#1E5AE8'} stopOpacity={'0.14'} />
              <stop offset={tOff} stopColor={'#1E5AE8'} stopOpacity={'0.03'} />
              <stop offset={tOff} stopColor="#FBBF24" stopOpacity="0.02" />
              <stop offset="1" stopColor="#FBBF24" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {gridVals.map(g => (
            <g key={g}>
              <line x1={padL} y1={Y(g)} x2={W - padR} y2={Y(g)} stroke="rgba(20,40,75,.08)" strokeWidth="1" />
              <text x={padL - 6} y={Y(g) + fAxis * 0.35} textAnchor="end" fontSize={fAxis} fill="#9094B0">{g}</text>
            </g>
          ))}
          {/* заливка под кривой */}
          {areaD && <path d={areaD} fill="url(#bhiArea)" stroke="none" />}
          {/* цель — пунктир на всю ширину */}
          <line x1={padL} y1={Y(goal)} x2={W - padR} y2={Y(goal)} stroke={'#93A5C4'} strokeWidth={'1.4'} strokeDasharray={'7 5'} />
          {/* сглаженная линия BHI (зелёная выше цели, оранжевая ниже) */}
          {lineD && <path d={lineD} fill="none" stroke="url(#bhiLine)" strokeWidth={wLine} strokeLinecap="round" strokeLinejoin="round" />}
          {/* плашка «Цель 75» слева на пунктире */}
          <g>
            <rect x={padL} y={Y(goal) - (fGoal * 0.5 + 4)} width={pillW} height={fGoal + 8} rx={5} fill={'#E9F1FB'} stroke={'#B8C2D4'} strokeWidth={'0.8'} />
            <text x={padL + pillW / 2} y={Y(goal) + fGoal * 0.34} textAnchor="middle" fontSize={fGoal} fill="#15803d" fontWeight="800">{goalLabel}</text>
          </g>
          {/* точки */}
          {points.map((p, i) => (
            <circle key={i} cx={X(i)} cy={Y(p.bhi)} r={rDot} fill={p.bhi >= goal ? '#1E5AE8' : '#D97706'} stroke="#fff" strokeWidth={narrow ? 1.8 : 2.4} style={{ cursor: 'pointer' }}>
              <title>{(p.date ? fmtBhiDay(p.date, lang) + ': ' : '')}BHI {p.bhi}</title>
            </circle>
          ))}
          {/* подписи дней по оси X (прорежены) */}
          {points.map((p, i) => {
            if (i % dayStep !== 0 && i !== n - 1) return null;
            return <text key={'d' + i} x={X(i)} y={H - padB + fDay + 9} textAnchor="middle" fontSize={fDay} fill="#9094B0" fontWeight="600">{p.date ? fmtBhiDay(p.date, lang) : ''}</text>;
          })}
        </svg>
      </>)}
    </div>
  );
}

// Карточка BHI. Владелец (founder) видит балл + 4 пилляра + цель + тренд;
// директор (director) — дополнительно 8 блоков; менеджер — только балл и зону
// (без разбивки по пилляров). BHI — безденежный показатель здоровья компании.
function BhiCard({ role }) {
  const { tt, lang } = useTt();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    api.get('/bhi/monthly', { params: { month } })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(() => { if (!ignore) setData(null); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  if (loading) return <Card icon="🧭" title={tt('Индекс здоровья бизнеса')} style={{ marginBottom: 16 }}><Skeleton height={64} /></Card>;
  if (!data || data.current == null) return null;
  // Недостаточно данных — не показываем вводящий в заблуждение «0».
  if (!data.blocks_active) {
    return (
      <Card icon="🧭" title={tt('Индекс здоровья бизнеса')} style={{ marginBottom: 16 }}>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>{tt('Недостаточно данных — индекс появится после ≥7 дней работы.')}</div>
      </Card>
    );
  }

  const z = BHI_ZONE[data.zone] || BHI_ZONE.attention;
  const points = data.points || [];
  const yest = points.length >= 2 ? points[points.length - 2].bhi : null;
  const dayDelta = yest != null ? data.current - yest : null;
  const isManager = role === 'manager';
  // лучший/худший день + тренд месяца (из точек)
  const best = points.length ? points.reduce((a, p) => (p.bhi > a.bhi ? p : a), points[0]) : null;
  const worst = points.length ? points.reduce((a, p) => (p.bhi < a.bhi ? p : a), points[0]) : null;
  const monthTrend = data.month_trend != null ? data.month_trend : (points.length >= 2 ? data.current - points[0].bhi : null);
  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 13px' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: color || 'var(--text)', lineHeight: 1.1, marginTop: 3 }}>{value}</div>
      {sub != null && <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', marginTop: 1 }}>{sub}</div>}
    </div>
  );

  return (
    <Card icon="🧭" title={tt('Индекс здоровья бизнеса')}
      actions={<Badge tone={z.tone}>{tt(z.label)}</Badge>} style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <div className="mono" style={{ fontSize: 42, fontWeight: 600, color: z.color, lineHeight: 1 }}>{data.current}</div>
          <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 700 }}>/ 100</div>
        </div>
        <div style={{ minWidth: 150 }}>
          {dayDelta != null && (
            <div style={{ fontSize: 12, fontWeight: 800, color: dayDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {dayDelta >= 0 ? '▲' : '▼'} {Math.abs(dayDelta)} {tt('к вчера')}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginTop: 2 }}>{tt('Цель')}: {data.goal}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginTop: 2 }}>{data.blocks_active} {tt('активных блоков')}</div>
          {data.alert?.falling_streak >= 3 && (
            <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 800, marginTop: 4 }}>{tt('Падение')} {data.alert.falling_streak} {tt('дн. подряд')}</div>
          )}
        </div>
      </div>

      {/* предупреждение о падении (как в макете) */}
      {data.alert?.falling_streak >= 3 && (
        <div style={{ marginTop: 12, background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 700, color: 'var(--red)' }}>
          {tt('Индекс падает')} {data.alert.falling_streak} {tt('дня подряд — требуется внимание руководства')}
        </div>
      )}

      {/* 4 стат-карточки как в макете */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10, marginTop: 14 }}>
        <StatCard label={tt('BHI сегодня')} value={data.current} color={z.color}
          sub={dayDelta != null ? (dayDelta >= 0 ? '▲ +' : '▼ ') + Math.abs(dayDelta) + ' ' + tt('к вчера') : null} />
        <StatCard label={tt('Тренд месяца')} value={monthTrend == null ? '—' : (monthTrend >= 0 ? '+' : '') + monthTrend}
          color={monthTrend >= 0 ? 'var(--green)' : 'var(--red)'} sub={tt('vs начало месяца')} />
        {best && <StatCard label={tt('Лучший день')} value={best.date ? fmtBhiDay(best.date, lang) : '—'} sub={'BHI ' + best.bhi} color="var(--green)" />}
        {worst && <StatCard label={tt('Худший день')} value={worst.date ? fmtBhiDay(worst.date, lang) : '—'} sub={'BHI ' + worst.bhi} color="var(--red)" />}
      </div>

      {/* График динамики BHI по дням (виден с 1-го дня; линия появляется со 2-го) */}
      {points.length >= 1 && (
        <div style={{ marginTop: 16 }}>
          <BhiChart points={points} goal={data.goal} tt={tt} lang={lang} />
        </div>
      )}

      {/* Пилляры — владелец и директор; менеджер не видит разбивку */}
      {!isManager && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 16 }}>
          {['fin', 'ops', 'people', 'market'].map(pk => {
            const p = data.pillars?.[pk] || {};
            const s = p.score;
            return (
              <div key={pk} style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .4 }}>{tt(BHI_PILLAR_LABEL[pk])} · {p.weight}%</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: bhiScoreColor(s), marginTop: 2 }}>{s == null ? '—' : s}</div>
                <div style={{ marginTop: 4 }}><Progress value={s || 0} max={100} color={bhiScoreColor(s)} /></div>
              </div>
            );
          })}
        </div>
      )}

      {/* 8 блоков — только директор (director) */}
      {(role === 'founder' || role === 'director') && data.blocks && (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
          {Object.entries(data.blocks).map(([k, b]) => (
            <div key={k} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 9px', borderRadius: 7, background: b.active ? 'var(--bg-2)' : 'transparent', opacity: b.active ? 1 : .45 }}>
              <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{tt(BHI_BLOCK_LABEL[k] || k)}</span>
              <span className="mono" style={{ fontWeight: 800, color: bhiScoreColor(b.active ? b.score : null) }}>{b.active ? b.score : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// Виджеты Главной — пользователь сам выбирает, что показывать. Данные грузятся ОДИН раз,
// виджеты только показывают срез → добавление/убирание мгновенно, без лагов. Хранится в localStorage.
// Список виджетов и дефолт — общий с PanelManagerTool (см. modules.js: DASH_WIDGETS/DASH_DEFAULT).

export default function Dashboard() {
  const navigate = useNavigate();
  const { tt, lang } = useTt();
  const { user } = useContext(AuthContext);
  const { branchId, isOwner, role, branches: allBranches, periodFrom, periodTo, periodLabel } = useContext(BranchScope);
  // Виджеты, отключённые учредителем для всей компании (companies.disabled_widgets).
  const companyOffWidgets = useMemo(() => new Set(user?.company_disabled_widgets || []), [user]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // ЕДИНЫЙ масштаб для обоих графиков продаж (день/неделя/месяц/год).
  // Оба графика («Продажи» и «Сравнение») строятся из ОДНОГО ответа sales-chart
  // (buckets + prev_buckets), поэтому достаточно одного запроса на выбранный масштаб.
  const [chartGran, setChartGran] = useState('day');
  const [chartOffset, setChartOffset] = useState(0); // навигация окна графика стрелками (0=сейчас)
  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  // Денежный поток: активный таб метрики + дневной разрез выбранной метрики за месяц
  const [cfMetric, setCfMetric] = useState('income');
  const [cfDaily, setCfDaily] = useState(null);
  const [cfDailyLoading, setCfDailyLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0); // бамп после правки активов/обязательств
  // Кастомизация Главной: какие виджеты показывать (per-browser, мгновенно).
  const [widgets, setWidgets] = useState(() => {
    try {
      const s = localStorage.getItem('dash_widgets');
      if (s) {
        const set = new Set(JSON.parse(s));
        // Одноразовая миграция: вернуть «Топ товаров» и «Сравнение филиалов» тем, у кого сохранён
        // старый набор без них (один раз — будущие ручные удаления уважаются).
        if (!localStorage.getItem('dash_widgets_v3')) {
          set.add('top-products'); set.add('branch-compare');
          localStorage.setItem('dash_widgets', JSON.stringify([...set]));
          localStorage.setItem('dash_widgets_v3', '1');
        }
        return set;
      }
    } catch {}
    return new Set(DASH_DEFAULT);
  });
  const [showWidgets, setShowWidgets] = useState(false);
  // Виджет виден, если выбран пользователем И не отключён учредителем для компании.
  const W = (id) => widgets.has(id) && !companyOffWidgets.has(id);
  const toggleWidget = (id) => setWidgets(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id);
    try { localStorage.setItem('dash_widgets', JSON.stringify([...n])); } catch {}
    return n;
  });

  useEffect(() => {
    // ignore-флаг: при быстром переключении периода старый ответ не должен
    // перезаписать свежий (защита от out-of-order ответов).
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    if (periodFrom) params.from = periodFrom;
    if (periodTo) params.to = periodTo;
    if (branchId) params.branch_id = branchId;
    api.get('/company/dashboard', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [periodFrom, periodTo, branchId, reloadTick]);

  useEffect(() => {
    let ignore = false;
    setChartLoading(true);
    const params = { granularity: chartGran };
    if (chartOffset !== 0) {
      params.offset = chartOffset; // навигация окна стрелками — сдвиг относительно текущего
    } else {
      if (periodFrom) params.from = periodFrom;
      if (periodTo) params.to = periodTo;
    }
    if (branchId) params.branch_id = branchId;
    api.get('/company/sales-chart', { params })
      .then(r => { if (!ignore) setChartData(r.data); })
      .catch(() => { if (!ignore) setChartData(null); })
      .finally(() => { if (!ignore) setChartLoading(false); });
    return () => { ignore = true; };
  }, [chartGran, chartOffset, periodFrom, periodTo, branchId]);

  // Дневной разрез выбранной метрики «Денежного потока» (месяц = конец выбранного периода).
  useEffect(() => {
    let ignore = false;
    setCfDailyLoading(true);
    const params = { metric: cfMetric };
    const monthSrc = periodTo || new Date().toISOString();
    params.month = String(monthSrc).slice(0, 7);
    if (branchId) params.branch_id = branchId;
    api.get('/company/branch-daily', { params })
      .then(r => { if (!ignore) setCfDaily(r.data); })
      .catch(() => { if (!ignore) setCfDaily(null); })
      .finally(() => { if (!ignore) setCfDailyLoading(false); });
    return () => { ignore = true; };
  }, [cfMetric, periodTo, branchId, reloadTick]);

  const t = data?.totals || {};
  const prev = data?.prev_totals || {};
  const branches = data?.branches || [];
  const trend = data?.sales_trend || [];
  const prevTrend = data?.prev_trend || [];
  const topProducts = data?.top_products || [];
  const topSellers = data?.top_sellers || [];
  const alerts = data?.alerts || [];

  // breakdown[type] === { cash_uzs, cash_usd, card, transfer }
  // type: 'revenue' | 'cash_in' | 'cash_out' | 'deals' | 'avg_check'
  const byMethod = t.by_method || {};

  // Оба графика строятся из одного ответа sales-chart на выбранном масштабе:
  // «Продажи» — текущие buckets, «Сравнение» — текущие vs prev_buckets.
  const salesValues = useMemo(() => (chartData?.buckets || []).map(b => b.revenue), [chartData]);
  const salesLabels = useMemo(() => (chartData?.buckets || []).map(b => b.label), [chartData]);
  const salesTotal = chartData?.total || 0;

  const compareValues = salesValues;
  const comparePrevValues = useMemo(() => (chartData?.prev_buckets || []).map(b => b.revenue), [chartData]);
  const compareLabels = salesLabels;
  const compareTotal = salesTotal;
  const comparePrevTotal = chartData?.prev_total || 0;
  const compareDelta = deltaPct(compareTotal, comparePrevTotal);

  // Денежный поток — дневной разрез выбранной метрики
  const currentCfTab = CASHFLOW_TABS.find(x => x.key === cfMetric) || CASHFLOW_TABS[0];
  const cfDailyValues = useMemo(() => (cfDaily?.points || []).map(p => p.value), [cfDaily]);
  const cfDailyLabels = useMemo(() => (cfDaily?.points || []).map(p => p.label), [cfDaily]);
  const cfPeak = cfDailyValues.length ? Math.max(...cfDailyValues) : 0;
  const cfPeakIdx = cfPeak > 0 ? cfDailyValues.indexOf(cfPeak) : -1;
  const cfMonthLabel = cfDaily?.month ? fmtDate(cfDaily.month + '-01', { month: 'long', year: 'numeric' }, lang) : '';

  const revDelta = deltaPct(t.sales_revenue, prev.sales_revenue);
  const profitDelta = deltaPct(t.gross_profit, prev.gross_profit);
  const dealsDelta = deltaPct(t.deals_count, prev.deals_count);
  const checkDelta = deltaPct(t.avg_check, prev.avg_check);

  const scopeLabel = isOwner
    ? (branchId ? (allBranches.find(x => x.id === branchId)?.name || `${tt('Филиал')} #${branchId}`) : tt('Все филиалы'))
    : (role === 'manager' ? tt('Мой филиал') : '');

  // Single-branch summary — для cashflow-карточки (показывается всегда: для manager — его филиал, для founder/director — суммарно по всем)
  const branchSummary = (() => {
    if (!isOwner && branches.length === 1) {
      return {
        title: branches[0].branch_name,
        sub: `${branches[0].worker_count} ${tt('сотр · маржа ')}${branches[0].margin_pct}%`,
        icon: '🏭',
      };
    }
    if (isOwner && branches.length > 0) {
      const totalWorkers = branches.reduce((a, b) => a + (b.worker_count || 0), 0);
      const avgMargin = t.margin_pct || 0;
      return {
        title: branchId
          ? (allBranches.find(x => x.id === branchId)?.name || `${tt('Филиал')} #${branchId}`)
          : tt('Все филиалы'),
        sub: `${totalWorkers} ${tt('сотр · маржа ')}${avgMargin}%`,
        icon: '🏢',
      };
    }
    return null;
  })();

  return (
    <>
      <PageHeader
        title={tt('Главная панель')}
        sub={`${scopeLabel} · ${todayLabel(lang)}`}
        actions={<button className="btn btn-ghost btn-sm" onClick={() => setShowWidgets(true)}>🎛️ {tt('Виджеты')}</button>}
      />

      {error && (
        <Card icon="⚠️" title={tt('Ошибка загрузки')}>
          <div style={{ color: 'var(--red)' }}>{error}</div>
        </Card>
      )}

      {loading && !data ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, marginBottom: 16 }} className="dashboard-hero-row">
            <div className="card" style={{ minHeight: 280, padding: 28 }}>
              <Skeleton height={14} style={{ width: '40%', marginBottom: 16 }} />
              <Skeleton height={44} style={{ width: '70%', marginBottom: 12 }} />
              <Skeleton height={12} style={{ width: '50%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="card" style={{ padding: 16 }}>
                  <Skeleton height={12} style={{ width: '50%', marginBottom: 10 }} />
                  <Skeleton height={22} style={{ width: '70%' }} />
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 22, marginBottom: 16 }}>
            <Skeleton height={14} style={{ width: '30%', marginBottom: 16 }} />
            <Skeleton height={40} />
          </div>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="card" style={{ padding: 22 }}>
              <Skeleton height={14} style={{ width: '40%', marginBottom: 16 }} />
              <Skeleton height={140} />
            </div>
            <div className="card" style={{ padding: 22 }}>
              <Skeleton height={14} style={{ width: '40%', marginBottom: 16 }} />
              <Skeleton height={140} />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Hero — выручка + разбивка по способам оплаты. СКРЫТ ДЛЯ МЕНЕДЖЕРА:
              сводная выручка и состав кассы — только владельцу/ген.директору. */}
          {W('revenue-hero') && role !== 'manager' && (
          <div style={{
            background: 'var(--surface)',
            borderRadius: 18,
            padding: '22px 26px',
            color: 'var(--text)',
            boxShadow: 'var(--shadow)',
            border: '1px solid var(--border)',
            display: 'flex', gap: 28, flexWrap: 'wrap',
            marginBottom: 14,
          }}>
            {/* Левая колонка — дата, выручка, дельта */}
            <div style={{ flex: '1 1 280px', minWidth: 240, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, opacity: .85, textTransform: 'uppercase', letterSpacing: .8 }}>
                {todayLabel(lang)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: .7, marginTop: 4 }}>
                {tt('ВЫРУЧКА')} · {periodLabel}
              </div>
              <div className={'grad-num'} style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.05, marginTop: 4, letterSpacing: -0.8 }}>
                {fmtMoneyFull(t.sales_revenue)} <span style={{ fontSize: 14, color: 'var(--text3)' }}>{tt('сум')}</span>
              </div>
              {revDelta != null ? (
                <div style={{ fontSize: 11.5, fontWeight: 800, color: revDelta >= 0 ? 'var(--green, #16a34a)' : 'var(--red, #DC2626)' }}>
                  {deltaDisplay(revDelta)} {tt('к прошлому периоду')}
                </div>
              ) : (
                data?.prev_totals != null && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>
                    {tt('Прошлый период пуст — сравнение появится позже')}
                  </div>
                )
              )}
            </div>

            {/* Правая колонка — разбивка по способам оплаты */}
            <div style={{ flex: '1 1 240px', minWidth: 220, maxWidth: 400 }}>
              <MethodBreakdown data={byMethod.revenue} usdOrig={byMethod.revenue_usd_orig} />
            </div>
          </div>
          )}

          {/* BHI — индекс здоровья бизнеса (0-100). Роль определяет уровень детализации. */}
          {W('bhi') && <BhiCard role={role} />}

          {/* «Состояние бизнеса» (Рост/Спад + AI-разбор) убран — его не было в макетах дашборда. */}

          {/* Три плитки — отдельный ряд под хиро (равная высота между собой) */}
          {W('kpi-tiles') && (
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <CompactTile icon="🏦" label={tt('Касса (баланс)')} value={fmtMoneyFull(t.cash_balance)} sub={tt('сум') + ' · ' + tt('остаток на сейчас')}
              breakdown={byMethod.cash_in} usdOrig={byMethod.cash_in_usd_orig} color="#0EA5E9" />
            <CompactTile icon="📦" label={tt('Продаж')} value={fmtNum(t.deals_count)} sub={tt('за период')}
              breakdown={byMethod.deals} delta={dealsDelta} color="#1D4ED8" countMode="шт" />
            <CompactTile icon="🧾" label={tt('Средний чек')} value={fmtMoneyFull(t.avg_check)} sub={tt('сум')}
              breakdown={byMethod.avg_check} delta={checkDelta} color="#D97706" />
          </div>
          )}

          {/* Денежный поток — ВЫШЕ диаграмм. Слева — филиал/сводка, справа — приход/расход/прибыль/склад */}
          {W('cashflow') && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: branchSummary ? 'minmax(180px, 220px) 1fr' : '1fr', gap: 18, alignItems: 'center' }}>
              {branchSummary && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  paddingRight: 18, borderRight: '1px solid var(--border, #E3EAF3)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'var(--primary-50, rgba(29,78,216,.10))', color: 'var(--primary, #1D4ED8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  }}>{branchSummary.icon}</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5 }}>
                      {tt('Денежный поток')}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{branchSummary.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginTop: 2 }}>{branchSummary.sub}</div>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {/* Кликабельные табы метрик — переключают дневной график ниже.
                    Активный таб: подчёркивание 3px + точка. Менеджер скоупится своим
                    филиалом, поэтому «Валовая прибыль» у него — только его филиал. */}
                {CASHFLOW_TABS.map(tab => {
                  const active = cfMetric === tab.key;
                  const val = t[tab.valueKey];
                  const color = tab.color || ((t.gross_profit || 0) >= 0 ? 'var(--green)' : 'var(--red)');
                  return (
                    <div key={tab.key} role="button" tabIndex={0} aria-pressed={active}
                      onClick={() => setCfMetric(tab.key)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCfMetric(tab.key); } }}
                      style={{ cursor: 'pointer', paddingBottom: 7, borderBottom: `3px solid ${active ? 'var(--primary)' : 'transparent'}`, transition: 'border-color .15s' }}>
                      <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--primary)', opacity: active ? 1 : 0 }} />
                        {tt(tab.label)}{tab.periodTag ? ' · ' + periodLabel : tab.nowTag ? ' · ' + tt('сейчас') : ''}
                      </div>
                      <div className="mono" style={{ fontWeight: 800, color, fontSize: 18, marginTop: 4 }}>{tab.sign}{fmtMoneyFull(val)}</div>
                      {tab.key === 'profit' && profitDelta != null ? (
                        <div style={{ fontSize: 10, fontWeight: 800, color: profitDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {deltaDisplay(profitDelta)} {tt('к прошлому периоду')}
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{tt(tab.sub)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Дневной график выбранной метрики (пиковый день — тёмный бар) */}
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 10 }}>
                {tt(currentCfTab.label)} {tt('по дням')}{cfMonthLabel ? ' · ' + cfMonthLabel : ''}
              </div>
              {cfDailyLoading && !cfDaily ? <Skeleton height={150} /> : (
                cfDailyValues.some(v => v !== 0)
                  ? <BarChart data={cfDailyValues} labels={cfDailyLabels} height={150} maxLabels={8}
                      peakIdx={cfPeakIdx} peakColor={currentCfTab.barColor} normalColor={shade(currentCfTab.barColor, 32)} />
                  : <div style={{ color: 'var(--text3)', fontSize: 13, padding: '10px 0' }}>{tt('Нет данных за месяц')}</div>
              )}
            </div>
          </Card>
          )}

          {/* Динамика продаж — единый переключатель масштаба + две карты-близнеца.
              Один бар = день / неделя / месяц / год (как в банковских приложениях). */}
          {W('sales-chart') && (() => {
            const hasPrev = comparePrevValues.some(v => v > 0);
            const peak = salesValues.length ? Math.max(...salesValues) : 0;
            const peakIdx = salesValues.indexOf(peak);
            const peakLabel = peakIdx >= 0 ? (salesLabels[peakIdx] || '') : '';
            const granOpts = CHART_GRAN_OPTIONS.map(o => ({ ...o, label: tt(o.label) }));
            return (
              <>
                {/* Заголовок секции + ЕДИНЫЙ переключатель масштаба для ОБОИХ графиков */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)' }}>{tt('Динамика продаж')}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => setChartOffset(o => o - 1)} title={tt('Раньше')}
                        style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', fontWeight: 800, fontSize: 15, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                      <button onClick={() => setChartOffset(o => Math.min(0, o + 1))} disabled={chartOffset >= 0} title={tt('Позже')}
                        style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: chartOffset >= 0 ? 'default' : 'pointer', opacity: chartOffset >= 0 ? 0.4 : 1, fontWeight: 800, fontSize: 15, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                      {chartOffset < 0 && <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }} title={tt('Периодов назад')}>−{-chartOffset}</span>}
                    </div>
                  </div>
                  <Pills value={chartGran} onChange={g => { setChartGran(g); setChartOffset(0); }} options={granOpts} label={tt('Масштаб графика')} />
                </div>

                <div className="grid-2 dashboard-charts-row" style={{ marginBottom: 16, alignItems: 'stretch' }}>
                  {/* Карта 1 — Продажи (пиковый бар выделен тёмным) */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <ChartHead icon="📈" iconBg="rgba(37,99,235,.10)" iconColor="#1D4ED8"
                      label={tt('Продажи') + ' · ' + periodLabel}>
                      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', marginTop: 2, lineHeight: 1.1 }}>
                        {fmtMoneyFull(salesTotal)} <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{tt('сум')}</span>
                      </div>
                    </ChartHead>
                    {chartLoading && !chartData ? <Skeleton height={150} /> : (
                      <BarChart data={salesValues} labels={salesLabels} height={150} peakIdx={peakIdx} />
                    )}
                    {/* Футер для выравнивания высоты с правой картой */}
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)', minHeight: 18 }}>
                      {peak > 0 && <>{tt('Пик')}: <strong className="mono">{fmtMoneyFull(peak)} {tt('сум')}</strong> · {peakLabel}</>}
                    </div>
                  </div>

                  {/* Карта 2 — Сравнение */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <ChartHead icon="📊" iconBg="rgba(34,197,94,.10)" iconColor="#16a34a"
                      label={tt('Сравнение') + ' · ' + periodLabel}>
                      <div className="mono" style={{
                        fontSize: 22, fontWeight: 600, lineHeight: 1.1, marginTop: 2,
                        color: compareDelta == null ? 'var(--text3)' : compareDelta >= 0 ? 'var(--green, #16A34A)' : 'var(--red, #DC2626)',
                      }}>
                        {compareDelta != null
                          ? <>{deltaDisplay(compareDelta)}</>
                          : <span style={{ fontSize: 13, fontWeight: 700 }}>{tt('нет базы для сравнения')}</span>}
                      </div>
                    </ChartHead>
                    {chartLoading && !chartData ? <Skeleton height={150} /> : (
                      <BarChart data={compareValues} prevData={hasPrev ? comparePrevValues : undefined} labels={compareLabels}
                        color="#16A34A" prevColor="#C3C8D4" height={150} />
                    )}
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, flexWrap: 'wrap', minHeight: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: '#16A34A', borderRadius: 3 }} />
                        <span style={{ color: 'var(--text2)' }}>{tt('Текущий')}: <strong className="mono">{fmtMoneyFull(compareTotal)} {tt('сум')}</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: '#C3C8D4', borderRadius: 3 }} />
                        <span style={{ color: 'var(--text2)' }}>{tt('Предыдущие')}: <strong className="mono">{fmtMoneyFull(comparePrevTotal)} {tt('сум')}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {W('branch-compare') && isOwner && branches.length > 1 && (
            <Card icon="🏭" title={tt('Сравнение филиалов')}
              actions={<Badge tone="purple">{branches.length} {tt('филиалов')}</Badge>}
              style={{ marginBottom: 16 }}>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Филиал')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Выручка')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Прибыль')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Маржа')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сделок')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Касса')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Склад')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сотр.')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map(b => (
                      <tr key={b.branch_id}>
                        <td style={{ fontWeight: 700 }}>
                          {b.branch_name}{' '}
                          {b.margin_pct < 10 && b.sales_revenue > 0 && <Badge tone="red">{tt('маржа↓')}</Badge>}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(b.sales_revenue)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: b.gross_profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtMoneyFull(b.gross_profit)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{b.margin_pct}%</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(b.deals_count)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: b.cash_balance >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmtMoneyFull(b.cash_balance)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(b.stock_value)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{b.worker_count}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(29,78,216,.05)', fontWeight: 800 }}>
                      <td>{tt('ИТОГО')}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(t.sales_revenue)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: (t.gross_profit || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtMoneyFull(t.gross_profit)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{t.margin_pct}%</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(t.deals_count)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(t.cash_balance)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoneyFull(t.stock_value)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{t.worker_count}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="grid-3" style={{ marginBottom: 16 }}>
            {W('alerts') && (<Card icon="⚠️" title={tt('Алерты')} actions={alerts.length > 0 && <Badge tone="red">{alerts.length}</Badge>}>
              <div className="list">
                {alerts.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>✓ {tt('Всё спокойно')}</div>
                ) : alerts.map((a, i) => (
                  <div key={i} className="list-item">
                    <div style={{ width: 5, height: 34, borderRadius: 3, background: ({ red: '#DC2626', yellow: '#D97706', blue: '#1D4ED8', purple: '#1D4ED8' })[a.tone] || '#6B7280' }} />
                    <div style={{ flex: 1 }}>
                      <div className="list-item-title">{a.title}</div>
                      <div className="list-item-sub">{a.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>)}

            {W('top-products') && (<Card icon="🏆" title={tt('Топ товаров')} actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/warehouse/stock')}>{tt('Все →')}</button>}>
              <div className="list">
                {topProducts.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>{tt('Нет данных')}</div>
                ) : topProducts.map((p, i) => (
                  <div key={p.id} className="list-item">
                    <div style={{
                      width: 26, height: 26, borderRadius: 7,
                      background: i < 3 ? 'rgba(255,107,43,.15)' : 'var(--bg-2)',
                      color: i < 3 ? 'var(--orange)' : 'var(--text2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 11,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="list-item-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div className="list-item-sub">{fmtNum(p.qty)} {p.unit}</div>
                    </div>
                    <div className="mono" style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 12 }}>{fmtMoneyFull(p.revenue)}</div>
                  </div>
                ))}
              </div>
            </Card>)}

            {W('top-sellers') && (<Card icon="👤" title={tt('Топ сотрудников')} actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/hr/team')}>KPI →</button>}>
              <div className="list">
                {topSellers.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>{tt('Нет данных')}</div>
                ) : topSellers.map(s => {
                  const init = (s.name || s.username || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={s.id} className="list-item">
                      <div className="o-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{init}</div>
                      <div style={{ flex: 1 }}>
                        <div className="list-item-title">{s.name}</div>
                        <div className="list-item-sub">{s.deals} {s.deals % 10 === 1 && s.deals % 100 !== 11 ? tt('сделка') : (s.deals % 10 >= 2 && s.deals % 10 <= 4 && (s.deals % 100 < 12 || s.deals % 100 > 14) ? tt('сделки') : tt('сделок'))} · {tt(ROLE_RU[s.role] || s.role)}</div>
                      </div>
                      <div className="mono" style={{ fontWeight: 800, color: 'var(--orange)', fontSize: 12 }}>{fmtMoneyFull(s.revenue)}</div>
                    </div>
                  );
                })}
              </div>
            </Card>)}
          </div>
        </>
      )}

      {showWidgets && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowWidgets(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>🎛️ {tt('Виджеты панели')}</div>
              <button onClick={() => setShowWidgets(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text3)' }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{tt('Выбери, что показывать на Главной. Сохраняется на этом устройстве.')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DASH_WIDGETS.filter(wg => !companyOffWidgets.has(wg.id)).map(wg => {
                const on = widgets.has(wg.id);
                return (
                  <button key={wg.id} onClick={() => toggleWidget(wg.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', border: '1.5px solid ' + (on ? 'var(--primary)' : 'var(--border)'), background: on ? 'var(--primary-50)' : 'var(--bg-2)' }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: on ? 'var(--text)' : 'var(--text3)' }}>{tt(wg.label)}</span>
                    <span style={{ width: 36, height: 20, borderRadius: 20, background: on ? 'var(--primary)' : '#CBD5E1', position: 'relative', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--surface)', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Compact tile for the right column next to the hero. Now supports breakdown by payment method.
// countMode — если задан, breakdown показывает счётчик (шт), а не суммы.
function CompactTile({ icon, label, value, sub, delta, color, breakdown, countMode = null, usdOrig = 0 }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 10,
      padding: '12px 14px',
      border: '1px solid var(--border)',
      flex: 1,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5 }}>
          {label}
        </div>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginTop: 4,
        }}>
          <div className="mono" style={{ fontSize: 19, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
          {delta != null && (
            <div style={{ fontSize: 10, fontWeight: 800, color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {deltaDisplay(delta)}
            </div>
          )}
        </div>
        {sub && <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginTop: 1 }}>{sub}</div>}
      </div>
      {breakdown && <MethodBreakdown data={breakdown} unit={countMode ? 'count' : 'money'} usdOrig={usdOrig} />}
    </div>
  );
}
