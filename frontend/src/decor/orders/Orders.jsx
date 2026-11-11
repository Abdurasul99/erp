// Заказы: канбан по статусам (компьютер — колонки; телефон — выбор статуса и список), выезжающая карточка заказа,
// новый лид. Карточка открывается по адресу /decor/orders?open=<id> (так же открывает её поиск Ctrl K).
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { errText } from '../api.js';
import Icon from '../icons.jsx';
import { useT, fm, fday, localYmd, addDays } from '../i18n.js';
import { useDecor, useLoad, useActions, Hero, Chip, Sheet, Loading, NoAccess, DateInput } from '../kit.jsx';
import OrderCard, { STATUSES, useStatusCounts } from './OrderCard.jsx';
import { ClientHint } from '../clients/Clients.jsx';

function OCard({ o, onOpen }) {
  const { t, lang } = useT();
  return (
    <button type="button" className="dd-ocard" onClick={() => onOpen(o.id)}>
      <div className="dd-row dd-between" style={{ flexWrap: 'nowrap' }}><b>{o.no}</b><span className="dd-note">{fday(o.event_date, lang)}</span></div>
      <div>{o.client}</div>
      <div className="meta">{t(o.type === 'big' ? 'bigShort' : 'smallShort')}{o.team.length ? ` · ${o.team.map(p => p.name).join(', ')}` : ''}</div>
      <div className="dd-row dd-between" style={{ flexWrap: 'nowrap' }}>
        <span className="num" style={{ fontWeight: 800 }}>{o.price_usd ? fm(o.price_usd) : t('priceNotSet')}</span>
        {o.profit_usd !== undefined && o.price_usd > 0 && <Chip tone={o.profit_usd < 0 ? 'bad' : 'ok'}>{o.profit_usd < 0 ? t('lossChip', { sum: fm(Math.abs(o.profit_usd)) }) : `+${fm(o.profit_usd)}`}</Chip>}
      </div>
      {(o.has_conflict || o.not_returned || o.shortage_pending || o.pending_reports > 0 || o.evidence_missing > 0) && (
        <div className="chips">
          {o.has_conflict && <Chip tone="bad">{t('conflictChip')}</Chip>}
          {o.not_returned && <Chip tone="bad">{t('notReturnedChip')}</Chip>}
          {o.shortage_pending && <Chip tone="warn">{t('tabShortage')}</Chip>}
          {o.pending_reports > 0 && <Chip tone="blue">{t('reportWaitChip')}</Chip>}
          {o.evidence_missing > 0 && o.status !== 'closed' && <Chip tone="warn">{t('evChip', { n: o.evidence_missing })}</Chip>}
        </div>
      )}
    </button>
  );
}

