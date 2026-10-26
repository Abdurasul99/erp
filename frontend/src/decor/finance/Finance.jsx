// Финансы: себестоимость по всем заказам (план / частично / факт / снимок, итоги, фильтр по месяцу), деньги ПМ → кассир
// (долг каждого, «Сдал» с фото чека, «Подтвердить» — только касса, история), касса (подтверждённые поступления − выплаты
// команде − покупки из фонда) и фонд материалов (износ + окончательная недостача закрытых заказов − возвращено после
// закрытия; «Купил декор» — с вещью пополняет склад). Все суммы считает сервер (formulas.js).
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api.js';
import Icon from '../icons.jsx';
import { useT, fm, fm2, fday, fmonth, fts } from '../i18n.js';
import { useDecor, useLoad, useActions, Hero, Tabs, Card, Chip, Sheet, Loading, Empty, NoAccess, numIn } from '../kit.jsx';
import { EvidenceSheet, Thumb, evForm, evidenceError } from '../evidence.jsx';
import OrderCard from '../orders/OrderCard.jsx';

const MODE_TONE = { plan: 'gray', partial: 'warn', fact: 'blue', closed: 'ok' };
const PS_TONE = { at_pm: 'warn', handed: 'blue', confirmed: 'ok' };

export default function Finance() {
  const { t } = useT();
  const { can } = useDecor();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const fin = can('see_finance'); const cash = can('confirm_money');
  const [money, moneyErr, reloadMoney] = useLoad(() => api.get('/money').then(r => r.data), []);
  const [fund, , reloadFund] = useLoad(() => (fin || cash ? api.get('/finance/fund').then(r => r.data) : Promise.resolve(null)), [fin, cash]);
  const tabs = [...(fin ? [['costs', t('fTabCosts')]] : []), ['money', t('fTabMoney'), money?.queue?.length || null, 'warn'],
    ...(fin || cash ? [['cash', t('fTabCash')], ['fund', t('fTabFund')]] : [])];
  const tab = tabs.some(x => x[0] === params.get('tab')) ? params.get('tab') : tabs[0][0];
  const open = Number(params.get('open')) || null;
  const go = p => { const q = { ...Object.fromEntries(params), ...p }; Object.keys(q).forEach(k => q[k] === null && delete q[k]); setParams(q, { replace: true }); };
  const reloadAll = () => { reloadMoney(); reloadFund(); };

  if (moneyErr?.response?.status === 403) return <><Hero id="finance" /><NoAccess err={moneyErr} /></>;
  if (!money) return <><Hero id="finance" /><Loading err={moneyErr} retry={reloadMoney} /></>;
  const stats = [];
  if (money.cash) stats.push([fm(money.cash.cash), t('fStatCash')]);
  stats.push([fm(money.debt_total_usd), t('fStatAtPm')]);
  if (fund) stats.push([fm(fund.remaining), t('fStatFund')]);
  return (
    <>
      <Hero id="finance" stats={stats} acts={[{ label: t('t_team'), onClick: () => nav('/decor/team') }, { label: t('s_orders'), onClick: () => nav('/decor/orders') }]} />
      <Tabs value={tab} onChange={k => go({ tab: k })} items={tabs} />
      {tab === 'costs' && <CostsTab onOpen={id => go({ open: String(id) })} />}
      {tab === 'money' && <MoneyTab money={money} reload={reloadAll} onOpen={id => go({ open: String(id) })} />}
      {tab === 'cash' && <CashTab money={money} fund={fund} />}
      {tab === 'fund' && (fund ? <FundTab fund={fund} reload={reloadAll} /> : <Loading />)}
      {open && <OrderCard id={open} onClose={() => go({ open: null })} onChanged={reloadAll} />}
    </>
  );
}

