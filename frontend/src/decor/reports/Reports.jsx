// Фото и видео отчёты: очередь на одобрение по всем заказам (фильтр по этапу), фото и видео, комплект по требованиям,
// «Одобрить» (только с полным комплектом) / «Вернуть» с комментарием, последние решения. Загрузка — в карточке заказа.
// Одобрение «Приёмки» начисляет команде сдельную оплату (ставка замораживается в начислении).
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api.js';
import Icon from '../icons.jsx';
import { useT, fm, fday, fts } from '../i18n.js';
import { useDecor, useLoad, useActions, Hero, Card, Chip, Loading, Empty, NoAccess } from '../kit.jsx';
import { Thumb, missingText, evidenceError } from '../evidence.jsx';
import OrderCard from '../orders/OrderCard.jsx';

const RS_TONE = { pending: 'blue', approved: 'ok', returned: 'bad' };

export default function Reports() {
  const { t, lang } = useT();
  const { can, toast, refreshHints } = useDecor();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, err, reload] = useLoad(() => api.get('/reports').then(r => r.data), []);
  const [stage, setStage] = useState('all');
  const [replies, setReplies] = useState({});
  const actions = useActions();
  const busy = !!actions.busy;
  const open = Number(params.get('open')) || null;
  if (err?.response?.status === 403) return <><Hero id="reports" /><NoAccess err={err} /></>;
  if (!data) return <><Hero id="reports" /><Loading err={err} retry={reload} /></>;
  const decide = async (r, decision) => {
    const reply = replies[r.id] || '';
    try {
      const res = await actions.run(`decision:${r.id}:${decision}:${reply}`, cfg => api.post(`/reports/${r.id}/decision`, { decision, reply }, cfg));
      if (!res) return;
      const d = res.data;
      toast(decision === 'return' ? t('returnedOk') : d.accrued?.length ? t('approvedAccrued', { sum: fm(d.accrued.reduce((a, x) => a + x.amount_usd, 0)) }) : t('approvedOk'));
      reload(); refreshHints();
    } catch (e) { toast(evidenceError(t, e), 'bad'); reload(); }
  };
  const pending = data.pending.filter(r => stage === 'all' || r.stage === stage);
  const incomplete = data.pending.filter(r => !r.evidence.ok).length;
  const count = s => data.pending.filter(r => r.stage === s).length;
  return (
    <>
      <Hero id="reports" stats={[[data.pending.length, t('rpStatPending')], [incomplete, t('rpStatIncomplete')], [data.decided.filter(r => r.status === 'approved').length, t('rpStatApproved')]]}
        acts={[{ label: t('s_orders'), onClick: () => nav('/decor/orders') }]} />
      <div className="dd-statuspick" role="tablist">
        {[['all', t('aiAll'), data.pending.length], ...['install', 'acceptance', 'dismantle'].map(s => [s, t(`rs_${s}`), count(s)])].map(([k, l, c]) => (
          <button key={k} type="button" role="tab" aria-selected={stage === k} className={stage === k ? 'on' : ''} onClick={() => setStage(k)}>{l}<span>{c}</span></button>
        ))}
      </div>
      {!pending.length ? <Empty>{t('rpNone')}</Empty> : pending.map(r => (
        <Card key={r.id}>
          <div className="dd-row dd-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <button type="button" className="dd-linkbtn" onClick={() => setParams({ open: String(r.order_id) })}><h3>{r.no} · {t(`rs_${r.stage}`)}</h3></button>
              <div className="dd-sub">{r.employee?.name || '—'} · {fday(r.date, lang)} · {r.client}</div>
            </div>
            <Chip tone={RS_TONE[r.status]}>{t(`rst_${r.status}`)}</Chip>
          </div>
          {r.comment && <p style={{ marginTop: 10 }}>{r.comment}</p>}
          <div className="dd-thumbs" style={{ marginTop: 10 }}>{r.files.length ? r.files.map(f => <Thumb key={f.id} f={f} />) : <span className="dd-note">{t('noFiles')}</span>}</div>
          <div className={`dd-warnline ${r.evidence.ok ? 'ok' : 'bad'}`} style={{ marginTop: 10 }}>
            {r.evidence.ok ? <>✓ {t('evComplete')} · {t('evHave', { photos: r.evidence.have.photos, videos: r.evidence.have.videos })}</>
              : <><Icon name="alert" size={16} /> {t('evIncomplete')}: {missingText(t, r.evidence.missing)}</>}
          </div>
          {can('approve_report') && <>
            <div className="dd-row" style={{ marginTop: 12 }}>
              <input className="dd-inp" style={{ flex: '1 1 200px' }} placeholder={t('replyPh')} value={replies[r.id] || ''} onChange={e => setReplies({ ...replies, [r.id]: e.target.value })} aria-label={t('replyPh')} />
              <button type="button" className="dd-btn ok" disabled={busy || !r.evidence.ok} title={r.evidence.ok ? '' : missingText(t, r.evidence.missing)} onClick={() => decide(r, 'approve')}><Icon name="check" size={16} /> {t('approveBtn')}</button>
              <button type="button" className="dd-btn bad" disabled={busy} onClick={() => decide(r, 'return')}>{t('returnBtn')}</button>
            </div>
            {!r.evidence.ok && <p className="dd-note" style={{ marginTop: 6 }}>{t('approveNeedsEvidence')}</p>}
            {r.stage === 'acceptance' && <p className="dd-note" style={{ marginTop: 6 }}>{t('acceptanceNote')}</p>}
          </>}
        </Card>
      ))}
      <Card>
        <h3>{t('rpDecided')}</h3>
        {!data.decided.length ? <div className="dd-empty">{t('rpNoDecided')}</div> : (
          <div className="dd-lines" style={{ marginTop: 8 }}>
            {data.decided.map(r => (
              <div key={r.id} className="dd-line">
                <div className="dd-line-head">
                  <button type="button" className="dd-linkbtn" onClick={() => setParams({ open: String(r.order_id) })}><b>{r.no} · {t(`rs_${r.stage}`)}</b></button>
                  <Chip tone={RS_TONE[r.status]}>{t(`rst_${r.status}`)}</Chip>
                </div>
                <div className="dd-nums"><span>{r.employee?.name || '—'}</span><span>{r.decided_at ? fts(r.decided_at, lang) : fday(r.date, lang)}</span>
                  <span>{t('filesN', { n: r.files.length })}</span>{r.reply && <span>↳ {r.reply}</span>}</div>
              </div>
            ))}
          </div>
        )}
        <p className="dd-note" style={{ marginTop: 8 }}>{t('rpUploadNote')}</p>
      </Card>
      {open && <OrderCard id={open} onClose={() => setParams({})} onChanged={reload} />}
    </>
  );
}
