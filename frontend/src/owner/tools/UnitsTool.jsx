import React, { useState } from 'react';
import { Card, PageHeader, Badge } from '../ui.jsx';
import { toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

const INIT = [
  { u: 'шт', i: '📦', cat: 'Штучные' }, { u: 'упак', i: '📦', cat: 'Штучные' }, { u: 'коробка', i: '📦', cat: 'Штучные' },
  { u: 'ящик', i: '🗃️', cat: 'Штучные' }, { u: 'пара', i: '👟', cat: 'Штучные' }, { u: 'компл', i: '🎁', cat: 'Штучные' },
  { u: 'пачка', i: '📚', cat: 'Штучные' }, { u: 'рулон', i: '🧻', cat: 'Штучные' },
  { u: 'кг', i: '⚖️', cat: 'Вес' }, { u: 'г', i: '🧪', cat: 'Вес' },
  { u: 'л', i: '💧', cat: 'Объём' }, { u: 'мл', i: '💦', cat: 'Объём' },
  { u: 'м', i: '📏', cat: 'Длина' }, { u: 'см', i: '📐', cat: 'Длина' },
  { u: 'м²', i: '🟦', cat: 'Площадь' }, { u: 'м³', i: '🟨', cat: 'Объём' },
];

export default function UnitsTool() {
  const { tt } = useTt();
  const [list, setList] = useState(INIT);
  const [newU, setNewU] = useState('');
  const cats = [...new Set(list.map(u => u.cat))];
  return (
    <>
      <PageHeader title={tt('📐 Единицы измерения')} sub={list.length + ' ' + tt('единиц · можно добавлять свои')} />
      {cats.map(c => (
        <Card key={c} icon={c === 'Вес' ? '⚖️' : c === 'Объём' ? '💧' : c === 'Длина' ? '📏' : c === 'Площадь' ? '🟦' : '📦'} title={tt(c)} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {list.filter(x => x.cat === c).map(x => (
              <Badge key={x.u} tone="gray">{x.i} {tt(x.u)}</Badge>
            ))}
          </div>
        </Card>
      ))}
      <Card icon="➕" title={tt('Добавить свою единицу')}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder={tt('например: бухта, моток, тюк')} value={newU} onChange={e => setNewU(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={() => { if (newU.trim()) { setList(l => [...l, { u: newU.trim(), i: '📦', cat: 'Штучные' }]); setNewU(''); toast(tt('Единица') + ' «' + newU.trim() + '» ' + tt('добавлена')); } }}>{tt('Добавить')}</button>
        </div>
      </Card>
    </>
  );
}
