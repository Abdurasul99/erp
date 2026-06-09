import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoney, fmtNum, Pills } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';

const SEGMENT_META = {
  vip:      { label: 'VIP',      tone: 'orange', icon: '👑', desc: 'LTV ≥ 5M UZS · активные'           },
  regular:  { label: 'Активные', tone: 'green',  icon: '✅', desc: 'Регулярные покупки в последние 60д' },
  new:      { label: 'Новые',    tone: 'blue',   icon: '✨', desc: 'Зарегистрированы < 30 дней назад' },
  sleeping: { label: 'Спящие',   tone: 'yellow', icon: '😴', desc: 'Без покупок 60-120 дней — реактивация' },
  lost:     { label: 'Ушли',     tone: 'red',    icon: '👋', desc: 'Без покупок 120+ дней или никогда не покупали' },
};

const TABS = [
  { value: 'all',      label: 'Все' },
  { value: 'vip',      label: '👑 VIP' },
  { value: 'regular',  label: '✅ Активные' },
  { value: 'sleeping', label: '😴 Спящие' },
  { value: 'lost',     label: '👋 Ушли' },
  { value: 'new',      label: '✨ Новые' },
];

export default function SegmentationTool() {
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/customers/segments', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const summary = data?.summary || {};
  const customers = data?.customers || [];
  const filtered = tab === 'all' ? customers : customers.filter(c => c.segment === tab);

  return (
    <>
      <PageHeader
        title="🎯 Сегментация клиентов"
        sub="RFM-разбивка — кому звонить, кого возвращать"
        actions={<Badge tone="green">Live</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>Загрузка...</div></div></Card>
      ) : (
        <>
          <div className="grid-5" style={{ marginBottom: 16 }}>
            <Tile icon="👑" label="VIP"      value={fmtNum(summary.vip)}      sub="клиентов"  color="#FF6B2B" />
            <Tile icon="✅" label="Активные" value={fmtNum(summary.regular)}  sub="клиентов"  color="#22C55E" />
            <Tile icon="😴" label="Спящие"   value={fmtNum(summary.sleeping)} sub="60-120 дн" color="#F59E0B" />
            <Tile icon="👋" label="Ушли"     value={fmtNum(summary.lost)}     sub="120+ дн"   color="#EF4444" />
            <Tile icon="✨" label="Новые"    value={fmtNum(summary.new)}      sub="< 30 дн"   color="#5B4FE8" />
          </div>

          <Card icon="📋" title={`Клиенты (${filtered.length})`} actions={<Pills value={tab} onChange={setTab} options={TABS} />}
            style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Телефон</th>
                    <th>Сегмент</th>
                    <th style={{ textAlign: 'right' }}>Сделок</th>
                    <th style={{ textAlign: 'right' }}>Выручка</th>
                    <th style={{ textAlign: 'right' }}>Посл. покупка</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>Нет клиентов в этом сегменте</td></tr>
                  ) : filtered.slice(0, 200).map(c => {
                    const meta = SEGMENT_META[c.segment] || {};
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700 }}>{c.name}</td>
                        <td className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{c.phone || '—'}</td>
                        <td><Badge tone={meta.tone}>{meta.icon} {meta.label}</Badge></td>
                        <td className="mono" style={{ textAlign: 'right' }}>{c.deals}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(c.revenue)}</td>
                        <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text2)' }}>
                          {c.last_at ? `${c.days_since} дн назад` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > 200 && (
              <div style={{ textAlign: 'center', padding: 10, color: 'var(--text3)', fontSize: 12 }}>
                Показаны первые 200 из {filtered.length}
              </div>
            )}
          </Card>

          <div className="grid-3">
            {['vip', 'sleeping', 'lost'].map(seg => {
              const meta = SEGMENT_META[seg];
              const count = summary[seg] || 0;
              return (
                <Card key={seg} icon={meta.icon} title={`${meta.label} — план действий`}>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                    {meta.desc}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 24, fontWeight: 900 }} className="mono">{count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>клиентов в сегменте</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {seg === 'vip' && 'Персональный звонок · эксклюзивные предложения · приоритетная поддержка'}
                    {seg === 'sleeping' && 'SMS-рассылка со скидкой 10% · напомните о себе · вернуть на радар'}
                    {seg === 'lost' && 'Опрос «что пошло не так» · попытка last-chance с агрессивной скидкой'}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
