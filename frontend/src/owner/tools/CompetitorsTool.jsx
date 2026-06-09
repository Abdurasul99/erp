import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';

export default function CompetitorsTool() {
  return (
    <>
      <PageHeader title="🔭 Конкуренты" sub="Мониторинг цен · сильные/слабые стороны" />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="🔭" label="Конкурентов" value="6" color="#5B4FE8" />
        <Tile icon="🚨" label="Сменили цены" value="3" sub="за неделю" color="#F59E0B" />
        <Tile icon="🆕" label="Новые товары" value="8" color="#22C55E" />
      </div>
      <Card icon="🆚" title="Сравнение цен">
        <table>
          <thead><tr><th>Товар</th><th style={{ textAlign: 'right' }}>Мы</th><th style={{ textAlign: 'right' }}>Конк. A</th><th style={{ textAlign: 'right' }}>Конк. B</th><th>Позиция</th></tr></thead>
          <tbody>
            {[
              ['Бейсболка синяя', 150, 165, 142, 'mid'],
              ['Брус 50×100', 420, 480, 460, 'best'],
              ['Шахматы 40×40', 300, 350, 340, 'best'],
              ['Йогоч ваза 45', 200, 180, 195, 'expensive'],
              ['Latun shamdon', 580, 620, 600, 'best'],
            ].map((r) => (
              <tr key={r[0]}>
                <td style={{ fontWeight: 700 }}>{r[0]}</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{r[1]}K</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{r[2]}K</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{r[3]}K</td>
                <td>{r[4] === 'best' && <Badge tone="green">✓ Лучшая цена</Badge>}
                    {r[4] === 'mid' && <Badge tone="yellow">≈ В рынке</Badge>}
                    {r[4] === 'expensive' && <Badge tone="red">⚠️ Дороже</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid-2" style={{ marginTop: 18 }}>
        <Card icon="💪" title="Наши сильные стороны">
          <div className="list">
            {['Доставка 24ч · быстрее на 2 дня', 'Возврат 100% без вопросов', 'Личный менеджер для B2B', 'Узбекская эстетика — туристы'].map(t => (
              <div key={t} className="list-item"><Badge tone="green">+</Badge><span style={{ fontSize: 13 }}>{t}</span></div>
            ))}
          </div>
        </Card>
        <Card icon="⚠️" title="Где мы проигрываем">
          <div className="list">
            {['Нет точек в Самарканде/Бухаре', 'Меньший ассортимент дерева', 'Сайт менее удобный', 'Нет рассрочки 3/6/12'].map(t => (
              <div key={t} className="list-item"><Badge tone="red">−</Badge><span style={{ fontSize: 13 }}>{t}</span></div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
