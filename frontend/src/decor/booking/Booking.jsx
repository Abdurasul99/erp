// Бронь декора: конфликты (с подсказкой «аренда у другой студии на N шт или замена в дизайне»), «не вернулось с объекта»,
// таблица вещи × 14 дней (частично / всё занято / не хватает; рамка — в числе есть не вернувшееся), заказы по датам.
// Номер заказа открывает карточку заказа (?open=<id>). Правило брони — по каждой вещи (formulas.js).
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api.js';
import { useT, fday, fdd, localYmd, addDays } from '../i18n.js';
import { useLoad, Hero, Card, Chip, Loading, NoAccess } from '../kit.jsx';
import OrderCard from '../orders/OrderCard.jsx';

const DAYS = 14;
const WEEK = { ru: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], uz: ['yak', 'du', 'se', 'chor', 'pay', 'ju', 'sha'], uzc: ['як', 'ду', 'се', 'чор', 'пай', 'жу', 'ша'] };
const wd = (ymd, lang) => WEEK[lang][new Date(`${ymd}T00:00:00Z`).getUTCDay()];

export default function Booking() {
  const { t, lang } = useT();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const fromParam = params.get('from') || '';
  const open = Number(params.get('open')) || null;
  const [allConf, setAllConf] = useState(false);   // телефон: сначала 3 конфликта, остальные — по кнопке
  const [b, err, reload] = useLoad(() => api.get('/booking', { params: { days: DAYS, ...(fromParam ? { from: fromParam } : {}) } }).then(r => r.data), [fromParam]);
  const today = b?.today || localYmd();   // «сегодня» — по серверу компании
  const from = fromParam || today;
  const go = p => setParams({ ...Object.fromEntries(params), ...p }, { replace: true });
  const openCard = id => go({ open: String(id) });
  const closeCard = () => { const p = Object.fromEntries(params); delete p.open; setParams(p, { replace: true }); };
  if (err?.response?.status === 403) return <><Hero id="booking" /><NoAccess err={err} /></>;
  if (!b) return <><Hero id="booking" /><Loading err={err} retry={reload} /></>;

  const ahead = new Set(b.orders_by_day.filter(d => d.day >= today).flatMap(d => d.orders.map(o => o.id))).size;
  const stats = [[b.conflicts.length, t('bStatConflicts')], [ahead, t('bStatAhead')]];
  if (b.not_returned.length) stats.push([b.not_returned.length, t('bStatNotBack')]);
  const orderNo = o => <button key={o.id} type="button" className="dd-btn ghost sm" onClick={() => openCard(o.id)}>{o.no}</button>;
  return (
    <>
      {/* Без кнопок «Новый заказ в калькуляторе» и «Склад» (владелец, 09.11.2026): оба раздела — в доке */}
      <Hero id="booking" stats={stats} />

      {b.conflicts.length > 0 && (
        <Card className="alert">
          <h3 style={{ color: 'var(--bad)' }}>{t('conflictsTitle')}</h3>
          <div className="dd-tw only-wide" style={{ marginTop: 6 }}>
            <table>
              <thead><tr><th>{t('colDay')}</th><th>{t('colItem')}</th><th className="r">{t('colNeed')}</th><th className="r">{t('colHave')}</th><th>{t('colSolution')}</th><th /></tr></thead>
              <tbody>{b.conflicts.map((c, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fday(c.day, lang)}</td><td><b>{c.item}</b></td>
                  <td className="r num">{c.need}</td><td className="r num" style={{ color: 'var(--bad)' }}>{c.have}</td>
                  <td className="dd-note">{t('rentHint', { n: c.short })}{c.not_returned > 0 ? ` · ${t('notBackPart', { n: c.not_returned })}` : ''}</td>
                  <td><div className="dd-row" style={{ gap: 4 }}>{c.order_refs.map(orderNo)}</div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="only-narrow">
            <div className="dd-lines">
              {(allConf ? b.conflicts : b.conflicts.slice(0, 3)).map((c, i) => (
                <div key={i} className="dd-line">
                  <div className="dd-line-head"><b>{c.item}</b><Chip tone="bad">{t('shortN', { n: c.short })}</Chip></div>
                  <div className="dd-nums"><span>{fday(c.day, lang)}</span><span>{t('colNeed')} <b>{c.need}</b></span><span>{t('colHave')} <b style={{ color: 'var(--bad)' }}>{c.have}</b></span></div>
                  <div className="dd-note">{t('rentHint', { n: c.short })}{c.not_returned > 0 ? ` · ${t('notBackPart', { n: c.not_returned })}` : ''}</div>
                  <div className="dd-row" style={{ gap: 4 }}>{c.order_refs.map(orderNo)}</div>
                </div>
              ))}
            </div>
            {!allConf && b.conflicts.length > 3 && (
              <button type="button" className="dd-btn ghost wide" style={{ marginTop: 10 }} onClick={() => setAllConf(true)}>{t('showAllN', { n: b.conflicts.length })}</button>
            )}
          </div>
        </Card>
      )}

      {b.not_returned.length > 0 && (
        <Card className="alert">
          <h3 style={{ color: 'var(--bad)' }}>{t('nbTitle')}</h3>
          <p className="dd-sub" style={{ marginTop: 4 }}>{t('nbNote')}</p>
          <div className="dd-lines">
            {b.not_returned.map(x => (
              <div key={x.order_id} className="dd-line">
                <div className="dd-line-head"><b>{x.no} · {x.client}</b><Chip tone="bad">{t('nbLate', { date: fday(x.period_to, lang), n: x.days_late })}</Chip></div>
                <div className="dd-nums">{x.items.map(i => <span key={i.item_id}>{i.item} <b>{i.qty}</b></span>)}</div>
                <div className="dd-row" style={{ gap: 6 }}>
                  <button type="button" className="dd-btn ghost sm" onClick={() => openCard(x.order_id)}>{t('card')}</button>
                  <button type="button" className="dd-btn sm" onClick={() => nav(`/decor/warehouse?tab=onsite&order=${x.order_id}`)}>{t('nbAccept')} →</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="dd-row dd-between">
          <h3>{t('gridTitle', { n: DAYS })}</h3>
          <div className="dd-row" style={{ gap: 6 }}>
            <Chip tone="blue">{t('legendSome')}</Chip><Chip tone="warn">{t('legendFull')}</Chip><Chip tone="bad">{t('legendOver')}</Chip>
          </div>
        </div>
        <div className="dd-row" style={{ marginTop: 10, gap: 6 }}>
          <button type="button" className="dd-btn ghost sm" onClick={() => go({ from: addDays(from, -7) })}>{t('earlier')}</button>
          <button type="button" className="dd-btn ghost sm" disabled={from === today} onClick={() => { const p = Object.fromEntries(params); delete p.from; setParams(p, { replace: true }); }}>{t('todayBtn')}</button>
          <button type="button" className="dd-btn ghost sm" onClick={() => go({ from: addDays(from, 7) })}>{t('later')}</button>
          <span className="dd-note">{t('period', { from: fdd(b.days[0]), to: fdd(b.days[b.days.length - 1]) })}</span>
        </div>
        {/* Своя прокрутка в обе стороны: строка дат закреплена сверху, вещь и «Есть» — слева (иначе при
            прокрутке вниз по 75 вещам даты уезжали вместе со страницей) */}
        <div className="dd-tw dd-calwrap" style={{ marginTop: 10 }}>
          <table className="dd-cal">
            <thead><tr>
              <th className="name">{t('colItem')}</th><th className="total">{t('colTotal')}</th>
              {b.days.map(d => <th key={d} className={d === today ? 'today' : ''}>{fdd(d)}<br /><span style={{ fontWeight: 500 }}>{wd(d, lang)}</span></th>)}
            </tr></thead>
            <tbody>{b.items.map(it => (
              <tr key={it.id}>
                <td className="name">{it.name}</td>
                <td className="num total" style={{ textAlign: 'center', fontWeight: 800 }}>{it.stock}</td>
                {it.cells.map(c => {
                  const used = c.reserved + c.not_returned;
                  return (
                    <td key={c.day}><div className={`dd-cell num ${c.state === 'none' ? '' : c.state} ${c.not_returned ? 'nb' : ''}`}
                      title={t('cellTitle', { item: it.name, date: fday(c.day, lang), used, have: c.stock })}>{used || '·'}</div></td>
                  );
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3>{t('byDayTitle')}</h3>
        {!b.orders_by_day.length ? <div className="dd-empty">{t('noBookings')}</div> : b.orders_by_day.map(d => (
          <div key={d.day} style={{ marginTop: 12 }}>
            <div className="dd-eyebrow">{fday(d.day, lang)}</div>
            <div className="dd-row" style={{ marginTop: 6, gap: 6 }}>
              {d.orders.map(o => <button key={o.id} type="button" className="dd-btn ghost sm" onClick={() => openCard(o.id)}>{o.no} · {o.client}</button>)}
            </div>
          </div>
        ))}
      </Card>
      {open && <OrderCard id={open} onClose={closeCard} onChanged={reload} />}
    </>
  );
}
