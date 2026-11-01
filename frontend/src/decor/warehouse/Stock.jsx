// Склад → «Декор и износ»: вещи с поиском, фильтрами, сортировкой и архивом. Цена и ресурс (износ за 1 заказ = цена ÷ ресурс) —
// тем, кто видит деньги, менять их — «менять настройки». «Куплено» меняется только операциями склада с причиной: приход,
// списание, инвентаризация (журнал D25). Заводить вещи, переименовывать, убирать в архив — «вести склад».
// Компьютер — таблица, телефон — карточки; окно вещи (правка, операции, история) — одно на обоих.
import React, { useCallback, useEffect, useState } from 'react';
import api, { errText } from '../api.js';
import Icon from '../icons.jsx';
import { useT, fm2, fts } from '../i18n.js';
import { useDecor, useActions, useLoad, Card, Chip, Sheet, Stepper, Loading, numIn } from '../kit.jsx';

// Фильтры по активным вещам; «Архив» — только выключенные
const FILTERS = [
  ['all', 'fAll', () => true],
  ['onsite', 'fOnSite', it => it.on_site > 0],
  ['problem', 'fProblem', it => it.shortage_pending > 0 || it.lost > 0 || it.free_today < 0],
  ['empty', 'fEmpty', it => it.in_warehouse <= 0],
  ['archive', 'fArchive', null],
];
const SORTS = {
  order: (a, b) => a.sort_order - b.sort_order || a.id - b.id,
  name: (a, b) => a.name.localeCompare(b.name, 'ru'),
  wh: (a, b) => b.in_warehouse - a.in_warehouse || a.name.localeCompare(b.name, 'ru'),
  free: (a, b) => a.free_today - b.free_today || a.name.localeCompare(b.name, 'ru'),
};
const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const errMsg = (t, e) => (e?.response ? errText(e, t('error')) : t('noAnswer'));

