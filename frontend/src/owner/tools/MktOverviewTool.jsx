import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

export default function MktOverviewTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('📣 Кампании')} sub={tt('Активные акции · промо · обзвон')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast('Конструктор кампаний')}>{tt('+ Кампания')}</button>} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="📣" label={tt('Активных')} value="8" color="#1D4ED8" />
        <Tile icon="📥" label={tt('Лидов (мес)')} value="284" delta={32} color="#16A34A" />
        <Tile icon="💰" label="ROI" value="3.8×" color="#D97706" />
        <Tile icon="🎁" label={tt('Реф. программа')} value="148" color="#EC4899" />
      </div>
      <Card>
        <table>
          <thead><tr><th>{tt('Кампания')}</th><th>{tt('Канал')}</th><th>{tt('Статус')}</th><th style={{ textAlign: 'right' }}>{tt('Бюджет')}</th><th style={{ textAlign: 'right' }}>{tt('Лидов')}</th><th style={{ textAlign: 'right' }}>ROI</th></tr></thead>
          <tbody>
            {[
              [tt('Весна 2026 — скидки'), 'Instagram', 'live', 8000, 124, 4.2],
              [tt('B2B спецпредложение'), 'Email', 'live', 0, 38, 12.5],
              [tt('Подарки 8 марта'),     'Telegram', 'paused', 5000, 86, 3.1],
              [tt('Реактивация спящих'),   'SMS+Email', 'live', 2000, 42, 5.8],
              [tt('Новый бренд Karven'),    'Reels', 'live', 12000, 64, 2.4],
            ].map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700 }}>{r[0]}</td>
                <td><Badge tone="purple">{r[1]}</Badge></td>
                <td>{r[2] === 'live' ? <Badge tone="green">{tt('● Активна')}</Badge> : <Badge tone="yellow">{tt('⏸ Пауза')}</Badge>}</td>
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
