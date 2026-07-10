import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import HrCriteriaBar from './HrCriteriaBar.jsx';
import { useTt } from '../tt.js';

const PERIODS = [
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
];

const SCOPES = [
  { value: 'network', label: 'Сеть магазинов' },
  { value: 'store', label: 'Магазин' },
];

const ROLE_RU = {
  founder: 'Учредитель', gen_dir: 'Ген. директор', manager: 'Менеджер',
  cashier: 'Кассир', warehouse: 'Складовщик', seller: 'Продавец',
};

const VERDICT = {
  KEEP: { tone: 'green', ru: 'Удержать', icon: '✅' },
  WATCH: { tone: 'orange', ru: 'Наблюдать', icon: '👀' },
  REPLACE: { tone: 'red', ru: 'Кандидат на замену', icon: '⚠️' },
};

// Кольцо-гейдж композитного рейтинга 0-100.
function Gauge({ value = 0, size = 92 }) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - 12) / 2;
  const C = 2 * Math.PI * r;
  const off = C * (1 - v / 100);
  const color = v >= 70 ? '#16A34A' : v >= 45 ? '#D97706' : '#DC2626';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border, #E3EAF3)" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .4s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fontSize={size * 0.26} fontWeight="800" fill={color} fontFamily="'JetBrains Mono', monospace">
        {Math.round(v)}
      </text>
    </svg>
  );
}

// Горизонтальный рейтинг-бар 0-100.
function RatingBar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 70 ? '#16A34A' : v >= 45 ? '#D97706' : '#DC2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'var(--border, #E3EAF3)', overflow: 'hidden' }}>
        <div style={{ width: `${v}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .3s ease' }} />
      </div>
      <span className="mono" style={{ fontSize: 12, fontWeight: 800, color, minWidth: 26, textAlign: 'right' }}>{Math.round(v)}</span>
    </div>
  );
}

export default function FireAnalysisTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [scope, setScope] = useState('network');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period, scope };
    if (branchId) params.branch_id = branchId;
    api.get('/hr/fire-analysis', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period, scope]);

  const summary = data?.summary || {};
  const employees = data?.employees || [];
  const replaceList = employees.filter(e => e.verdict === 'REPLACE');

  const verdictBadge = (v) => {
    const cfg = VERDICT[v] || VERDICT.WATCH;
    return <Badge tone={cfg.tone}>{cfg.icon} {tt(cfg.ru)}</Badge>;
  };

  const init = (name) => (name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <PageHeader
        title={tt('🎯 Анализ на увольнение')}
        sub={tt('Ранжирование персонала по эффективности · кого удержать vs кандидаты на замену')}
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Pills value={scope} onChange={setScope} label={tt('Охват')}
              options={SCOPES.map(s => ({ value: s.value, label: tt(s.label) }))} />
            <Pills value={period} onChange={setPeriod} label={tt('Период')}
              options={PERIODS.map(p => ({ value: p.value, label: tt(p.label) }))} />
          </div>
        }
      />

      <HrCriteriaBar tool="fire" />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={220} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : employees.length === 0 ? (
        <Card>
          <EmptyState
            icon="🎯"
            title={tt('Нет данных для анализа')}
            description={tt('За выбранный период нет продавцов с продажами или явкой для оценки эффективности.')}
          />
        </Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile icon="👥" label={tt('Сотрудников в анализе')} value={fmtNum(summary.total || 0)} sub={tt('с данными за период')} color="#0EA5E9" />
            <Tile icon="✅" label={tt('Удержать')} value={fmtNum(summary.keep || 0)} sub={tt('рейтинг ≥ 70')} color="#16A34A" />
            <Tile icon="👀" label={tt('Наблюдать')} value={fmtNum(summary.watch || 0)} sub={tt('рейтинг 45–69')} color="#D97706" />
            <Tile icon="⚠️" label={tt('На замену')} value={fmtNum(summary.replace || 0)} sub={tt('рейтинг < 45')} color="#DC2626" />
          </div>

          {replaceList.length > 0 && (
            <Card style={{ marginBottom: 18, borderLeft: '4px solid #DC2626' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 26 }}>⚠️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#DC2626', marginBottom: 4 }}>
                    {tt('Кандидаты на замену')}: {replaceList.length}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                    {tt('Эти сотрудники показывают эффективность ниже порога. Замена может окупиться за счёт роста выручки до уровня медианы.')}
                  </div>
                  {summary.replace_payback > 0 && (
                    <div style={{ marginTop: 8, fontSize: 13 }}>
                      {tt('Оценка окупаемости (разрыв до медианы по выручке)')}:{' '}
                      <span className="mono" style={{ fontWeight: 800, color: '#DC2626' }}>
                        {fmtMoneyFull(summary.replace_payback)} {tt('сум')}
                      </span>
                      <span style={{ color: 'var(--text3)' }}> {tt('за период')}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {replaceList.map(e => (
                      <div key={e.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'rgba(220,38,38,.06)', borderRadius: 8, padding: '6px 10px',
                      }}>
                        <Gauge value={e.rating} size={44} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{e.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {e.branch || tt('без филиала')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card icon="📊" title={tt('Рейтинг эффективности персонала')}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Сотрудник')}</th>
                    <th>{tt('Роль')}</th>
                    {scope === 'network' && <th>{tt('Филиал')}</th>}
                    <th style={{ textAlign: 'right' }}>{tt('Конверсия')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Средний чек')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Дисциплина')}</th>
                    <th style={{ minWidth: 140 }}>{tt('Рейтинг')}</th>
                    <th>{tt('Вердикт')}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(e => (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="o-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{init(e.name)}</div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{e.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>@{e.username}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{tt(ROLE_RU[e.role] || e.role)}</td>
                      {scope === 'network' && <td style={{ fontSize: 12, color: 'var(--text2)' }}>{e.branch || '—'}</td>}
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {e.conversion_pct != null ? `${fmtNum(e.conversion_pct)}%` : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {e.avg_check > 0 ? fmtMoneyFull(e.avg_check) : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {e.discipline_pct != null ? `${fmtNum(e.discipline_pct)}%` : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td><RatingBar value={e.rating} /></td>
                      <td>{verdictBadge(e.verdict)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
              {tt('ℹ️ Композитный рейтинг 0–100 = конверсия 45% + средний чек 30% + дисциплина 25%, нормализованные по группе.')}
              {' '}
              {tt('KEEP ≥ 70 · WATCH 45–69 · REPLACE < 45. Конверсия — по визитам (если введены) или по доле чеков.')}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
