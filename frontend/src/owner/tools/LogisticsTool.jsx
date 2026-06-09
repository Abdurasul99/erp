import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';

export default function LogisticsTool() {
  return (
    <>
      <PageHeader title="🚚 Логистика" sub="Курьеры · карта · статусы доставки" />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="📦" label="В доставке" value="42" color="#5B4FE8" />
        <Tile icon="🚚" label="Курьеров" value="8" sub="из 12" color="#FF6B2B" />
        <Tile icon="⏱️" label="Среднее время" value="2.4ч" color="#22C55E" />
        <Tile icon="⚠️" label="Просрочки" value="3" color="#EF4444" />
      </div>
      <div className="grid-2">
        <Card icon="🚚" title="Активные доставки">
          {[
            { id: 'D-1042', c: 'ООО Меркурий',  dr: 'Бекзод М.', st: 'on-way' },
            { id: 'D-1041', c: 'Алишер К.',      dr: 'Diana K.',  st: 'picked-up' },
            { id: 'D-1040', c: 'TashTrade LLC',  dr: 'Anvar S.',  st: 'delivered' },
            { id: 'D-1039', c: 'ЧП «Барс»',      dr: '—',          st: 'pending' },
          ].map(d => (
            <div key={d.id} className="list-item">
              <Badge tone="gray">{d.id}</Badge>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{d.c}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.dr !== '—' ? '👤 ' + d.dr : 'Не назначен'}</div></div>
              {d.st === 'on-way' && <Badge tone="blue">🚚 В пути</Badge>}
              {d.st === 'picked-up' && <Badge tone="yellow">📦 Забран</Badge>}
              {d.st === 'delivered' && <Badge tone="green">✓ Доставлен</Badge>}
              {d.st === 'pending' && <Badge tone="gray">⏳ Ждёт</Badge>}
            </div>
          ))}
        </Card>
        <Card icon="🗺️" title="Live-карта">
          <div style={{ background: '#0a0a0f', borderRadius: 12, padding: 40, textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 50 }}>🗺️</div>
            <div style={{ marginTop: 10, fontWeight: 700 }}>Карта Ташкента</div>
            <div style={{ fontSize: 12, opacity: .7, marginTop: 4 }}>8 курьеров онлайн · обновление 30 сек</div>
          </div>
        </Card>
      </div>
    </>
  );
}
