// Склад → «Декор и износ»: остатки по вещам; цена и ресурс (износ за 1 заказ = цена ÷ ресурс) — тем, кто видит деньги;
// менять их и добавлять вещи может тот, у кого «менять настройки». Компьютер — таблица, телефон — карточки.
import React, { useState } from 'react';
import api, { errText } from '../api.js';
import Icon from '../icons.jsx';
import { useT, fm2 } from '../i18n.js';
import { useDecor, useActions, Card, Chip, Sheet, numIn } from '../kit.jsx';

export function StockTab({ items, reload }) {
  const { t } = useT();
  const { can, toast } = useDecor();
  const edit = can('edit_settings');
  const money = items.some(i => i.price_usd !== undefined);
  const [sheet, setSheet] = useState(null);
  const actions = useActions();   // правка вещи — с ключом повторной отправки
  const save = async (id, patch, name) => {
    try { const r = await actions.run(`item:${id}:${Object.keys(patch).join(',')}:${Object.values(patch).join(',')}`, cfg => api.put(`/items/${id}`, patch, cfg)); if (r) toast(t('itemSaved', { name })); reload(); }
    catch (e) { toast(e?.response ? errText(e, t('error')) : t('noAnswer'), 'bad'); reload(); }
  };
  const cell = (it, key, step) => (edit
    ? <input className="dd-inp r num" style={{ width: 96 }} inputMode="decimal" defaultValue={it[key]} key={`${it.id}:${it[key]}`} step={step}
      onBlur={e => { const v = numIn(e.target.value); if (v !== '' && Number(v) !== it[key]) save(it.id, { [key]: Number(v) }, it.name); }}
      onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} aria-label={`${it.name}: ${key}`} />
    : <span className="num">{key === 'price_usd' ? fm2(it[key]) : it[key]}</span>);
  return (
    <Card>
      <div className="dd-row dd-between"><h3>{t('stockTitle')}</h3>
        {edit && <button type="button" className="dd-btn sm" onClick={() => setSheet({ name: '', qty_bought: '', price_usd: '', resource_orders: '' })}><Icon name="plus" size={14} /> {t('addItem')}</button>}</div>
      <div className="dd-tw only-wide" style={{ marginTop: 8 }}>
        <table>
          <thead><tr>
            <th>{t('itemName')}</th><th className="r">{t('bought')}</th>
            {money && <><th className="r">{t('price')}</th><th className="r">{t('resource')}</th><th className="r">{t('wearPer')}</th></>}
            <th className="r">{t('inWarehouse')}</th><th className="r">{t('onSites')}</th><th className="r">{t('pending')}</th><th className="r">{t('lostClosed')}</th><th className="r">{t('freeToday')}</th>
          </tr></thead>
          <tbody>{items.map(it => (
            <tr key={it.id}>
              <td><b>{it.name}</b></td>
              <td className="r">{edit ? cell(it, 'qty_bought') : <span className="num">{it.qty_bought}</span>}</td>
              {money && <><td className="r">{cell(it, 'price_usd', '0.01')}</td><td className="r">{cell(it, 'resource_orders')}</td>
                <td className="r num"><b>{fm2(it.wear_per_order_usd)}</b></td></>}
              <td className="r num">{it.in_warehouse}</td>
              <td className="r num">{it.on_site || '·'}</td>
              <td className="r num" style={{ color: it.shortage_pending ? 'var(--warn)' : undefined }}>{it.shortage_pending || '·'}</td>
              <td className="r num" style={{ color: it.lost ? 'var(--bad)' : undefined }}>{it.lost || '·'}</td>
              <td className="r num" style={{ color: it.free_today < 0 ? 'var(--bad)' : undefined }}><b>{it.free_today}</b></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="only-narrow">
        <div className="dd-lines">
          {items.map(it => (
            <button key={it.id} type="button" className="dd-line" style={{ textAlign: 'left', cursor: edit ? 'pointer' : 'default' }}
              onClick={() => edit && setSheet({ id: it.id, name: it.name, qty_bought: it.qty_bought, price_usd: it.price_usd, resource_orders: it.resource_orders })}>
              <div className="dd-line-head"><b>{it.name}</b><Chip tone={it.free_today < 0 ? 'bad' : 'blue'}>{t('freeToday')} {it.free_today}</Chip></div>
              <div className="dd-nums">
                <span>{t('bought')} <b>{it.qty_bought}</b></span><span>{t('inWarehouse')} <b>{it.in_warehouse}</b></span>
                {it.on_site > 0 && <span>{t('onSites')} <b>{it.on_site}</b></span>}
                {it.shortage_pending > 0 && <span style={{ color: 'var(--warn)' }}>{t('pending')} <b>{it.shortage_pending}</b></span>}
                {it.lost > 0 && <span style={{ color: 'var(--bad)' }}>{t('lostClosed')} <b>{it.lost}</b></span>}
              </div>
              {money && <div className="dd-nums"><span>{t('price')} <b>{fm2(it.price_usd)}</b></span><span>{t('resource')} <b>{it.resource_orders}</b></span><span>{t('wearPer')} <b>{fm2(it.wear_per_order_usd)}</b></span></div>}
            </button>
          ))}
        </div>
      </div>
      <p className="dd-note" style={{ marginTop: 12 }}>{t('stockNote')}</p>
      {sheet && <ItemSheet s={sheet} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); reload(); }} />}
    </Card>
  );
}

function ItemSheet({ s, onClose, onSaved }) {
  const { t } = useT();
  const { toast } = useDecor();
  const [f, setF] = useState(s);
  const actions = useActions();   // добавление и правка вещи — с ключом повторной отправки
  const busy = !!actions.busy;
  const submit = async () => {
    const body = { name: f.name, qty_bought: Number(f.qty_bought) || 0, price_usd: Number(f.price_usd) || 0, resource_orders: Number(f.resource_orders) || 1 };
    try {
      const r = await actions.run('itemSheet', cfg => (s.id ? api.put(`/items/${s.id}`, body, cfg) : api.post('/items', body, cfg)));
      if (r) { toast(t('itemSaved', { name: f.name })); onSaved(); }
    } catch (e) { toast(e?.response ? errText(e, t('error')) : t('noAnswer'), 'bad'); }
  };
  const field = (key, label, mode = 'decimal') => (
    <div className="dd-field"><label htmlFor={`it_${key}`}>{label}</label>
      <input id={`it_${key}`} className="dd-inp" inputMode={mode} value={f[key]} onChange={e => { setF({ ...f, [key]: mode === 'text' ? e.target.value : numIn(e.target.value) }); actions.reset('itemSheet'); }} /></div>
  );
  return (
    <Sheet title={s.id ? s.name : t('newItem')} onClose={onClose} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('cancel')}</button>
      <button type="button" className="dd-btn lg" disabled={busy || !String(f.name).trim()} onClick={submit}><Icon name="check" size={18} /> {t('confirm')}</button>
    </>}>
      {field('name', t('itemName'), 'text')}
      <div className="dd-form">{field('qty_bought', t('bought'), 'numeric')}{field('price_usd', t('price'))}{field('resource_orders', t('resource'), 'numeric')}</div>
      {Number(f.resource_orders) > 0 && <div className="dd-sum-line strong"><span>{t('wearPer')}</span><span className="num">{fm2((Number(f.price_usd) || 0) / Number(f.resource_orders))}</span></div>}
    </Sheet>
  );
}
