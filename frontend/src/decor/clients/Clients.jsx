// «Клиенты» (ТЗ «Декор, обновление 2», раздел 1): список (поиск, новый / повторный), карточка клиента (данные,
// родственники, история заказов), «Ближайшие даты» на 30 дней (дни рождения, годовщины свадеб, «не в браке» —
// будущие свадьбы) и разовая привязка старых заказов по телефону (учредитель: сначала отчёт, запись — после «Привязать»).
// Число заказов, сумма, последний заказ — считает сервер из заказов. Видят те, кто оформляет заказы, и учредитель.
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { errText } from '../api.js';
import Icon from '../icons.jsx';
import { useT, fm, fdm, fday } from '../i18n.js';
import { useDecor, useLoad, useActions, Hero, Tabs, Card, Chip, Sheet, Loading, NoAccess, DateInput, StatusChip } from '../kit.jsx';

const SOURCES = ['instagram', 'recommendation', 'repeat', 'other'];
const RELATIONS = ['son', 'daughter', 'brother', 'sister', 'nephew', 'other'];
const tel = p => `tel:${String(p || '').replace(/[^\d+]/g, '')}`;
export const KIND_TONE = { repeat: 'ok', new: 'blue' };

export default function Clients() {
  const { t } = useT();
  const { me } = useDecor();
  const [params, setParams] = useSearchParams();
  const tab = ['list', 'dates', 'bind'].includes(params.get('tab')) ? params.get('tab') : 'list';
  const [list, err, reload] = useLoad(() => api.get('/clients').then(r => r.data), []);
  const [up, , reloadUp] = useLoad(() => api.get('/clients/upcoming').then(r => r.data).catch(() => null), []);
  const openId = Number(params.get('open')) || null;
  const setParam = (k, v) => { const p = new URLSearchParams(params); if (v === null) p.delete(k); else p.set(k, v); setParams(p, { replace: true }); };
  const [creating, setCreating] = useState(false);
  if (err?.response?.status === 403) return <><Hero id="clients" /><NoAccess err={err} /></>;
  if (!list) return <><Hero id="clients" /><Loading err={err} retry={reload} /></>;
  const tabs = [['list', t('clTabList')], ['dates', t('clTabDates'), up?.events.length || null], ...(me.is_owner ? [['bind', t('clTabBind')]] : [])];
  const refresh = () => { reload(); reloadUp(); };
  return (
    <>
      <Hero id="clients" stats={[[list.length, t('clStatAll')], [list.filter(c => c.kind === 'repeat').length, t('clStatRepeat')], [up?.events.length ?? '—', t('clStatDates')]]}
        acts={[{ label: t('clNew'), onClick: () => setCreating(true) }]} />
      <Tabs value={tab} onChange={k => setParam('tab', k)} items={tabs} />
      {tab === 'list' && <ClientList list={list} onOpen={id => setParam('open', String(id))} />}
      {tab === 'dates' && <Dates up={up} onOpen={id => setParam('open', String(id))} />}
      {tab === 'bind' && <BindTab onDone={refresh} />}
      {creating && <ClientForm onClose={() => setCreating(false)} onSaved={c => { setCreating(false); refresh(); setParam('open', String(c.id)); }}
        onOpenExisting={id => { setCreating(false); setParam('open', String(id)); }} />}
      {openId && <ClientSheet key={openId} id={openId} onClose={() => setParam('open', null)} onChanged={refresh} />}
    </>
  );
}

