import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { toast } from '../Modal.jsx';

export default function DataControlTool() {
  return (
    <>
      <PageHeader title="🛡️ Контроль данных" sub="Защита от ошибок ввода · дубликаты · валидация" />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="✅" label="Качество" value="96%" color="#22C55E" />
        <Tile icon="🔁" label="Дубликаты" value="14" color="#F59E0B" />
        <Tile icon="❌" label="Битые" value="3" color="#EF4444" />
        <Tile icon="🛡️" label="Правил" value="47" color="#5B4FE8" />
      </div>
      <Card icon="🔁" title="Найденные дубликаты (требуют слияния)" actions={<button className="btn btn-primary btn-sm" onClick={() => toast('Запуск авто-слияния')}>🤖 Авто-слияние</button>}>
        <table>
          <thead><tr><th>Тип</th><th>Запись 1</th><th>Запись 2</th><th>Сходство</th><th></th></tr></thead>
          <tbody>
            {[
              ['Клиент', 'Алишер Каримов', 'Алишер Каримов А.', '92%'],
              ['Клиент', 'ООО Меркурий', 'OOO "Меркурий"', '88%'],
              ['Товар',  'Шахматы 40x40', 'Шахматы 40×40', '95%'],
              ['Поставщик', 'TashWood', 'Tashkent Wood', '74%'],
            ].map((r, i) => (
              <tr key={i}>
                <td><Badge tone="blue">{r[0]}</Badge></td>
                <td style={{ fontWeight: 700 }}>{r[1]}</td>
                <td style={{ fontWeight: 700, color: 'var(--text2)' }}>{r[2]}</td>
                <td><Badge tone={parseInt(r[3]) > 90 ? 'red' : 'yellow'}>{r[3]}</Badge></td>
                <td><button className="btn btn-primary btn-sm" onClick={() => toast('Объединено')}>Слить</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
