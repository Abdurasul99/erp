import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, AreaChart, EmptyState, Skeleton, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt, fmtDate } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

// Тип движения → подпись + цвет (синяя-на-белом тема: приход — зелёный, расход — красный).
const KIND_META = {
  income:   { label: 'Приход',      color: '#16A34A', sign: '+' },
  sale:     { label: 'Продажа',     color: '#DC2626', sign: '−' },
  writeoff: { label: 'Списание',    color: '#D97706', sign: '−' },
  return:   { label: 'Возврат',     color: '#1D4ED8', sign: '+' },
};

export default function ProductMovementsTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Список товаров для выпадашки — берём из того же эндпоинта (он отдаёт products при пустом product_id).
  useEffect(() => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    if (productId) params.product_id = productId;
    api.get('/warehouse/movements', { params })
      .then(r => {
        setData(r.data);
        if (r.data.products) setProducts(r.data.products);
        // Авто-выбор первого товара, если ещё не выбран.
        if (!productId && r.data.products && r.data.products.length) {
          setProductId(String(r.data.products[0].id));
        }
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period, productId]);

  const kpi = data?.kpi || {};
  const movements = data?.movements || [];
  const balanceSeries = (data?.balance_series || []).map(p => Number(p.balance) || 0);
  const balanceLabels = (data?.balance_series || []).map(p =>
    fmtDate(new Date(p.date), { day: 'numeric', month: 'short' }, lang)
  );

  return (
    <>
      <PageHeader
        title={tt('📜 История движения товара')}
        sub={tt('Склад · только просмотр · приход и расход с накопительным остатком')}
        actions={<Badge tone="blue">{tt('Только просмотр')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 280px', minWidth: 220 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Товар')}</div>
            <select
              className="input"
              value={productId}
              onChange={e => setProductId(e.target.value)}
              style={{ width: '100%' }}
            >
              {products.length === 0 && <option value="">{tt('Нет товаров')}</option>}
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {(lang === 'uz' ? (p.name_uz || p.name_ru) : p.name_ru)}{p.barcode ? ` (${p.barcode})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Период')}</div>
            <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />
          </div>
        </div>
      </Card>

      {loading ? (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[0, 1, 2, 3].map(i => <Card key={i}><Skeleton height={48} /></Card>)}
          </div>
          <Card><Skeleton height={160} /></Card>
        </>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📦" label={tt('Текущий остаток')} value={`${fmtNum(kpi.balance || 0)} ${kpi.unit || ''}`} sub={tt('на складе сейчас')} color="var(--primary)" />
            <Tile icon="⬆️" label={tt('Приходов за период')} value={`+${fmtNum(kpi.income_qty || 0)} ${kpi.unit || ''}`} sub={tt('поступило')} color="#16A34A" />
            <Tile icon="⬇️" label={tt('Расходов за период')} value={`−${fmtNum(kpi.outcome_qty || 0)} ${kpi.unit || ''}`} sub={tt('продано и списано')} color="#DC2626" />
            <Tile icon="🔄" label={tt('Оборачиваемость')} value={kpi.turnover_days != null ? `${fmtNum(kpi.turnover_days)} ${tt('дн')}` : '—'} sub={tt('средний срок оборота')} color="#D97706" />
          </div>

          <Card icon="📈" title={tt('Динамика остатка')} style={{ marginBottom: 16 }}>
            {balanceSeries.length === 0 ? (
              <EmptyState icon="📭" title={tt('Нет движений за период')} description={tt('Выберите товар или другой период')} />
            ) : (
              <AreaChart data={balanceSeries} labels={balanceLabels} color="var(--primary)" height={180} />
            )}
          </Card>

          <Card icon="📋" title={`${tt('Движения')} (${movements.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Дата и время')}</th>
                    <th>{tt('Тип движения')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Кол-во')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Остаток после')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Цена (сум)')}</th>
                    <th>{tt('Филиал')}</th>
                    <th>{tt('Провёл')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет движений')}</td></tr>
                  ) : movements.slice(0, 300).map((m, idx) => {
                    const meta = KIND_META[m.kind] || { label: m.kind, color: 'var(--text2)', sign: '' };
                    const qty = Number(m.qty) || 0;
                    return (
                      <tr key={m.id ? `${m.kind}-${m.id}` : idx}>
                        <td className="mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {fmtDate(new Date(m.created_at), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }, lang)}
                        </td>
                        <td>
                          <span style={{ background: meta.color + '20', color: meta.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12 }}>
                            {tt(meta.label)}
                          </span>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: meta.color }}>
                          {meta.sign}{fmtNum(qty)}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(m.balance_after || 0)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{m.price != null ? fmtMoneyFull(m.price) : '—'}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 12 }}>{m.branch_name || '—'}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 12 }}>{m.user_name || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
