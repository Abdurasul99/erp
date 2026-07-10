import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, EmptyState, Skeleton, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt, fmtDate } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

const STATUS_META = {
  in_transit: { label: 'В пути',  tone: 'amber' },
  received:   { label: 'Принято', tone: 'green' },
};

export default function StockTransfersTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [form, setForm] = useState({ product_id: '', from_branch: '', to_branch: '', qty: '' });

  const load = () => {
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/warehouse/transfers', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [branchId, period]);

  const transfers = data?.transfers || [];
  const branches = data?.branches || [];
  const products = data?.products || [];
  const agg = data?.aggregates || { invoices: 0, units: 0, value: 0 };

  const submit = async (e) => {
    e.preventDefault();
    setFormErr(null);
    if (!form.product_id || !form.from_branch || !form.to_branch || !form.qty) {
      setFormErr(tt('Заполните все поля')); return;
    }
    if (form.from_branch === form.to_branch) {
      setFormErr(tt('Склады отправки и получения должны отличаться')); return;
    }
    setSaving(true);
    try {
      await api.post('/warehouse/transfers', {
        product_id: parseInt(form.product_id),
        from_branch: parseInt(form.from_branch),
        to_branch: parseInt(form.to_branch),
        qty: parseFloat(form.qty),
      });
      setForm({ product_id: '', from_branch: '', to_branch: '', qty: '' });
      load();
    } catch (err) {
      setFormErr(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const receive = async (id) => {
    try {
      await api.patch(`/warehouse/transfers/${id}/receive`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const branchName = (id) => branches.find(b => b.id === id)?.name || ('#' + id);

  return (
    <>
      <PageHeader
        title={tt('🚚 Перемещение между складами')}
        sub={tt('Накладные перемещения · отправка списывает остаток, приёмка зачисляет')}
        actions={<Badge tone="amber">{tt('🟡 Полезно')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      <Card style={{ marginBottom: 16 }}>
        <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} label={tt('Период')} />
      </Card>

      {loading ? (
        <Card><Skeleton height={16} style={{ marginBottom: 10 }} /><Skeleton height={16} width="60%" /></Card>
      ) : (
        <>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Tile icon="📋" label={tt('Перемещений (накладных)')} value={fmtNum(agg.invoices)} sub={tt('за период')} color="var(--primary)" />
            <Tile icon="📦" label={tt('Штук перемещено')} value={fmtNum(agg.units)} sub={tt('единиц товара')} color="#16A34A" />
            <Tile icon="💰" label={tt('Стоимость (сум)')} value={fmtMoneyFull(agg.value)} sub={tt('по себестоимости')} color="#1D4ED8" />
          </div>

          <Card icon="➕" title={tt('Новая отправка')} style={{ marginBottom: 16 }}>
            <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' }}>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Товар')}</div>
                <select className="input" value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}>
                  <option value="">{tt('— выберите —')}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Откуда')}</div>
                <select className="input" value={form.from_branch} onChange={e => setForm({ ...form, from_branch: e.target.value })}>
                  <option value="">{tt('— склад —')}</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Куда')}</div>
                <select className="input" value={form.to_branch} onChange={e => setForm({ ...form, to_branch: e.target.value })}>
                  <option value="">{tt('— склад —')}</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Кол-во (шт)')}</div>
                <input className="input" type="number" min="0" step="any" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} placeholder="0" />
              </label>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? tt('Отправка...') : tt('Отправить')}
              </button>
            </form>
            {formErr && <div style={{ color: 'var(--red)', marginTop: 10, fontSize: 13 }}>{formErr}</div>}
          </Card>

          <Card icon="📋" title={`${tt('История перемещений')} (${transfers.length})`}>
            {transfers.length === 0 ? (
              <EmptyState icon="🚚" title={tt('Нет перемещений')} description={tt('За выбранный период перемещений между складами не было')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Дата и время')}</th>
                      <th>{tt('Товар')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Кол-во (шт)')}</th>
                      <th>{tt('Откуда')}</th>
                      <th>{tt('Куда')}</th>
                      <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Стоимость')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map(t => {
                      const meta = STATUS_META[t.status] || { label: t.status, tone: 'blue' };
                      return (
                        <tr key={t.id}>
                          <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                            {fmtDate(new Date(t.sent_at), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, lang)}
                          </td>
                          <td style={{ fontWeight: 700 }}>{t.product_name}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(t.qty)}</td>
                          <td>{branchName(t.from_branch)}</td>
                          <td>{branchName(t.to_branch)}</td>
                          <td style={{ textAlign: 'center' }}><Badge tone={meta.tone}>{tt(meta.label)}</Badge></td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(t.value)}</td>
                          <td style={{ textAlign: 'right' }}>
                            {t.status === 'in_transit' && (
                              <button className="btn btn-sm" onClick={() => receive(t.id)}>{tt('Принять')}</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
