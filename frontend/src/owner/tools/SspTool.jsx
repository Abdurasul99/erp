import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, Progress, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { Modal, toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

// Авто-источники подставляют факт из живых данных (бэкенд bscLoadFull):
// выручка POS / число новых клиентов / текущая стоимость склада за год стратегии.
const SOURCE_OPTS = [
  { value: 'manual', label: 'Ручной ввод' },
  { value: 'auto_pos', label: 'Авто · Выручка (POS)' },
  { value: 'auto_crm', label: 'Авто · Новые клиенты (CRM)' },
  { value: 'auto_inventory', label: 'Авто · Стоимость склада' },
];

const pctTone = (p) => p == null ? 'gray' : p >= 100 ? 'green' : p >= 70 ? 'blue' : p >= 40 ? 'yellow' : 'red';
const pctColor = (p) => p == null ? '#9CA3AF' : p >= 100 ? '#16A34A' : p >= 70 ? '#1D4ED8' : p >= 40 ? '#D97706' : '#DC2626';

export default function SspTool() {
  const { tt } = useTt();
  const { role } = useContext(BranchScope);
  const isFounder = role === 'founder' || role === 'admin';

  const [tab, setTab] = useState('dashboard');
  const [dash, setDash] = useState(null);
  const [table, setTable] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // fact entry
  const [factForm, setFactForm] = useState({ metric_id: '', fact_date: new Date().toISOString().slice(0, 10), fact_value: '' });
  const [factSaving, setFactSaving] = useState(false);

  // create-strategy modal
  const [showCreate, setShowCreate] = useState(false);

  const reload = async () => {
    setLoading(true); setError(null);
    try {
      const [d, t, f] = await Promise.all([
        api.get('/bsc/dashboard'),
        api.get('/bsc/table'),
        api.get('/bsc/forecast'),
      ]);
      setDash(d.data); setTable(t.data); setForecast(f.data);
    } catch (e) { setError(e.response?.data?.error || e.message); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const hasStrategy = dash && dash.strategy;
  const allMetrics = (table?.departments || []).flatMap(d =>
    d.metrics.filter(m => m.source_type === 'manual').map(m => ({ ...m, dept: d.name })));

  const submitFact = async () => {
    if (!factForm.metric_id || factForm.fact_value === '') { toast(tt('Заполните метрику и значение'), 'error'); return; }
    setFactSaving(true);
    try {
      await api.post('/bsc/fact', {
        metric_id: parseInt(factForm.metric_id, 10),
        fact_date: factForm.fact_date,
        fact_value: parseFloat(factForm.fact_value),
      });
      toast(tt('Факт сохранён'));
      setFactForm({ ...factForm, fact_value: '' });
      await reload();
    } catch (e) { toast(e.response?.data?.error || e.message, 'error'); }
    setFactSaving(false);
  };

  const TABS = [
    { value: 'dashboard', label: tt('Дашборд') },
    { value: 'table', label: tt('Таблица') },
    { value: 'facts', label: tt('Факты') },
    { value: 'forecast', label: tt('Прогноз') },
  ];

  return (
    <>
      <PageHeader
        title={tt('🧭 ССП — Сбалансированная система показателей')}
        sub={tt('Стратегия по отделам · веса · план/факт/% · прогноз 3 года')}
        actions={isFounder ? (
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            {hasStrategy ? tt('Новая стратегия') : tt('Создать стратегию')}
          </button>
        ) : null}
      />

      {loading && !dash ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={220} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !hasStrategy ? (
        <Card>
          <EmptyState icon="🧭" title={tt('Стратегия ещё не создана')}
            description={isFounder
              ? tt('Создайте стратегию: задайте отделы с весами (сумма = 100%), метрики и план на 3 года. Затем вносите факты — система посчитает % выполнения и прогноз.')
              : tt('Учредитель ещё не задал стратегию ССП. Как только она появится — здесь будут показатели по отделам.')}
            action={isFounder ? <button className="btn btn-primary" onClick={() => setShowCreate(true)}>{tt('Создать стратегию')}</button> : null}
          />
        </Card>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Pills value={tab} onChange={setTab} options={TABS} label={tt('Раздел ССП')} />
          </div>

          {tab === 'dashboard' && <DashboardTab dash={dash} tt={tt} />}
          {tab === 'table' && <TableTab table={table} tt={tt} />}
          {tab === 'facts' && (
            <FactsTab tt={tt} metrics={allMetrics} form={factForm} setForm={setFactForm}
              saving={factSaving} onSubmit={submitFact} />
          )}
          {tab === 'forecast' && <ForecastTab forecast={forecast} tt={tt} />}
        </>
      )}

      {showCreate && isFounder && (
        <CreateStrategyModal tt={tt} onClose={() => setShowCreate(false)}
          onCreated={async () => { setShowCreate(false); await reload(); }} />
      )}
    </>
  );
}

// ---------- Dashboard ----------
function DashboardTab({ dash, tt }) {
  const ts = dash.total_score;
  return (
    <>
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Tile icon="🎯" label={tt('Общий итог')} value={ts != null ? `${ts}/100` : '—'}
          sub={tt('Взвешенно по отделам')} color={pctColor(ts)} />
        <Tile icon="📅" label={tt('Прогресс по времени')} value={`${dash.progress_pct}%`}
          sub={`${dash.months_elapsed} / ${dash.total_months} ${tt('мес')}`} color="#1D4ED8" />
        <Tile icon="🗓️" label={tt('Текущий год')} value={`${dash.current_year} / 3`} sub={dash.strategy.name} color="#0EA5E9" />
        <Tile icon="🏢" label={tt('Отделов')} value={fmtNum(dash.departments.length)} sub={tt('в стратегии')} color="#9333EA" />
      </div>

      <Card icon="🏢" title={tt('Отделы — выполнение текущего года')}>
        {dash.departments.length === 0 ? (
          <EmptyState icon="📭" title={tt('Нет отделов')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {dash.departments.map(d => (
              <div key={d.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color || '#1D4ED8', display: 'inline-block' }} />
                  <span style={{ fontWeight: 700 }}>{d.name}</span>
                  <Badge tone="gray">{tt('вес')} {d.weight_pct}%</Badge>
                  <span style={{ flex: 1 }} />
                  <Badge tone={pctTone(d.completion)}>{d.completion != null ? `${d.completion}%` : '—'}</Badge>
                </div>
                <Progress value={d.completion || 0} max={100} color={pctColor(d.completion)} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{d.metric_count} {tt('метрик')}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

// ---------- Table ----------
function TableTab({ table, tt }) {
  const cy = table.current_year;
  return (
    <Card icon="📋" title={tt('Таблица ССП — план / факт / % по годам')}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: '6px 8px' }}>{tt('Метрика')}</th>
              <th style={{ padding: '6px 8px' }}>{tt('Ед.')}</th>
              {[1, 2, 3].map(y => (
                <th key={y} style={{ padding: '6px 8px', textAlign: 'right' }}>
                  {tt('Год')} {y}{y === cy ? ' •' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.departments.map(d => (
              <React.Fragment key={d.id}>
                <tr style={{ background: 'var(--bg2, #F8FAFC)' }}>
                  <td colSpan={5} style={{ padding: '8px', fontWeight: 800 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color || '#1D4ED8', display: 'inline-block', marginRight: 6 }} />
                    {d.name} · {tt('вес')} {d.weight_pct}% · {d.completion != null ? `${d.completion}%` : '—'}
                  </td>
                </tr>
                {d.metrics.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px' }}>
                      {m.name}
                      {m.source_type !== 'manual' && <Badge tone="gray">{tt('авто-источник')}</Badge>}
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--text3)' }}>{m.unit || '—'}</td>
                    {[1, 2, 3].map(y => {
                      const plan = m[`plan_year_${y}`], fact = m[`fact_y${y}`], pct = m[`pct_y${y}`];
                      return (
                        <td key={y} style={{ padding: '6px 8px', textAlign: 'right' }}>
                          <div style={{ color: '#B45309' }}>{tt('план')}: {fmtNum(plan)}</div>
                          <div style={{ color: '#16A34A' }}>{tt('факт')}: {fmtNum(fact)}</div>
                          <div style={{ color: pctColor(pct), fontWeight: 700 }}>{pct != null ? `${pct}%` : '—'}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
        🟡 {tt('план')} · 🟢 {tt('факт')} · 🔵 {tt('% выполнения')} · {tt('«•» — текущий год')}
      </div>
    </Card>
  );
}

// ---------- Facts ----------
function FactsTab({ tt, metrics, form, setForm, saving, onSubmit }) {
  return (
    <Card icon="✍️" title={tt('Внести факт по метрике')}>
      {metrics.length === 0 ? (
        <EmptyState icon="📭" title={tt('Нет ручных метрик')}
          description={tt('Факты можно вносить только по метрикам с источником «Ручной ввод». Авто-метрики (Касса/CRM/Склад) заполняются из системных данных.')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>{tt('Метрика')}
            <select className="input" value={form.metric_id}
              onChange={e => setForm({ ...form, metric_id: e.target.value })} style={{ width: '100%', marginTop: 4 }}>
              <option value="">{tt('— выберите —')}</option>
              {metrics.map(m => (
                <option key={m.id} value={m.id}>{m.dept} · {m.name}{m.unit ? ` (${m.unit})` : ''}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>{tt('Дата')}
            <input type="date" className="input" value={form.fact_date}
              onChange={e => setForm({ ...form, fact_date: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>{tt('Значение')}
            <input type="number" className="input" value={form.fact_value} placeholder="0"
              onChange={e => setForm({ ...form, fact_value: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
          </label>
          <button className="btn btn-primary" disabled={saving} onClick={onSubmit}>
            {saving ? tt('Сохранение…') : tt('Сохранить факт')}
          </button>
        </div>
      )}
    </Card>
  );
}

// ---------- Forecast ----------
function ForecastTab({ forecast, tt }) {
  const of = forecast.overall_forecast_pct;
  const recs = forecast.recommendations || [];
  return (
    <>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Tile icon="🔮" label={tt('Прогноз к концу стратегии')} value={of != null ? `${of}%` : '—'}
          sub={tt('При текущем темпе')} color={pctColor(of)} />
        <Tile icon="⏱️" label={tt('Прошло месяцев')} value={fmtNum(forecast.months_elapsed)} sub={tt('от старта')} color="#1D4ED8" />
        <Tile icon="⚠️" label={tt('Отстающих отделов')} value={fmtNum(recs.length)} sub={tt('< 90% прогноз')} color="#DC2626" />
      </div>

      <Card icon="🏢" title={tt('Прогноз по отделам (линейная экстраполяция)')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(forecast.departments || []).map(d => (
            <div key={d.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>{d.name}</span>
                <Badge tone="gray">{tt('вес')} {d.weight_pct}%</Badge>
                <span style={{ flex: 1 }} />
                <Badge tone={pctTone(d.forecast_pct)}>{d.forecast_pct != null ? `${d.forecast_pct}%` : '—'}</Badge>
              </div>
              <Progress value={d.forecast_pct || 0} max={100} color={pctColor(d.forecast_pct)} />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                {d.metrics.map(m => (
                  <span key={m.id} style={{ marginRight: 12 }}>
                    {m.name}: {m.forecast_pct != null ? `${m.forecast_pct}%` : '—'}
                    {m.months_to_goal != null && m.months_to_goal > 0 ? ` (${tt('цель через')} ${m.months_to_goal} ${tt('мес')})` : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {recs.length > 0 && (
        <Card icon="💡" title={tt('Рекомендации')} style={{ marginTop: 16 }}>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {recs.map((r, i) => <li key={i}>{r.message}</li>)}
          </ul>
        </Card>
      )}
    </>
  );
}

// ---------- Create Strategy (founder, simple form) ----------
function CreateStrategyModal({ tt, onClose, onCreated }) {
  const today = new Date().toISOString().slice(0, 10);
  const end3y = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 3); return d.toISOString().slice(0, 10); })();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(end3y);
  const [depts, setDepts] = useState([
    { name: 'Маркетинг', weight_pct: 20, metrics: [{ name: '', unit: '', source_type: 'manual', plan_year_1: '', plan_year_2: '', plan_year_3: '' }] },
  ]);
  const [saving, setSaving] = useState(false);

  const sumW = depts.reduce((a, d) => a + (parseFloat(d.weight_pct) || 0), 0);

  const addDept = () => setDepts([...depts, { name: '', weight_pct: 0, metrics: [{ name: '', unit: '', source_type: 'manual', plan_year_1: '', plan_year_2: '', plan_year_3: '' }] }]);
  const delDept = (i) => setDepts(depts.filter((_, idx) => idx !== i));
  const setDept = (i, patch) => setDepts(depts.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  const addMetric = (i) => setDept(i, { metrics: [...depts[i].metrics, { name: '', unit: '', source_type: 'manual', plan_year_1: '', plan_year_2: '', plan_year_3: '' }] });
  const setMetric = (di, mi, patch) => setDept(di, { metrics: depts[di].metrics.map((m, idx) => idx === mi ? { ...m, ...patch } : m) });
  const delMetric = (di, mi) => setDept(di, { metrics: depts[di].metrics.filter((_, idx) => idx !== mi) });

  const submit = async () => {
    if (!name.trim()) { toast(tt('Укажите название стратегии'), 'error'); return; }
    if (Math.round(sumW) !== 100) { toast(tt('Сумма весов должна быть = 100%'), 'error'); return; }
    setSaving(true);
    try {
      await api.post('/bsc/strategies', {
        name, start_date: startDate, end_date: endDate,
        departments: depts.map(d => ({
          name: d.name, weight_pct: parseFloat(d.weight_pct) || 0,
          metrics: d.metrics.filter(m => m.name.trim()).map(m => ({
            name: m.name, unit: m.unit, source_type: m.source_type,
            plan_year_1: parseFloat(m.plan_year_1) || 0,
            plan_year_2: parseFloat(m.plan_year_2) || 0,
            plan_year_3: parseFloat(m.plan_year_3) || 0,
          })),
        })),
      });
      toast(tt('Стратегия создана'));
      onCreated();
    } catch (e) { toast(e.response?.data?.error || e.message, 'error'); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={tt('Новая стратегия ССП')} icon="🧭" width={720}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{tt('Отмена')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? tt('Сохранение…') : tt('Создать')}</button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>{tt('Название')}
          <input className="input" value={name} onChange={e => setName(e.target.value)}
            placeholder={tt('Стратегия 2026–2028')} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <div className="grid-2">
          <label style={{ fontSize: 12, fontWeight: 700 }}>{tt('Начало')}
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>{tt('Окончание')}
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong>{tt('Отделы и веса')}</strong>
          <Badge tone={Math.round(sumW) === 100 ? 'green' : 'red'}>{tt('сумма')} {Math.round(sumW)}%</Badge>
          <span style={{ flex: 1 }} />
          <button className="btn btn-ghost btn-sm" onClick={addDept}>+ {tt('отдел')}</button>
        </div>

        {depts.map((d, di) => (
          <div key={di} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
            <div className="grid-3" style={{ alignItems: 'end', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700 }}>{tt('Отдел')}
                <input className="input" value={d.name} onChange={e => setDept(di, { name: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 700 }}>{tt('Вес, %')}
                <input type="number" className="input" value={d.weight_pct} onChange={e => setDept(di, { weight_pct: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
              </label>
              <button className="btn btn-ghost btn-sm" onClick={() => delDept(di)} disabled={depts.length === 1}>🗑 {tt('удалить')}</button>
            </div>

            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>{tt('Метрики (план на 3 года)')}</div>
            {d.metrics.map((m, mi) => (
              <div key={mi} style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr 1.2fr .8fr .8fr .8fr auto', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <input className="input" placeholder={tt('Название')} value={m.name} onChange={e => setMetric(di, mi, { name: e.target.value })} />
                <input className="input" placeholder={tt('Ед.')} value={m.unit} onChange={e => setMetric(di, mi, { unit: e.target.value })} />
                <select className="input" value={m.source_type} onChange={e => setMetric(di, mi, { source_type: e.target.value })}>
                  {SOURCE_OPTS.map(o => <option key={o.value} value={o.value}>{tt(o.label)}</option>)}
                </select>
                <input type="number" className="input" placeholder={tt('Год 1')} value={m.plan_year_1} onChange={e => setMetric(di, mi, { plan_year_1: e.target.value })} />
                <input type="number" className="input" placeholder={tt('Год 2')} value={m.plan_year_2} onChange={e => setMetric(di, mi, { plan_year_2: e.target.value })} />
                <input type="number" className="input" placeholder={tt('Год 3')} value={m.plan_year_3} onChange={e => setMetric(di, mi, { plan_year_3: e.target.value })} />
                <button className="btn btn-ghost btn-sm" onClick={() => delMetric(di, mi)}>×</button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => addMetric(di)}>+ {tt('метрика')}</button>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          {tt('Авто-источники (Касса/CRM/Склад) помечаются как «авто-источник». Сейчас полностью работает «Ручной ввод» — факты вносятся на вкладке «Факты».')}
        </div>
      </div>
    </Modal>
  );
}