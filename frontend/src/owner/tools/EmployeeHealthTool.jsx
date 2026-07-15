import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, Progress, fmtMoneyFull, fmtNum } from '../ui.jsx';
import HrCriteriaBar from './HrCriteriaBar.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const PERIODS = [
  { value: 'week',    label: 'Неделя' },
  { value: 'month',   label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
];

const ZONE = {
  ok:     { tone: 'green',  ru: 'OK',       color: '#16A34A' },
  warn:   { tone: 'orange', ru: 'Внимание', color: '#D97706' },
  risk:   { tone: 'red',    ru: 'Риск',     color: '#DC2626' },
};

const zoneColor = (score) => (score >= 75 ? '#16A34A' : score >= 60 ? '#D97706' : '#DC2626');
const zoneKey = (score) => (score >= 75 ? 'ok' : score >= 60 ? 'warn' : 'risk');

const FACTOR_META = {
  productivity: { icon: '💪', ru: 'Продуктивность' },
  punctuality:  { icon: '⏰', ru: 'Пунктуальность' },
  overtime:     { icon: '⚖️', ru: 'Баланс переработок' },
  stability:    { icon: '📊', ru: 'Стабильность результата' },
  absence:      { icon: '🚫', ru: 'Отсутствие прогулов' },
  tasks:        { icon: '✅', ru: 'Выполнение задач' },
};
const FACTOR_ORDER = ['productivity', 'punctuality', 'overtime', 'stability', 'absence', 'tasks'];

// Gauge-кольцо: SVG прогресс-дуга 0..100 с центральным числом.
function Gauge({ score, label }) {
  const { tt } = useTt();
  const R = 70, STROKE = 14, C = 90;
  const circ = 2 * Math.PI * R;
  // Полное кольцо (gap снизу 90°): рисуем 270° дугу.
  const arcFraction = 0.75;
  const dash = circ * arcFraction;
  const val = Math.max(0, Math.min(100, score || 0));
  const filled = dash * (val / 100);
  const col = zoneColor(val);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg viewBox="0 0 180 180" style={{ width: 180, height: 180, transform: 'rotate(135deg)' }}>
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--border, #E3EAF3)" strokeWidth={STROKE}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
        <circle cx={C} cy={C} r={R} fill="none" stroke={col} strokeWidth={STROKE}
          strokeLinecap="round" strokeDasharray={`${filled} ${circ}`}
          style={{ transition: 'stroke-dasharray .5s ease, stroke .3s ease' }} />
      </svg>
      <div style={{ marginTop: -118, textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: col, lineHeight: 1 }}>{Math.round(val)}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginTop: 2 }}>{tt('из 100')}</div>
      </div>
      {label && <div style={{ marginTop: 80, fontWeight: 700, fontSize: 14 }}>{label}</div>}
    </div>
  );
}

const trendBadge = (t, tt) => {
  const v = Math.round(t || 0);
  if (v > 1) return <span style={{ color: '#16A34A', fontWeight: 700 }}>▲ {v}</span>;
  if (v < -1) return <span style={{ color: '#DC2626', fontWeight: 700 }}>▼ {Math.abs(v)}</span>;
  return <span style={{ color: 'var(--text3)', fontWeight: 700 }}>— {tt('ровно')}</span>;
};

