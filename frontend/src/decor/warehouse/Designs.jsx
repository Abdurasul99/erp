// Склад → «Дизайны» (D26, владелец 09.11.2026): готовый дизайн — название и состав (вещи и сколько штук каждой).
// В калькуляторе дизайн добавляет в заказ все свои вещи разом; недостающие материалы добавляются вещами сверху.
// «Хватает на» — сколько таких дизайнов собирается из свободного сегодня (считает сервер по вещам).
// Заводит и правит — «вести склад» или «менять настройки»; остальные смотрят. Не удаляются — архив.
import React, { useState } from 'react';
import api, { errText } from '../api.js';
import Icon from '../icons.jsx';
import { useT } from '../i18n.js';
import { useDecor, useLoad, useActions, Card, Chip, Sheet, Loading, ItemPick } from '../kit.jsx';

export function DesignsTab({ items }) {
  const { t } = useT();
  const { can } = useDecor();
  const manage = can('manage_items') || can('edit_settings');
  const [archive, setArchive] = useState(false);
  const [sheet, setSheet] = useState(null);      // { id } — дизайн, { new: true } — новый
  const [list, err, reload] = useLoad(() => api.get('/designs', { params: { all: 1 } }).then(r => r.data), []);
  if (!list) return <Card><Loading err={err} retry={reload} /></Card>;
  const shown = list.filter(d => d.is_active !== archive);
  const open = sheet?.id ? list.find(d => d.id === sheet.id) : null;
  return (
    <Card>
      <div className="dd-row dd-between"><h3>{t('designsTitle')}</h3>
        <div className="dd-row" style={{ gap: 8 }}>
          {(archive || list.some(d => !d.is_active)) && (
            <button type="button" className="dd-btn ghost sm" onClick={() => setArchive(v => !v)}>{archive ? t('designsActive') : t('designsArchive')}</button>)}
          {manage && !archive && <button type="button" className="dd-btn sm" onClick={() => setSheet({ new: true })}><Icon name="plus" size={16} /> {t('designNew')}</button>}
        </div>
      </div>
      <p className="dd-note" style={{ marginTop: 4 }}>{t('designsNote')}</p>
      {!shown.length ? <div className="dd-empty">{archive ? t('designsNoArchive') : t('designsNone')}</div> : (
        <div className="dd-lines" style={{ marginTop: 10 }}>
          {shown.map(d => (
            <button key={d.id} type="button" className="dd-line dd-line-btn" onClick={() => setSheet({ id: d.id })}>
              <div className="dd-line-head"><b>{d.name}</b>
                {d.is_active && <Chip tone={d.can_build > 0 ? 'ok' : 'warn'}>{t('designCanBuild', { n: d.can_build })}</Chip>}</div>
              <div className="dd-sub">{t('designPieces', { n: d.lines.length, pcs: d.pieces })}</div>
              <div className="dd-sub dd-design-lines">{d.lines.map(l => `${l.item} × ${l.qty}`).join(' · ')}</div>
            </button>
          ))}
        </div>
      )}
      {sheet && <DesignSheet key={sheet.id || 'new'} design={open} items={items} manage={manage} onClose={() => setSheet(null)} onSaved={reload} />}
    </Card>
  );
}

