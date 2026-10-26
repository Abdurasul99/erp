// Карточка заказа (выезжающая панель): Обзор / Декор / Себестоимость / Деньги / Отчёты — как в прототипе.
// На телефоне — на весь экран. Каждое записывающее действие — с ключом повторной отправки (useActions).
// Доказательства (D24): по этапам — есть / не хватает (и в чек-листе закрытия); «Сдал» — с фото чека; отчёт — с нужным
// числом фото/видео; «Одобрить» недоступна без полного комплекта; «Добавить доказательства» для старых заказов.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import Icon from '../icons.jsx';
import { useT, fm, fm2, fsum, fday, fperiod } from '../i18n.js';
import { useDecor, useLoad, useActions, Tabs, Card, Chip, StatusChip, Loading, numIn } from '../kit.jsx';
import { EvidencePicker, EvidenceStatus, EvidenceSheet, Thumb, evForm, evidenceError, useEvidenceReady, useEvidenceRules, dropFiles, gapOf, ruleOf, missingText } from '../evidence.jsx';

export const STATUSES = ['lead', 'design', 'prepay', 'booked', 'install', 'acceptance', 'dismantle', 'closed'];
const PS_TONE = { at_pm: 'warn', handed: 'blue', confirmed: 'ok' };
const RS_TONE = { pending: 'blue', approved: 'ok', returned: 'bad' };

