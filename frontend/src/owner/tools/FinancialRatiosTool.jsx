import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import AiAnalyze from '../AiAnalyze.jsx';
import { useTt } from '../tt.js';

// Финансовые коэффициенты — раздел Финансы, ТОЛЬКО для учредителя/гендиректора.
// 6 коэффициентов, которые смотрят банки, инвесторы и партнёры: ликвидность,
// долговая нагрузка, оборачиваемость, покрытие процентов. Авто-данные (касса/
// дебиторка/запасы) + ручной баланс из balance_entries.
export default function FinancialRatiosTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/finance/ratios', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period]);

  const periodOpts = [
    { value: 'day', label: tt('День') },
    { value: 'week', label: tt('Неделя') },
    { value: 'month', label: tt('Месяц') },
    { value: 'year', label: tt('Год') },
  ];

  const d = data || {};
  const ratios = d.ratios || [];

  const statusTone = (s) => s === 'good' ? 'green' : s === 'warn' ? 'yellow' : s === 'bad' ? 'red' : 'blue';
  const statusLabel = (s) => s === 'good' ? '✅ ' + tt('Норма')
    : s === 'warn' ? '⚠️ ' + tt('Внимание')
    : s === 'bad' ? '🔴 ' + tt('Риск')
    : tt('Нет данных');

  return (
    <>
      <PageHeader
        title={'📐 ' + tt('Финансовые коэффициенты')}
        sub={tt('Только для учредителя · показатели для банков и инвесторов')}
        actions={<Pills value={period} onChange={setPeriod} options={periodOpts} label={tt("Период")} />}
      />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={220} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : ratios.length === 0 ? (
        <Card><EmptyState icon="📐" title={tt('Недостаточно данных')} description={tt('Коэффициенты не на чём рассчитать. Добавьте продажи, кассовые операции и ручной баланс — расчёт заработает.')} /></Card>
      ) : (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>
              {tt('Это коэффициенты, которые смотрят банки, инвесторы и партнёры, чтобы оценить финансовое здоровье бизнеса.')}
              {' '}{tt('Считаются из реальных данных компании: касса, дебиторка, запасы — плюс ручной баланс активов и обязательств.')}
            </div>
          </Card>

          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="💵" label={tt('Деньги (касса)')} value={fmtMoneyFull(d.cash)} sub={tt('сум')} color="#1D4ED8" />
            <Tile icon="📥" label={tt('Дебиторка')} value={fmtMoneyFull(d.receivables)} sub={tt('должны нам · сум')} color="#0EA5E9" />
            <Tile icon="📦" label={tt('Запасы')} value={fmtMoneyFull(d.inventory)} sub={tt('склад · сум')} color="#16A34A" />
            <Tile icon="📤" label={tt('Обязательства')} value={fmtMoneyFull(d.liabilities)} sub={tt('должны мы · сум')} color="#D97706" />
          </div>

          <Card icon="📐" title={tt('Коэффициент · значение · норма · статус')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text3)', fontSize: 12 }}>
                    <th style={{ padding: '8px 10px' }}>{tt('Коэффициент')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>{tt('Значение')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>{tt('Норма')}</th>
                    <th style={{ padding: '8px 10px' }}>{tt('Статус')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ratios.map((r, i) => (
                    <React.Fragment key={r.key || i}>
                      <tr style={{ borderTop: '1px solid var(--border, #E3EAF3)' }}>
                        <td style={{ padding: '10px', fontWeight: 700 }}>{tt(r.name)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800 }} className="mono">
                          {r.value != null ? r.value + (r.unit ? r.unit : '') : '—'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text2)' }} className="mono">{r.norm}</td>
                        <td style={{ padding: '10px' }}><Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge></td>
                      </tr>
                      <tr>
                        <td colSpan={4} style={{ padding: '0 10px 12px', color: 'var(--text3)', fontSize: 12.5, lineHeight: 1.5 }}>
                          {tt(r.hint)}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="🧮" title={tt('Как это считается')}>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.7 }}>
              <div>{tt('Текущая ликвидность = (деньги + дебиторка + запасы) ÷ обязательства')}</div>
              <div>{tt('Быстрая ликвидность = (деньги + дебиторка) ÷ обязательства')}</div>
              <div>{tt('Долговая нагрузка = обязательства ÷ активы')}</div>
              <div>{tt('Оборачиваемость дебиторки = выручка ÷ средняя дебиторка')}</div>
              <div>{tt('Оборачиваемость запасов = себестоимость ÷ средние запасы')}</div>
              <div>{tt('Покрытие процентов = прибыль ÷ проценты по долгам')}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
                {tt('Деньги, дебиторка и запасы берутся автоматически из системы; активы и обязательства — из ручного баланса.')}
              </div>
            </div>
          </Card>

          <AiAnalyze topic="financial-ratios" branchId={branchId} />
        </>
      )}
    </>
  );
}
