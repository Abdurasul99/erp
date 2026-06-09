import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';

export default function SecurityTool() {
  return (
    <>
      <PageHeader title="🔐 Безопасность" sub="Роли · права · бэкапы · шифрование" />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="✅" label="Security Score" value="92" sub="из 100" color="#22C55E" />
        <Tile icon="🔐" label="Сессий" value="14" sub="онлайн" color="#5B4FE8" />
        <Tile icon="💾" label="Последний бэкап" value="2ч" color="#FF6B2B" />
        <Tile icon="⚠️" label="Угроз" value="0" sub="за неделю" color="#22C55E" />
      </div>
      <Card icon="👮" title="Роли × Права">
        <table>
          <thead><tr><th>Роль</th><th>Каталог</th><th>Продажи</th><th>Финансы</th><th>HR</th><th>Настройки</th></tr></thead>
          <tbody>
            {[
              ['Admin', 'RW', 'RW', 'RW', 'RW', 'RW'],
              ['Ген.директор', 'RW', 'RW', 'RW', 'RW', 'R'],
              ['Менеджер', 'RW', 'RW', 'R', '−', '−'],
              ['Кассир', 'R', 'RW', '−', '−', '−'],
              ['Складовщик', 'RW', 'R', '−', '−', '−'],
              ['Продавец', 'R', 'RW(свой)', '−', '−', '−'],
            ].map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 800 }}>{r[0]}</td>
                {r.slice(1).map((p, j) => <td key={j}><Badge tone={p === 'RW' ? 'green' : p === 'R' ? 'blue' : p.includes('RW') ? 'yellow' : 'gray'}>{p}</Badge></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
