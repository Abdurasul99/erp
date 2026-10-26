// Главная (как в прототипе): приветствие, 4 цифры (заказы на 7 дней, деньги у ПМ, отчёты на одобрении, прибыль закрытых /
// касса / заказы без фото — по полномочиям), карточка Wave Intelligence с главной проблемой (конфликт брони → не вернулось →
// несданные деньги → не хватает фото → всё под контролем), «сегодня и завтра», отделы.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useT, fm, fday, ftoday } from '../i18n.js';
import { SECTIONS, useDecor, useLoad, Card, Chip, StatusChip, Tile, Loading } from '../kit.jsx';
import { hintView } from '../ai/hintText.js';

const visible = (s, me) => s !== '|' && (!s.feature || me.features.includes(s.feature)) && !(me.panel_off || []).includes(s.id);

export default function Home() {
  const { t, lang } = useT();
  const { me } = useDecor();
  const nav = useNavigate();
  const [h, err, reload] = useLoad(() => api.get('/home').then(r => r.data), []);
  const name = me.user.first_name || me.user.username;
  const k = h?.kpi || {};
  const kpis = h ? [
    [t('homeWeek'), k.week_orders, t('homeWeekSub'), null, '/decor/orders'],
    ...(k.pm_debt_usd !== undefined ? [[t('homeDebt'), fm(k.pm_debt_usd), t('homeDebtSub'), k.pm_debt_usd > 0 ? 'var(--warn)' : null, '/decor/finance?tab=money']] : []),
    [t('homeReports'), k.pending_reports, t('homeReportsSub'), k.pending_reports > 0 ? 'var(--blue)' : null, '/decor/reports'],
    ...(k.closed_profit_usd !== undefined ? [[t('homeProfit'), fm(k.closed_profit_usd), t('homeProfitSub', { sum: fm(k.closed_shortage_usd || 0) }), null, '/decor/finance?tab=costs']]
      : k.cash_usd !== undefined ? [[t('homeCash'), fm(k.cash_usd), t('homeCashSub'), null, '/decor/finance?tab=cash']]
        : [[t('homeNoPhoto'), k.evidence_missing_orders, t('homeNoPhotoSub'), k.evidence_missing_orders > 0 ? 'var(--bad)' : null, '/decor/orders']]),
  ].slice(0, 4) : [];
  const intel = h ? hintView(t, lang, h.intel) : null;
  return (
    <>
      <div className="dd-greet">
        <h1>{t('hello', { name })}</h1>
        <p><span className="dd-dot" />{ftoday(h?.today || new Date().toISOString().slice(0, 10), lang)} · {me.user.company_name}</p>
      </div>
      {!h ? <Loading err={err} retry={reload} /> : <>
        <div className="dd-grid dd-g4">
          {kpis.map(([label, v, sub, color, to]) => (
            <button key={label} type="button" className="dd-card dd-kpi" onClick={() => nav(to)}>
              <div className="dd-eyebrow">{label}</div><b className="num" style={{ color: color || undefined }}>{v}</b><small>{sub}</small>
            </button>
          ))}
        </div>
        <div className="dd-grid dd-g2" style={{ alignItems: 'stretch' }}>
          <Card className="dd-intel">
            <div className="dd-eyebrow">✦ Wave Intelligence · {t('homeHint')}</div>
            <h3>{intel.title}</h3><p>{intel.text}</p>
            <div className="dd-row" style={{ gap: 8 }}>
              <button type="button" className="dd-ibtn" onClick={() => nav(intel.to)}>{intel.action} →</button>
              {h.hints_count > 1 && <button type="button" className="dd-ibtn ghost" onClick={() => nav('/decor/ai')}>{t('homeAllHints', { n: h.hints_count })}</button>}
            </div>
          </Card>
          <Card>
            <div className="dd-row dd-between"><h3>{t('homeToday')}</h3><Chip tone="gray">{t('homeTodayN', { n: h.today_tomorrow.length })}</Chip></div>
            {!h.today_tomorrow.length ? <div className="dd-empty">{t('homeTodayNone')}</div> : (
              <div className="dd-lines" style={{ marginTop: 10, gridTemplateColumns: 'none' }}>
                {h.today_tomorrow.map(o => (
                  <button key={o.id} type="button" className="dd-line dd-line-btn" onClick={() => nav(`/decor/orders?open=${o.id}`)}>
                    <div className="dd-line-head"><b>{o.no} · {o.client}</b><StatusChip status={o.status} /></div>
                    <div className="dd-nums"><span>{fday(o.event_date, lang)}</span><span>{o.team.map(p => p.name).join(', ') || '—'}</span>
                      {o.evidence_missing > 0 && <Chip tone="warn">{t('evChip', { n: o.evidence_missing })}</Chip>}</div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </>}
      <Card>
        <div className="dd-row dd-between"><h3>{t('departments')}</h3><span className="dd-sub">{t('quickGo')}</span></div>
        <div className="dd-grid dd-g4" style={{ marginTop: 12 }}>
          {SECTIONS.filter(s => s !== '|' && s.id !== 'home' && s.id !== 'tools' && s.id !== 'ai' && visible(s, me)).map(s => (
            <button key={s.id} type="button" className="dd-card dd-tool flat" onClick={() => nav(`/decor/${s.path}`)}>
              <Tile g={s.g} i={s.i} />
              <div><h3>{t(`s_${s.id}`)}</h3><div className="dd-sub">{t(`d_${s.id}`)}</div></div>
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}
