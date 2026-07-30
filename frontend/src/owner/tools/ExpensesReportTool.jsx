import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { usePeriodParams, ToolFilters } from '../usePeriod.jsx';
import { useTt, fmtDate } from '../tt.js';

// Отчёт расходов — операционные расходы + закупки (cash_expense).
// Только для учредителя/гендиректора. Read-only.
// /finance/expenses/summary — агрегат по категориям (сумма, доля, динамика).
// /finance/expenses — реестр операций.
// Период и филиал — из глобального селектора топбара (usePeriodParams).

// Иконки по категориям расходов (совпадают с макетом)
const CAT_ICON = {
  'Закупка товара': '📦',
  'Аренда': '🏢',
  'Зарплаты': '👥',
  'Реклама': '📢',
  'Коммунальные': '💡',
  'Прочие': '📎',
};

export default function ExpensesReportTool() {
  const { tt, lang } = useTt();
  const params = usePeriodParams();
  const [summary, setSummary] = useState(null);
  const [ops, setOps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    Promise.all([
      api.get('/finance/expenses/summary', { params }),
      api.get('/finance/expenses', { params }),
    ])
      .then(([s, o]) => { if (!ignore) { setSummary(s.data); setOps(o.data); } })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [params]);

  const s = summary || {};
  const cats = s.categories || [];
  const rows = (ops && ops.operations) || [];
  const top = cats.length ? cats[0] : null;

  const fmtDelta = (d) => {
    if (d == null) return <span style={{ color: 'var(--text3)' }}>—</span>;
    const up = d >= 0;
    // Для расходов рост — это «дороже» (оранжевый), падение — «дешевле» (зелёный)
    return (
      <span style={{ color: up ? 'var(--orange)' : 'var(--green)', fontWeight: 700 }}>
        {up ? '↑' : '↓'} {Math.abs(Math.round(d))}%
      </span>
    );
  };

  return (
    <>
      <PageHeader title={'🧾 ' + tt('Отчёт расходов')} sub={tt('Операционные расходы и закупки · реальные данные')} />

      <ToolFilters />

      {loading && !summary ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !s.total ? (
        <Card><EmptyState icon="🧾" title={tt('Нет расходов за период')} description={tt('За выбранный период расходов не зафиксировано. Появятся операции — отчёт заполнится.')} /></Card>
      ) : (
        <>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Tile icon="💰" label={tt('Всего расходов')} value={fmtMoneyFull(s.total)} sub={tt('сум')} color="#1D4ED8" />
            <Tile icon="⚙️" label={tt('Операционные')} value={fmtMoneyFull(s.operating)} sub={tt('аренда · зарплаты · прочее')} color="#D97706" />
            <Tile icon="📦" label={tt('Закупки товара')} value={fmtMoneyFull(s.purchases)} sub={tt('себестоимость закупок')} color="#16A34A" />
          </div>

          {top && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  {CAT_ICON[top.category] || '📂'} {tt('Крупнейшая статья расходов')}: <span style={{ color: 'var(--primary)' }}>{tt(top.category)}</span>
                </div>
                <Badge tone="blue">{top.share}% {tt('от всех расходов')}</Badge>
              </div>
            </Card>
          )}

          <Card icon="📊" title={tt('Структура расходов по категориям')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text3)', fontSize: 12, fontWeight: 700 }}>
                    <th style={{ padding: '8px 10px' }}>{tt('Категория')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>{tt('Сумма (сум)')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>{tt('Доля')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>{tt('vs прошлый')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cats.map((c, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border, #E3EAF3)' }}>
                      <td style={{ padding: '10px 10px', fontWeight: 600 }}>
                        {CAT_ICON[c.category] || '📂'} {tt(c.category)}
                      </td>
                      <td className="mono" style={{ padding: '10px 10px', textAlign: 'right' }}>{fmtMoneyFull(c.amount)}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <div style={{ width: 60, height: 6, background: 'var(--bg-2)', borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{ width: Math.min(100, c.share) + '%', height: '100%', background: 'var(--primary)', borderRadius: 6 }} />
                          </div>
                          <span style={{ fontWeight: 700, minWidth: 38, textAlign: 'right' }}>{c.share}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right' }}>{fmtDelta(c.delta_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="📋" title={tt('Реестр операций')}>
            {rows.length === 0 ? (
              <EmptyState icon="📭" title={tt('Нет операций за период')} description={tt('За выбранный период операций расходов не найдено.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text3)', fontSize: 12, fontWeight: 700 }}>
                      <th style={{ padding: '8px 10px' }}>{tt('Дата и время')}</th>
                      <th style={{ padding: '8px 10px' }}>{tt('Категория')}</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>{tt('Сумма (сум)')}</th>
                      <th style={{ padding: '8px 10px' }}>{tt('Комментарий')}</th>
                      <th style={{ padding: '8px 10px' }}>{tt('Кто внёс')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id ?? i} style={{ borderTop: '1px solid var(--border, #E3EAF3)' }}>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                          {fmtDate(new Date(r.created_at), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }, lang)}
                        </td>
                        <td style={{ padding: '9px 10px', fontWeight: 600 }}>
                          {CAT_ICON[r.category] || '📂'} {tt(r.category || 'Прочие')}
                        </td>
                        <td className="mono" style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(r.amount)}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--text2)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.comment || ''}>
                          {r.comment || <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 10px', color: 'var(--text2)' }}>{r.responsible || <span style={{ color: 'var(--text3)' }}>{tt('система')}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ops && ops.truncated && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
                    {tt('Показаны последние')} {fmtNum(rows.length)} {tt('операций.')}
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
