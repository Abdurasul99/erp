// Калькулятор дизайна: клиент, дата, тип, команда; вещи с «свободно на весь период заказа» (бронь других заказов +
// не вернувшееся + недостача под вопросом) и подсказкой, почему вещи нет; живой расчёт себестоимости — на сервере
// теми же формулами (POST calc/preview). «Подтвердить» → заказ, бронь, заявка на склад, предоплата в кассу →
// калькулятор очищается. Черновик хранится на этом устройстве, пока заказ не подтверждён.
// /decor/calc?order=<id> — дособрать дизайн лида (тот же номер заказа): черновик заполняется из карточки, order_id идёт в расчёт и в «Подтвердить».
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { errText, store } from '../api.js';
import Icon from '../icons.jsx';
import { useT, fm, fm2, fsum, fday, fperiod, localYmd, addDays } from '../i18n.js';
import { useDecor, useLoad, useActions, Hero, Card, Chip, Stepper, DateInput, ItemPick, numIn } from '../kit.jsx';

const emptyCalc = () => ({ client: '', phone: '', address: '', event_date: addDays(localYmd(), 3), type: 'big', team: [], lines: [], rented: '', price: '', prepay: '' });

// Почему вещи не хватает — по ответу сервера (why): кто держит на самом тесном дне, откуда не вернулась
export function whyText(t, lang, why) {
  if (!why) return '';
  const list = a => a.map(x => `${x.no} (${x.qty})`).join(', ');
  const parts = [];
  if (why.reserved_by.length) parts.push(t('whyBusy', { list: list(why.reserved_by) }));
  if (why.not_returned_from.length) parts.push(t('whyNotBack', { list: list(why.not_returned_from) }));
  if (why.pending_shortage_from.length) parts.push(t('whyPending', { list: list(why.pending_shortage_from) }));
  if (why.lost_closed > 0) parts.push(t('whyLost', { n: why.lost_closed }));
  return `${t('whyDay', { date: fday(why.day, lang) })}: ${parts.join(' · ')}`;
}