function DesignSheet({ design, items, manage, onClose, onSaved }) {
  const { t } = useT();
  const { toast } = useDecor();
  const actions = useActions();
  const busy = !!actions.busy;
  // Количества — строками (поле можно стереть и набрать заново), числом — только при сохранении
  const [f, setF] = useState(() => ({ name: design?.name || '', note: design?.note || '',
    lines: (design?.lines || []).map(l => ({ item_id: l.item_id, qty: String(l.qty), archived: !l.item_active })) }));
  const [pick, setPick] = useState({ item: '', qty: '' });
  const active = items.filter(i => i.is_active);
  const nameOf = id => items.find(i => i.id === id)?.name || design?.lines.find(l => l.item_id === id)?.item || `#${id}`;
  const edit = manage && (!design || design.is_active);

  const add = () => {
    const id = Number(pick.item); const q = Number(pick.qty);
    if (!id || !(q > 0)) return;
    const ex = f.lines.find(l => l.item_id === id);
    setF({ ...f, lines: ex ? f.lines.map(l => (l.item_id === id ? { ...l, qty: String((Number(l.qty) || 0) + q) } : l)) : [...f.lines, { item_id: id, qty: String(q) }] });
    setPick({ item: '', qty: '' });
  };
  const clean = f.lines.filter(l => Number(l.qty) > 0 && !l.archived).map(l => ({ item_id: l.item_id, qty: Number(l.qty) }));
  const ready = f.name.trim() && clean.length > 0;
  const run = async (id, request, msg) => {
    try { const r = await actions.run(id, request); if (r) { toast(msg); onSaved(); onClose(); } } catch (e) { toast(errText(e, t('error')), 'bad'); }
  };
  const save = () => {
    const body = { name: f.name.trim(), note: f.note.trim() || null, lines: clean };
    run(`design:${design?.id || 'new'}:${JSON.stringify(body)}`, cfg => (design ? api.put(`/designs/${design.id}`, body, cfg) : api.post('/designs', body, cfg)),
      t('designSaved', { name: body.name }));
  };
  const setActive = on => run(`design:${design.id}:active:${on}`, cfg => api.put(`/designs/${design.id}`, { is_active: on }, cfg),
    t(on ? 'designRestored' : 'designArchived', { name: design.name }));

  const footer = <>
    <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('close')}</button>
    {manage && design && <button type="button" className="dd-btn ghost lg" disabled={busy} onClick={() => setActive(!design.is_active)}>
      {t(design.is_active ? 'designArchive' : 'designRestore')}</button>}
    {edit && <button type="button" className="dd-btn lg" disabled={busy || !ready} onClick={save}><Icon name="check" size={18} /> {t('saveBtn')}</button>}
  </>;

  return (
    <Sheet title={design ? design.name : t('designNew')} onClose={onClose} footer={footer}>
      {design?.is_active && <p className="dd-note">{t('designCanBuildNote', { n: design.can_build })}</p>}
      {edit ? <>
        <div className="dd-field"><label htmlFor="ds_name">{t('designName')}</label>
          <input id="ds_name" className="dd-inp" value={f.name} maxLength={160} autoFocus={!design} onChange={e => setF({ ...f, name: e.target.value })} /></div>
        <div className="dd-field"><label htmlFor="ds_note">{t('designNote')}</label>
          <input id="ds_note" className="dd-inp" value={f.note} maxLength={2000} onChange={e => setF({ ...f, note: e.target.value })} /></div>
        <span className="dd-label">{t('designLines')}</span>
        <div className="dd-row" style={{ gap: 8 }}>
          <div style={{ flex: '2 1 200px', minWidth: 0 }}>
            <ItemPick id="ds_pick" items={active.map(i => ({ id: i.id, name: i.name, note: t('inWhShort', { n: i.in_warehouse }) }))}
              value={pick.item} placeholder={t('pickItem')} onChange={v => setPick({ ...pick, item: v === '' ? '' : String(v) })} />
          </div>
          <input className="dd-inp" style={{ flex: '1 1 80px' }} inputMode="numeric" placeholder={t('qty')} value={pick.qty} aria-label={t('qty')}
            onChange={e => setPick({ ...pick, qty: e.target.value.replace(/\D/g, '') })} onKeyDown={e => e.key === 'Enter' && add()} />
          <button type="button" className="dd-btn" disabled={!pick.item || !(Number(pick.qty) > 0)} onClick={add}><Icon name="plus" size={16} /> {t('add')}</button>
        </div>
      </> : (design?.note ? <p className="dd-note">{design.note}</p> : null)}
      {!f.lines.length ? <div className="dd-empty">{t('designEmptyLines')}</div> : (
        <div className="dd-lines">
          {f.lines.map(l => (
            <div key={l.item_id} className="dd-line">
              <div className="dd-line-head"><b>{nameOf(l.item_id)}</b>
                {l.archived ? <Chip tone="gray">{t('designItemArchived')}</Chip> : edit ? (
                  <div className="dd-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    <input className="dd-inp r num" style={{ width: 90 }} inputMode="numeric" value={l.qty} aria-label={nameOf(l.item_id)}
                      onChange={e => setF({ ...f, lines: f.lines.map(x => (x.item_id === l.item_id ? { ...x, qty: e.target.value.replace(/\D/g, '') } : x)) })} />
                    <button type="button" className="dd-btn ghost sm" aria-label={t('remove')}
                      onClick={() => setF({ ...f, lines: f.lines.filter(x => x.item_id !== l.item_id) })}><Icon name="x" size={14} /></button>
                  </div>
                ) : <b className="num">× {l.qty}</b>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
