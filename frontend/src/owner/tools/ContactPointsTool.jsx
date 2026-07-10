import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { useTt } from '../tt.js';

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
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('📍 Точки контакта')} sub={tt('До · во время · после покупки')} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="📍" label={tt('Всего')} value="14" color="#1D4ED8" />
        <Tile icon="✅" label={tt('Активных')} value="11" color="#16A34A" />
        <Tile icon="🚧" label={tt('В плане')} value="3" color="#D97706" />
        <Tile icon="🎯" label={tt('Конверсия')} value="8.4%" delta={3} color="#D97706" />
      </div>
      {POINTS.map(s => (
        <Card key={s.stage} icon={s.icon} title={tt(s.stage)} style={{ marginBottom: 14 }}>
          <div className="grid-4">
            {s.items.map(p => (
              <div key={p.name} style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{tt(p.name)}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge tone={p.status === 'live' ? 'green' : 'yellow'}>{p.status === 'live' ? tt('Активно') : tt('План')}</Badge>
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
