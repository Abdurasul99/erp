import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
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
const STATUS_RU = { draft: 'Черновик', approved: 'Утверждено', paid: 'Выплачено' };
const STATUS_TONE = { draft: 'gray', approved: 'blue', paid: 'green' };

function curPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function SalariesTool() {
  const { tt } = useTt();
  const { branchId, role } = useContext(BranchScope);
  // PATCH /hr/salaries/:id/approve|pay сервер отдаёт только director/founder —
  // менеджеру кнопки не показываем, иначе каждый клик гарантированный 403.
  const canSettle = role === 'founder' || role === 'director';
  const [period, setPeriod] = useState(curPeriod());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  // Последние 6 месяцев в качестве пилюль-периодов
  const periodOptions = (() => {
    const out = [];
    const d = new Date();
    for (let i = 0; i < 6; i++) {
      const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      out.push({ value: p, label: p });
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  })();

  const load = useCallback(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/hr/salaries', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [period, branchId]);

  useEffect(() => load(), [load]);

  // Тело обязано нести начисления строки: approve делает UPSERT и берёт
  // base/bonus/penalty из запроса (комиссию пересчитывает сам). Пустое тело
  // записывало нули поверх сохранённых сумм — ФОТ схлопывался в одну комиссию.
  const act = async (row, action) => {
    setBusy(row.employee_id + action);
    try {
      await api.patch(`/hr/salaries/${row.employee_id}/${action}`, {
        period, base: row.base, bonus: row.bonus, penalty: row.penalty,
      });
      load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(null);
    }
  };

  const sum = data?.summary || {};
  const rows = data?.rows || [];
  const history = data?.history || [];

  return (
    <>
      <PageHeader title={tt('💰 Зарплата (ФОТ)')} sub={tt('Фонд оплаты труда · оклады · % с продаж · премии')} />

      <div style={{ marginBottom: 16 }}>
        <Pills value={period} onChange={setPeriod} options={periodOptions} label="Период" />
      </div>

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon="💸" title={tt('Нет данных по ФОТ')} description={tt('За выбранный период нет сотрудников или начислений.')} /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile icon="💰" label={tt('Всего ФОТ')} value={fmtMoneyFull(sum.total)} sub={tt('сум · к выплате')} color="#9333EA" />
            <Tile icon="🏷" label={tt('Окладов')} value={fmtMoneyFull(sum.base)} sub={tt('сум · фикс')} color="#0EA5E9" />
            <Tile icon="📈" label={tt('% с продаж')} value={fmtMoneyFull(sum.commission)} sub={tt('сум · комиссии')} color="#16A34A" />
            <Tile icon="🏆" label={tt('Премии')} value={fmtMoneyFull(sum.bonus)} sub={tt('сум · бонусы')} color="#D97706" />
          </div>

          <Card icon="🧾" title={tt('Начисления по сотрудникам')}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Сотрудник')}</th>
                    <th>{tt('Роль')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Оклад')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('% с продаж')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Премия')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Штраф')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('К выплате')}</th>
                    <th>{tt('Статус')}</th>
                    {canSettle && <th style={{ textAlign: 'right' }}>{tt('Действия')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(e => {
                    const init = (e.name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                    const dash = (v) => v > 0 ? fmtMoneyFull(v) : <span style={{ color: 'var(--text3)' }}>—</span>;
                    return (
                      <tr key={e.employee_id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="o-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{init}</div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{e.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text3)' }}>@{e.username}</div>
                            </div>
                          </div>
                        </td>
                        <td><Badge tone={ROLE_TONE[e.role] || 'gray'}>{tt(ROLE_RU[e.role] || e.role)}</Badge></td>
                        <td className="mono" style={{ textAlign: 'right' }}>{dash(e.base)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{dash(e.commission)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{dash(e.bonus)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: e.penalty > 0 ? 'var(--red)' : undefined }}>{e.penalty > 0 ? `−${fmtMoneyFull(e.penalty)}` : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(e.total)}</td>
                        <td><Badge tone={STATUS_TONE[e.status] || 'gray'}>{tt(STATUS_RU[e.status] || e.status)}</Badge></td>
                        {canSettle && (
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {e.status === 'draft' && (
                              <button type="button" className="btn-sm" disabled={!!busy}
                                onClick={() => act(e, 'approve')}
                                style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                                {busy === e.employee_id + 'approve' ? '…' : tt('Утвердить')}
                              </button>
                            )}
                            {e.status === 'approved' && (
                              <button type="button" className="btn-sm" disabled={!!busy}
                                onClick={() => act(e, 'pay')}
                                style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                                {busy === e.employee_id + 'pay' ? '…' : tt('Выплатить')}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('ℹ️ К выплате = оклад + % с продаж + премия − штраф. Комиссия начисляется с продаж сотрудника за период.')}
            </div>
          </Card>

          {history.length > 0 && (
            <Card icon="📜" title={tt('История выплат')} style={{ marginTop: 18 }}>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Период')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сотрудников')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сумма')}</th>
                      <th>{tt('Статус')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i}>
                        <td className="mono">{h.period}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(h.employees)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(h.total)}</td>
                        <td><Badge tone="green">{tt('Выплачено')}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
