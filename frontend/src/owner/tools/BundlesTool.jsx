import React from 'react';
import { Card, Tile, PageHeader } from '../ui.jsx';
import { toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

const BUNDLES = [
  { n: 'Узбекский сувенир BASE',   items: 3, price: '850K',  img: '🎁' },
  { n: 'Hand-craft PREMIUM',       items: 5, price: '1.8M',  img: '💎' },
  { n: 'Деловой подарок CORP',     items: 4, price: '2.4M',  img: '🏢' },
  { n: 'Свадебный набор',          items: 7, price: '3.5M',  img: '💍' },
  { n: 'Новогодний',                items: 6, price: '1.2M',  img: '🎄' },
  { n: 'Туристический',             items: 4, price: '950K',  img: '✈️' },
];

export default function BundlesTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('🎁 Наборы')} sub={tt('Сборка · разборка · спецификация (BOM)')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast(tt('Конструктор набора'))}>+ {tt('Набор')}</button>} />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="🎁" label={tt('Наборов')} value={BUNDLES.length} color="#5B4FE8" />
        <Tile icon="🔧" label={tt('К сборке')} value="22" sub={tt('по компонентам')} color="#22C55E" />
        <Tile icon="📈" label={tt('Маржа набора')} value="+18%" sub={tt('vs позиций')} color="#FF6B2B" />
      </div>
      <div className="grid-3">
        {BUNDLES.map(b => (
          <Card key={b.n} style={{ padding: 18, textAlign: 'center', cursor: 'pointer' }}
            onClick={() => toast(tt('Открыта карточка набора') + ' «' + tt(b.n) + '»')}>
            <div style={{ fontSize: 50 }}>{b.img}</div>
            <div style={{ fontWeight: 800, fontSize: 14, marginTop: 8 }}>{tt(b.n)}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{b.items} {tt('компонентов')}</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: 'var(--primary)', marginTop: 8 }}>{b.price}</div>
          </Card>
        ))}
      </div>
    </>
  );
}