export default function EmployeeHealthTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selId, setSelId] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/hr/employee-health', { params })
      .then(r => { if (!ignore) { setData(r.data); setSelId(null); } })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period]);

  const summary = data?.summary || {};
  const employees = data?.employees || [];
  const selected = employees.find(e => e.id === selId) || employees[0] || null;

  const init = (name) => (name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <PageHeader
        title={tt('❤️‍🩹 Здоровье сотрудника')}
        sub={tt('Детектор выгорания · единый score 0–100 из рабочих сигналов · только просмотр')}
        actions={<Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} label={tt('Период')} />}
      />

      <HrCriteriaBar tool="health" />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={220} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : employees.length === 0 ? (
        <Card>
          <EmptyState
            icon="❤️‍🩹"
            title={tt('Нет данных для оценки')}
            description={tt('За выбранный период недостаточно сигналов (явка, продажи, задачи) для расчёта здоровья сотрудников.')}
          />
        </Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile icon="❤️" label={tt('Средний score')} value={fmtNum(summary.avg_score || 0)} sub={tt('из 100 · по команде')} color={zoneColor(summary.avg_score || 0)} />
            <Tile icon="📈" label={tt('Тренд за 30 дней')} value={`${(summary.trend_30d || 0) >= 0 ? '+' : ''}${fmtNum(summary.trend_30d || 0)}`} sub={tt('изменение score')} color={(summary.trend_30d || 0) >= 0 ? '#16A34A' : '#DC2626'} />
            <Tile icon="🚨" label={tt('В зоне риска')} value={fmtNum(summary.at_risk || 0)} sub={tt('сотрудников · score < 60')} color="#DC2626" />
            <Tile icon="👥" label={tt('Всего оценено')} value={fmtNum(summary.total || employees.length)} sub={tt('сотрудников')} color="#0EA5E9" />
          </div>

          <div className="grid-2" style={{ marginBottom: 18, alignItems: 'stretch' }}>
            <Card icon="🎯" title={tt('Здоровье сотрудника')}>
              {selected ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div className="o-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>{init(selected.name)}</div>
                    <div>
                      <div style={{ fontWeight: 800 }}>{selected.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{tt(selected.role_ru || selected.role || '')}</div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <Badge tone={ZONE[zoneKey(selected.score)].tone}>{tt(ZONE[zoneKey(selected.score)].ru)}</Badge>
                    </div>
                  </div>
                  <Gauge score={selected.score} />
                  <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>
                    {tt('Тренд 30 дней')}: {trendBadge(selected.trend_30d, tt)}
                  </div>
                </>
              ) : (
                <EmptyState icon="👤" title={tt('Выберите сотрудника')} />
              )}
            </Card>

            <Card icon="🧩" title={tt('Разбивка по факторам')}>
              {selected && selected.factors ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {FACTOR_ORDER.filter(k => selected.factors[k] != null).map(k => {
                    const meta = FACTOR_META[k];
                    const v = Math.round(selected.factors[k] || 0);
                    return (
                      <div key={k}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{meta.icon} {tt(meta.ru)}</span>
                          <span className="mono" style={{ fontWeight: 700, color: zoneColor(v) }}>{v}</span>
                        </div>
                        <Progress value={v} max={100} color={zoneColor(v)} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon="🧩" title={tt('Нет факторов')} />
              )}
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12 }}>
                {tt('ℹ️ Score = взвешенное среднее факторов. Зелёный ≥75, жёлтый 60–74, красный <60.')}
              </div>
            </Card>
          </div>

          <Card icon="📋" title={tt('Сотрудники')}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Сотрудник')}</th>
                    <th>{tt('Роль')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Score')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Тренд 30д')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Продуктивность')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Пунктуальность')}</th>
                    <th>{tt('Зона')}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(e => {
                    const zk = zoneKey(e.score);
                    const isSel = selected && e.id === selected.id;
                    return (
                      <tr key={e.id} onClick={() => setSelId(e.id)}
                        style={{ cursor: 'pointer', background: isSel ? 'rgba(29,78,216,.06)' : undefined }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="o-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{init(e.name)}</div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{e.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text3)' }}>@{e.username}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text2)' }}>{tt(e.role_ru || e.role || '—')}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: zoneColor(e.score) }}>{fmtNum(e.score)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{trendBadge(e.trend_30d, tt)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{e.factors?.productivity != null ? `${Math.round(e.factors.productivity)}%` : '—'}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{e.factors?.punctuality != null ? `${Math.round(e.factors.punctuality)}%` : '—'}</td>
                        <td><Badge tone={ZONE[zk].tone}>{tt(ZONE[zk].ru)}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('ℹ️ Нажмите на строку, чтобы увидеть кольцо и разбивку факторов сотрудника. Факторы считаются из явки, продаж и задач за период.')}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
