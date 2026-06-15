import React from 'react';
import { Card, Tile, Badge, PageHeader, Progress } from '../ui.jsx';
import { useTt } from '../tt.js';

const CHANNELS = [
  { n: 'Instagram', leads: 142, cpl: 12000, conv: 8, roi: 3.4, c: '#EC4899' },
  { n: 'Telegram', leads: 84, cpl: 8500, conv: 14, roi: 5.2, c: '#0EA5E9' },
  { n: 'Google Ads', leads: 48, cpl: 24000, conv: 6, roi: 1.8, c: '#22C55E' },
  { n: 'SEO органика', leads: 76, cpl: 0, conv: 11, roi: 999, c: '#5B4FE8' },
  { n: 'Реф. программа', leads: 38, cpl: 5000, conv: 22, roi: 8.4, c: '#FF6B2B' },
  { n: 'Партнёры', leads: 22, cpl: 0, conv: 18, roi: 999, c: '#F59E0B' },
];

export default function LeadGenTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('📡 Лидогенерация')} sub={tt('ROI по каналам · CPL · поток лидов')} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="📥" label={tt('Лидов (мес)')} value="410" delta={28} color="#5B4FE8" />
        <Tile icon="💰" label={tt('Средний CPL')} value="9.2K" color="#FF6B2B" />
        <Tile icon="🎯" label={tt('В сделку')} value="11.8%" delta={3} color="#22C55E" />
        <Tile icon="📈" label={tt('ROI всего')} value="3.8×" delta={6} color="#0EA5E9" />
      </div>
      <Card icon="📡" title={tt('Эффективность каналов')}>
        <table>
          <thead><tr><th>{tt('Канал')}</th><th style={{ textAlign: 'right' }}>{tt('Лидов')}</th><th style={{ textAlign: 'right' }}>CPL</th><th style={{ textAlign: 'right' }}>{tt('Конверсия')}</th><th style={{ textAlign: 'right' }}>ROI</th><th>{tt('Доля')}</th></tr></thead>
          <tbody>
            {CHANNELS.map(c => (
              <tr key={c.n}>
                <td><Badge tone="blue">●  {tt(c.n)}</Badge></td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{c.leads}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{c.cpl === 0 ? 'free' : c.cpl.toLocaleString('ru-RU')}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{c.conv}%</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: c.roi >= 3 ? 'var(--green)' : c.roi >= 1.5 ? 'var(--orange)' : 'var(--red)' }}>{c.roi === 999 ? '∞' : c.roi + '×'}</td>
                <td style={{ minWidth: 100 }}><Progress value={c.leads} max={150} color={c.c} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
