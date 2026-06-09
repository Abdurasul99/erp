import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { fmt } from '../data.js';

const SALES = Array.from({ length: 20 }, (_, i) => ({
  id: 'S-' + (1000 + i),
  date: '2026-05-' + (10 + (i % 20)),
  time: ['09:14', '10:30', '11:45', '13:22', '14:08', '15:55', '16:40', '17:12'][i % 8],
  client: ['Алишер К.', 'Дилшод У.', 'TashTrade', 'ЧП Барс', 'Меркурий', 'Розница', 'Бахтиёр К.', 'Khorezm M.'][i % 8],
  pm: ['cash', 'card', 'transfer', 'wire'][i % 4],
  items: (i % 5) + 1,
  total: ((i * 137 + 240) * 1000) % 5000000 + 100000,
  type: i % 5 === 0 ? 'B2B' : 'B2C',
}));

export default function SalesHistoryTool() {
  const [search, setSearch] = useState('');
  const filtered = SALES.filter(s => !search || s.client.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search));
  return (
    <>
      <PageHeader title="📋 История продаж" sub="Все чеки и B2B сделки" />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="🧾" label="Сегодня" value={SALES.filter(s => s.date.endsWith('-30')).length} color="#5B4FE8" />
        <Tile icon="💰" label="Сумма дня" value={fmt(SALES.filter(s => s.date.endsWith('-30')).reduce((a, s) => a + s.total, 0))} color="#22C55E" />
        <Tile icon="📅" label="За месяц" value={SALES.length} color="#FF6B2B" />
        <Tile icon="🏢" label="B2B доля" value={Math.round(SALES.filter(s => s.type === 'B2B').length / SALES.length * 100) + '%'} color="#0EA5E9" />
      </div>
      <Card>
        <input className="input" placeholder="🔍 Клиент или № чека..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 14, maxWidth: 400 }} />
        <table>
          <thead><tr><th>#</th><th>Дата</th><th>Клиент</th><th>Тип</th><th>Оплата</th><th style={{ textAlign: 'right' }}>Поз.</th><th style={{ textAlign: 'right' }}>Сумма</th></tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td className="mono" style={{ color: 'var(--text3)' }}>{s.id}</td>
                <td style={{ fontSize: 12 }}>{s.date}<br/><span style={{ color: 'var(--text3)' }}>{s.time}</span></td>
                <td style={{ fontWeight: 700 }}>{s.client}</td>
                <td><Badge tone={s.type === 'B2B' ? 'purple' : 'blue'}>{s.type}</Badge></td>
                <td><Badge tone="gray">{ {cash:'💵 Нал', card:'💳 Карта', transfer:'🏦 Перевод', wire:'📑 Перечисл.'}[s.pm] }</Badge></td>
                <td className="mono" style={{ textAlign: 'right' }}>{s.items}</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{fmt(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
