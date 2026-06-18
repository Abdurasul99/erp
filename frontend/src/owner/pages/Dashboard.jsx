import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { BranchScope } from '../OwnerShell.jsx';
import { Tile, Card, Badge, AreaChart, BarChart, PageHeader, Pills, Skeleton, EmptyState, fmtMoney, fmtNum, fmtMoneyFull, fmtSum, todayLabel } from '../ui.jsx';
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
  manager: 'менеджер', gen_dir: 'ген. директор', founder: 'учредитель', admin: 'админ',
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
  const dividerColor = lightOnDark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.06)';
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
            fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace",
            opacity: v > 0 ? 1 : 0.55,
          }}>
            <span style={{ color: labelColor, fontWeight: 700 }}>{m.icon} {tt(m.label)}</span>
            <span style={{ color: valueColor, fontWeight: 700 }}>
              {isCount ? fmtNum(v) : fmtMoneyFull(v)} <span style={{ opacity: .6, fontSize: 9 }}>{isCount ? tt('шт') : m.curr}</span>
              {!isCount && m.key === 'cash_usd' && usdOrig > 0 && (
                <span style={{ opacity: .85, fontSize: 9.5, marginLeft: 4 }}>{`(${fmtNum(usdOrig)} $)`}</span>
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
// ===== BHI (индекс здоровья бизнеса) — блок на карточке «Состояние бизнеса» =====
const bhiZoneColor = (s) => (s == null ? '#9ca3af' : s >= 75 ? '#16a34a' : s >= 50 ? '#f59e0b' : '#EF4444');

function BHIChart({ history, target, lang, picked, setPicked }) {
  const { tt } = useTt();
  const pts = (history || []).filter(h => h.bhi != null);
  if (pts.length < 1) return null;
  const n = pts.length;
  const W = 1000, H = 200, TOP = 8, BOT = H - 4;
  const xAt = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const yAt = (v) => TOP + (1 - (Math.max(0, Math.min(100, v)) / 100)) * (BOT - TOP);
  const bands = [{ f: 0, t: 50, c: 'rgba(239,68,68,.07)' }, { f: 50, t: 75, c: 'rgba(245,158,11,.09)' }, { f: 75, t: 100, c: 'rgba(22,163,74,.09)' }];
  const labelStep = Math.max(1, Math.ceil(n / 31));
  const dm = (iso) => { const d = new Date(iso); return d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0'); };
  return (
    <div style={{ position: 'relative', paddingLeft: 28, paddingRight: 4 }}>
      {[0, 50, 75, 100].map(v => (
        <div key={v} style={{ position: 'absolute', left: 0, width: 22, textAlign: 'right', top: `${(yAt(v) / H) * 100}%`, transform: 'translateY(-50%)', fontSize: 9.5, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none' }}>{v}</div>
      ))}
      <div style={{ position: 'relative', height: H, cursor: 'pointer' }} onMouseLeave={() => setPicked(null)}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
          {bands.map((b, i) => (<rect key={i} x="0" y={yAt(b.t)} width={W} height={yAt(b.f) - yAt(b.t)} fill={b.c} />))}
          {[0, 50, 75, 100].map(v => (<line key={v} x1="0" y1={yAt(v)} x2={W} y2={yAt(v)} stroke="rgba(0,0,0,.07)" strokeWidth="1" strokeDasharray={v === 0 ? '0' : '4 4'} vectorEffect="non-scaling-stroke" />))}
          {target != null && <line x1="0" y1={yAt(target)} x2={W} y2={yAt(target)} stroke="#5B4FE8" strokeWidth="1.5" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />}
          {pts.slice(0, -1).map((p, i) => (<line key={'s' + i} x1={xAt(i)} y1={yAt(p.bhi)} x2={xAt(i + 1)} y2={yAt(pts[i + 1].bhi)} stroke={bhiZoneColor(pts[i + 1].bhi)} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />))}
          {pts.map((p, i) => (<circle key={'p' + i} cx={xAt(i)} cy={yAt(p.bhi)} r={picked === i ? 4.5 : 2.8} fill={bhiZoneColor(p.bhi)} stroke="#fff" strokeWidth="1.4" vectorEffect="non-scaling-stroke" onMouseEnter={() => setPicked(i)} style={{ cursor: 'pointer' }} />))}
        </svg>
        {target != null && <div style={{ position: 'absolute', right: 2, top: `${(yAt(target) / H) * 100}%`, transform: 'translateY(-50%)', fontSize: 9, fontWeight: 800, color: '#5B4FE8', background: '#fff', padding: '0 3px', borderRadius: 3 }}>{tt('Цель')} {target}</div>}
        {picked != null && pts[picked] && (() => {
          const left = (xAt(picked) / W) * 100;
          return (<div style={{ position: 'absolute', left: `${left}%`, top: 0, transform: `translateX(${left > 70 ? '-100%' : left < 30 ? '0' : '-50%'})`, background: 'var(--text)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 10.5, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,.25)', pointerEvents: 'none', zIndex: 2 }}>
            <div>BHI: {pts[picked].bhi}</div>
            <div style={{ fontSize: 9, opacity: .7, marginTop: 1 }}>{fmtDate(pts[picked].date, { day: 'numeric', month: 'short' }, lang)}</div>
          </div>);
        })()}
      </div>
      <div style={{ display: 'flex', marginTop: 6, fontSize: 8.5, fontWeight: 700, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>
        {pts.map((p, i) => (<div key={i} style={{ flex: 1, minWidth: 0, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>{i % labelStep === 0 ? dm(p.date) : ''}</div>))}
      </div>
    </div>
  );
}

function PillarCard({ p }) {
  const { tt } = useTt();
  const has = p.score != null;
  const col = bhiZoneColor(p.score);
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px', opacity: has ? 1 : .6 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)' }}>{tt(p.label)}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 900, color: col }}>{has ? p.score : '—'}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700 }}>{tt('вес')} {Math.round(p.weight)}%</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>{has ? tt(p.question) : tt('Нет данных')}</div>
      <div style={{ height: 6, borderRadius: 4, background: '#eef0f4', overflow: 'hidden' }}>
        <div style={{ width: `${has ? p.score : 0}%`, height: '100%', background: col, borderRadius: 4 }} />
      </div>
    </div>
  );
}

function BHIBlock({ bhi, lang }) {
  const { tt } = useTt();
  const [picked, setPicked] = useState(null);
  const [showBlocks, setShowBlocks] = useState(false);
  if (!bhi || bhi.score == null) {
    return <div style={{ padding: '18px 4px', color: 'var(--text3)', fontSize: 13 }}>📈 {tt('История BHI накапливается — данные появятся в ближайшие дни')}</div>;
  }
  const zc = bhiZoneColor(bhi.score);
  const pts = (bhi.history || []).filter(h => h.bhi != null);
  let best = null, worst = null;
  for (const h of pts) { if (best == null || h.bhi > best.bhi) best = h; if (worst == null || h.bhi < worst.bhi) worst = h; }
  const dlt = (v) => (v == null ? '—' : v >= 0 ? '▲ +' + v : '▼ ' + v);
  const trigTone = bhi.trigger ? (bhi.trigger.tone === 'red' ? '#EF4444' : bhi.trigger.tone === 'green' ? '#16a34a' : '#f59e0b') : null;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 40, fontWeight: 900, color: zc, lineHeight: 1 }}>{bhi.score}</span>
          <span style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 700 }}>/ 100 {tt('баллов')}</span>
        </div>
        <span style={{ background: zc, color: '#fff', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 800 }}>● {tt(bhi.zone_label)}</span>
        {bhi.delta_today != null && <span style={{ fontSize: 12, fontWeight: 800, color: bhi.delta_today >= 0 ? '#16a34a' : '#EF4444' }}>{dlt(bhi.delta_today)} {tt('vs вчера')}</span>}
        {bhi.delta_month != null && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>{dlt(bhi.delta_month)} {tt('за месяц')}</span>}
      </div>
      {bhi.trigger && <div style={{ background: trigTone + '18', border: '1px solid ' + trigTone + '55', color: trigTone, borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>⚠ {bhi.trigger.text}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 12, background: '#f7f8fb', borderRadius: 8, padding: '6px 10px' }}>
        <span title={tt('BHI считается по доступным данным — точность растёт со временем')}>⚙️ {tt('Адаптивный режим')}</span>
        <span>· {tt('Точность')}: {tt(bhi.accuracy_tier)}</span>
        <span>· {tt('Активных блоков')}: {bhi.blocks_active}/8</span>
        <span>· {tt('Вес выручки')}: {Math.round(bhi.revenue_weight * 100)}%</span>
      </div>
      {(best && worst && pts.length > 1) && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{tt('Лучший день')}: <b style={{ color: '#16a34a' }}>{best.bhi}</b> · {fmtDate(best.date, { day: 'numeric', month: 'short' }, lang)}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{tt('Худший день')}: <b style={{ color: '#EF4444' }}>{worst.bhi}</b> · {fmtDate(worst.date, { day: 'numeric', month: 'short' }, lang)}</div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
        {(bhi.pillars || []).map(p => <PillarCard key={p.key} p={p} />)}
      </div>
      <BHIChart history={bhi.history} target={bhi.target} lang={lang} picked={picked} setPicked={setPicked} />
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowBlocks(s => !s)} style={{ fontSize: 12 }}>{showBlocks ? '▾' : '▸'} {tt('Уровень 2 — 8 блоков')}</button>
        {showBlocks && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 8, marginTop: 8 }}>
            {(bhi.blocks || []).map(b => {
              const has = b.hasData && b.score != null;
              const col = bhiZoneColor(b.score);
              const kindLbl = b.kind === 'proxy' ? tt('прокси') : b.kind === 'partial' ? tt('частично') : tt('реальные');
              return (
                <div key={b.key} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', opacity: has ? 1 : .55 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800 }}>{tt(b.label)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, color: col }}>{has ? b.score : '—'}</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--text3)', marginTop: 2 }}>{has ? `${tt('вес')} ${Math.round(b.weight)}% · ${kindLbl}` : tt(b.reason || 'Нет данных')}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const GREEN = '#16a34a', RED = '#EF4444';
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
          <div key={k} style={{ position: 'absolute', left: 0, width: 48, textAlign: 'right', top: `${(yAt(v) / H) * 100}%`, transform: 'translateY(-50%)', fontSize: 9.5, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none' }}>{fmtMoney(v)}</div>
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
            <div style={{ position: 'absolute', left: `${left}%`, top: 0, transform: `translateX(${left > 70 ? '-100%' : left < 30 ? '0' : '-50%'})`, background: 'var(--text)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 10.5, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,.25)', pointerEvents: 'none', zIndex: 2 }}>
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
        <div style={{ display: 'flex', marginTop: 6, fontSize: 8.5, fontWeight: 700, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>
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
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 8 }}>🤖 {tt('Спросить про график')}</div>
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
      {err && <div style={{ marginTop: 8, color: 'var(--red)', fontWeight: 600, fontSize: 12 }}>⚠️ {err}</div>}
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
  const GREEN = '#16a34a', RED = '#EF4444';
  // Нет данных для баланса — не показываем вводящий в заблуждение «Капитал 100%».
  const hasData = isOwner ? ((bs.assets || 0) > 0 || (bs.liabilities || 0) > 0)
    : ((bs.equity_ratio || 0) !== 0 || (bs.liability_ratio || 0) !== 0);
  if (!hasData) {
    return (
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', fontSize: 13 }}>
        <span>📊 {tt('Нет данных для баланса')}</span>
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
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 10, alignItems: 'flex-end', fontFamily: "'JetBrains Mono', monospace" }}>
          <div><div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{tt('Всего активов')}</div><div style={{ fontSize: 18, fontWeight: 900 }}>{fmtMoneyFull(bs.assets)} <span style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('сум')}</span></div></div>
          <div><div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{tt('Всего обязательств')}</div><div style={{ fontSize: 18, fontWeight: 900, color: RED }}>{fmtMoneyFull(bs.liabilities)} <span style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('сум')}</span></div></div>
          <div><div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{tt('Собственный капитал')}</div><div style={{ fontSize: 18, fontWeight: 900, color: negEquity ? RED : GREEN }}>{fmtMoneyFull(bs.equity)} <span style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('сум')}</span></div></div>
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
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: "'JetBrains Mono', monospace" }}>
          <span><b style={{ color: GREEN }}>{tt('Активы')}:</b> 💵{fmtMoney(b.cash)} · 📦{fmtMoney(b.inventory)} · 📥{fmtMoney(b.receivables)} · 🏭{fmtMoney(b.fixed_assets)}</span>
          <span><b style={{ color: RED }}>{tt('Обязательства')}:</b> 📤{fmtMoney(b.payables)} · 🏦{fmtMoney(b.loans)} · 📋{fmtMoney(b.tax_payable)} · 💼{fmtMoney(b.wages_payable)}</span>
        </div>
      )}
    </div>
  );
}

