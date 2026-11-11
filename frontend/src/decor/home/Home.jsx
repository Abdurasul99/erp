// Главная (как в прототипе): приветствие, 4 цифры (заказы за выбранный период, деньги у ПМ, отчёты на одобрении, прибыль закрытых /
// касса / заказы без фото — по полномочиям), карточка Wave Intelligence с главной проблемой (конфликт брони → не вернулось →
// несданные деньги → не хватает фото → всё под контролем), «сегодня и завтра», отделы.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useT, fm, fday, fdm, ftoday, localYmd, addDays } from '../i18n.js';
import { SECTIONS, useDecor, useLoad, Card, Chip, StatusChip, Tile, Loading } from '../kit.jsx';
import { hintView } from '../ai/hintText.js';
import { ValuesBar, useValues } from '../values.jsx';
import { taskTitle } from '../manage/taskText.js';

// Период карточки заказов выбирает сам пользователь (владелец, 09.11.2026: было зашито «на 7 дней»).
// 7 / 14 / 30 дней — с сегодняшнего дня, «этот месяц» — с 1-го по последнее число, «свой» — любые две даты.
// Выбор запоминается на устройстве.
const PERIOD_KEY = 'decor_home_period';
const PRESETS = [['7', 'homeP7'], ['14', 'homeP14'], ['30', 'homeP30'], ['month', 'homePMonth'], ['custom', 'homePCustom']];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function rangeOf(p, today) {
  if (p.key === 'month') {
    const [y, m] = today.split('-').map(Number);
    return [`${today.slice(0, 7)}-01`, localYmd(new Date(y, m, 0))];
  }
  if (p.key === 'custom') return [p.from, p.to];
  return [today, addDays(today, Number(p.key) - 1)];
}
function loadPeriod(today) {
  try {
    const p = JSON.parse(localStorage.getItem(PERIOD_KEY));
    if (p && PRESETS.some(x => x[0] === p.key) && (p.key !== 'custom' || (DATE_RE.test(p.from) && DATE_RE.test(p.to) && p.from <= p.to))) return p;
  } catch { /* хранилище недоступно или испорчено */ }
  return { key: '7', from: today, to: addDays(today, 6) };
}

const visible = (s, me) => s !== '|' && (!s.feature || me.features.includes(s.feature)) && (!s.perm || me.permissions.includes(s.perm))
  && !(me.panel_off || []).includes(s.id);

export default function Home() {
  const { t, lang } = useT();
  const { me } = useDecor();
  const nav = useNavigate();
  const today = localYmd();
  const [values, reloadValues] = useValues();
  const [period, setPeriod] = useState(() => loadPeriod(today));
  const [from, to] = rangeOf(period, today);
  const choose = p => { setPeriod(p); try { localStorage.setItem(PERIOD_KEY, JSON.stringify(p)); } catch { /* только на сессию */ } };
  const [h, err, reload] = useLoad(() => api.get('/home', { params: { from, to } }).then(r => r.data), [from, to]);
  const name = me.user.first_name || me.user.username;
  const k = h?.kpi || {};
  const kpis = h ? [
    [t('homeOrders'), k.period_orders, `${from === to ? fdm(from, lang) : `${fdm(from, lang)} – ${fdm(to, lang)}`} · ${t('homeOrdersSub', { a: k.period_active ?? 0, c: k.period_closed ?? 0 })}`, null, '/decor/orders'],
    ...(k.pm_debt_usd !== undefined ? [[t('homeDebt'), fm(k.pm_debt_usd), t('homeDebtSub'), k.pm_debt_usd > 0 ? 'var(--warn)' : null, '/decor/finance?tab=money']] : []),
    [t('homeReports'), k.pending_reports, t('homeReportsSub'), k.pending_reports > 0 ? 'var(--blue)' : null, '/decor/reports'],
    ...(k.closed_profit_usd !== undefined ? [[t('homeProfit'), fm(k.closed_profit_usd), t('homeProfitSub', { sum: fm(k.closed_shortage_usd || 0) }), null, '/decor/finance?tab=costs']]
      : k.cash_usd !== undefined ? [[t('homeCash'), fm(k.cash_usd), t('homeCashSub'), null, '/decor/finance?tab=cash']]
        : [[t('homeNoPhoto'), k.evidence_missing_orders, t('homeNoPhotoSub'), k.evidence_missing_orders > 0 ? 'var(--bad)' : null, '/decor/orders']]),
  ].slice(0, 4) : [];
  const intel = h ? hintView(t, lang, h.intel) : null;
  return (
    <>
      <ValuesBar values={values} refresh={reloadValues} />
      <div className="dd-greet">
        <h1>{t('hello', { name })}</h1>
        <p><span className="dd-dot" />{ftoday(h?.today || new Date().toISOString().slice(0, 10), lang)} · {me.user.company_name}</p>
      </div>
      <div className="dd-period">
        <div className="dd-statuspick" role="tablist" aria-label={t('homePeriod')}>
          {PRESETS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={period.key === key} className={period.key === key ? 'on' : ''}
              onClick={() => choose(key === 'custom' ? { key, from, to } : { key })}>{t(label)}</button>
          ))}
        </div>
        {period.key === 'custom' && (
          <div className="dd-row dd-period-dates">
            <label>{t('homeFrom')} <input className="dd-inp" type="date" value={period.from} max={period.to}
              onChange={e => DATE_RE.test(e.target.value) && e.target.value <= period.to && choose({ ...period, from: e.target.value })} /></label>
            <label>{t('homeTo')} <input className="dd-inp" type="date" value={period.to} min={period.from}
              onChange={e => DATE_RE.test(e.target.value) && e.target.value >= period.from && choose({ ...period, to: e.target.value })} /></label>
          </div>
        )}
      </div>
      {!h ? <Loading err={err} retry={reload} /> : <>
        <div className="dd-grid dd-g4">
          {kpis.map(([label, v, sub, color, to]) => (
            <button key={label} type="button" className="dd-card dd-kpi" onClick={() => nav(to)}>
              <div className="dd-eyebrow">{label}</div><b className="num" style={{ color: color || undefined }}>{v}</b><small>{sub}</small>
            </button>
          ))}
        </div>
        {h.tasks && (h.tasks.overdue > 0 || h.tasks.mine_open > 0) && (
          <Card className={`dd-hometasks ${h.tasks.overdue ? 'bad' : ''}`}>
            <div className="dd-row dd-between">
              <h3>{t('homeTasks')}</h3>
              <div className="dd-row" style={{ gap: 6 }}>
                {h.tasks.overdue > 0 && <Chip tone="bad">{t('homeTasksOverdue', { n: h.tasks.overdue })}</Chip>}
                <Chip tone="gray">{t('homeTasksMine', { n: h.tasks.mine_open })}</Chip>
              </div>
            </div>
            {h.tasks.overdue_list.length > 0 && (
              <div className="dd-lines" style={{ gridTemplateColumns: 'none' }}>
                {h.tasks.overdue_list.map(x => (
                  <button key={x.id} type="button" className="dd-line dd-line-btn" onClick={() => nav(`/decor/manage?open=${x.id}`)}>
                    <div className="dd-line-head"><b>{taskTitle(t, lang, x)}</b><Chip tone="bad">{t('tkDueWas', { date: fdm(x.due_date, lang) })}</Chip></div>
                    {x.assignee && <div className="dd-sub">{x.assignee.name}</div>}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="dd-link" style={{ justifySelf: 'start' }} onClick={() => nav('/decor/manage')}>{t('homeTasksGo')} →</button>
          </Card>
        )}
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