export default function Calc() {
  const { t, lang } = useT();
  const { me, can, toast, refreshHints } = useDecor();
  const nav = useNavigate();
  const fin = can('see_finance');
  const KEY = `decor_calc_${me.user.id}`;
  const [C, setC] = useState(() => { try { return { ...emptyCalc(), ...JSON.parse(store.get(KEY) || '{}') }; } catch { return emptyCalc(); } });
  const [pick, setPick] = useState({ item: '', qty: '' });
  // Готовые дизайны со склада (D26): дизайн добавляет все свои вещи разом, недостающее добавляется вещами сверху
  const [designs] = useLoad(() => api.get('/designs').then(r => r.data).catch(() => []), []);
  const [dsel, setDsel] = useState('');
  const qtyRef = useRef(null);   // после выбора вещи — сразу количество
  const [preview, setPreview] = useState(null);
  const [created, setCreated] = useState(null);
  const actions = useActions();                 // ключ повтора для «Подтвердить»: тот же, пока сервер не ответил
  const busy = !!actions.busy;
  const [employees, , reloadEmployees] = useLoad(() => api.get('/employees').then(r => r.data), []);
  // Новый человек прямо из калькулятора — тем, кто заводит сотрудников (раздел «Команда» могут выключить в панели)
  const people = useActions();
  const [np, setNp] = useState(null);           // { name, level } — форма открыта
  const addPerson = async () => {
    const body = { name: np.name.trim(), level: np.level };
    try {
      const r = await people.run(`emp:${body.level}:${body.name}`, cfg => api.post('/employees', body, cfg));
      if (!r) return;
      await reloadEmployees();
      setC(c => ({ ...c, team: [...c.team, r.data.id] }));
      setNp(null); toast(t('personAdded', { name: body.name }));
    } catch (e) { toast(errText(e, t('error')), 'bad'); }
  };
  const [settings] = useLoad(() => (fin ? api.get('/settings').then(r => r.data) : Promise.resolve(null)), [fin]);
  const [avail, , reloadAvail] = useLoad(() => api.get('/availability', { params: { date: C.event_date, ...(C.order_id ? { order_id: C.order_id } : {}) } }).then(r => r.data), [C.event_date, C.order_id]);
  const set = patch => setC(c => ({ ...c, ...patch }));
  const [params, setParams] = useSearchParams();
  const forOrder = Number(params.get('order')) || null;
  useEffect(() => {   // «Собрать в калькуляторе» из карточки лида
    if (!forOrder) return undefined;
    let alive = true;
    api.get(`/orders/${forOrder}`).then(({ data: o }) => {
      if (!alive) return;
      if (!['lead', 'design'].includes(o.status)) toast(t('calcOrderDone', { no: o.no }), 'bad');
      else {
        setC({ ...emptyCalc(), order_id: o.id, order_no: o.no, client: o.client || '', phone: o.phone || '', address: o.address || '',
          event_date: o.event_date, type: o.type, team: o.team.map(x => x.id), lines: o.lines.map(l => ({ item_id: l.item_id, qty: l.qty })),
          rented: o.extras?.rented_decor_usd ? String(o.extras.rented_decor_usd) : '', price: o.price_usd ? String(o.price_usd) : '' });
        setCreated(null);
      }
      setParams({}, { replace: true });
    }).catch(e => { if (alive) { toast(errText(e, t('error')), 'bad'); setParams({}, { replace: true }); } });
    return () => { alive = false; };
  }, [forOrder]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { store.set(KEY, JSON.stringify(C)); }, [C, KEY]);
  useEffect(() => { actions.reset('confirm'); }, [C, actions.reset]);   // данные заказа изменились — новое действие, новый ключ

  // Живой расчёт: через 300 мс после изменения
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    const h = setTimeout(() => {
      api.post('/calc/preview', { order_id: C.order_id || undefined, event_date: C.event_date, type: C.type, team: C.team, lines: C.lines, rented_decor_usd: Number(C.rented) || 0, price_usd: Number(C.price) || 0 })
        .then(r => { if (n === seq.current) setPreview(r.data); }).catch(() => {});
    }, 300);
    return () => clearTimeout(h);
  }, [C.order_id, C.event_date, C.type, C.team, C.lines, C.rented, C.price]);

  const team = useMemo(() => (employees || []).filter(e => e.is_active && ['pm', 'trainee'].includes(e.level)), [employees]);
  const pv = preview?.lines ? new Map(preview.lines.map(l => [l.item_id, l])) : new Map();
  const period = preview?.period || { from: C.event_date, to: addDays(C.event_date, me.days_on_site ?? 1) };
  const cost = preview?.cost;
  const price = Number(C.price) || 0;
  const items = avail?.items || [];
  const itemName = id => items.find(i => i.id === id)?.name || pv.get(id)?.item || `#${id}`;

  const addLine = () => {
    const id = Number(pick.item); const q = Number(pick.qty);
    if (!id || !(q > 0)) return;
    const ex = C.lines.find(l => l.item_id === id);
    set({ lines: ex ? C.lines.map(l => (l.item_id === id ? { ...l, qty: l.qty + q } : l)) : [...C.lines, { item_id: id, qty: q }] });
    setPick({ item: '', qty: '' });
  };
  const addDesign = () => {
    const d = (designs || []).find(x => String(x.id) === String(dsel));
    if (!d) return;
    const avail = new Map(items.map(i => [i.id, i]));
    const take = d.lines.filter(l => l.item_active && avail.has(l.item_id));
    const merged = take.reduce((acc, l) => {
      const ex = acc.find(x => x.item_id === l.item_id);
      return ex ? acc.map(x => (x.item_id === l.item_id ? { ...x, qty: (Number(x.qty) || 0) + l.qty } : x)) : [...acc, { item_id: l.item_id, qty: l.qty }];
    }, C.lines);
    set({ lines: merged });
    setDsel('');
    // Чего не хватает на даты заказа — сразу словами; строки с нехваткой калькулятор подсветит сам
    const short = merged.filter(l => take.some(x => x.item_id === l.item_id) && Number(l.qty) > (avail.get(l.item_id)?.free ?? 0))
      .map(l => avail.get(l.item_id)?.name).filter(Boolean);
    const skipped = d.lines.length - take.length;
    toast([t('designAdded', { name: d.name, n: take.length }), skipped ? t('designSkipped', { n: skipped }) : '',
      short.length ? t('designShort', { items: short.join(', ') }) : ''].filter(Boolean).join(' · '), short.length ? 'bad' : undefined);
  };
  const setLineQty = (id, q) => set({ lines: C.lines.map(l => (l.item_id === id ? { ...l, qty: q === '' ? '' : Math.max(1, Number(q)) } : l)) });
  const cleanLines = C.lines.filter(l => Number(l.qty) > 0).map(l => ({ item_id: l.item_id, qty: Number(l.qty) }));
  const missing = !C.client.trim() ? t('needClient') : !cleanLines.length ? t('needLines') : !(price > 0) ? t('needPrice') : null;
  const canCreate = can('create_order');

  const confirm = async () => {
    try {
      const r = await actions.run('confirm', cfg => api.post('/calc/confirm', { order_id: C.order_id || undefined, client: C.client, phone: C.phone, address: C.address, event_date: C.event_date, type: C.type, team: C.team,
        lines: cleanLines, rented_decor_usd: Number(C.rented) || 0, price_usd: price, prepay_usd: Number(C.prepay) || 0 }, cfg));
      if (!r) return;
      const { data } = r;
      const o = data.order;
      setCreated({ id: o.id, no: o.no, client: o.client, period: o.period });
      setC(emptyCalc()); store.del(KEY); setPreview(null);
      toast(t('created', { no: o.no }));
      reloadAvail(); refreshHints();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast(e?.response ? errText(e, t('error')) : t('noAnswer'), 'bad'); }
  };

  const stats = [[C.lines.length, t('cStatLines')]];
  if (fin && cost) stats.push([fm(cost.full), t('cStatFull')], [price ? fm(cost.profit) : '—', t('cStatProfit')]);
  else stats.push([fperiod(period, lang), t('cStatPeriod')]);

  const statusChip = l => (l.short > 0 ? <Chip tone="bad">{t('shortN', { n: l.short })}</Chip> : <Chip tone="ok">{t('have')}</Chip>);

  return (
    <>
      <Hero id="calc" stats={stats} />
      {created && (
        <Card className="flat" style={{ borderColor: '#BFE8D3', background: 'var(--okbg)' }}>
          <div className="dd-row dd-between">
            <div><h3 style={{ color: 'var(--ok)' }}>✓ {t('createdCard', { no: created.no })}</h3>
              <div className="dd-sub">{t('createdLine', { client: created.client, period: fperiod(created.period, lang) })}</div></div>
            <div className="dd-row">
              <button type="button" className="dd-btn ok" onClick={() => nav(`/decor/warehouse?tab=requests&order=${created.id}`)}>{t('toRequest')} →</button>
              <button type="button" className="dd-btn ghost" onClick={() => setCreated(null)}>{t('newCalc')}</button>
            </div>
          </div>
        </Card>
      )}
      {C.order_id && (
        <Card className="flat" style={{ borderColor: '#C9D7FF', background: 'var(--bluebg)' }}>
          <div className="dd-row dd-between">
            <div><h3>{t('calcForOrder', { no: C.order_no, client: C.client || '—' })}</h3><div className="dd-sub">{t('calcForOrderNote')}</div></div>
            <div className="dd-row">
              <button type="button" className="dd-btn ghost" onClick={() => nav(`/decor/orders?open=${C.order_id}`)}>{t('card')}</button>
              <button type="button" className="dd-btn ghost" onClick={() => setC(emptyCalc())}>{t('newCalc')}</button>
            </div>
          </div>
        </Card>
      )}
      <div className="dd-grid dd-g2" style={{ alignItems: 'start' }}>
        <div className="dd-grid">
          <Card>
            <h3>{t('clientDate')}</h3>
            <div className="dd-form" style={{ marginTop: 12 }}>
              <div className="dd-field"><label htmlFor="c_client">{t('client')}</label><input id="c_client" className="dd-inp" value={C.client} placeholder={t('clientPh')} onChange={e => set({ client: e.target.value })} /></div>
              <div className="dd-field"><label htmlFor="c_phone">{t('phone')}</label><input id="c_phone" className="dd-inp" inputMode="tel" value={C.phone} placeholder="+998" onChange={e => set({ phone: e.target.value })} /></div>
              <div className="dd-field"><label htmlFor="c_addr">{t('address')}</label><input id="c_addr" className="dd-inp" value={C.address} onChange={e => set({ address: e.target.value })} /></div>
              <div className="dd-field"><label htmlFor="c_date">{t('date')}</label><DateInput id="c_date" value={C.event_date} onChange={v => set({ event_date: v })} /></div>
              <div className="dd-field"><label htmlFor="c_type">{t('type')}</label>
                <select id="c_type" className="dd-inp" value={C.type} onChange={e => set({ type: e.target.value })}><option value="big">{t('big')}</option><option value="small">{t('small')}</option></select></div>
            </div>
            <div className="dd-field" style={{ marginTop: 12 }}><span className="dd-label">{t('team')}</span>
              <div className="dd-teampick">
                {team.map(e => (
                  <button key={e.id} type="button" className={C.team.includes(e.id) ? 'on' : ''} aria-pressed={C.team.includes(e.id)}
                    onClick={() => set({ team: C.team.includes(e.id) ? C.team.filter(x => x !== e.id) : [...C.team, e.id] })}>
                    {e.name}<small>{t(`l_${e.level}`)}</small></button>
                ))}
                {can('edit_settings') && !np && <button type="button" className="add" onClick={() => setNp({ name: '', level: 'trainee' })}>＋ {t('personNew')}</button>}
              </div>
              {np && (
                <div className="dd-row dd-newperson">
                  <input className="dd-inp" autoFocus value={np.name} maxLength={120} placeholder={t('personName')} aria-label={t('personName')}
                    onChange={e => setNp({ ...np, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && np.name.trim() && addPerson()} />
                  <select className="dd-inp" value={np.level} aria-label={t('personLevel')} onChange={e => setNp({ ...np, level: e.target.value })}>
                    <option value="trainee">{t('l_trainee')}</option><option value="pm">{t('l_pm')}</option>
                  </select>
                  <button type="button" className="dd-btn sm" disabled={!np.name.trim() || !!people.busy} onClick={addPerson}>{t('personAdd')}</button>
                  <button type="button" className="dd-btn ghost sm" onClick={() => setNp(null)}>{t('cancel')}</button>
                </div>
              )}
              {!C.team.length && <span className="dd-note">{t('teamNone')}</span>}
            </div>
          </Card>

          <Card>
            <div className="dd-row dd-between"><h3>{t('designItems')}</h3><Chip tone="blue">{t('period', { from: fdd2(period.from), to: fdd2(period.to) })}</Chip></div>
            <p className="dd-note" style={{ marginTop: 4 }}>{t('freeHint', { period: fperiod(period, lang) })}</p>
            {designs?.length > 0 && (
              <div className="dd-row dd-designpick">
                <div style={{ flex: '2 1 220px', minWidth: 0 }}>
                  <ItemPick id="c_design" items={designs.map(d => ({ id: d.id, name: d.name, note: t('designPieces', { n: d.lines.length, pcs: d.pieces }) }))}
                    value={dsel} placeholder={t('pickDesign')} onChange={v => setDsel(v === '' ? '' : String(v))} />
                </div>
                <button type="button" className="dd-btn ghost" disabled={!dsel} onClick={addDesign}><Icon name="plus" size={16} /> {t('addDesign')}</button>
              </div>
            )}
            <div className="dd-row" style={{ margin: '12px 0' }}>
              <div style={{ flex: '2 1 220px', minWidth: 0 }}>
                <ItemPick id="c_pick" items={items.map(it => ({ id: it.id, name: it.name, note: it.free > 0 ? t('freeOpt', { n: it.free }) : t('freeNone'), tone: it.free > 0 ? '' : 'bad' }))}
                  value={pick.item} placeholder={t('pickItem')} onChange={v => { setPick({ ...pick, item: v === '' ? '' : String(v) }); if (v !== '') qtyRef.current?.focus(); }} />
              </div>
              <input ref={qtyRef} className="dd-inp" style={{ flex: '1 1 80px' }} inputMode="numeric" placeholder={t('qty')} value={pick.qty}
                onChange={e => setPick({ ...pick, qty: e.target.value.replace(/\D/g, '') })} onKeyDown={e => e.key === 'Enter' && addLine()} aria-label={t('qty')} />
              <button type="button" className="dd-btn" onClick={addLine} disabled={!pick.item || !(Number(pick.qty) > 0)}><Icon name="plus" size={16} /> {t('add')}</button>
            </div>
            {!C.lines.length ? <div className="dd-empty">{t('noLines')}</div> : <>
              <div className="dd-tw only-wide">
                <table>
                  <thead><tr><th>{t('colItem')}</th><th className="r">{t('colQty')}</th><th className="r">{t('colFree')}</th>
                    {fin && <><th className="r">{t('colWearPer')}</th><th className="r">{t('colWear')}</th></>}<th /><th /></tr></thead>
                  <tbody>{C.lines.map(l => {
                    const p = pv.get(l.item_id) || {};
                    return (
                      <React.Fragment key={l.item_id}>
                        <tr>
                          <td><b>{itemName(l.item_id)}</b></td>
                          <td className="r"><input className="dd-inp r num" style={{ width: 90 }} inputMode="numeric" value={l.qty} onChange={e => setLineQty(l.item_id, e.target.value.replace(/\D/g, ''))} aria-label={itemName(l.item_id)} /></td>
                          <td className="r num" style={{ color: p.short > 0 ? 'var(--bad)' : undefined }}>{p.free ?? '·'}</td>
                          {fin && <><td className="r num">{p.wear_per_order_usd !== undefined ? fm2(p.wear_per_order_usd) : '·'}</td><td className="r num">{p.wear_usd !== undefined ? fm2(p.wear_usd) : '·'}</td></>}
                          <td>{p.free !== undefined && statusChip(p)}</td>
                          <td className="r"><button type="button" className="dd-btn ghost sm" onClick={() => set({ lines: C.lines.filter(x => x.item_id !== l.item_id) })} aria-label={t('remove')}><Icon name="x" size={14} /></button></td>
                        </tr>
                        {p.short > 0 && <tr><td className="why" colSpan={fin ? 7 : 5}>{whyText(t, lang, p.why)}</td></tr>}
                      </React.Fragment>
                    );
                  })}</tbody>
                </table>
              </div>
              <div className="only-narrow">
                <div className="dd-lines">
                  {C.lines.map(l => {
                    const p = pv.get(l.item_id) || {};
                    return (
                      <div key={l.item_id} className="dd-line">
                        <div className="dd-line-head"><b>{itemName(l.item_id)}</b>{p.free !== undefined && statusChip(p)}</div>
                        <div className="dd-line-head">
                          <div className="dd-nums"><span>{t('colFree')} <b style={{ color: p.short > 0 ? 'var(--bad)' : undefined }}>{p.free ?? '·'}</b></span>
                            {fin && p.wear_usd !== undefined && <span>{t('colWear')} <b>{fm2(p.wear_usd)}</b></span>}</div>
                          <div className="dd-row" style={{ flexWrap: 'nowrap' }}>
                            <Stepper value={l.qty} onChange={v => setLineQty(l.item_id, v)} min={1} label={itemName(l.item_id)} />
                            <button type="button" className="dd-btn ghost sm" onClick={() => set({ lines: C.lines.filter(x => x.item_id !== l.item_id) })} aria-label={t('remove')}><Icon name="x" size={16} /></button>
                          </div>
                        </div>
                        {p.short > 0 && <div className="dd-note" style={{ color: 'var(--bad)', fontWeight: 600 }}>{whyText(t, lang, p.why)}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>}
          </Card>
        </div>

        <Card style={{ position: 'sticky', top: 84 }}>
          <h3>{fin ? t('costTitle') : t('priceTitle')}</h3>
          {fin && cost && (
            <div style={{ marginTop: 10 }}>
              <div className="dd-sum-line"><span>{t('cWear')}</span><b className="num">{fm2(cost.wear)}</b></div>
              <div className="dd-sum-line"><span>{t('cTeam')}{C.team.length ? ` · ${team.filter(e => C.team.includes(e.id)).map(e => e.name).join(' + ')}` : ''}</span><b className="num">{fm2(cost.team)}</b></div>
              <div className="dd-sum-line"><span>{t('cTransport')}</span><b className="num">{fm2(cost.transport)}</b></div>
              <div className="dd-sum-line"><span>{t('cCons', { sum: fsum(cost.consumables * cost.rate_uzs, lang) })}</span><b className="num">{fm2(cost.consumables)}</b></div>
              <div className="dd-sum-line"><label htmlFor="c_rent">{t('cRented')}</label>
                <input id="c_rent" className="dd-inp r num" inputMode="decimal" value={C.rented} onChange={e => set({ rented: numIn(e.target.value) })} /></div>
              <div className="dd-sum-line strong"><span>{t('cDirect')}</span><span className="num">{fm2(cost.direct)}</span></div>
              <div className="dd-sum-line"><span>{t('cFixed', { n: settings?.expected_orders ?? '…' })}</span><b className="num">{fm2(cost.fixed)}</b></div>
              <div className="dd-sum-line strong hl"><span>{t('cFull')}</span><span className="num">{fm2(cost.full)}</span></div>
            </div>
          )}
          <div className="dd-form" style={{ marginTop: 14 }}>
            <div className="dd-field"><label htmlFor="c_price">{t('priceUsd')}</label><input id="c_price" className="dd-inp num" inputMode="decimal" value={C.price} onChange={e => set({ price: numIn(e.target.value) })} /></div>
            <div className="dd-field"><label htmlFor="c_pre">{t('prepayUsd')}</label><input id="c_pre" className="dd-inp num" inputMode="decimal" value={C.prepay} disabled={!can('confirm_money')} onChange={e => set({ prepay: numIn(e.target.value) })} /></div>
          </div>
          {!can('confirm_money') && <p className="dd-note" style={{ marginTop: 6 }}>{t('prepayCashOnly')}</p>}
          {fin && cost && price > 0 && (
            <div className="dd-sum-line strong" style={{ marginTop: 10 }}><span>{t('profit')}</span><span className="num" style={{ color: cost.profit < 0 ? 'var(--bad)' : 'var(--ok)' }}>{fm2(cost.profit)}</span></div>
          )}
          {preview?.below_cost && price > 0 && <div className="dd-warnline bad"><Icon name="alert" size={16} /> {t('belowCost')}</div>}
          {preview?.any_short && <div className="dd-warnline warn"><Icon name="alert" size={16} /> {t('anyShort')}</div>}
          <div className="dd-row" style={{ marginTop: 16 }}>
            <button type="button" className="dd-btn lg" style={{ flex: 1 }} disabled={!canCreate || !!missing || busy} onClick={confirm} title={missing || ''}><Icon name="check" size={18} /> {t('confirmBtn')}</button>
            <button type="button" className="dd-btn ghost lg" onClick={() => { setC(emptyCalc()); store.del(KEY); }}>{t('clearBtn')}</button>
          </div>
          {missing && canCreate && <p className="dd-note" style={{ marginTop: 8 }}>{missing}</p>}
          <p className="dd-note" style={{ marginTop: 8 }}>{t('confirmNote')}{canCreate ? '' : ` ${t('noCreateRight')}`}</p>
        </Card>
      </div>
    </>
  );
}

const fdd2 = ymd => (ymd ? `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}` : '—');
