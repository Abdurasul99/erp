import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

export default function DataControlTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('🛡️ Контроль данных')} sub={tt('Защита от ошибок ввода · дубликаты · валидация')} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="✅" label={tt('Качество')} value="96%" color="#16A34A" />
        <Tile icon="🔁" label={tt('Дубликаты')} value="14" color="#D97706" />
        <Tile icon="❌" label={tt('Битые')} value="3" color="#DC2626" />
        <Tile icon="🛡️" label={tt('Правил')} value="47" color="#1D4ED8" />
      </div>
      <Card icon="🔁" title={tt('Найденные дубликаты (требуют слияния)')} actions={<button className="btn btn-primary btn-sm" onClick={() => toast(tt('Запуск авто-слияния'))}>{tt('🤖 Авто-слияние')}</button>}>
        <table>
          <thead><tr><th>{tt('Тип')}</th><th>{tt('Запись 1')}</th><th>{tt('Запись 2')}</th><th>{tt('Сходство')}</th><th></th></tr></thead>
          <tbody>
            {[
              [tt('Клиент'), 'Алишер Каримов', 'Алишер Каримов А.', '92%'],
              [tt('Клиент'), 'ООО Меркурий', 'OOO "Меркурий"', '88%'],
              [tt('Товар'),  'Шахматы 40x40', 'Шахматы 40×40', '95%'],
              [tt('Поставщик'), 'TashWood', 'Tashkent Wood', '74%'],
            ].map((r, i) => (
              <tr key={i}>
                <td><Badge tone="blue">{r[0]}</Badge></td>
                <td style={{ fontWeight: 700 }}>{r[1]}</td>
                <td style={{ fontWeight: 700, color: 'var(--text2)' }}>{r[2]}</td>
                <td><Badge tone={parseInt(r[3]) > 90 ? 'red' : 'yellow'}>{r[3]}</Badge></td>
                <td><button className="btn btn-primary btn-sm" onClick={() => toast(tt('Объединено'))}>{tt('Слить')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