// ---------- Себестоимость по заказам: фильтр по месяцу, режимы, итоги ----------
function CostsTab({ onOpen }) {
  const { t, lang } = useT();
  const [month, setMonth] = useState('');
  const [d, err, reload] = useLoad(() => api.get('/finance/costs', { params: month ? { month } : {} }).then(r => r.data), [month]);
  if (!d) return <Loading err={err} retry={reload} />;
  const other = r => r.transport + r.consumables + r.rented + r.other;
  return <>
    <Card>
      <div className="dd-row dd-between">
        <div className="dd-field" style={{ minWidth: 200 }}><label htmlFor="fc_m">{t('fMonth')}</label>
          <select id="fc_m" className="dd-inp" value={month} onChange={e => setMonth(e.target.value)}>
            <option value="">{t('fAllMonths')}</option>
            {d.months.map(m => <option key={m} value={m}>{fmonth(m, lang)}</option>)}
          </select></div>
        <div className="dd-row" style={{ gap: 6 }}>{['plan', 'partial', 'fact', 'closed'].map(k => <Chip key={k} tone={MODE_TONE[k]}>{t(`modeS_${k}`)} · {d.modes[k]}</Chip>)}</div>
      </div>
      <div className="dd-kpis" style={{ marginTop: 14 }}>
        <div><span>{t('fKpiOrders')}</span><b className="num">{d.rows.length}</b></div>
        <div><span>{t('fKpiPrice')}</span><b className="num">{fm(d.total.price)}</b></div>
        <div><span>{t('fKpiFull')}</span><b className="num">{fm(d.total.full)}</b></div>
        <div><span>{t('fKpiProfit')}</span><b className="num" style={{ color: d.total.profit < 0 ? 'var(--bad)' : 'var(--ok)' }}>{fm(d.total.profit)}</b></div>
      </div>
      {d.closed_recovered_usd > 0 && <div className="dd-warnline ok" style={{ marginTop: 10 }}><Icon name="undo" size={16} /> {t('fRecovered', { sum: fm2(d.closed_recovered_usd) })}</div>}
    </Card>
    {!d.rows.length ? <Empty>{t('fNoOrders')}</Empty> : <>
      <Card className="only-wide">
        <div className="dd-tw">
          <table>
            <thead><tr><th>{t('colOrder')}</th><th>{t('colDate')}</th><th>{t('fColMode')}</th><th className="r">{t('fColPrice')}</th><th className="r">{t('fColWear')}</th>
              <th className="r">{t('fColShortage')}</th><th className="r">{t('fColTeam')}</th><th className="r">{t('fColOther')}</th><th className="r">{t('fColFixed')}</th>
              <th className="r">{t('fColFull')}</th><th className="r">{t('fColProfit')}</th></tr></thead>
            <tbody>
              {d.rows.map(r => (
                <tr key={r.id} className="dd-rowlink" onClick={() => onOpen(r.id)}>
                  <td><b>{r.no}</b><div className="dd-note">{r.client}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fday(r.event_date, lang)}</td>
                  <td><Chip tone={MODE_TONE[r.mode]}>{t(`modeS_${r.mode}`)}</Chip></td>
                  <td className="r num">{fm(r.price)}</td><td className="r num">{fm2(r.wear)}</td>
                  <td className="r num" style={{ color: r.shortage > 0 ? 'var(--warn)' : undefined }}>{fm2(r.shortage)}{r.shortage_preliminary ? '*' : ''}</td>
                  <td className="r num">{fm2(r.team)}</td><td className="r num">{fm2(other(r))}</td><td className="r num">{fm2(r.fixed)}</td>
                  <td className="r num"><b>{fm2(r.full)}</b></td>
                  <td className="r num" style={{ color: r.profit < 0 ? 'var(--bad)' : 'var(--ok)', fontWeight: 800 }}>{fm2(r.profit)}</td>
                </tr>
              ))}
              <tr className="dd-total"><td colSpan={3}>{t('fTotal')}</td><td className="r num">{fm(d.total.price)}</td><td className="r num">{fm2(d.total.wear)}</td>
                <td className="r num">{fm2(d.total.shortage)}</td><td className="r num">{fm2(d.total.team)}</td>
                <td className="r num">{fm2(d.total.transport + d.total.consumables + d.total.rented + d.total.other)}</td><td className="r num">{fm2(d.total.fixed)}</td>
                <td className="r num">{fm2(d.total.full)}</td><td className="r num">{fm2(d.total.profit)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="dd-note" style={{ marginTop: 8 }}>{t('fCostsNote')}</p>
      </Card>
      <div className="only-narrow">
        <div className="dd-stack">
          {d.rows.map(r => (
            <button key={r.id} type="button" className="dd-card dd-ocard" onClick={() => onOpen(r.id)}>
              <div className="dd-row dd-between" style={{ flexWrap: 'nowrap' }}><b>{r.no} · {r.client}</b><Chip tone={MODE_TONE[r.mode]}>{t(`modeS_${r.mode}`)}</Chip></div>
              <div className="dd-nums"><span>{fday(r.event_date, lang)}</span><span>{t('fColPrice')} <b>{fm(r.price)}</b></span><span>{t('fColFull')} <b>{fm2(r.full)}</b></span></div>
              <div className="dd-nums"><span>{t('fColWear')} <b>{fm2(r.wear)}</b></span><span>{t('fColShortage')} <b>{fm2(r.shortage)}</b></span><span>{t('fColTeam')} <b>{fm2(r.team)}</b></span></div>
              <div className="dd-row dd-between"><span className="dd-note">{t('fColProfit')}</span><b className="num" style={{ color: r.profit < 0 ? 'var(--bad)' : 'var(--ok)' }}>{fm2(r.profit)}</b></div>
            </button>
          ))}
        </div>
        <p className="dd-note" style={{ marginTop: 8 }}>{t('fCostsNote')}</p>
      </div>
    </>}
  </>;
}

