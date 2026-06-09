import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';

const POINTS = [
  { stage: 'До покупки', icon: '🔍', items: [
    { name: 'Instagram реклама', status: 'live', conv: '3.2%' },
    { name: 'Telegram канал', status: 'live', conv: '5.8%' },
    { name: 'Сайт / SEO', status: 'live', conv: '2.1%' },
    { name: 'Реф. программа', status: 'live', conv: '14%' },
  ]},
  { stage: 'Во время покупки', icon: '🛒', items: [
    { name: 'Розничный магазин', status: 'live', conv: '—' },
    { name: 'Касса', status: 'live', conv: '—' },
    { name: 'Упаковка', status: 'live', conv: '—' },
    { name: 'Чек с QR обратной связи', status: 'plan', conv: '—' },
  ]},
  { stage: 'После покупки', icon: '🎁', items: [
    { name: 'SMS «спасибо»', status: 'live', conv: '—' },
    { name: 'NPS-опрос через 7 дней', status: 'live', conv: '32%' },
    { name: 'Реактивация через 60 дн', status: 'plan', conv: '—' },
    { name: 'День рождения', status: 'live', conv: '18%' },
  ]},
];

export default function ContactPointsTool() {
  return (
    <>
      <PageHeader title="📍 Точки контакта" sub="До · во время · после покупки" />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="📍" label="Всего" value="14" color="#5B4FE8" />
        <Tile icon="✅" label="Активных" value="11" color="#22C55E" />
        <Tile icon="🚧" label="В плане" value="3" color="#F59E0B" />
        <Tile icon="🎯" label="Конверсия" value="8.4%" delta={3} color="#FF6B2B" />
      </div>
      {POINTS.map(s => (
        <Card key={s.stage} icon={s.icon} title={s.stage} style={{ marginBottom: 14 }}>
          <div className="grid-4">
            {s.items.map(p => (
              <div key={p.name} style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{p.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge tone={p.status === 'live' ? 'green' : 'yellow'}>{p.status === 'live' ? 'Активно' : 'План'}</Badge>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)' }}>{p.conv}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}
