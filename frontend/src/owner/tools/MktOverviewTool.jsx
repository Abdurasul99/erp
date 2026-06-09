import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { toast } from '../Modal.jsx';

export default function MktOverviewTool() {
  return (
    <>
      <PageHeader title="📣 Кампании" sub="Активные акции · промо · обзвон"
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast('Конструктор кампаний')}>+ Кампания</button>} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="📣" label="Активных" value="8" color="#5B4FE8" />
        <Tile icon="📥" label="Лидов (мес)" value="284" delta={32} color="#22C55E" />
        <Tile icon="💰" label="ROI" value="3.8×" color="#FF6B2B" />
        <Tile icon="🎁" label="Реф. программа" value="148" color="#EC4899" />
      </div>
      <Card>
        <table>
          <thead><tr><th>Кампания</th><th>Канал</th><th>Статус</th><th style={{ textAlign: 'right' }}>Бюджет</th><th style={{ textAlign: 'right' }}>Лидов</th><th style={{ textAlign: 'right' }}>ROI</th></tr></thead>
          <tbody>
            {[
              ['Весна 2026 — скидки', 'Instagram', 'live', 8000, 124, 4.2],
              ['B2B спецпредложение', 'Email', 'live', 0, 38, 12.5],
              ['Подарки 8 марта',     'Telegram', 'paused', 5000, 86, 3.1],
              ['Реактивация спящих',   'SMS+Email', 'live', 2000, 42, 5.8],
              ['Новый бренд Karven',    'Reels', 'live', 12000, 64, 2.4],
            ].map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700 }}>{r[0]}</td>
                <td><Badge tone="purple">{r[1]}</Badge></td>
                <td>{r[2] === 'live' ? <Badge tone="green">● Активна</Badge> : <Badge tone="yellow">⏸ Пауза</Badge>}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{r[3]}K</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{r[4]}</td>
                <td><Badge tone={r[5] > 5 ? 'green' : r[5] > 2 ? 'yellow' : 'red'}>{r[5]}×</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