// ---------- Деньги ПМ → кассир: долги, очередь («Сдал» с фото чека, «Подтвердить» — касса), история ----------
function MoneyTab({ money, reload, onOpen }) {
  const { t, lang } = useT();
  const { me, can, toast, refreshHints } = useDecor();
  const actions = useActions();
  const busy = !!actions.busy;
  const [hand, setHand] = useState(null);
  const act = async (aid, fn, msg) => {
    try {
      const r = await actions.run(aid, fn);
      if (!r) return null;
      toast(msg); reload(); refreshHints();
      return r;
    } catch (e) { toast(evidenceError(t, e), 'bad'); if (e?.response) reload(); return null; }
  };
  const mineId = me.employee?.id;
  const canHand = p => p.status === 'at_pm' && (p.received_by?.id === mineId || can('confirm_money'));
  const row = (p, queue) => (
    <div key={p.id} className="dd-line">
      <div className="dd-line-head">
        <button type="button" className="dd-linkbtn" onClick={() => onOpen(p.order_id)}><b>{p.no}</b> · {p.client}</button>
        <Chip tone={PS_TONE[p.status]}>{t(`ps_${p.status}`)}</Chip>
      </div>
      <div className="dd-line-head">
        <div className="dd-nums"><span className="num"><b>{fm(p.amount_usd)}</b> · {t(`pk_${p.kind}`)}</span><span>{fday(p.date, lang)}</span>
          <span>{t('colWho')} <b>{p.received_by?.name || t('cashboxName')}</b></span>
          {p.status === 'confirmed' && p.confirmed_at && <span>{t('fConfirmedAt', { date: fts(p.confirmed_at, lang) })}</span>}</div>
        {queue && <div className="dd-line-acts">
          {canHand(p) && <button type="button" className="dd-btn ghost sm" disabled={busy} onClick={() => setHand(p)}><Icon name="camera" size={16} /> {t('handBtn')}</button>}
          {can('confirm_money') && <button type="button" className="dd-btn ok sm" disabled={busy}
            onClick={() => act(`confirm:${p.id}`, cfg => api.post(`/payments/${p.id}/confirm`, {}, cfg), t('confirmedOk', { sum: fm(p.amount_usd) }))}>{t('confirmCash')}</button>}
        </div>}
      </div>
      {p.received_by && p.status !== 'at_pm' && (p.receipt.length ? <div className="dd-thumbs">{p.receipt.map(f => <Thumb key={f.id} f={f} />)}</div> : <div className="dd-note">{t('noReceipt')}</div>)}
    </div>
  );
  return <>
    <Card>
      <h3>{t('fDebtsTitle')}</h3>
      {!money.debts.length ? <div className="dd-empty">{t('fNoDebts')}</div> : (
        <div className="dd-lines" style={{ marginTop: 8 }}>
          {money.debts.map(d => (
            <div key={d.employee.id} className="dd-line"><div className="dd-line-head"><b>{d.employee.name}</b><b className="num" style={{ color: 'var(--warn)' }}>{fm(d.amount_usd)}</b></div></div>
          ))}
        </div>
      )}
      <p className="dd-note" style={{ marginTop: 8 }}>{t('fDebtsNote')}</p>
    </Card>
    <Card>
      <h3>{t('fQueueTitle')}</h3>
      {!money.queue.length ? <div className="dd-empty">{t('fNoQueue')}</div> : <div className="dd-lines" style={{ marginTop: 8 }}>{money.queue.map(p => row(p, true))}</div>}
    </Card>
    <Card>
      <h3>{t('fHistoryTitle')}</h3>
      {!money.payments.length ? <div className="dd-empty">{t('noPayments')}</div> : <div className="dd-lines" style={{ marginTop: 8 }}>{money.payments.slice(0, 40).map(p => row(p, false))}</div>}
    </Card>
    {hand && <EvidenceSheet title={`${t('handBtn')} · ${hand.no} · ${fm(hand.amount_usd)}`} note={t('handNote')} stage="handover" commentPh={t('handCommentPh')}
      busy={busy} actions={actions} aid={`hand:${hand.id}`} onClose={() => setHand(null)}
      send={(files, comment) => act(`hand:${hand.id}`, cfg => api.post(`/payments/${hand.id}/hand`, evForm({ comment }, files), cfg), t('handedOk'))} />}
  </>;
}

