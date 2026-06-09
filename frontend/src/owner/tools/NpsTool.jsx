import React from 'react';
import { Card, Tile, Badge, PageHeader, Sparkline } from '../ui.jsx';
import { toast } from '../Modal.jsx';

export default function NpsTool() {
  return (
    <>
      <PageHeader title="⭐ NPS / Опросы" sub="Лояльность · детракторы · действия"
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast('Опрос запущен на 245 клиентов')}>+ Опрос</button>} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="⭐" label="NPS" value="64" sub="Excellent (>50)" delta={9} color="#22C55E" />
        <Tile icon="😊" label="Промоутеры" value="72%" color="#22C55E" />
        <Tile icon="😐" label="Нейтралы" value="20%" color="#F59E0B" />
        <Tile icon="😠" label="Детракторы" value="8%" color="#EF4444" />
      </div>
      <div className="grid-2">
        <Card icon="📈" title="Динамика NPS">
          <Sparkline data={[42, 48, 51, 55, 58, 62, 64]} color="#22C55E" />
        </Card>
        <Card icon="⚠️" title="Детракторы — звонить срочно">
          {[
            { s: '2/10', n: 'Дилшод У.', r: 'Долго доставляли' },
            { s: '4/10', n: 'Малика Т.', r: 'Не тот цвет' },
            { s: '5/10', n: 'Бахтиёр К.', r: 'Дорого vs конкуренты' },
          ].map(d => (
            <div key={d.n} className="list-item">
              <Badge tone="red">{d.s}</Badge>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>{d.n}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.r}</div></div>
              <button className="btn btn-primary btn-sm" onClick={() => toast('Звонок инициирован: ' + d.n)}>📞</button>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
