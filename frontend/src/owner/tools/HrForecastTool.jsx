import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

const ROLE_RU = {
  founder: 'Учредитель', director: 'Директор', manager: 'Менеджер',
  cashier: 'Кассир', warehouse: 'Складовщик', seller: 'Продавец',
};
const ROLE_TONE = {
  founder: 'purple', director: 'purple', manager: 'blue',
  cashier: 'cyan', warehouse: 'orange', seller: 'green',
};

export default function HrForecastTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/hr/forecast', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId]);

  const employees = data?.employees || [];
  const recs = data?.recommendations || [];
  const m = data?.metrics || {};

  const REC_TONE = { high: 'red', medium: 'orange', low: 'blue' };
  const REC_ICON = { high: '🔴', medium: '🟠', low: '🔵' };

  return (
    <>
      <PageHeader title={tt('📊 Прогноз персонала')} sub={tt('ФОТ и потребность в найме на следующий месяц · по выручке')} />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : employees.length === 0 ? (
        <Card><EmptyState icon="👥" title={tt('Сотрудников нет')} description={tt('Добавьте сотрудников в разделе «Сотрудники».')} /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile
              icon="💰"
              label={tt('Прогноз ФОТ')}
              value={fmtMoneyFull(m.payroll_forecast)}
              sub={`${tt('сум')} · ${m.payroll_delta_pct >= 0 ? '+' : ''}${fmtNum(m.payroll_delta_pct)}% ${tt('к текущему')}`}
              color="#D97706"
            />
            <Tile
              icon="🧑‍💼"
              label={tt('Нужно нанять (продавцы)')}
              value={m.hire_need > 0 ? `+${fmtNum(m.hire_need)}` : '0'}
              sub={tt('к найму')}
              color="#9333EA"
            />
            <Tile
              icon="🏖"
              label={tt('Отпуска (след. месяц)')}
              value={fmtNum(m.vacations_next)}
              sub={tt('сотрудников')}
              color="#0EA5E9"
            />
            <Tile
              icon="📈"
              label={tt('Рост выручки')}
              value={`${m.revenue_growth_pct >= 0 ? '+' : ''}${fmtNum(m.revenue_growth_pct)}%`}
              sub={tt('месяц к месяцу')}
              color="#16A34A"
            />
          </div>

          <Card icon="💵" title={tt('Прогноз ФОТ по сотрудникам')}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Сотрудник')}</th>
                    <th>{tt('Роль')}</th>
                    <th>{tt('Филиал')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Текущая ЗП')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Прогноз ЗП')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Изм.')}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(e => {
                    const init = (e.name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                    const hasSalary = e.salary_current > 0;
                    return (
                      <tr key={e.id} style={e.is_new ? { background: 'var(--bg2)' } : undefined}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="o-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{e.is_new ? '➕' : init}</div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{e.is_new ? tt('Новый сотрудник') : e.name}</div>
                              {!e.is_new && <div style={{ fontSize: 11, color: 'var(--text3)' }}>@{e.username}</div>}
                            </div>
                          </div>
                        </td>
                        <td><Badge tone={ROLE_TONE[e.role] || 'gray'}>{tt(ROLE_RU[e.role] || e.role)}</Badge></td>
                        <td style={{ color: 'var(--text2)' }}>{e.branch || '—'}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {hasSalary ? fmtMoneyFull(e.salary_current) : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                          {e.salary_forecast > 0 ? fmtMoneyFull(e.salary_forecast) : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: e.delta_pct > 0 ? 'var(--green)' : 'var(--text3)' }}>
                          {hasSalary && e.delta_pct !== 0 ? `${e.delta_pct > 0 ? '+' : ''}${fmtNum(e.delta_pct)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('ℹ️ Прогноз ЗП масштабируется по росту выручки сотрудника. Текущая ЗП вводится вручную (раздел «Сотрудники»); где данных нет — прочерк.')}
            </div>
          </Card>

          <Card icon="🧭" title={tt('Рекомендации')} style={{ marginTop: 18 }}>
            {recs.length === 0 ? (
              <EmptyState icon="✅" title={tt('Команда укомплектована')} description={tt('Срочных кадровых действий не требуется.')} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recs.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 18 }}>{REC_ICON[r.urgency] || '🔵'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700 }}>{tt(r.title)}</span>
                        <Badge tone={REC_TONE[r.urgency] || 'blue'}>{tt(r.urgency === 'high' ? 'Срочно' : r.urgency === 'medium' ? 'Важно' : 'Инфо')}</Badge>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text2)' }}>{tt(r.text)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