export default function OrderCard({ id, onClose, onChanged }) {
  const { t, lang } = useT();
  const { can, toast, refreshHints } = useDecor();
  const nav = useNavigate();
  const [o, err, reload] = useLoad(() => api.get(`/orders/${id}`).then(r => r.data), [id]);
  const [tab, setTab] = useState('overview');
  const [addEv, setAddEv] = useState(null);     // «Добавить доказательства»: этап issue / final
  const actions = useActions();
  const busy = !!actions.busy;
  useEffect(() => {
    const k = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  // Действие с ключом: успех — сообщение и обновить карточку и канбан; нет ответа — «нажмите ещё раз»
  const act = async (aid, fn, msg) => {
    try {
      const r = await actions.run(aid, fn);
      if (!r) return null;
      if (msg) toast(typeof msg === 'function' ? msg(r.data) : msg);
      reload(); onChanged?.(); refreshHints();
      return r;
    } catch (e) {
      toast(e?.response?.data?.code === 'checklist' ? t('cantClose') : evidenceError(t, e), 'bad');
      if (e?.response) reload();
      return null;
    }
  };

  const tabs = [['overview', t('tabOverview')], ['decor', t('tabDecor')], ...(can('see_finance') ? [['cost', t('tabCost')]] : []),
    ['money', t('tabMoney')], ['reports', t('tabReports'), o?.reports?.length || null]];
  const idx = o ? STATUSES.indexOf(o.status) : -1;
  return (
    <div className="dd-scrim" onClick={onClose}>
      <aside className="dd-drawer" role="dialog" aria-label={o ? `${t('cardOrder')} ${o.no}` : t('cardOrder')} onClick={e => e.stopPropagation()}>
        <div className="dd-row dd-between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <div style={{ minWidth: 0 }}><div className="dd-eyebrow">{t('cardOrder')}</div><h2>{o ? `${o.no} · ${o.client}` : '…'}</h2></div>
          <button type="button" className="dd-btn ghost" onClick={onClose} aria-label={t('close')}><Icon name="x" size={18} /></button>
        </div>
        {!o ? <Loading err={err} retry={reload} /> : <>
          <div className="dd-steps">{STATUSES.map((s, i) => <span key={s} className={`dd-step ${i < idx ? 'done' : i === idx ? 'cur' : ''}`}>{t(`st_${s}`)}</span>)}</div>
          <Tabs value={tab} onChange={setTab} items={tabs} />
          {tab === 'overview' && overview()}
          {tab === 'decor' && <DecorTab o={o} nav={nav} />}
          {tab === 'cost' && <CostTab o={o} busy={busy} act={act} actions={actions} />}
          {tab === 'money' && <MoneyTab o={o} busy={busy} act={act} actions={actions} />}
          {tab === 'reports' && <ReportsTab o={o} busy={busy} act={act} actions={actions} />}
          {addEv && <AddEvidenceSheet o={o} stage={addEv} busy={busy} act={act} actions={actions} onClose={() => setAddEv(null)} />}
        </>}
      </aside>
    </div>
  );

  // ---------- Обзор (функция отрисовки, а не компонент — не пересоздаётся при каждой отрисовке) ----------
  function overview() {
    const ck = o.checklist;
    const prev = STATUSES[idx - 1]; const next = STATUSES[idx + 1];
    const setStatus = to => act(`status:${o.id}:${to}`, cfg => api.post(`/orders/${o.id}/status`, { status: to }, cfg),
      d => (to === 'closed' ? t('closedOk', { no: d.no }) : t('statusChanged', { status: t(`st_${to}`) })));
    const row = (label, okv) => <div className="dd-check"><span>{label}</span>{okv ? <Chip tone="ok">{t('yes')}</Chip> : <Chip tone="gray">{t('no')}</Chip>}</div>;
    return <>
      <Card>
        <div className="dd-facts">
          <div><div className="dd-eyebrow">{t('fClient')}</div><b>{o.client}</b><div className="dd-note">{o.phone || '—'}</div></div>
          <div><div className="dd-eyebrow">{t('fAddress')}</div><b>{o.address || '—'}</b></div>
          <div><div className="dd-eyebrow">{t('fDate')}</div><b>{fday(o.event_date, lang)}</b><div className="dd-note">{fperiod(o.period, lang)}</div></div>
          <div><div className="dd-eyebrow">{t('fTypeTeam')}</div><b>{t(o.type === 'big' ? 'bigShort' : 'smallShort')}</b><div className="dd-note">{o.team.map(p => p.name).join(' + ') || '—'}</div></div>
          <div><div className="dd-eyebrow">{t('fPricePaid')}</div><b className="num">{fm(o.price_usd)} · {fm(o.paid_usd)}</b><div className="dd-note">{t('toPayShort', { sum: fm(o.to_pay_usd) })}</div></div>
        </div>
        <div className="dd-row" style={{ marginTop: 10, gap: 6 }}>
          <StatusChip status={o.status} />
          {o.has_conflict && <Chip tone="bad">{t('conflictChip')}</Chip>}
          {o.not_returned && <Chip tone="bad">{t('notReturnedChip')}</Chip>}
          {o.shortage_pending && <Chip tone="warn">{t('tabShortage')}</Chip>}
        </div>
      </Card>
      <Card>
        <h3>{t('designTitle')}</h3>
        {!o.lines.length ? <div className="dd-empty">{t('designEmpty')}</div> : (
          <div className="dd-lines" style={{ gridTemplateColumns: 'none' }}>
            {o.lines.map(l => (
              <div key={l.item_id} className="dd-line">
                <div className="dd-line-head"><b>{l.item}</b>{l.short > 0 ? <Chip tone="bad">{t('shortN', { n: l.short })}</Chip> : <Chip tone="ok">{t('have')}</Chip>}</div>
                <div className="dd-nums"><span>{t('colQty')} <b>{l.qty}</b></span><span>{t('freeOnPeriod')} <b style={{ color: l.short > 0 ? 'var(--bad)' : undefined }}>{l.free}</b></span></div>
              </div>
            ))}
          </div>
        )}
        {['lead', 'design'].includes(o.status) && can('create_order') && (
          <button type="button" className="dd-btn lg wide" style={{ marginTop: 12 }} onClick={() => nav(`/decor/calc?order=${o.id}`)}><Icon name="calc" size={18} /> {t('buildInCalc')}</button>
        )}
      </Card>
      <Card>
        <h3>{t('statusTitle')}</h3>
        <div className="dd-row" style={{ marginTop: 10 }}>
          {prev && <button type="button" className="dd-btn ghost lg" disabled={!can('change_status') || busy} onClick={() => setStatus(prev)}>← {t(`st_${prev}`)}</button>}
          {next && <button type="button" className={`dd-btn lg ${next === 'closed' ? 'ok' : ''}`} disabled={!can('change_status') || busy || (next === 'closed' && !ck.ok)} onClick={() => setStatus(next)}>{t(`st_${next}`)} →</button>}
        </div>
        {o.status === 'closed' && <p className="dd-note" style={{ marginTop: 8 }}>{t('reopenOwner')}</p>}
        <div style={{ marginTop: 14 }}>
          <div className="dd-eyebrow">{t('beforeClose')}</div>
          {row(t('ckFinal'), ck.final_returned)}
          {ck.waiting_final.length > 0 && <div className="dd-note" style={{ paddingTop: 6 }}>{t('waitingFinalList', { list: ck.waiting_final.map(w => `${w.item} (${w.on_site})`).join(', ') })}</div>}
          {row(t('ckPaid'), ck.paid_in_cashbox)}
          {row(t('ckAccept'), ck.acceptance_approved)}
          {row(t('ckEvidence'), ck.evidence_ok)}
          {ck.shortage_usd > 0 && o.status !== 'closed' && <div className="dd-warnline warn"><Icon name="alert" size={16} /> {t('shortageOnClose', { sum: fm2(ck.shortage_usd) })}</div>}
        </div>
      </Card>
      {o.status !== 'lead' && (
        <Card>
          <div className="dd-row dd-between"><h3>{t('evStagesTitle')}</h3>{o.evidence_missing > 0 ? <Chip tone="bad">{t('evMissingN', { n: o.evidence_missing })}</Chip> : <Chip tone="ok">✓</Chip>}</div>
          <p className="dd-note" style={{ marginTop: 4 }}>{t('evStagesNote')}</p>
          <EvidenceStatus list={o.evidence} onAdd={can('handle_decor') ? setAddEv : null} />
          {o.evidence_files.some(e => e.stage !== 'handover') && (
            <div style={{ marginTop: 12 }}>
              {o.evidence_files.filter(e => e.stage !== 'handover').map(e => (
                <div key={e.id} style={{ marginTop: 8 }}>
                  <div className="dd-eyebrow">{t(`ev_${e.stage}`)}{e.comment ? ` · ${e.comment}` : ''}</div>
                  <div className="dd-thumbs" style={{ marginTop: 6 }}>{e.files.map(f => <Thumb key={f.id} f={f} />)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </>;
  }
}

// ---------- Декор: движение по вещам, недостача, история ----------
function DecorTab({ o, nav }) {
  const { t, lang } = useT();
  return <>
    <Card>
      <h3>{t('flowTitle')}</h3>
      {o.shortage && <div className={`dd-warnline ${o.shortage.status === 'pending' ? 'warn' : 'bad'}`}><Icon name="alert" size={16} />
        {o.shortage.status === 'pending' ? t('tabShortage') : t('sfTitle')}: {o.shortage.items.map(x => `${x.item} ${x.qty}`).join(', ')}{o.shortage.amount_usd !== undefined ? ` · ${fm2(o.shortage.amount_usd)}` : ''}</div>}
      {o.recovered_after_close && <div className="dd-warnline ok"><Icon name="undo" size={16} /> {t('recoveredTitle')}: {o.recovered_after_close.items.map(x => `${x.item} ${x.qty}`).join(', ')}{o.recovered_after_close.amount_usd !== undefined ? ` · ${fm2(o.recovered_after_close.amount_usd)}` : ''}</div>}
      <div className="dd-lines" style={{ gridTemplateColumns: 'none' }}>
        {o.flows.map(f => (
          <div key={f.item_id} className={`dd-line ${f.final_done || (f.issued && f.onSite <= 0) ? 'done' : ''}`}>
            <div className="dd-line-head"><b>{f.item}</b>
              {f.final_done ? (f.onSite > 0 ? <Chip tone={o.status === 'closed' ? 'bad' : 'warn'}>{t('colOnSite')} {f.onSite}</Chip> : <Chip tone="ok">{t('finalDone')}</Chip>)
                : f.onSite > 0 ? <Chip tone={o.not_returned ? 'bad' : 'blue'}>{t('colOnSite')} {f.onSite}</Chip> : <Chip tone="gray">{t('nothingOnSite')}</Chip>}</div>
            <div className="dd-nums">
              <span>{t('colDesign')} <b>{f.design || '·'}</b></span><span>{t('colIssued')} <b>{f.issued || '·'}</b></span><span>{t('colLeft')} <b>{f.left || '·'}</b></span>
              <span>{t('colFinal')} <b>{f.final_done ? f.fin : '·'}</b></span>{f.late > 0 && <span>{t('colLate')} <b>{f.late}</b></span>}
            </div>
          </div>
        ))}
        {!o.flows.length && <div className="dd-empty">{t('noMoves')}</div>}
      </div>
      <div className="dd-row" style={{ marginTop: 12 }}>
        <button type="button" className="dd-btn ghost" onClick={() => nav(`/decor/warehouse?tab=${o.moves.some(m => m.type === 'issue') ? 'onsite' : 'requests'}&order=${o.id}`)}><Icon name="box" size={16} /> {t('openWarehouse')}</button>
        <span className="dd-note">{t('warehouseNote')}</span>
      </div>
    </Card>
    <Card>
      <h3>{t('history')}</h3>
      {!o.moves.length ? <div className="dd-empty">{t('noMoves')}</div> : o.moves.map(m => (
        <div key={m.id} className="dd-hist">
          <span>{t(`mv_${m.type}`)} · {m.item}{m.after_close ? ` · ${t('afterClose')}` : ''} <span className="dd-note">{fday(m.date, lang)}</span></span>
          <b className="num">{m.qty} {t('pcs')}{m.amount_usd !== undefined ? ` · ${fm2(m.amount_usd)}` : ''}</b>
        </div>
      ))}
    </Card>
  </>;
}

// ---------- Себестоимость: раскладка и факт расходов ----------
function CostTab({ o, busy, act, actions }) {
  const { t, lang } = useT();
  const c = o.cost; const closed = o.status === 'closed';
  const [f, setF] = useState(() => ({ ...o.extras, price_usd: o.price_usd }));
  useEffect(() => { setF({ ...o.extras, price_usd: o.price_usd }); }, [o]);
  const set = (k, v) => { setF({ ...f, [k]: numIn(v) }); actions.reset(`costs:${o.id}`); };
  const save = () => act(`costs:${o.id}`, cfg => api.put(`/orders/${o.id}/costs`, Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v) || 0])), cfg), t('costSaved'));
  const inp = k => (closed ? <b className="num">{k === 'consumables_uzs' ? fsum(f[k], lang) : fm2(f[k])}</b>
    : <input className="dd-inp r num" inputMode="decimal" value={f[k]} onChange={e => set(k, e.target.value)} aria-label={k} />);
  const line = (label, v, extra) => <div className="dd-sum-line"><span>{label}</span><b className="num" style={extra}>{fm2(v)}</b></div>;
  return (
    <Card>
      <div className="dd-row dd-between"><h3>{t('costOrder')}</h3><Chip tone={c.mode === 'closed' || c.mode === 'fact' ? 'ok' : c.mode === 'partial' ? 'blue' : 'gray'}>{t(`mode_${c.mode}`)}</Chip></div>
      <div style={{ marginTop: 10 }}>
        {line(t('cWearShort'), c.wear)}
        <div className="dd-sum-line"><span>{t('cShortage')}{c.shortage_preliminary ? ` · ${t('preliminary')}` : ''}</span><b className="num" style={{ color: c.shortage ? 'var(--bad)' : undefined }}>{fm2(c.shortage)}</b></div>
        {line(t('cTeamPiece'), c.team)}
        <div className="dd-sum-line"><span>{t('cTransportUsd')}</span>{inp('transport_usd')}</div>
        <div className="dd-sum-line"><span>{t('cConsUzs')} · {fm2(c.consumables)}</span>{inp('consumables_uzs')}</div>
        <div className="dd-sum-line"><span>{t('cRented')}</span>{inp('rented_decor_usd')}</div>
        <div className="dd-sum-line"><span>{t('cOtherUsd')}</span>{inp('other_usd')}</div>
        <div className="dd-sum-line strong"><span>{t('cDirect')}</span><span className="num">{fm2(c.direct)}</span></div>
        {line(t('cFixedShort'), c.fixed)}
        <div className="dd-sum-line strong hl"><span>{t('cFull')}</span><span className="num">{fm2(c.full)}</span></div>
        <div className="dd-sum-line"><span>{t('priceUsd')}</span>{inp('price_usd')}</div>
        <div className="dd-sum-line strong"><span>{t('profit')}</span><span className="num" style={{ color: c.profit < 0 ? 'var(--bad)' : 'var(--ok)' }}>{fm2(c.profit)}</span></div>
      </div>
      {c.below_cost && <div className="dd-warnline bad"><Icon name="alert" size={16} /> {t('belowCost')}</div>}
      {closed ? <p className="dd-note" style={{ marginTop: 10 }}>{t('closedNote')}</p> : <>
        <button type="button" className="dd-btn lg wide" style={{ marginTop: 14 }} disabled={busy} onClick={save}><Icon name="check" size={18} /> {t('saveBtn')}</button>
        <p className="dd-note" style={{ marginTop: 8 }}>{t('costNote')}</p>
      </>}
    </Card>
  );
}

// ---------- Деньги: оплаты, «сдал кассиру», подтверждение кассой, приём оплаты ----------
function MoneyTab({ o, busy, act, actions }) {
  const { t, lang } = useT();
  const { me, can } = useDecor();
  const [hand, setHand] = useState(null);     // окно «Сдал кассиру» (с фото чека) или «Добавить фото чека»
  const pms = o.team.filter(p => p.level === 'pm');
  const canCash = can('confirm_money');
  const mine = me.employee && o.team.some(p => p.id === me.employee.id) ? me.employee.id : null;
  const blank = () => ({ amount: o.to_pay_usd ? String(o.to_pay_usd) : '', kind: 'final', who: canCash ? 'cashbox' : String(mine || pms[0]?.id || '') });
  const [f, setF] = useState(blank);
  useEffect(() => { setF(blank()); }, [o.id, o.to_pay_usd]);   // eslint-disable-line react-hooks/exhaustive-deps
  const set = p => { setF({ ...f, ...p }); actions.reset(`pay:${o.id}`); };
  const take = () => {
    const who = f.who === 'cashbox' ? null : Number(f.who);
    const name = who ? o.team.find(p => p.id === who)?.name : null;
    return act(`pay:${o.id}`, cfg => api.post(`/orders/${o.id}/payments`, { amount_usd: Number(f.amount), kind: f.kind, received_by_employee_id: who }, cfg),
      who ? t('paidAtPm', { name }) : t('paidCash'));
  };
  const canTake = (can('take_money') || canCash) && !['lead', 'closed'].includes(o.status);
  return <>
    <Card>
      <h3>{t('paymentsTitle')}</h3>
      {!o.payments.length ? <div className="dd-empty">{t('noPayments')}</div> : (
        <div className="dd-lines" style={{ gridTemplateColumns: 'none' }}>
          {o.payments.map(p => (
            <div key={p.id} className="dd-line">
              <div className="dd-line-head"><b className="num">{fm(p.amount_usd)} · {t(`pk_${p.kind}`)}</b><Chip tone={PS_TONE[p.status]}>{t(`ps_${p.status}`)}</Chip></div>
              <div className="dd-line-head">
                <div className="dd-nums"><span>{fday(p.date, lang)}</span><span>{t('colWho')} <b>{p.received_by?.name || t('cashboxName')}</b></span></div>
                <div className="dd-line-acts">
                  {p.status === 'at_pm' && <button type="button" className="dd-btn ghost sm" disabled={busy} onClick={() => setHand({ p, mode: 'hand' })}><Icon name="camera" size={16} /> {t('handBtn')}</button>}
                  {p.received_by && p.status !== 'at_pm' && !p.receipt.length && <button type="button" className="dd-btn ghost sm" disabled={busy} onClick={() => setHand({ p, mode: 'add' })}>{t('addReceipt')}</button>}
                  {p.status !== 'confirmed' && canCash && <button type="button" className="dd-btn ok sm" disabled={busy} onClick={() => act(`confirm:${p.id}`, cfg => api.post(`/payments/${p.id}/confirm`, {}, cfg), t('confirmedOk', { sum: fm(p.amount_usd) }))}>{t('confirmCash')}</button>}
                </div>
              </div>
              {p.received_by && p.status !== 'at_pm' && (
                p.receipt.length ? <div className="dd-thumbs">{p.receipt.map(f => <Thumb key={f.id} f={f} />)}</div>
                  : <div className="dd-note">{t('noReceipt')}</div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="dd-sum-line strong" style={{ marginTop: 8 }}><span>{t('toPayLine')}</span><span className="num">{fm(o.to_pay_usd)}</span></div>
    </Card>
    {hand && <HandSheet o={o} p={hand.p} mode={hand.mode} busy={busy} act={act} actions={actions} onClose={() => setHand(null)} />}
    {canTake && (
      <Card>
        <h3>{t('takeTitle')}</h3>
        <div className="dd-form" style={{ marginTop: 10 }}>
          <div className="dd-field"><label htmlFor="pay_amt">{t('amountUsd')}</label><input id="pay_amt" className="dd-inp num" inputMode="decimal" value={f.amount} onChange={e => set({ amount: numIn(e.target.value) })} /></div>
          <div className="dd-field"><label htmlFor="pay_kind">{t('whatKind')}</label>
            <select id="pay_kind" className="dd-inp" value={f.kind} onChange={e => set({ kind: e.target.value })}>{['prepay', 'final', 'topup'].map(k => <option key={k} value={k}>{t(`pk_${k}`)}</option>)}</select></div>
          <div className="dd-field"><label htmlFor="pay_by">{t('whoTook')}</label>
            <select id="pay_by" className="dd-inp" value={f.who} onChange={e => set({ who: e.target.value })}>
              {canCash && <option value="cashbox">{t('cashboxOpt')}</option>}
              {pms.map(p => <option key={p.id} value={p.id}>{t('pmOpt', { name: p.name })}</option>)}
            </select></div>
        </div>
        <div className="dd-row" style={{ marginTop: 12 }}>
          <button type="button" className="dd-btn lg" disabled={busy || !(Number(f.amount) > 0) || !f.who} onClick={take}>{t('takeBtn')}</button>
          <span className="dd-note">{t('takeNote')}</span>
        </div>
      </Card>
    )}
  </>;
}

// ---------- Отчёты: загрузка с телефона, одобрение и возврат ----------
function ReportsTab({ o, busy, act, actions }) {
  const { t, lang } = useT();
  const { me, can } = useDecor();
  const mine = me.employee && o.team.some(p => p.id === me.employee.id) ? me.employee.id : null;
  const [f, setF] = useState({ stage: 'install', employee: String(mine || o.team[0]?.id || ''), comment: '', files: [] });
  const [replies, setReplies] = useState({});
  const rules = useEvidenceRules();
  const ready = useEvidenceReady(f.stage, f.files);
  const set = p => { setF({ ...f, ...p }); actions.reset(`report:${o.id}`); };
  const send = async () => {
    const fd = evForm({ stage: f.stage, employee_id: f.employee, comment: f.comment }, f.files);
    const r = await act(`report:${o.id}`, cfg => api.post(`/orders/${o.id}/reports`, fd, cfg), t('reportSent'));
    if (r) { dropFiles(f.files); setF({ ...f, comment: '', files: [] }); }
  };
  const decide = (r, decision) => act(`decision:${r.id}:${decision}:${replies[r.id] || ''}`, cfg => api.post(`/reports/${r.id}/decision`, { decision, reply: replies[r.id] || '' }, cfg),
    d => (decision === 'return' ? t('returnedOk') : d.accrued?.length ? t('approvedAccrued', { sum: fm(d.accrued.reduce((a, x) => a + x.amount_usd, 0)) }) : t('approvedOk')));
  const canUpload = can('upload_report') && !['lead', 'closed'].includes(o.status);
  return <>
    {canUpload && (
      <Card>
        <h3>{t('uploadTitle')}</h3>
        <div className="dd-form" style={{ marginTop: 10 }}>
          <div className="dd-field"><label htmlFor="rep_stage">{t('stage')}</label>
            <select id="rep_stage" className="dd-inp" value={f.stage} onChange={e => set({ stage: e.target.value })}>{['install', 'acceptance', 'dismantle'].map(s => <option key={s} value={s}>{t(`rs_${s}`)}</option>)}</select></div>
          <div className="dd-field"><label htmlFor="rep_by">{t('executor')}</label>
            <select id="rep_by" className="dd-inp" value={f.employee} onChange={e => set({ employee: e.target.value })}>{o.team.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="dd-field" style={{ gridColumn: '1 / -1' }}><label htmlFor="rep_cm">{t('commentLabel')}</label>
            <input id="rep_cm" className="dd-inp" value={f.comment} placeholder={t('commentPh')} onChange={e => set({ comment: e.target.value })} /></div>
        </div>
        <div style={{ marginTop: 12 }}><EvidencePicker stage={f.stage} files={f.files} onChange={files => set({ files })} /></div>
        <button type="button" className="dd-btn lg wide" style={{ marginTop: 12 }} disabled={busy || !f.employee || !ready} onClick={send}><Icon name="camera" size={18} /> {t('sendReport')}</button>
      </Card>
    )}
    {!o.reports.length ? <Card className="dd-empty">{t('noReports')}</Card> : o.reports.map(r => {
      const gap = gapOf(ruleOf(rules, r.stage), r.files);
      return (
      <Card key={r.id}>
        <div className="dd-row dd-between">
          <div><h3>{t(`rs_${r.stage}`)}</h3><div className="dd-sub">{r.employee?.name || '—'} · {fday(r.date, lang)}</div></div>
          <Chip tone={RS_TONE[r.status]}>{t(`rst_${r.status}`)}</Chip>
        </div>
        {r.comment && <p style={{ marginTop: 10 }}>{r.comment}</p>}
        {r.reply && <p className="dd-note" style={{ marginTop: 6 }}>↳ {r.reply}</p>}
        <div className="dd-thumbs" style={{ marginTop: 10 }}>{r.files.length ? r.files.map(file => <Thumb key={file.id} f={file} />) : <span className="dd-note">{t('noFiles')}</span>}</div>
        {r.status !== 'returned' && <div className={`dd-warnline ${gap.ok ? 'ok' : 'bad'}`} style={{ marginTop: 10 }}>
          {gap.ok ? <>✓ {t('evComplete')} · {t('evHave', { photos: gap.have.photos, videos: gap.have.videos })}</> : <><Icon name="alert" size={16} /> {t('evIncomplete')}: {missingText(t, gap.missing)}</>}</div>}
        {r.status === 'pending' && can('approve_report') && <>
          <div className="dd-row" style={{ marginTop: 12 }}>
            <input className="dd-inp" style={{ flex: '1 1 200px' }} placeholder={t('replyPh')} value={replies[r.id] || ''} onChange={e => setReplies({ ...replies, [r.id]: e.target.value })} aria-label={t('replyPh')} />
            <button type="button" className="dd-btn ok" disabled={busy || !gap.ok} title={gap.ok ? '' : missingText(t, gap.missing)} onClick={() => decide(r, 'approve')}><Icon name="check" size={16} /> {t('approveBtn')}</button>
            <button type="button" className="dd-btn bad" disabled={busy} onClick={() => decide(r, 'return')}>{t('returnBtn')}</button>
          </div>
          {!gap.ok && <p className="dd-note" style={{ marginTop: 6 }}>{t('approveNeedsEvidence')}</p>}
          {r.stage === 'acceptance' && <p className="dd-note" style={{ marginTop: 6 }}>{t('acceptanceNote')}</p>}
        </>}
      </Card>
      );
    })}
  </>;
}

// ---------- «Сдал кассиру» с фото чека / «Добавить фото чека» к уже сданным деньгам ----------
function HandSheet({ o, p, mode, busy, act, actions, onClose }) {
  const { t } = useT();
  const aid = mode === 'hand' ? `hand:${p.id}` : `receipt:${p.id}`;
  const send = (files, comment) => act(aid, cfg => (mode === 'hand'
    ? api.post(`/payments/${p.id}/hand`, evForm({ comment }, files), cfg)
    : api.post(`/orders/${o.id}/evidence`, evForm({ stage: 'handover', payment_id: p.id, comment }, files), cfg)),
  mode === 'hand' ? t('handedOk') : t('receiptAdded'));
  return <EvidenceSheet title={`${mode === 'hand' ? t('handBtn') : t('addReceipt')} · ${fm(p.amount_usd)}`} note={t('handNote')} stage="handover"
    commentPh={t('handCommentPh')} busy={busy} actions={actions} aid={aid} send={send} onClose={onClose} />;
}

// ---------- «Добавить доказательства» к выдаче или финальному возврату (старые заказы, поднятые требования) ----------
function AddEvidenceSheet({ o, stage, busy, act, actions, onClose }) {
  const { t } = useT();
  const aid = `addEv:${o.id}:${stage}`;
  const send = (files, comment) => act(aid, cfg => api.post(`/orders/${o.id}/evidence`, evForm({ stage, comment }, files), cfg), t('evAdded'));
  return <EvidenceSheet title={`${t('evAdd')} · ${t(`ev_${stage}`)} · ${o.no}`} note={t('evAddNote')} stage={stage}
    shortage={stage === 'final' && Boolean(o.shortage)} commentPh={stage === 'final' && o.shortage ? t('shortageCommentPh') : null}
    busy={busy} actions={actions} aid={aid} send={send} onClose={onClose} />;
}

export const useStatusCounts = list => useMemo(() => Object.fromEntries(STATUSES.map(s => [s, list.filter(o => o.status === s).length])), [list]);