export default function Orders() {
  const { t } = useT();
  const { can } = useDecor();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [list, err, reload] = useLoad(() => api.get('/orders').then(r => r.data), []);
  const [phoneStatus, setPhoneStatus] = useState(null);
  const [lead, setLead] = useState(false);
  const counts = useStatusCounts(list || []);
  const open = Number(params.get('open')) || null;
  const openCard = id => setParams({ open: String(id) });
  // Телефон: по умолчанию — самый «горячий» статус, где есть заказы (в работе раньше лидов)
  const ps = phoneStatus || ['install', 'acceptance', 'dismantle', 'booked', 'prepay', 'design', 'lead', 'closed'].find(s => counts[s]) || 'booked';
  const pick = useRef(null);
  useEffect(() => {   // выбранный статус — в середине ленты (только по горизонтали, страница не прыгает)
    const el = pick.current; const on = el?.querySelector('.on');
    if (el && on) el.scrollLeft += on.getBoundingClientRect().left - el.getBoundingClientRect().left - (el.clientWidth - on.offsetWidth) / 2;
  }, [ps, !!list]);
  if (err?.response?.status === 403) return <><Hero id="orders" /><NoAccess err={err} /></>;
  if (!list) return <><Hero id="orders" /><Loading err={err} retry={reload} /></>;

  const byStatus = s => list.filter(o => o.status === s).sort((a, b) => (a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : a.id - b.id));
  const active = list.filter(o => !['lead', 'closed'].includes(o.status)).length;
  return (
    <>
      <Hero id="orders" stats={[[active, t('oStatActive')], [counts.lead, t('oStatLeads')], [counts.closed, t('oStatClosed')]]}
        acts={can('create_order') ? [{ label: t('oNewInCalc'), onClick: () => nav('/decor/calc') }, { label: t('oNewLead'), onClick: () => setLead(true) }] : []} />
      <div className="dd-kanban only-wide">
        {STATUSES.map(s => {
          const col = byStatus(s);
          return (
            <div key={s} className="dd-col">
              <h4>{t(`st_${s}`)} <Chip tone="gray">{col.length}</Chip></h4>
              {col.length ? col.map(o => <OCard key={o.id} o={o} onOpen={openCard} />) : <div className="dd-note" style={{ textAlign: 'center', padding: 10 }}>{t('colEmpty')}</div>}
            </div>
          );
        })}
      </div>
      <div className="only-narrow">
        <div className="dd-statuspick" role="tablist" ref={pick}>
          {STATUSES.map(s => <button key={s} type="button" role="tab" aria-selected={ps === s} className={ps === s ? 'on' : ''} onClick={() => setPhoneStatus(s)}>{t(`st_${s}`)}<span>{counts[s]}</span></button>)}
        </div>
        <div className="dd-stack" style={{ marginTop: 12 }}>
          {byStatus(ps).length ? byStatus(ps).map(o => <OCard key={o.id} o={o} onOpen={openCard} />) : <div className="dd-card dd-empty">{t('colEmpty')}</div>}
        </div>
      </div>
      {open && <OrderCard id={open} onClose={() => setParams({})} onChanged={reload} />}
      {lead && <LeadSheet onClose={() => setLead(false)} onCreated={o => { setLead(false); reload(); openCard(o.id); }} />}
    </>
  );
}

// Новый лид: клиент, телефон, дата, тип — дизайн потом собирают в калькуляторе (тот же номер)
function LeadSheet({ onClose, onCreated }) {
  const { t } = useT();
  const { toast } = useDecor();
  const actions = useActions();
  const [f, setF] = useState({ client: '', phone: '', event_date: addDays(localYmd(), 7), type: 'big' });
  const set = p => { setF({ ...f, ...p }); actions.reset('lead'); };
  const create = async () => {
    try {
      const r = await actions.run('lead', cfg => api.post('/orders', { ...f, status: 'lead' }, cfg));
      if (r) { toast(t('leadCreated', { no: r.data.no })); onCreated(r.data); }
    } catch (e) { toast(e?.response ? errText(e, t('error')) : t('noAnswer'), 'bad'); }
  };
  return (
    <Sheet title={t('leadTitle')} onClose={onClose} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('cancel')}</button>
      <button type="button" className="dd-btn lg" disabled={!!actions.busy || !f.client.trim()} onClick={create}><Icon name="check" size={18} /> {t('leadCreate')}</button>
    </>}>
      <div className="dd-field"><label htmlFor="ld_p">{t('phone')}</label><input id="ld_p" className="dd-inp" inputMode="tel" value={f.phone} placeholder="+998" onChange={e => set({ phone: e.target.value })} />
        <ClientHint phone={f.phone} onFound={c => setF(x => ({ ...x, client: x.client.trim() ? x.client : c.name }))} /></div>
      <div className="dd-field"><label htmlFor="ld_c">{t('client')}</label><input id="ld_c" className="dd-inp" value={f.client} placeholder={t('clientPh')} onChange={e => set({ client: e.target.value })} /></div>
      <div className="dd-form">
        <div className="dd-field"><label htmlFor="ld_d">{t('date')}</label><DateInput id="ld_d" value={f.event_date} onChange={v => set({ event_date: v })} /></div>
        <div className="dd-field"><label htmlFor="ld_t">{t('type')}</label>
          <select id="ld_t" className="dd-inp" value={f.type} onChange={e => set({ type: e.target.value })}><option value="big">{t('big')}</option><option value="small">{t('small')}</option></select></div>
      </div>
    </Sheet>
  );
}
