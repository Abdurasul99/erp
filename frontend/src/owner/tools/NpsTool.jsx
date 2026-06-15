import React from 'react';
import { Card, Tile, Badge, PageHeader, Sparkline } from '../ui.jsx';
import { toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

export default function NpsTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('⭐ NPS / Опросы')} sub={tt('Лояльность · детракторы · действия')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast(tt('Опрос запущен на 245 клиентов'))}>{tt('+ Опрос')}</button>} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="⭐" label="NPS" value="64" sub="Excellent (>50)" delta={9} color="#22C55E" />
        <Tile icon="😊" label={tt('Промоутеры')} value="72%" color="#22C55E" />
        <Tile icon="😐" label={tt('Нейтралы')} value="20%" color="#F59E0B" />
        <Tile icon="😠" label={tt('Детракторы')} value="8%" color="#EF4444" />
      </div>
      <div className="grid-2">
        <Card icon="📈" title={tt('Динамика NPS')}>
          <Sparkline data={[42, 48, 51, 55, 58, 62, 64]} color="#22C55E" />
        </Card>
        <Card icon="⚠️" title={tt('Детракторы — звонить срочно')}>
          {[
            { s: '2/10', n: 'Дилшод У.', r: tt('Долго доставляли') },
            { s: '4/10', n: 'Малика Т.', r: tt('Не тот цвет') },
            { s: '5/10', n: 'Бахтиёр К.', r: tt('Дорого vs конкуренты') },
          ].map(d => (
            <div key={d.n} className="list-item">
              <Badge tone="red">{d.s}</Badge>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{d.n}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.r}</div></div>
              <button className="btn btn-primary btn-sm" onClick={() => toast(tt('Звонок инициирован:') + ' ' + d.n)}>📞</button>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
