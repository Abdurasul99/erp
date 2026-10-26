// Wave Intelligence: подсказки по данным компании (конфликты брони, не вернулось, деньги у ПМ, недостача, цена ниже
// себестоимости, отчёты на одобрении, не хватает фото, к выплате, фонд в минусе). Сначала срочные; у каждой — переход.
// Денежные подсказки сервер отдаёт только тем, кто видит деньги.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useT } from '../i18n.js';
import { useDecor, useLoad, Hero, Card, Chip, Loading, NoAccess } from '../kit.jsx';
import { hintView, SEV_TONE } from './hintText.js';

const ORDER = { bad: 0, warn: 1, info: 2 };

export default function AI() {
  const { t, lang } = useT();
  const { refreshHints } = useDecor();
  const nav = useNavigate();
  const [filter, setFilter] = useState('all');
  const [hints, err, reload] = useLoad(() => api.get('/hints').then(r => { refreshHints(); return r.data; }), []);
  if (err?.response?.status === 403) return <><Hero id="ai" /><NoAccess err={err} /></>;
  if (!hints) return <><Hero id="ai" /><Loading err={err} retry={reload} /></>;
  const sorted = [...hints].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const all = filter === 'all' ? sorted : sorted.filter(h => h.severity === filter);
  // Конфликтов брони бывает много (по вещи на каждый день) — первые 3, остальные одной строкой со ссылкой на «Бронь»
  const conflicts = all.filter(h => h.kind === 'conflict');
  const shown = all.filter(h => h.kind !== 'conflict' || conflicts.indexOf(h) < 3);
  const moreConflicts = conflicts.length - 3;
  const n = s => hints.filter(h => h.severity === s).length;
  return (
    <>
      <Hero id="ai" stats={[[hints.length, t('aiStatAll')], [n('bad'), t('aiStatBad')], [n('warn'), t('aiStatWarn')]]} />
      <div className="dd-statuspick" role="tablist" style={{ marginBottom: 0 }}>
        {[['all', t('aiAll'), hints.length], ['bad', t('sev_bad'), n('bad')], ['warn', t('sev_warn'), n('warn')], ['info', t('sev_info'), n('info')]].map(([k, l, c]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}<span>{c}</span></button>
        ))}
      </div>
      {!shown.length ? (
        <Card className="dd-intel"><div className="dd-eyebrow">✦ Wave Intelligence</div><h3>{t('hAllGoodT')}</h3><p>{t('hAllGoodP')}</p></Card>
      ) : (
        <div className="dd-stack">
          {shown.map((h, i) => {
            const v = hintView(t, lang, h);
            const more = h.kind === 'conflict' && conflicts.indexOf(h) === 2 && moreConflicts > 0;
            return (<React.Fragment key={i}>
              <Card className={`dd-hint ${h.severity}`}>
                <div className="dd-row dd-between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 10 }}>
                  <div style={{ minWidth: 0 }}><h3>{v.title}</h3><p className="dd-note" style={{ marginTop: 6, fontSize: 14 }}>{v.text}</p></div>
                  <Chip tone={SEV_TONE[h.severity]}>{t(`sev_${h.severity}`)}</Chip>
                </div>
                <button type="button" className="dd-btn ghost" style={{ marginTop: 10 }} onClick={() => nav(v.to)}>{v.action} →</button>
              </Card>
              {more && <Card className="dd-hint bad"><div className="dd-row dd-between"><b>{t('aiMoreConflicts', { n: moreConflicts })}</b>
                <button type="button" className="dd-btn ghost" onClick={() => nav('/decor/booking')}>{t('hGoBooking')} →</button></div></Card>}
            </React.Fragment>);
          })}
        </div>
      )}
    </>
  );
}
