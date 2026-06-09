import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';

export default function ScalingTool() {
  return (
    <>
      <PageHeader title="🌍 Масштабирование" sub="Несколько компаний · валют · языков · филиалов" />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="🏢" label="Компаний" value="1" sub="из ∞" color="#5B4FE8" />
        <Tile icon="🏭" label="Филиалов" value="3" color="#FF6B2B" />
        <Tile icon="💱" label="Валют" value="10" color="#22C55E" />
        <Tile icon="🌐" label="Языков" value="2" sub="RU · UZ" color="#0EA5E9" />
      </div>
      <div className="grid-2">
        <Card icon="🏭" title="Филиалы">
          {[
            ['📍 Ташкент центр', 'active'],
            ['📍 Ташкент Чиланзар', 'active'],
            ['📦 Склад главный', 'storage'],
            ['📍 Самарканд', 'plan'],
            ['📍 Бухара', 'plan'],
          ].map(([n, s]) => (
            <div key={n} className="list-item">
              <span style={{ flex: 1, fontWeight: 700 }}>{n}</span>
              <Badge tone={s === 'active' ? 'green' : s === 'storage' ? 'blue' : 'yellow'}>{s === 'active' ? 'Активен' : s === 'storage' ? 'Склад' : 'Q3 2026'}</Badge>
            </div>
          ))}
        </Card>
        <Card icon="💱" title="Валюты + курсы">
          <div className="grid-2" style={{ gap: 8 }}>
            {[
              ['🇺🇿 UZS', '1.0000'],
              ['🇺🇸 USD', '12 750'],
              ['🇪🇺 EUR', '13 800'],
              ['🇷🇺 RUB', '140'],
              ['🇰🇿 KZT', '27'],
              ['🇨🇳 CNY', '1 750'],
              ['🇹🇷 TRY', '350'],
              ['🇰🇷 KRW', '9.3'],
              ['🇬🇧 GBP', '16 000'],
              ['🇦🇪 AED', '3 470'],
            ].map(([c, r]) => (
              <div key={c} style={{ padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{c}</span>
                <span className="mono" style={{ fontWeight: 800, color: 'var(--primary)' }}>{r}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
