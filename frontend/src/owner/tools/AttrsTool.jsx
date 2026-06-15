import React from 'react';
import { Card, PageHeader, Badge } from '../ui.jsx';
import { useTt } from '../tt.js';

const ATTRS = [
  { type: 'Одежда', attrs: ['цвет', 'размер (S/M/L/XL)', 'материал', 'пол'] },
  { type: 'Дерево', attrs: ['порода', 'влажность %', 'сорт (А/Б/В)'] },
  { type: 'Декор',  attrs: ['материал', 'высота см', 'стиль'] },
  { type: 'Латунь', attrs: ['вес г', 'покрытие'] },
  { type: 'Керамика', attrs: ['роспись', 'диаметр см', 'обжиг'] },
];

export default function AttrsTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('⚙️ Атрибуты товаров')} sub={tt('Кастомные поля по типу товара')} />
      {ATTRS.map(a => (
        <Card key={a.type} icon="🏷️" title={tt(a.type)} style={{ marginBottom: 14 }}
          actions={<button className="btn btn-ghost btn-sm">{tt('+ Атрибут')}</button>}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {a.attrs.map(x => <Badge key={x} tone="purple">{tt(x)}</Badge>)}
          </div>
        </Card>
      ))}
    </>
  );
}