export function StockTab({ items, reload }) {
  const { t } = useT();
  const { can, toast } = useDecor();
  const manage = can('manage_items') || can('edit_settings');
  const priceEdit = can('edit_settings');
  const money = items.some(i => i.price_usd !== undefined);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('order');
  const [sheet, setSheet] = useState(null);      // { id } — окно вещи, { new: true } — новая вещь
  const [journal, setJournal] = useState(false);
  const actions = useActions();   // правка цены и ресурса прямо в таблице — с ключом повторной отправки
  const save = async (id, patch, name) => {
    try { const r = await actions.run(`item:${id}:${Object.keys(patch).join(',')}:${Object.values(patch).join(',')}`, cfg => api.put(`/items/${id}`, patch, cfg)); if (r) toast(t('itemSaved', { name })); reload(); }
    catch (e) { toast(errMsg(t, e), 'bad'); reload(); }
  };
  const cell = (it, key, step) => (priceEdit && it.is_active
    ? <input className="dd-inp r num" style={{ width: 96 }} inputMode="decimal" defaultValue={it[key]} key={`${it.id}:${it[key]}`} step={step}
      onBlur={e => { const v = numIn(e.target.value); if (v !== '' && Number(v) !== it[key]) save(it.id, { [key]: Number(v) }, it.name); }}
      onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} aria-label={`${it.name}: ${key}`} />
    : <span className="num">{key === 'price_usd' ? fm2(it[key]) : it[key]}</span>);

  const active = items.filter(i => i.is_active);
  const pool = key => (key === 'archive' ? items.filter(i => !i.is_active) : active.filter(FILTERS.find(f => f[0] === key)[2]));
  const needle = query.trim().toLowerCase();
  const list = pool(filter).filter(i => !needle || i.name.toLowerCase().includes(needle)).sort(SORTS[sort]);
  const open = sheet?.id ? items.find(i => i.id === sheet.id) : null;
  const openItem = it => setSheet({ id: it.id });

  return (
    <Card>
      <div className="dd-row dd-between"><h3>{t('stockTitle')}</h3>
        <div className="dd-row" style={{ gap: 8 }}>
          <button type="button" className="dd-btn ghost sm" onClick={() => setJournal(true)}><Icon name="undo" size={14} /> {t('journalBtn')}</button>
          {manage && <button type="button" className="dd-btn sm" onClick={() => setSheet({ new: true })}><Icon name="plus" size={14} /> {t('addItem')}</button>}
        </div>
      </div>
      <div className="dd-stockbar">
        <div className="dd-search"><Icon name="search" size={16} />
          <input className="dd-inp" value={query} placeholder={t('searchItem')} aria-label={t('searchItem')} onChange={e => setQuery(e.target.value)} />
          {query && <button type="button" className="dd-search-x" onClick={() => setQuery('')} aria-label={t('close')}><Icon name="x" size={14} /></button>}
        </div>
        <select className="dd-inp dd-sortsel" value={sort} onChange={e => setSort(e.target.value)} aria-label={t('sortLabel')}>
          {Object.keys(SORTS).map(k => <option key={k} value={k}>{t(`sort_${k}`)}</option>)}
        </select>
      </div>
      <div className="dd-statuspick" role="tablist" style={{ marginTop: 10 }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {t(label)}<span>{pool(k).length}</span></button>
        ))}
      </div>
      <p className="dd-note" style={{ marginTop: 8 }}>{t('shownOf', { n: list.length, total: pool(filter).length })}</p>

      {!list.length ? <div className="dd-empty">{t('noItemsFound')}</div> : <>
        <div className="dd-tw only-wide" style={{ marginTop: 4 }}>
          <table>
            <thead><tr>
              <th>{t('itemName')}</th><th className="r">{t('bought')}</th>
              {money && <><th className="r">{t('price')}</th><th className="r">{t('resource')}</th><th className="r">{t('wearPer')}</th></>}
              <th className="r">{t('inWarehouse')}</th><th className="r">{t('onSites')}</th><th className="r">{t('pending')}</th><th className="r">{t('lostClosed')}</th><th className="r">{t('freeToday')}</th>
            </tr></thead>
            <tbody>{list.map(it => (
              <tr key={it.id}>
                <td><button type="button" className="dd-linkbtn" onClick={() => openItem(it)}><b>{it.name}</b></button>
                  {!it.is_active && <> <Chip tone="gray">{t('archivedChip')}</Chip></>}</td>
                <td className="r num">{it.qty_bought}</td>
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
            {list.map(it => (
              <button key={it.id} type="button" className="dd-line dd-line-btn" onClick={() => openItem(it)}>
                <div className="dd-line-head"><b>{it.name}</b>
                  {it.is_active ? <Chip tone={it.free_today < 0 ? 'bad' : 'blue'}>{t('freeToday')} {it.free_today}</Chip> : <Chip tone="gray">{t('archivedChip')}</Chip>}</div>
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
      </>}
      <p className="dd-note" style={{ marginTop: 12 }}>{t('stockNote')}</p>
      {sheet?.new && <NewItemSheet onClose={() => setSheet(null)} onSaved={it => { reload(); setSheet(it ? { id: it.id } : null); }} />}
      {open && <ItemSheet key={open.id} it={open} onClose={() => setSheet(null)} onChanged={reload} />}
      {journal && <JournalSheet onClose={() => setJournal(false)} onOpen={id => { setJournal(false); setSheet({ id }); }} />}
    </Card>
  );
}

// Новая вещь: название и сколько есть сейчас (первая строка журнала); цена и ресурс — у «менять настройки»
function NewItemSheet({ onClose, onSaved }) {
  const { t } = useT();
  const { can, toast } = useDecor();
  const priceEdit = can('edit_settings');
  const [f, setF] = useState({ name: '', qty_bought: '', price_usd: '', resource_orders: '' });
  const actions = useActions();
  const set = p => { setF({ ...f, ...p }); actions.reset('newItem'); };
  const submit = async () => {
    const body = { name: f.name.trim(), qty_bought: Number(f.qty_bought) || 0,
      ...(priceEdit ? { price_usd: Number(f.price_usd) || 0, resource_orders: Number(f.resource_orders) || 1 } : {}) };
    try {
      const r = await actions.run('newItem', cfg => api.post('/items', body, cfg));
      if (r) { toast(t('itemSaved', { name: body.name })); onSaved(r.data); }
    } catch (e) { toast(errMsg(t, e), 'bad'); }
  };
  const num = (key, label, mode) => (
    <div className="dd-field"><label htmlFor={`ni_${key}`}>{label}</label>
      <input id={`ni_${key}`} className="dd-inp num" inputMode={mode} value={f[key]}
        onChange={e => set({ [key]: mode === 'numeric' ? e.target.value.replace(/\D/g, '') : numIn(e.target.value) })} /></div>
  );
  return (
    <Sheet title={t('newItem')} onClose={onClose} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('cancel')}</button>
      <button type="button" className="dd-btn lg" disabled={!!actions.busy || !f.name.trim()} onClick={submit}><Icon name="check" size={18} /> {t('confirm')}</button>
    </>}>
      <div className="dd-field"><label htmlFor="ni_name">{t('itemName')}</label>
        <input id="ni_name" className="dd-inp" value={f.name} autoFocus onChange={e => set({ name: e.target.value })} /></div>
      <div className="dd-form">
        {num('qty_bought', t('openingQty'), 'numeric')}
        {priceEdit && <>{num('price_usd', t('price'), 'decimal')}{num('resource_orders', t('resource'), 'numeric')}</>}
      </div>
      {priceEdit && Number(f.resource_orders) > 0 && <div className="dd-sum-line strong"><span>{t('wearPer')}</span><span className="num">{fm2((Number(f.price_usd) || 0) / Number(f.resource_orders))}</span></div>}
      <p className="dd-note">{t('openingNote')}</p>
    </Sheet>
  );
}

// Окно вещи: название (и цена с ресурсом), итоги, операции склада, архив, история
function ItemSheet({ it, onClose, onChanged }) {
  const { t } = useT();
  const { can, toast } = useDecor();
  const manage = can('manage_items') || can('edit_settings');
  const priceEdit = can('edit_settings') && it.price_usd !== undefined;
  const [mode, setMode] = useState('main');                     // main | receipt | writeoff | count
  const [f, setF] = useState({ name: it.name, price_usd: String(it.price_usd ?? ''), resource_orders: String(it.resource_orders) });
  const [op, setOp] = useState({ n: 1, counted: '', comment: '' });
  const [moves, movesErr, reloadMoves] = useLoad(() => api.get(`/items/${it.id}/history`).then(r => r.data.moves), [it.id]);
  const actions = useActions();
  const busy = !!actions.busy;

  const patch = {};
  if (f.name.trim() && f.name.trim() !== it.name) patch.name = f.name.trim();
  if (priceEdit && f.price_usd !== '' && Number(f.price_usd) !== it.price_usd) patch.price_usd = Number(f.price_usd);
  if (priceEdit && Number(f.resource_orders) >= 1 && Number(f.resource_orders) !== it.resource_orders) patch.resource_orders = Number(f.resource_orders);
  const changed = manage && it.is_active && Object.keys(patch).length > 0;

  const put = async (body, msg) => {
    try {
      const r = await actions.run(`put:${it.id}:${JSON.stringify(body)}`, cfg => api.put(`/items/${it.id}`, body, cfg));
      if (r) { toast(msg); onChanged(); reloadMoves(); }
    } catch (e) { toast(errMsg(t, e), 'bad'); }
  };

  // Операция склада
  const diff = op.counted === '' ? null : Number(op.counted) - it.in_warehouse;
  const needComment = mode === 'writeoff' || (mode === 'count' && diff !== null && diff !== 0);
  const opReady = mode === 'receipt' ? Number(op.n) >= 1
    : mode === 'writeoff' ? Number(op.n) >= 1 && Number(op.n) <= it.in_warehouse && op.comment.trim()
      : diff !== null && (!needComment || op.comment.trim());
  const startOp = kind => { setOp({ n: 1, counted: '', comment: '' }); setMode(kind); };
  const setOpF = p => { setOp({ ...op, ...p }); actions.reset(`op:${it.id}:${mode}`); };
  const runOp = async () => {
    const body = { kind: mode, comment: op.comment.trim() || undefined, ...(mode === 'count' ? { counted: Number(op.counted) } : { qty: Number(op.n) }) };
    try {
      const r = await actions.run(`op:${it.id}:${mode}`, cfg => api.post(`/items/${it.id}/stock`, body, cfg));
      if (!r) return;
      const m = r.data.move;
      toast(t(`opDone_${mode}`, { item: it.name, n: Math.abs(m.qty), diff: m.qty === 0 ? t('diffNone') : signed(m.qty) }));
      setMode('main'); onChanged(); reloadMoves();
    } catch (e) { toast(errMsg(t, e), 'bad'); }
  };

  const footer = mode === 'main'
    ? <>
      <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('close')}</button>
      {changed && <button type="button" className="dd-btn lg" disabled={busy} onClick={() => put(patch, t('itemSaved', { name: patch.name || it.name }))}><Icon name="check" size={18} /> {t('saveBtn')}</button>}
    </>
    : <>
      <button type="button" className="dd-btn ghost lg" onClick={() => setMode('main')}>{t('back')}</button>
      <button type="button" className={`dd-btn lg ${mode === 'writeoff' ? 'bad' : 'ok'}`} disabled={busy || !opReady} onClick={runOp}><Icon name="check" size={18} /> {t('confirm')}</button>
    </>;

  return (
    <Sheet title={mode === 'main' ? it.name : `${t(`op_${mode}`)} · ${it.name}`} onClose={onClose} footer={footer}>
      <div className="dd-nums">
        <span>{t('bought')} <b>{it.qty_bought}</b></span><span>{t('inWarehouse')} <b>{it.in_warehouse}</b></span>
        <span>{t('onSites')} <b>{it.on_site}</b></span><span>{t('freeToday')} <b style={{ color: it.free_today < 0 ? 'var(--bad)' : undefined }}>{it.free_today}</b></span>
      </div>

      {mode === 'main' && <>
        {!it.is_active && <div className="dd-warnline warn"><Icon name="alert" size={16} /> {t('archivedInfo')}</div>}
        {manage && it.is_active && <>
          <div className="dd-field"><label htmlFor="it_name">{t('itemName')}</label>
            <input id="it_name" className="dd-inp" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
          {priceEdit && <div className="dd-form">
            <div className="dd-field"><label htmlFor="it_price">{t('price')}</label>
              <input id="it_price" className="dd-inp num" inputMode="decimal" value={f.price_usd} onChange={e => setF({ ...f, price_usd: numIn(e.target.value) })} /></div>
            <div className="dd-field"><label htmlFor="it_res">{t('resource')}</label>
              <input id="it_res" className="dd-inp num" inputMode="numeric" value={f.resource_orders} onChange={e => setF({ ...f, resource_orders: e.target.value.replace(/\D/g, '') })} /></div>
          </div>}
          <div className="dd-ops">
            <button type="button" className="dd-btn ghost" onClick={() => startOp('receipt')}><Icon name="plus" size={16} /> {t('op_receipt')}</button>
            <button type="button" className="dd-btn ghost" onClick={() => startOp('writeoff')} disabled={it.in_warehouse <= 0}><Icon name="minus" size={16} /> {t('op_writeoff')}</button>
            <button type="button" className="dd-btn ghost" onClick={() => startOp('count')}><Icon name="check" size={16} /> {t('op_count')}</button>
          </div>
        </>}
        {manage && (
          <div className="dd-row dd-between" style={{ marginTop: 2 }}>
            <span className="dd-note" style={{ flex: '1 1 220px' }}>{it.is_active ? t('archiveNote') : ''}</span>
            <button type="button" className="dd-btn ghost sm" disabled={busy}
              onClick={() => put({ is_active: !it.is_active }, t(it.is_active ? 'archivedOk' : 'restoredOk', { name: it.name }))}>
              <Icon name={it.is_active ? 'box' : 'undo'} size={14} /> {t(it.is_active ? 'archiveBtn' : 'restoreBtn')}</button>
          </div>
        )}
        <h4 className="dd-hist-title">{t('historyTitle')}</h4>
        {!moves ? <Loading err={movesErr} retry={reloadMoves} /> : !moves.length ? <div className="dd-note">{t('historyEmpty')}</div>
          : <div className="dd-hist">{moves.map(m => <HistRow key={`${m.source}${m.id}`} m={m} />)}</div>}
      </>}

      {mode !== 'main' && <>
        <p className="dd-note">{mode === 'receipt' ? t('opReceiptNote') : mode === 'writeoff' ? t('opWriteoffNote', { n: it.in_warehouse }) : t('opCountNote', { n: it.in_warehouse })}</p>
        {mode === 'count'
          ? <div className="dd-field"><label htmlFor="op_counted">{t('countedLabel')}</label>
            <input id="op_counted" className="dd-inp num" inputMode="numeric" autoFocus value={op.counted} onChange={e => setOpF({ counted: e.target.value.replace(/\D/g, '') })} /></div>
          : <div className="dd-row" style={{ justifyContent: 'center', margin: '4px 0' }}>
            <Stepper value={op.n} onChange={v => setOpF({ n: v })} min={1} max={mode === 'writeoff' ? it.in_warehouse : undefined} label={t('opQty')} /></div>}
        {mode === 'count' && diff !== null && (
          <div className={`dd-warnline ${diff === 0 ? 'ok' : 'warn'}`}><Icon name={diff === 0 ? 'check' : 'alert'} size={16} />
            {diff === 0 ? t('diffNone') : diff > 0 ? t('diffPlus', { n: diff }) : t('diffMinus', { n: -diff })}</div>
        )}
        <div className="dd-field"><label htmlFor="op_cm">{needComment ? t('opComment') : t('opCommentOpt')}</label>
          <input id="op_cm" className="dd-inp" value={op.comment} placeholder={t(mode === 'receipt' ? 'opReceiptPh' : 'opCommentPh')} onChange={e => setOpF({ comment: e.target.value })} /></div>
      </>}
    </Sheet>
  );
}

// Строка истории: операция склада (меняет «Куплено») или движение по заказу (на объект / на склад)
function HistRow({ m, item }) {
  const { t, lang } = useT();
  const toSite = m.kind === 'issue' || m.kind === 'extra';
  const qty = m.source === 'order' ? `${m.qty} → ${t(toSite ? 'toSite' : 'toWarehouse')}` : signed(m.qty);
  const tone = m.source === 'order' ? 'gray' : m.qty > 0 ? 'ok' : m.qty < 0 ? 'bad' : 'gray';
  return (
    <div className="dd-hist-row">
      <div style={{ minWidth: 0 }}>
        <b>{item ? `${item} · ` : ''}{t(`mk_${m.kind}`)}</b>
        <div className="dd-note">
          {m.source === 'order' ? `${m.no} · ${m.client}` : ''}
          {m.kind === 'count' ? t('countLine', { counted: m.counted, expected: m.expected }) : ''}
          {m.source === 'stock' && m.kind !== 'count' ? t('afterQty', { n: m.qty_after }) : ''}
          {m.source === 'stock' && m.kind === 'count' ? ` · ${t('afterQty', { n: m.qty_after })}` : ''}
        </div>
        {m.comment && <div className="dd-hist-cm">{m.comment}</div>}
        <div className="dd-note">{fts(m.created_at, lang)}{m.who ? ` · ${m.who}` : ''}</div>
      </div>
      <Chip tone={tone}>{qty}</Chip>
    </div>
  );
}

// Журнал склада компании: операции, новые сверху, «Показать ещё»; фильтр по виду операции
function JournalSheet({ onClose, onOpen }) {
  const { t } = useT();
  const [kind, setKind] = useState('');
  const [s, setS] = useState({ rows: null, more: false, err: null, loading: false });
  const load = useCallback(async (before, prev = []) => {
    setS(x => ({ ...x, loading: true, err: null }));
    try {
      const r = await api.get('/stock-moves', { params: { limit: 50, ...(before ? { before } : {}), ...(kind ? { kind } : {}) } });
      setS({ rows: [...prev, ...r.data.moves], more: r.data.more, err: null, loading: false });
    } catch (e) { setS(x => ({ ...x, err: e, loading: false })); }
  }, [kind]);
  useEffect(() => { setS({ rows: null, more: false, err: null, loading: false }); load(); }, [load]);
  return (
    <Sheet title={t('journalTitle')} onClose={onClose} footer={<button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('close')}</button>}>
      <div className="dd-statuspick" role="tablist">
        {[['', t('fAll')], ['receipt', t('op_receipt')], ['writeoff', t('op_writeoff')], ['count', t('op_count')], ['purchase', t('mk_purchase')], ['opening', t('mk_opening')]].map(([k, l]) => (
          <button key={k || 'all'} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      {!s.rows ? <Loading err={s.err} retry={() => load()} /> : !s.rows.length ? <div className="dd-empty">{t('journalEmpty')}</div> : (
        <div className="dd-hist">
          {s.rows.map(m => (
            <button key={m.id} type="button" className="dd-hist-btn" onClick={() => onOpen(m.item_id)}><HistRow m={{ ...m, source: 'stock' }} item={m.item} /></button>
          ))}
        </div>
      )}
      {s.rows && s.more && <button type="button" className="dd-btn ghost wide" disabled={s.loading} onClick={() => load(s.rows[s.rows.length - 1].id, s.rows)}>{t('moreBtn')}</button>}
      {s.rows && s.err && <div className="dd-err">{s.err?.response?.data?.error || t('error')}</div>}
    </Sheet>
  );
}