// ---------- Касса: формула и движения ----------
function CashTab({ money, fund }) {
  const { t, lang } = useT();
  const { can } = useDecor();
  const [pay] = useLoad(() => (can('pay_team') || can('see_finance') ? api.get('/payroll').then(r => r.data) : Promise.resolve(null)), []);
  const c = money.cash;
  if (!c) return <Empty>{t('fNoCashRight')}</Empty>;
  const moves = [
    ...money.payments.filter(p => p.status === 'confirmed').map(p => ({ k: `p${p.id}`, at: p.confirmed_at || p.date, label: `${p.no} · ${t(`pk_${p.kind}`)}`, who: p.received_by?.name || t('cashboxName'), amount: p.amount_usd })),
    ...(pay?.payouts || []).map((x, i) => ({ k: `w${i}`, at: x.paid_at, label: t('fPayout', { name: x.employee?.name || '—' }), who: x.orders.join(', '), amount: -x.amount_usd })),
    ...(fund?.purchases || []).map(x => ({ k: `f${x.id}`, at: x.date, label: t('fPurchase', { what: x.comment }), who: x.item ? `${x.item.name} × ${x.qty}` : '', amount: -x.amount_usd })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return <>
    <Card>
      <h3>{t('fCashTitle')}</h3>
      <div className="dd-sum-line"><span>{t('fCashIncome')}</span><b className="num">{fm2(c.income)}</b></div>
      <div className="dd-sum-line"><span>− {t('fCashPayroll')}</span><b className="num">{fm2(c.payroll)}</b></div>
      <div className="dd-sum-line"><span>− {t('fCashFund')}</span><b className="num">{fm2(c.fund)}</b></div>
      <div className="dd-sum-line strong hl"><span>{t('fCashTotal')}</span><b className="num" style={{ color: c.cash < 0 ? 'var(--bad)' : undefined }}>{fm2(c.cash)}</b></div>
      <p className="dd-note" style={{ marginTop: 8 }}>{t('fCashNote')}</p>
    </Card>
    <Card>
      <h3>{t('fCashMoves')}</h3>
      {!moves.length ? <div className="dd-empty">{t('fNoMoves')}</div> : (
        <div className="dd-lines" style={{ marginTop: 8 }}>
          {moves.slice(0, 50).map(m => (
            <div key={m.k} className="dd-line">
              <div className="dd-line-head"><b>{m.label}</b><b className="num" style={{ color: m.amount < 0 ? 'var(--bad)' : 'var(--ok)' }}>{m.amount < 0 ? '−' : '+'}{fm2(Math.abs(m.amount))}</b></div>
              <div className="dd-nums"><span>{String(m.at).length > 10 ? fts(m.at, lang) : fday(m.at, lang)}</span>{m.who && <span>{m.who}</span>}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  </>;
}

// ---------- Фонд материалов: накоплено / потрачено / остаток, «Купил декор», история ----------
function FundTab({ fund, reload }) {
  const { t, lang } = useT();
  const { can } = useDecor();
  const [sheet, setSheet] = useState(false);
  return <>
    <Card>
      <div className="dd-row dd-between"><h3>{t('fundTitle')}</h3>
        {can('confirm_money') && <button type="button" className="dd-btn" onClick={() => setSheet(true)}><Icon name="plus" size={16} /> {t('fundBuy')}</button>}</div>
      <p className="dd-note" style={{ marginTop: 4 }}>{t('fundNote')}</p>
      <div className="dd-kpis" style={{ marginTop: 12 }}>
        <div><span>{t('fundAccum')}</span><b className="num">{fm2(fund.accumulated)}</b></div>
        <div><span>{t('fundSpent')}</span><b className="num">{fm2(fund.spent)}</b></div>
        <div><span>{t('fundLeft')}</span><b className="num" style={{ color: fund.remaining < 0 ? 'var(--bad)' : 'var(--ok)' }}>{fm2(fund.remaining)}</b></div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="dd-sum-line"><span>{t('fundWear')}</span><span className="num">{fm2(fund.wear)}</span></div>
        <div className="dd-sum-line"><span>+ {t('fundShortage')}</span><span className="num">{fm2(fund.shortage)}</span></div>
        <div className="dd-sum-line"><span>− {t('fundRecovered')}</span><span className="num">{fm2(fund.recovered)}</span></div>
        <div className="dd-sum-line strong"><span>= {t('fundAccum')}</span><span className="num">{fm2(fund.accumulated)}</span></div>
      </div>
      {fund.remaining < 0 && <div className="dd-warnline bad"><Icon name="alert" size={16} /> {t('fundOverspent', { sum: fm2(-fund.remaining) })}</div>}
    </Card>
    <Card>
      <h3>{t('fundPurchases')}</h3>
      {!fund.purchases.length ? <div className="dd-empty">{t('fundNoPurchases')}</div> : (
        <div className="dd-lines" style={{ marginTop: 8 }}>
          {fund.purchases.map(x => (
            <div key={x.id} className="dd-line">
              <div className="dd-line-head"><b>{x.comment}</b><b className="num" style={{ color: 'var(--bad)' }}>−{fm2(x.amount_usd)}</b></div>
              <div className="dd-nums"><span>{fday(x.date, lang)}</span>
                {x.item && <span>{x.item.name} <b>+{x.qty}</b> {t('pcs')}{x.unit_price_usd !== null ? ` · ${fm2(x.unit_price_usd)}/${t('pcs')}` : ''}</span>}
                {x.new_item && <Chip tone="blue">{t('fundNewItem')}</Chip>}{x.by && <span>{x.by}</span>}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
    <Card>
      <h3>{t('fundOrders')}</h3>
      {!fund.orders.length ? <div className="dd-empty">{t('fundNoOrders')}</div> : (
        <div className="dd-lines" style={{ marginTop: 8 }}>
          {fund.orders.map(o => (
            <div key={o.order_id} className="dd-line">
              <div className="dd-line-head"><b>{o.no} · {o.client}</b><b className="num">{fm2(o.amount)}</b></div>
              <div className="dd-nums"><span>{t('fundWear')} <b>{fm2(o.wear)}</b></span><span>{t('fundShortage')} <b>{fm2(o.shortage)}</b></span>
                {o.recovered > 0 && <span>{t('fundRecovered')} <b>−{fm2(o.recovered)}</b></span>}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
    {sheet && <BuySheet onClose={() => setSheet(false)} onDone={reload} />}
  </>;
}

// «Купил декор»: сумма и что купили; с вещью — склад пополняется (цена — средняя по умолчанию / цена покупки / не менять)
function BuySheet({ onClose, onDone }) {
  const { t } = useT();
  const { toast } = useDecor();
  const actions = useActions();
  const busy = !!actions.busy;
  const [items] = useLoad(() => api.get('/items').then(r => r.data), []);
  const [f, setF] = useState({ kind: 'none', amount: '', comment: '', item_id: '', qty: '', unit: '', mode: 'average', resource: '', name: '' });
  const set = p => { setF({ ...f, ...p }); actions.reset('fundSpend'); };
  const item = items?.find(i => String(i.id) === String(f.item_id));
  const amount = Number(f.amount) || 0; const qty = Number(f.qty) || 0;
  const valid = amount > 0 && f.comment.trim() && (f.kind === 'none' || (qty > 0 && (f.kind === 'item' ? item : f.name.trim() && Number(f.resource) > 0)));
  const body = () => {
    const b = { amount_usd: amount, comment: f.comment.trim() };
    if (f.kind === 'none') return b;
    Object.assign(b, { qty, ...(f.unit !== '' ? { unit_price_usd: Number(f.unit) } : {}), ...(f.resource !== '' ? { resource_orders: Number(f.resource) } : {}) });
    if (f.kind === 'item') Object.assign(b, { item_id: item.id, price_mode: f.mode });
    else b.new_item = { name: f.name.trim() };
    return b;
  };
  const save = async () => {
    try {
      const r = await actions.run('fundSpend', cfg => api.post('/finance/fund/spend', body(), cfg));
      if (!r) return;
      const it = r.data.item;
      toast(it ? t('fundBoughtItem', { name: it.name, qty: it.qty_bought, price: fm2(it.price_usd) }) : t('fundSpentOk', { sum: fm2(amount) }));
      onDone(); onClose();
    } catch (e) { toast(evidenceError(t, e), 'bad'); }
  };
  const unitAuto = qty > 0 && amount > 0 ? Math.round((amount / qty) * 100) / 100 : null;
  return (
    <Sheet title={t('fundBuy')} onClose={onClose} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('cancel')}</button>
      <button type="button" className="dd-btn lg" disabled={busy || !valid} onClick={save}><Icon name="check" size={18} /> {t('saveBtn')}</button>
    </>}>
      <div className="dd-seg" role="radiogroup">
        {[['none', t('fundKindNone')], ['item', t('fundKindItem')], ['new', t('fundKindNew')]].map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={f.kind === k} className={f.kind === k ? 'on' : ''} onClick={() => set({ kind: k })}>{l}</button>
        ))}
      </div>
      <div className="dd-form">
        <div className="dd-field"><label htmlFor="b_amt">{t('fundAmount')}</label><input id="b_amt" className="dd-inp num" inputMode="decimal" value={f.amount} onChange={e => set({ amount: numIn(e.target.value) })} /></div>
        <div className="dd-field"><label htmlFor="b_cm">{t('fundWhat')}</label><input id="b_cm" className="dd-inp" value={f.comment} placeholder={t('fundWhatPh')} onChange={e => set({ comment: e.target.value })} /></div>
      </div>
      {f.kind === 'item' && <>
        <div className="dd-form">
          <div className="dd-field"><label htmlFor="b_it">{t('colItem')}</label>
            <select id="b_it" className="dd-inp" value={f.item_id} onChange={e => set({ item_id: e.target.value })}>
              <option value="">{t('pickItem')}</option>{(items || []).map(i => <option key={i.id} value={i.id}>{i.name} · {i.qty_bought} {t('pcs')}</option>)}
            </select></div>
          <div className="dd-field"><label htmlFor="b_q">{t('fundQty')}</label><input id="b_q" className="dd-inp num" inputMode="numeric" value={f.qty} onChange={e => set({ qty: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="dd-field"><label htmlFor="b_u">{t('fundUnit')}</label><input id="b_u" className="dd-inp num" inputMode="decimal" value={f.unit} placeholder={unitAuto !== null ? String(unitAuto) : ''} onChange={e => set({ unit: numIn(e.target.value) })} /></div>
          <div className="dd-field"><label htmlFor="b_r">{t('fundResource')}</label><input id="b_r" className="dd-inp num" inputMode="numeric" value={f.resource} placeholder={item ? String(item.resource_orders ?? '') : ''} onChange={e => set({ resource: e.target.value.replace(/\D/g, '') })} /></div>
        </div>
        <div className="dd-field"><span className="dd-label">{t('fundPriceMode')}</span>
          <div className="dd-seg" role="radiogroup">
            {[['average', t('pm_average')], ['replace', t('pm_replace')], ['keep', t('pm_keep')]].map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={f.mode === k} className={f.mode === k ? 'on' : ''} onClick={() => set({ mode: k })}>{l}</button>
            ))}
          </div>
          <span className="dd-note">{t(`pmNote_${f.mode}`)}{item && item.price_usd !== undefined ? ` ${t('fundNowPrice', { price: fm2(item.price_usd), qty: item.qty_bought, lost: item.lost || 0, present: item.qty_bought - (item.lost || 0) })}` : ''}</span>
        </div>
        {item && qty > 0 && <div className="dd-warnline ok"><Icon name="box" size={16} /> {t('fundStockAfter', { name: item.name, qty: item.qty_bought + qty })}</div>}
      </>}
      {f.kind === 'new' && <div className="dd-form">
        <div className="dd-field"><label htmlFor="b_n">{t('fundNewName')}</label><input id="b_n" className="dd-inp" value={f.name} onChange={e => set({ name: e.target.value })} /></div>
        <div className="dd-field"><label htmlFor="b_q2">{t('fundQty')}</label><input id="b_q2" className="dd-inp num" inputMode="numeric" value={f.qty} onChange={e => set({ qty: e.target.value.replace(/\D/g, '') })} /></div>
        <div className="dd-field"><label htmlFor="b_u2">{t('fundUnit')}</label><input id="b_u2" className="dd-inp num" inputMode="decimal" value={f.unit} placeholder={unitAuto !== null ? String(unitAuto) : ''} onChange={e => set({ unit: numIn(e.target.value) })} /></div>
        <div className="dd-field"><label htmlFor="b_r2">{t('fundResource')}</label><input id="b_r2" className="dd-inp num" inputMode="numeric" value={f.resource} onChange={e => set({ resource: e.target.value.replace(/\D/g, '') })} /></div>
      </div>}
      <p className="dd-note">{f.kind === 'none' ? t('fundNoneNote') : t('fundItemNote')}</p>
    </Sheet>
  );
}
