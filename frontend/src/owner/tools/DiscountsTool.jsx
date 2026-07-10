import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Скидки и акции — KPI (активных акций, % чеков со скидкой, средняя скидка, потери)
// + таблица акций + форма создания. Данные из /api/discounts.
const TYPE_LABEL = {
  percent: '% от чека',
  fixed: 'Фикс. сумма',
  qty: 'За объём',
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return '—'; }
};

export default function DiscountsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'percent', value: '', min_qty: '', starts_at: '', ends_at: '',
  });

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/discounts', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const kpi = data?.kpi || {};
  const items = data?.items || [];

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.value === '') return;
    setSaving(true); setError(null);
    const body = {
      name: form.name.trim(),
      type: form.type,
      value: parseFloat(form.value) || 0,
      min_qty: form.min_qty === '' ? null : parseInt(form.min_qty, 10),
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    };
    if (branchId) body.branch_id = branchId;
    api.post('/discounts', body)
      .then(() => {
        setForm({ name: '', type: 'percent', value: '', min_qty: '', starts_at: '', ends_at: '' });
        setShowForm(false);
        load();
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setSaving(false));
  };

  const toggleActive = (it) => {
    api.patch(`/discounts/${it.id}`, { is_active: !it.is_active })
      .then(load)
      .catch(e => setError(e.response?.data?.error || e.message));
  };

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border, #E3EAF3)', fontSize: 13, background: 'var(--bg, #fff)', color: 'var(--text)' };

  return (
    <>
      <PageHeader
        title={tt('🏷️ Скидки и акции')}
        sub={tt('Активные акции · влияние на чеки и выручку · потери на скидках')}
        actions={
          <button type="button" className="pill active" onClick={() => setShowForm(s => !s)}>
            {showForm ? tt('Закрыть') : tt('+ Новая акция')}
          </button>
        }
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {showForm && (
        <Card icon="➕" title={tt('Новая акция')} style={{ marginBottom: 16 }}>
          <form onSubmit={submit}>
            <div className="grid-3" style={{ gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{tt('Название')}</label>
                <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={tt('Летняя распродажа')} required />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{tt('Тип')}</label>
                <select style={inputStyle} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="percent">{tt('% от чека')}</option>
                  <option value="fixed">{tt('Фикс. сумма')}</option>
                  <option value="qty">{tt('За объём')}</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{tt('Значение')}</label>
                <input style={inputStyle} type="number" step="any" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={form.type === 'percent' ? '15' : '10000'} required />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{tt('Мин. кол-во')}</label>
                <input style={inputStyle} type="number" value={form.min_qty} onChange={e => setForm({ ...form, min_qty: e.target.value })} placeholder={tt('необязательно')} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{tt('Начало')}</label>
                <input style={inputStyle} type="date" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{tt('Конец')}</label>
                <input style={inputStyle} type="date" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="pill active" disabled={saving}>
              {saving ? tt('Сохранение...') : tt('Создать акцию')}
            </button>
          </form>
        </Card>
      )}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🔥" label={tt('Активных акций')} value={fmtNum(kpi.active_count || 0)} sub={tt('сейчас идут')} color="#16A34A" />
            <Tile icon="🧾" label={tt('Чеков со скидкой')}
              value={kpi.discount_check_share == null ? '—' : `${kpi.discount_check_share}%`}
              sub={tt('от всех чеков')} color="#1D4ED8" />
            <Tile icon="📉" label={tt('Средняя скидка')}
              value={kpi.avg_discount == null ? '—' : `${kpi.avg_discount}%`}
              sub={tt('по акциям')} color="#D97706" />
            <Tile icon="💸" label={tt('Потери на скидках')} value={`${fmtMoneyFull(kpi.lost_revenue || 0)} UZS`} sub={tt('за период')} color="#DC2626" />
          </div>

          <Card icon="🏷️" title={`${tt('Акции')} (${items.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th>{tt('Название')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Тип')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Значение')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Период')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                    <th style={{ textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет акций — создайте первую')}</td></tr>
                  ) : items.map(it => (
                    <tr key={it.id}>
                      <td style={{ fontWeight: 700 }}>{it.name}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 12 }}>{tt(TYPE_LABEL[it.type] || it.type)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                        {it.type === 'percent' ? `${fmtNum(it.value)}%` : `${fmtMoneyFull(it.value)}`}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 12 }}>
                        {!it.starts_at && !it.ends_at ? tt('Бессрочно') : `${fmtDate(it.starts_at)} — ${fmtDate(it.ends_at)}`}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge tone={it.is_active ? 'green' : 'gray'}>{it.is_active ? tt('Активна') : tt('Выкл')}</Badge>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button type="button" className="pill" onClick={() => toggleActive(it)}>
                          {it.is_active ? tt('Выключить') : tt('Включить')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