const FIN_TABS = [
  { key: 'fixed-assets', label: '🏭 Основные средства', amount: 'acquisition_cost', title: 'name', fields: [
    { name: 'category', label: 'Категория', type: 'select', options: [['equipment', 'Оборудование'], ['vehicle', 'Транспорт'], ['real_estate', 'Недвижимость']] },
    { name: 'name', label: 'Название', type: 'text' },
    { name: 'acquisition_cost', label: 'Стоимость (сум)', type: 'number' },
  ] },
  { key: 'loans', label: '🏦 Кредиты', amount: 'remaining_balance', title: 'lender', fields: [
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
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
      }} aria-hidden="true">{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { tt, lang } = useTt();
  const { branchId, isOwner, role, branches: allBranches, periodFrom, periodTo, periodLabel } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Два графика — каждый со СВОЕЙ гранулярностью (независимо друг от друга и от плиток)
  const [salesGran, setSalesGran] = useState('day');
  const [salesChart, setSalesChart] = useState(null);
  const [salesLoading, setSalesLoading] = useState(true);
  const [compareGran, setCompareGran] = useState('day');
  const [compareChart, setCompareChart] = useState(null);
  const [compareLoading, setCompareLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0); // бамп после правки активов/обязательств

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
    setSalesLoading(true);
    const params = { granularity: salesGran };
    if (periodFrom) params.from = periodFrom;
    if (periodTo) params.to = periodTo;
    if (branchId) params.branch_id = branchId;
    api.get('/company/sales-chart', { params })
      .then(r => { if (!ignore) setSalesChart(r.data); })
      .catch(() => { if (!ignore) setSalesChart(null); })
      .finally(() => { if (!ignore) setSalesLoading(false); });
    return () => { ignore = true; };
  }, [salesGran, periodFrom, periodTo, branchId]);

  useEffect(() => {
    let ignore = false;
    setCompareLoading(true);
    const params = { granularity: compareGran };
    if (periodFrom) params.from = periodFrom;
    if (periodTo) params.to = periodTo;
    if (branchId) params.branch_id = branchId;
    api.get('/company/sales-chart', { params })
      .then(r => { if (!ignore) setCompareChart(r.data); })
      .catch(() => { if (!ignore) setCompareChart(null); })
      .finally(() => { if (!ignore) setCompareLoading(false); });
    return () => { ignore = true; };
  }, [compareGran, periodFrom, periodTo, branchId]);

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

  // Данные бар-чартов с бэкенда: бакеты агрегированы по своей гранулярности у каждого графика
  const salesValues = useMemo(() => (salesChart?.buckets || []).map(b => b.revenue), [salesChart]);
  const salesLabels = useMemo(() => (salesChart?.buckets || []).map(b => b.label), [salesChart]);
  const salesTotal = salesChart?.total || 0;

  const compareValues = useMemo(() => (compareChart?.buckets || []).map(b => b.revenue), [compareChart]);
  const comparePrevValues = useMemo(() => (compareChart?.prev_buckets || []).map(b => b.revenue), [compareChart]);
  const compareLabels = useMemo(() => (compareChart?.buckets || []).map(b => b.label), [compareChart]);
  const compareTotal = compareChart?.total || 0;
  const comparePrevTotal = compareChart?.prev_total || 0;
  const compareDelta = deltaPct(compareTotal, comparePrevTotal);

  const revDelta = deltaPct(t.sales_revenue, prev.sales_revenue);
  const profitDelta = deltaPct(t.gross_profit, prev.gross_profit);
  const dealsDelta = deltaPct(t.deals_count, prev.deals_count);
  const checkDelta = deltaPct(t.avg_check, prev.avg_check);

  const scopeLabel = isOwner
    ? (branchId ? (allBranches.find(x => x.id === branchId)?.name || `${tt('Филиал')} #${branchId}`) : tt('Все филиалы'))
    : (role === 'manager' ? tt('Мой филиал') : '');

  // Single-branch summary — для cashflow-карточки (показывается всегда: для manager — его филиал, для founder/gen_dir — суммарно по всем)
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
          {/* Hero — БАННЕР на всю ширину с фиксированной высотой (не растягивается
              под соседние колонки → нет пустоты). Слева цифры, справа плавная
              area-кривая с точкой пика. Плитки — отдельным рядом ниже. */}
          <div style={{
            background: '#fff',
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
                📅 {todayLabel(lang)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: .7, marginTop: 4 }}>
                💰 {tt('ВЫРУЧКА')} · {periodLabel}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 900, lineHeight: 1.05, marginTop: 4, letterSpacing: -0.5, color: '#16a34a' }}>
                {fmtMoneyFull(t.sales_revenue)} <span style={{ fontSize: 14, color: 'var(--text3)' }}>{tt('сум')}</span>
              </div>
              {revDelta != null ? (
                <div style={{ fontSize: 11.5, fontWeight: 800, color: revDelta >= 0 ? 'var(--green, #16a34a)' : 'var(--red, #EF4444)' }}>
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

          {/* Диаграмма состояния бизнеса — отдельная широкая карта.
              Учредитель видит суммы (выручка+прибыль) и AI-разбор; менеджер — только состояние. */}
          {(data?.bhi || (isOwner && data?.biz_state) || (trend.length > 1 && trend.some(x => (x.revenue || 0) > 0 || (x.idx || 0) > 0))) && (
            <Card icon="📊" title={tt('Состояние бизнеса') + ' · ' + periodLabel} style={{ marginBottom: 16 }}>
              {data?.bhi ? (
                <BHIBlock bhi={data.bhi} lang={lang} />
              ) : (
                trend.length > 1 && trend.some(x => (x.revenue || 0) > 0 || (x.idx || 0) > 0) && (
                  <BusinessStateChart data={trend} lang={lang} isOwner={isOwner} gran={data?.sales_trend_gran} />
                )
              )}
              <StateAsk trend={trend} bizState={isOwner ? data?.biz_state : null} lang={lang} />
            </Card>
          )}

          {/* Три плитки — отдельный ряд под хиро (равная высота между собой) */}
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <CompactTile icon="🏦" label={tt('Касса (баланс)')} value={fmtMoneyFull(t.cash_balance)} sub={tt('сум') + ' · ' + tt('остаток на сейчас')}
              breakdown={byMethod.cash_in} usdOrig={byMethod.cash_in_usd_orig} color="#0EA5E9" />
            <CompactTile icon="📦" label={tt('Продаж')} value={fmtNum(t.deals_count)} sub={tt('за период')}
              breakdown={byMethod.deals} delta={dealsDelta} color="#5B4FE8" countMode="шт" />
            <CompactTile icon="🧾" label={tt('Средний чек')} value={fmtMoneyFull(t.avg_check)} sub={tt('сум')}
              breakdown={byMethod.avg_check} delta={checkDelta} color="#FF6B2B" />
          </div>

          {/* Денежный поток — ВЫШЕ диаграмм. Слева — филиал/сводка, справа — приход/расход/прибыль/склад */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: branchSummary ? 'minmax(180px, 220px) 1fr' : '1fr', gap: 18, alignItems: 'center' }}>
              {branchSummary && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  paddingRight: 18, borderRight: '1px solid var(--border, #e6e8f2)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'var(--primary-50, rgba(91,79,232,.10))', color: 'var(--primary, #5B4FE8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  }}>{branchSummary.icon}</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5 }}>
                      💸 {tt('Денежный поток')}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{branchSummary.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginTop: 2 }}>{branchSummary.sub}</div>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {/* Приход/Расход — за выбранный период (синхронно с выручкой).
                    Валовая прибыль — продажи минус себестоимость за период.
                    Склад — текущая стоимость остатков (не зависит от периода). */}
                <div>
                  <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{tt('Приход')} · {periodLabel}</div>
                  <div className="mono" style={{ fontWeight: 800, color: 'var(--green)', fontSize: 18, marginTop: 4 }}>+{fmtMoneyFull(t.cash_income)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{tt('сум · в кассу')}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{tt('Расход')} · {periodLabel}</div>
                  <div className="mono" style={{ fontWeight: 800, color: 'var(--red)', fontSize: 18, marginTop: 4 }}>−{fmtMoneyFull(t.cash_expense)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{tt('сум · из кассы')}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{tt('Валовая прибыль')}</div>
                  <div className="mono" style={{ fontWeight: 800, color: (t.gross_profit || 0) >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 18, marginTop: 4 }}>{fmtMoneyFull(t.gross_profit)}</div>
                  {profitDelta != null ? (
                    <div style={{ fontSize: 10, fontWeight: 800, color: profitDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {deltaDisplay(profitDelta)} {tt('к прошлому периоду')}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{tt('сум · продажи − себестоимость')}</div>
                  )}
                </div>
                <div>
                  <div style={{ color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{tt('Склад')} · {tt('сейчас')}</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>{fmtMoneyFull(t.stock_value)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{tt('сум · стоимость остатков')}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Динамика продаж — единый переключатель масштаба + две карты-близнеца.
              Один бар = день / неделя / месяц / год (как в банковских приложениях). */}
          {(() => {
            const hasPrev = comparePrevValues.some(v => v > 0);
            const peak = salesValues.length ? Math.max(...salesValues) : 0;
            const peakIdx = salesValues.indexOf(peak);
            const peakLabel = peakIdx >= 0 ? (salesLabels[peakIdx] || '') : '';
            const granOpts = CHART_GRAN_OPTIONS.map(o => ({ ...o, label: tt(o.label) }));
            return (
              <>
                {/* Заголовок секции — у каждой карты свой переключатель масштаба */}
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)', marginBottom: 12 }}>📊 {tt('Динамика продаж')}</div>

                <div className="grid-2 dashboard-charts-row" style={{ marginBottom: 16, alignItems: 'stretch' }}>
                  {/* Карта 1 — Продажи (свой переключатель) */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                      <ChartHead icon="📈" iconBg="rgba(37,99,235,.10)" iconColor="#2563EB"
                        label={tt('Продажи') + ' · ' + periodLabel}>
                        <div className="mono" style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 2, lineHeight: 1.1 }}>
                          {fmtMoneyFull(salesTotal)} <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{tt('сум')}</span>
                        </div>
                      </ChartHead>
                      <Pills value={salesGran} onChange={setSalesGran} options={granOpts} label={tt('Продажи')} />
                    </div>
                    {salesLoading && !salesChart ? <Skeleton height={150} /> : (
                      <BarChart data={salesValues} labels={salesLabels} color="#2563EB" height={150} />
                    )}
                    {/* Футер для выравнивания высоты с правой картой */}
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)', minHeight: 18 }}>
                      {peak > 0 && <>{tt('Пик')}: <strong className="mono">{fmtMoneyFull(peak)} {tt('сум')}</strong> · {peakLabel}</>}
                    </div>
                  </div>

                  {/* Карта 2 — Сравнение (свой переключатель) */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                      <ChartHead icon="📊" iconBg="rgba(34,197,94,.10)" iconColor="#16a34a"
                        label={tt('Сравнение') + ' · ' + periodLabel}>
                        <div className="mono" style={{
                          fontSize: 22, fontWeight: 900, lineHeight: 1.1, marginTop: 2,
                          color: compareDelta == null ? 'var(--text3)' : compareDelta >= 0 ? 'var(--green, #22C55E)' : 'var(--red, #EF4444)',
                        }}>
                          {compareDelta != null
                            ? <>{deltaDisplay(compareDelta)}</>
                            : <span style={{ fontSize: 13, fontWeight: 700 }}>{tt('нет базы для сравнения')}</span>}
                        </div>
                      </ChartHead>
                      <Pills value={compareGran} onChange={setCompareGran} options={granOpts} label={tt('Сравнение')} />
                    </div>
                    {compareLoading && !compareChart ? <Skeleton height={150} /> : (
                      <BarChart data={compareValues} prevData={hasPrev ? comparePrevValues : undefined} labels={compareLabels}
                        color="#22C55E" prevColor="#C3C8D4" height={150} />
                    )}
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, flexWrap: 'wrap', minHeight: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: '#22C55E', borderRadius: 3 }} />
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

          {isOwner && branches.length > 1 && (
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
                          🏭 {b.branch_name}{' '}
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
                    <tr style={{ background: 'rgba(91,79,232,.05)', fontWeight: 800 }}>
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
            <Card icon="⚠️" title={tt('Алерты')} actions={alerts.length > 0 && <Badge tone="red">{alerts.length}</Badge>}>
              <div className="list">
                {alerts.length === 0 ? (
                  <div style={{ padding: '14px 0', color: 'var(--text3)', fontSize: 13 }}>✓ {tt('Всё спокойно')}</div>
                ) : alerts.map((a, i) => (
                  <div key={i} className="list-item">
                    <div style={{ width: 5, height: 34, borderRadius: 3, background: ({ red: '#EF4444', yellow: '#F59E0B', blue: '#5B4FE8', purple: '#7c3aed' })[a.tone] || '#6B7280' }} />
                    <div style={{ flex: 1 }}>
                      <div className="list-item-title">{a.title}</div>
                      <div className="list-item-sub">{a.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card icon="🏆" title={tt('Топ товаров')} actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/warehouse/stock')}>{tt('Все →')}</button>}>
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
            </Card>

            <Card icon="👤" title={tt('Топ сотрудников')} actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/management/team-kpi')}>KPI →</button>}>
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
            </Card>
          </div>
        </>
      )}
    </>
  );
}

// Compact tile for the right column next to the hero. Now supports breakdown by payment method.
// countMode — если задан, breakdown показывает счётчик (шт), а не суммы.
function CompactTile({ icon, label, value, sub, delta, color, breakdown, countMode = null, usdOrig = 0 }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '12px 14px',
      border: '1px solid rgba(230,232,242,.6)',
      borderLeft: `4px solid ${color}`,
      boxShadow: 'var(--shadow)',
      flex: 1,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .5 }}>
          {icon} {label}
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
