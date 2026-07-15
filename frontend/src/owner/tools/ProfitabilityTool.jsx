import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, Pills, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import AiAnalyze from '../AiAnalyze.jsx';
import { useTt } from '../tt.js';

// Рентабельность — раздел Финансы, ТОЛЬКО учредитель/гендиректор.
// revenue/net_profit берутся из продаж/расходов; балансовые данные (активы/капитал/
// амортизация/проценты/налоги) вводятся вручную через POST /api/finance/balance-entry.
export default function ProfitabilityTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Форма ручного ввода балансовых данных
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ total_assets: '', equity: '', depreciation: '', interest_expense: '', taxes: '' });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  const load = () => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/finance/profitability', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  };

  useEffect(load, [branchId, period]);

  const submitBalance = (e) => {
    e.preventDefault();
    setSaving(true); setSaveErr(null);
    const body = {
      total_assets: parseFloat(form.total_assets) || 0,
      equity: parseFloat(form.equity) || 0,
      depreciation: parseFloat(form.depreciation) || 0,
      interest_expense: parseFloat(form.interest_expense) || 0,
      taxes: parseFloat(form.taxes) || 0,
    };
    if (branchId) body.branch_id = branchId;
    api.post('/finance/balance-entry', body)
      .then(() => { setShowForm(false); setForm({ total_assets: '', equity: '', depreciation: '', interest_expense: '', taxes: '' }); load(); })
      .catch(e => setSaveErr(e.response?.data?.error || e.message))
      .finally(() => setSaving(false));
  };

  const d = data || {};
  const m = d.metrics || {};
  const hasBalance = d.has_balance;

  // Цвет статуса по оценке («ok» | «warn» | «bad»)
  const toneColor = (s) => s === 'ok' ? 'var(--green)' : s === 'bad' ? 'var(--red)' : 'var(--orange)';
  const toneIcon = (s) => s === 'ok' ? '✅' : s === 'bad' ? '🔴' : '⚠️';
  const toneBadge = (s) => s === 'ok' ? 'green' : s === 'bad' ? 'red' : 'yellow';

  // Строки таблицы показателей
  const rows = [
    { key: 'ros', label: tt('ROS — рентабельность продаж'), value: m.ros, unit: '%', norm: tt('5–15%'), hint: tt('Сколько прибыли в каждом сум выручки') },
    { key: 'roa', label: tt('ROA — рентабельность активов'), value: m.roa, unit: '%', norm: tt('> 10%'), hint: tt('Сколько прибыли приносят активы'), needBalance: true },
    { key: 'roe', label: tt('ROE — рентабельность капитала'), value: m.roe, unit: '%', norm: tt('> 15%'), hint: tt('Отдача на вложенный капитал'), needBalance: true },
    { key: 'gross_margin', label: tt('Валовая маржа'), value: m.gross_margin, unit: '%', norm: tt('20–40%'), hint: tt('Выручка минус себестоимость') },
    { key: 'ebitda_margin', label: tt('Маржа EBITDA'), value: m.ebitda_margin, unit: '%', norm: tt('> 10%'), hint: tt('Операционная прибыль до амортизации и налогов') },
    { key: 'asset_turnover', label: tt('Оборачиваемость активов'), value: m.asset_turnover, unit: '', norm: tt('> 1.0'), hint: tt('Сколько выручки на каждый сум активов'), needBalance: true },
  ];

  const periodOptions = [
    { value: 'day', label: tt('День') },
    { value: 'week', label: tt('Неделя') },
    { value: 'month', label: tt('Месяц') },
    { value: 'year', label: tt('Год') },
  ];

  const fmtPct = (v) => (v == null ? '—' : fmtNum(Math.round(v * 10) / 10) + '%');
  const fmtRatio = (v) => (v == null ? '—' : fmtNum(Math.round(v * 100) / 100));

  return (
    <>
      <PageHeader
        title={'📐 ' + tt('Рентабельность')}
        sub={tt('ROS · ROA · ROE · EBITDA · только учредитель')}
        actions={<Pills value={period} onChange={setPeriod} options={periodOptions} label={tt('Период')} />}
      />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={160} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !d.revenue ? (
        <Card><EmptyState icon="📊" title={tt('Нет продаж за период')} description={tt('Рентабельность не на чём рассчитать. Появятся продажи — расчёт заработает.')} /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📈" label={tt('ROS — рентабельность продаж')} value={fmtPct(m.ros)} sub={tt('прибыль ÷ выручка')} color="#1D4ED8" />
            <Tile icon="🏛️" label={tt('ROA — рентабельность активов')} value={hasBalance ? fmtPct(m.roa) : '—'} sub={tt('прибыль ÷ активы')} color="#0EA5E9" />
            <Tile icon="💼" label={tt('ROE — рентабельность капитала')} value={hasBalance ? fmtPct(m.roe) : '—'} sub={tt('прибыль ÷ собств. капитал')} color="#16A34A" />
            <Tile icon="⚙️" label={tt('EBITDA')} value={m.ebitda != null ? fmtMoneyFull(m.ebitda) : '—'} sub={tt('опер. прибыль + амортизация')} color="#D97706" />
          </div>

          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Tile icon="💰" label={tt('Выручка (период)')} value={fmtMoneyFull(d.revenue)} sub={tt('сум')} color="#1D4ED8" />
            <Tile icon="💵" label={tt('Чистая прибыль')} value={fmtMoneyFull(d.net_profit)} sub={tt('сум · выручка − расходы')} color={d.net_profit >= 0 ? '#16A34A' : '#DC2626'} />
            <Tile icon="🧱" label={tt('Себестоимость')} value={fmtMoneyFull(d.cogs)} sub={tt('сум · закупка проданного')} color="#64748B" />
          </div>

          {!hasBalance && (
            <Card style={{ marginBottom: 16, borderLeft: '3px solid var(--orange)' }}>
              <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>
                ⚠️ {tt('ROA, ROE и оборачиваемость активов требуют балансовых данных.')}{' '}
                {tt('Введите активы и капитал вручную, чтобы увидеть полный расчёт.')}
              </div>
            </Card>
          )}

          <Card
            icon="📋"
            title={tt('Показатели рентабельности')}
            actions={<button type="button" className="pill" onClick={() => setShowForm(v => !v)}>{showForm ? tt('Скрыть форму') : tt('Ввести баланс')}</button>}
            style={{ marginBottom: 16 }}
          >
            {showForm && (
              <form onSubmit={submitBalance} style={{ marginBottom: 16, padding: 14, background: 'var(--bg-2)', borderRadius: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>{tt('Балансовые данные за период (сум)')}</div>
                <div className="grid-3" style={{ gap: 10 }}>
                  {[
                    ['total_assets', tt('Всего активов')],
                    ['equity', tt('Собственный капитал')],
                    ['depreciation', tt('Амортизация')],
                    ['interest_expense', tt('Проценты по кредитам')],
                    ['taxes', tt('Налоги')],
                  ].map(([k, lbl]) => (
                    <label key={k} style={{ display: 'block', fontSize: 12.5, color: 'var(--text2)' }}>
                      {lbl}
                      <input
                        type="number" inputMode="numeric" min="0" step="any"
                        value={form[k]}
                        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                        placeholder="0"
                        style={{ width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}
                      />
                    </label>
                  ))}
                </div>
                {saveErr && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 8 }}>⚠️ {saveErr}</div>}
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button type="submit" className="pill active" disabled={saving}>{saving ? tt('Сохранение…') : tt('Сохранить')}</button>
                  <button type="button" className="pill" onClick={() => setShowForm(false)}>{tt('Отмена')}</button>
                </div>
              </form>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text3)', borderBottom: '1.5px solid var(--border)' }}>
                    <th style={{ padding: '8px 8px' }}>{tt('Показатель')}</th>
                    <th style={{ padding: '8px 8px', textAlign: 'right' }}>{tt('Значение')}</th>
                    <th style={{ padding: '8px 8px' }}>{tt('Норма')}</th>
                    <th style={{ padding: '8px 8px' }}>{tt('Статус')}</th>
                    <th style={{ padding: '8px 8px' }}>{tt('Смысл простыми словами')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const blocked = r.needBalance && !hasBalance;
                    const status = blocked ? null : (m[r.key + '_status'] || null);
                    return (
                      <tr key={r.key} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{r.label}</td>
                        <td className="mono" style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: blocked ? 'var(--text3)' : 'var(--text)' }}>
                          {blocked ? '—' : (r.unit === '%' ? fmtPct(r.value) : fmtRatio(r.value))}
                        </td>
                        <td style={{ padding: '10px 8px', color: 'var(--text2)' }}>{r.norm}</td>
                        <td style={{ padding: '10px 8px' }}>
                          {blocked
                            ? <Badge tone="blue">{tt('нужен баланс')}</Badge>
                            : status
                              ? <Badge tone={toneBadge(status)}>{toneIcon(status)} {status === 'ok' ? tt('норма') : status === 'bad' ? tt('низко') : tt('средне')}</Badge>
                              : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 8px', color: 'var(--text3)', fontSize: 12.5, maxWidth: 260 }}>{r.hint}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card icon="🧮" title={tt('Как это считается')} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
              <div>{tt('ROS = Чистая прибыль ÷ Выручка')}</div>
              <div>{tt('ROA = Чистая прибыль ÷ Всего активов')}</div>
              <div>{tt('ROE = Чистая прибыль ÷ Собственный капитал')}</div>
              <div>{tt('EBITDA = Операционная прибыль + Амортизация + Проценты + Налоги')}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
                {tt('Выручка и себестоимость берутся из продаж, расходы — из кассы. Активы, капитал, амортизация, проценты и налоги вводятся вручную.')}
              </div>
            </div>
          </Card>

          <AiAnalyze topic="profitability" branchId={branchId} />
        </>
      )}
    </>
  );
}