function ClientList({ list, onOpen }) {
  const { t, lang } = useT();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const s = q.trim().toLowerCase(); const digits = q.replace(/\D/g, '');
  const shown = list.filter(c => (kind === 'all' || c.kind === kind)
    && (!s || c.name.toLowerCase().includes(s) || (c.address || '').toLowerCase().includes(s)
      || (digits.length >= 3 && [c.phone, c.phone2].some(p => String(p || '').replace(/\D/g, '').includes(digits)))));
  return (
    <Card>
      <div className="dd-row" style={{ gap: 8 }}>
        <input className="dd-inp" style={{ flex: '2 1 220px' }} value={q} placeholder={t('clSearchPh')} aria-label={t('clSearchPh')} onChange={e => setQ(e.target.value)} />
        <div className="dd-statuspick" role="tablist">
          {[['all', t('tkAll'), list.length], ['new', t('clKindNew'), list.filter(c => c.kind === 'new').length], ['repeat', t('clKindRepeat'), list.filter(c => c.kind === 'repeat').length]].map(([k, label, n]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{label}<span>{n}</span></button>
          ))}
        </div>
      </div>
      {!shown.length ? <div className="dd-empty">{list.length ? t('searchEmpty') : t('clNone')}</div> : (
        <div className="dd-lines">
          {shown.map(c => (
            <button key={c.id} type="button" className="dd-line dd-line-btn" onClick={() => onOpen(c.id)}>
              <div className="dd-line-head"><b>{c.name}</b><Chip tone={KIND_TONE[c.kind]}>{t(c.kind === 'repeat' ? 'clKindRepeat' : 'clKindNew')}</Chip></div>
              <div className="dd-nums">
                <span>{c.phone}</span>
                <span>{t('clOrdersN', { n: c.orders })}</span>
                {c.orders > 0 && <span><b>{fm(c.total_usd)}</b></span>}
                {c.last_order && <span>{t('clLast', { date: fdm(c.last_order, lang) })}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function Dates({ up, onOpen }) {
  const { t, lang } = useT();
  if (!up) return <Loading />;
  const label = e => (e.kind === 'client_birthday' ? t('clEvClientBd', { years: e.years })
    : e.kind === 'relative_birthday' ? t('clEvRelBd', { rel: t(`rel_${e.relative.relation}`), name: e.relative.name, years: e.years })
      : t('clEvAnniv', { years: e.years, no: e.order?.no || '' }));
  return <>
    <Card>
      <div className="dd-row dd-between"><h3>{t('clDatesTitle')}</h3><Chip tone="gray">{t('clDatesRange', { from: fdm(up.from, lang), to: fdm(up.to, lang) })}</Chip></div>
      <p className="dd-note" style={{ marginTop: 4 }}>{t('clDatesNote')}</p>
      {!up.events.length ? <div className="dd-empty">{t('clDatesNone')}</div> : (
        <div className="dd-lines">
          {up.events.map(e => (
            <div key={`${e.kind}:${e.ref}:${e.date}`} className="dd-line">
              <div className="dd-line-head"><b>{fday(e.date, lang)}</b>
                <Chip tone={e.days_left <= 7 ? 'warn' : 'gray'}>{e.days_left === 0 ? t('clToday') : t('clInDays', { n: e.days_left })}</Chip></div>
              <div>{label(e)}{e.relative?.not_married ? <> · <Chip tone="ok">{t('relNotMarried')}</Chip></> : null}</div>
              <div className="dd-row dd-between" style={{ gap: 8 }}>
                <button type="button" className="dd-link" onClick={() => onOpen(e.client.id)}>{e.client.name} →</button>
                {e.client.phone && <a className="dd-btn ghost sm" href={tel(e.client.phone)}><Icon name="phone" size={14} /> {e.client.phone}</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
    <Card>
      <h3>{t('clWeddingsTitle')}</h3>
      <p className="dd-note" style={{ marginTop: 4 }}>{t('clWeddingsNote')}</p>
      {!up.weddings.length ? <div className="dd-empty">{t('clWeddingsNone')}</div> : (
        <div className="dd-lines">
          {up.weddings.map(w => (
            <button key={w.id} type="button" className="dd-line dd-line-btn" onClick={() => onOpen(w.client.id)}>
              <div className="dd-line-head"><b>{w.name}</b>{w.expected_wedding_year ? <Chip tone="ok">{t('clWeddingYear', { y: w.expected_wedding_year })}</Chip> : <Chip tone="gray">{t('clWeddingNoYear')}</Chip>}</div>
              <div className="dd-sub">{t(`rel_${w.relation}`)} · {w.client.name}{w.client.phone ? ` · ${w.client.phone}` : ''}</div>
            </button>
          ))}
        </div>
      )}
    </Card>
  </>;
}

// ---------- Разовая привязка старых заказов ----------
function BindTab({ onDone }) {
  const { t } = useT();
  const { toast } = useDecor();
  const actions = useActions();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const preview = async () => {
    setLoading(true);
    try { setPlan((await api.get('/clients/bind-preview')).data); } catch (e) { toast(errText(e, t('error')), 'bad'); } finally { setLoading(false); }
  };
  const bind = async () => {
    try {
      const r = await actions.run(`bind:${plan.fingerprint}`, cfg => api.post('/clients/bind', { fingerprint: plan.fingerprint }, cfg));
      if (r) { toast(t('clBindDone', { c: r.data.created_clients, o: r.data.linked_orders })); setPlan(null); onDone(); }
    } catch (e) {
      toast(errText(e, t('error')), 'bad');
      if (e?.response?.data?.code === 'bind_changed') preview();
    }
  };
  return (
    <Card>
      <h3>{t('clBindTitle')}</h3>
      <p className="dd-note" style={{ marginTop: 4 }}>{t('clBindNote')}</p>
      <div className="dd-row" style={{ gap: 8, marginTop: 10 }}>
        <button type="button" className="dd-btn ghost" disabled={loading} onClick={preview}>{t(plan ? 'clBindRefresh' : 'clBindPreview')}</button>
        {plan && plan.to_link > 0 && <button type="button" className="dd-btn" disabled={!!actions.busy} onClick={bind}><Icon name="check" size={16} /> {t('clBindGo', { n: plan.to_link })}</button>}
      </div>
      {plan && <>
        <div className="dd-kpis" style={{ marginTop: 12 }}>
          <div><span>{t('clBindOrders')}</span><b className="num">{plan.to_link}</b></div>
          <div><span>{t('clBindNewClients')}</span><b className="num">{plan.new_clients}</b></div>
          <div><span>{t('clBindExisting')}</span><b className="num">{plan.existing_clients}</b></div>
          <div><span>{t('clBindNoPhone')}</span><b className="num">{plan.no_phone.length}</b></div>
        </div>
        {!plan.groups.length ? <div className="dd-empty">{t('clBindNothing')}</div> : (
          <div className="dd-lines">
            {plan.groups.map(g => (
              <div key={g.phone_key} className="dd-line">
                <div className="dd-line-head"><b>{g.name}</b><Chip tone={g.client_id ? 'gray' : 'blue'}>{t(g.client_id ? 'clBindToExisting' : 'clBindWillCreate')}</Chip></div>
                <div className="dd-sub">{g.phone}{g.names.length > 1 ? ` · ${t('clBindNames', { names: g.names.join(', ') })}` : ''}</div>
                <div className="dd-sub">{g.orders.map(o => o.no).join(', ')}</div>
              </div>
            ))}
          </div>
        )}
        {plan.no_phone.length > 0 && <p className="dd-note" style={{ marginTop: 10 }}>{t('clBindSkipped', { list: plan.no_phone.map(o => o.no).join(', ') })}</p>}
      </>}
    </Card>
  );
}

// ---------- Новый клиент / правка данных ----------
function ClientForm({ client, onClose, onSaved, onOpenExisting }) {
  const { t } = useT();
  const { toast } = useDecor();
  const actions = useActions();
  const [f, setF] = useState(() => ({ name: client?.name || '', phone: client?.phone || '', phone2: client?.phone2 || '', address: client?.address || '',
    birth_date: client?.birth_date || '', source: client?.source || 'other', notes: client?.notes || '' }));
  const [exists, setExists] = useState(null);
  const set = p => { setF({ ...f, ...p }); actions.reset('client'); setExists(null); };
  const save = async () => {
    const body = { ...f, name: f.name.trim(), phone: f.phone.trim(), birth_date: f.birth_date || null };
    try {
      const r = await actions.run('client', cfg => (client ? api.put(`/clients/${client.id}`, body, cfg) : api.post('/clients', body, cfg)));
      if (r) { toast(t('clSaved', { name: r.data.name })); onSaved(r.data); }
    } catch (e) {
      if (e?.response?.data?.code === 'client_exists') setExists(e.response.data.client_id);
      toast(errText(e, t('error')), 'bad');
    }
  };
  return (
    <Sheet title={client ? t('clEdit') : t('clNew')} onClose={onClose} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('close')}</button>
      <button type="button" className="dd-btn lg" disabled={!!actions.busy || !f.name.trim() || f.phone.replace(/\D/g, '').length < 7} onClick={save}><Icon name="check" size={18} /> {t('saveBtn')}</button></>}>
      <div className="dd-field"><label htmlFor="cl_name">{t('clName')}</label><input id="cl_name" className="dd-inp" maxLength={160} value={f.name} autoFocus={!client} onChange={e => set({ name: e.target.value })} /></div>
      <div className="dd-grid dd-g2" style={{ gap: 10 }}>
        <div className="dd-field"><label htmlFor="cl_phone">{t('phone')}</label><input id="cl_phone" className="dd-inp" inputMode="tel" placeholder="+998" maxLength={40} value={f.phone} onChange={e => set({ phone: e.target.value })} /></div>
        <div className="dd-field"><label htmlFor="cl_phone2">{t('clPhone2')}</label><input id="cl_phone2" className="dd-inp" inputMode="tel" placeholder="+998" maxLength={40} value={f.phone2} onChange={e => set({ phone2: e.target.value })} /></div>
      </div>
      {exists && <button type="button" className="dd-link" style={{ justifySelf: 'start' }} onClick={() => onOpenExisting?.(exists)}>{t('clOpenExisting')} →</button>}
      <div className="dd-field"><label htmlFor="cl_addr">{t('address')}</label><input id="cl_addr" className="dd-inp" maxLength={2000} value={f.address} onChange={e => set({ address: e.target.value })} /></div>
      <div className="dd-grid dd-g2" style={{ gap: 10 }}>
        <div className="dd-field"><label htmlFor="cl_bd">{t('clBirth')}</label><DateInput id="cl_bd" value={f.birth_date} onChange={v => set({ birth_date: v })} /></div>
        <div className="dd-field"><label htmlFor="cl_src">{t('clSource')}</label>
          <select id="cl_src" className="dd-inp" value={f.source} onChange={e => set({ source: e.target.value })}>
            {SOURCES.map(s => <option key={s} value={s}>{t(`src_${s}`)}</option>)}
          </select></div>
      </div>
      <div className="dd-field"><label htmlFor="cl_notes">{t('clNotes')}</label><textarea id="cl_notes" className="dd-inp dd-textarea" rows={3} maxLength={4000} value={f.notes} onChange={e => set({ notes: e.target.value })} /></div>
    </Sheet>
  );
}

// ---------- Карточка клиента ----------
function ClientSheet({ id, onClose, onChanged }) {
  const { t, lang } = useT();
  const nav = useNavigate();
  const [c, err, reload] = useLoad(() => api.get(`/clients/${id}`).then(r => r.data), [id]);
  const [editing, setEditing] = useState(false);
  const [rel, setRel] = useState(null);           // { } — новый родственник, { id… } — правка
  if (!c) return <Sheet title={t('clCard')} onClose={onClose}><Loading err={err} retry={reload} /></Sheet>;
  const changed = () => { reload(); onChanged(); };
  if (editing) return <ClientForm client={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); changed(); }} />;
  if (rel) return <RelativeForm clientId={c.id} rel={rel.id ? rel : null} onClose={() => setRel(null)} onSaved={() => { setRel(null); changed(); }} />;
  return (
    <Sheet title={c.name} onClose={onClose} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('close')}</button>
      <button type="button" className="dd-btn lg" onClick={() => setEditing(true)}>{t('clEdit')}</button></>}>
      <div className="dd-row" style={{ gap: 6 }}>
        <Chip tone={KIND_TONE[c.kind]}>{t(c.kind === 'repeat' ? 'clKindRepeat' : 'clKindNew')}</Chip>
        <Chip tone="gray">{t(`src_${c.source}`)}</Chip>
      </div>
      <div className="dd-kpis">
        <div><span>{t('clStatOrders')}</span><b className="num">{c.orders}</b></div>
        <div><span>{t('clStatSum')}</span><b className="num">{fm(c.total_usd)}</b></div>
        <div><span>{t('clStatLast')}</span><b className="num">{c.last_order ? fdm(c.last_order, lang) : '—'}</b></div>
      </div>
      <div className="dd-line">
        <div className="dd-row" style={{ gap: 8 }}>
          <a className="dd-btn ghost sm" href={tel(c.phone)}><Icon name="phone" size={14} /> {c.phone}</a>
          {c.phone2 && <a className="dd-btn ghost sm" href={tel(c.phone2)}><Icon name="phone" size={14} /> {c.phone2}</a>}
        </div>
        {c.address && <div className="dd-sub">{c.address}</div>}
        {c.birth_date && <div className="dd-sub">{t('clBirth')}: {fdm(c.birth_date, lang)}</div>}
        {c.notes && <div className="dd-note" style={{ whiteSpace: 'pre-line' }}>{c.notes}</div>}
      </div>
      <div className="dd-row dd-between"><h3>{t('clRelatives')}</h3>
        <button type="button" className="dd-btn ghost sm" onClick={() => setRel({})}><Icon name="plus" size={14} /> {t('clRelAdd')}</button></div>
      {!c.relatives.length ? <div className="dd-note">{t('clRelNone')}</div> : (
        <div className="dd-lines" style={{ marginTop: 0, gridTemplateColumns: 'none' }}>
          {c.relatives.map(r => (
            <button key={r.id} type="button" className="dd-line dd-line-btn" onClick={() => setRel(r)}>
              <div className="dd-line-head"><b>{r.name}</b><span className="dd-sub">{t(`rel_${r.relation}`)}</span></div>
              <div className="dd-nums">
                {r.birth_date && <span>{t('clBirth')}: {fdm(r.birth_date, lang)}</span>}
                {r.not_married && <Chip tone="ok">{t('relNotMarried')}{r.expected_wedding_year ? ` · ${r.expected_wedding_year}` : ''}</Chip>}
              </div>
            </button>
          ))}
        </div>
      )}
      <h3>{t('clHistory')}</h3>
      {!c.history.length ? <div className="dd-note">{t('clHistoryNone')}</div> : (
        <div className="dd-lines" style={{ marginTop: 0, gridTemplateColumns: 'none' }}>
          {c.history.map(o => (
            <button key={o.id} type="button" className="dd-line dd-line-btn" onClick={() => nav(`/decor/orders?open=${o.id}`)}>
              <div className="dd-line-head"><b>{o.no} · {fday(o.event_date, lang)}</b><StatusChip status={o.status} /></div>
              {o.price_usd > 0 && <div className="dd-sub">{fm(o.price_usd)}</div>}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function RelativeForm({ clientId, rel, onClose, onSaved }) {
  const { t } = useT();
  const { toast } = useDecor();
  const actions = useActions();
  const [f, setF] = useState(() => ({ relation: rel?.relation || 'son', name: rel?.name || '', birth_date: rel?.birth_date || '',
    not_married: !!rel?.not_married, expected_wedding_year: rel?.expected_wedding_year ? String(rel.expected_wedding_year) : '' }));
  const set = p => { setF({ ...f, ...p }); actions.reset('rel'); };
  const run = async (aid, request, msg) => {
    try { const r = await actions.run(aid, request); if (r) { toast(msg); onSaved(); } } catch (e) { toast(errText(e, t('error')), 'bad'); }
  };
  const body = { ...f, name: f.name.trim(), birth_date: f.birth_date || null, expected_wedding_year: f.not_married && f.expected_wedding_year ? Number(f.expected_wedding_year) : null };
  const save = () => run('rel', cfg => (rel ? api.put(`/clients/${clientId}/relatives/${rel.id}`, body, cfg) : api.post(`/clients/${clientId}/relatives`, body, cfg)), t('clRelSaved', { name: body.name }));
  const remove = () => run(`rel:del:${rel.id}`, cfg => api.delete(`/clients/${clientId}/relatives/${rel.id}`, cfg), t('clRelRemoved', { name: rel.name }));
  const year = f.expected_wedding_year && !(Number(f.expected_wedding_year) >= 2000 && Number(f.expected_wedding_year) <= 2100);
  return (
    <Sheet title={rel ? rel.name : t('clRelAdd')} onClose={onClose} footer={<>
      <button type="button" className="dd-btn ghost lg" onClick={onClose}>{t('close')}</button>
      {rel && <button type="button" className="dd-btn ghost lg" disabled={!!actions.busy} onClick={remove}>{t('remove')}</button>}
      <button type="button" className="dd-btn lg" disabled={!!actions.busy || !f.name.trim() || year} onClick={save}><Icon name="check" size={18} /> {t('saveBtn')}</button></>}>
      <div className="dd-grid dd-g2" style={{ gap: 10 }}>
        <div className="dd-field"><label htmlFor="rl_rel">{t('clRelation')}</label>
          <select id="rl_rel" className="dd-inp" value={f.relation} onChange={e => set({ relation: e.target.value })}>
            {RELATIONS.map(r => <option key={r} value={r}>{t(`rel_${r}`)}</option>)}
          </select></div>
        <div className="dd-field"><label htmlFor="rl_name">{t('clName')}</label><input id="rl_name" className="dd-inp" maxLength={160} value={f.name} onChange={e => set({ name: e.target.value })} /></div>
      </div>
      <div className="dd-field"><label htmlFor="rl_bd">{t('clBirth')}</label><DateInput id="rl_bd" value={f.birth_date} onChange={v => set({ birth_date: v })} /></div>
      <button type="button" className={`dd-toggle ${f.not_married ? 'on' : ''}`} style={{ alignSelf: 'flex-start' }} aria-pressed={f.not_married} onClick={() => set({ not_married: !f.not_married })}>{t('relNotMarried')}</button>
      {f.not_married && <div className="dd-field"><label htmlFor="rl_year">{t('clWeddingYearLabel')}</label>
        <input id="rl_year" className="dd-inp" inputMode="numeric" maxLength={4} placeholder={String(new Date().getFullYear() + 1)} value={f.expected_wedding_year}
          onChange={e => set({ expected_wedding_year: e.target.value.replace(/\D/g, '') })} /></div>}
    </Sheet>
  );
}

// ---------- Подсказка «клиент по телефону» — калькулятор и новый лид ----------
// Найден — подставить имя и адрес (пустые поля — сами) и показать, сколько заказов; нет — «будет новый клиент».
export function ClientHint({ phone, onFound }) {
  const { t } = useT();
  const { can } = useDecor();
  const [res, setRes] = useState(null);
  const digits = String(phone || '').replace(/\D/g, '');
  useEffect(() => {
    if (!can('create_order') || digits.length < 7) { setRes(null); return undefined; }
    let alive = true;
    const tm = setTimeout(() => api.get('/clients/lookup', { params: { phone } }).then(r => {
      if (!alive) return;
      setRes({ client: r.data.client });
      if (r.data.client) onFound?.(r.data.client);
    }).catch(() => {}), 350);
    return () => { alive = false; clearTimeout(tm); };
  }, [digits]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!res) return null;
  if (!res.client) return <div className="dd-note dd-clhint">{t('clHintNew')}</div>;
  const c = res.client;
  return (
    <div className="dd-clhint found">
      <Chip tone={KIND_TONE[c.kind]}>{t(c.kind === 'repeat' ? 'clKindRepeat' : 'clKindNew')}</Chip>
      <span>{t('clHintFound', { name: c.name, n: c.orders })}</span>
    </div>
  );
}
