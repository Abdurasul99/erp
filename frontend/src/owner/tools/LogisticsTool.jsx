import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { useTt } from '../tt.js';

export default function LogisticsTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('🚚 Логистика')} sub={tt('Курьеры · карта · статусы доставки')} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="📦" label={tt('В доставке')} value="42" color="#1D4ED8" />
        <Tile icon="🚚" label={tt('Курьеров')} value="8" sub={tt('из 12')} color="#D97706" />
        <Tile icon="⏱️" label={tt('Среднее время')} value="2.4ч" color="#16A34A" />
        <Tile icon="⚠️" label={tt('Просрочки')} value="3" color="#DC2626" />
      </div>
      <div className="grid-2">
        <Card icon="🚚" title={tt('Активные доставки')}>
          {[
            { id: 'D-1042', c: 'ООО Меркурий',  dr: 'Бекзод М.', st: 'on-way' },
            { id: 'D-1041', c: 'Алишер К.',      dr: 'Diana K.',  st: 'picked-up' },
            { id: 'D-1040', c: 'TashTrade LLC',  dr: 'Anvar S.',  st: 'delivered' },
            { id: 'D-1039', c: 'ЧП «Барс»',      dr: '—',          st: 'pending' },
          ].map(d => (
            <div key={d.id} className="list-item">
              <Badge tone="gray">{d.id}</Badge>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{tt(d.c)}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.dr !== '—' ? '👤 ' + tt(d.dr) : tt('Не назначен')}</div></div>
              {d.st === 'on-way' && <Badge tone="blue">{tt('🚚 В пути')}</Badge>}
              {d.st === 'picked-up' && <Badge tone="yellow">{tt('📦 Забран')}</Badge>}
              {d.st === 'delivered' && <Badge tone="green">{tt('✓ Доставлен')}</Badge>}
              {d.st === 'pending' && <Badge tone="gray">{tt('⏳ Ждёт')}</Badge>}
            </div>
          ))}
        </Card>
        <Card icon="🗺️" title={tt('Live-карта')}>
          <div style={{ background: '#0a0a0f', borderRadius: 12, padding: 40, textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 50 }}>🗺️</div>
            <div style={{ marginTop: 10, fontWeight: 700 }}>{tt('Карта Ташкента')}</div>
            <div style={{ fontSize: 12, opacity: .7, marginTop: 4 }}>8 {tt('курьеров онлайн · обновление 30 сек')}</div>
          </div>
        </Card>
      </div>
    </>
  );
}
