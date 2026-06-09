import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { toast } from '../Modal.jsx';

export default function AutomationTool() {
  const [flows, setFlows] = useState([
    { name: 'Низкий остаток → Заказ', trigger: 'stock < ROP', action: 'Создать PO', runs: 142, status: 'on' },
    { name: 'Долг > 7 дней → SMS', trigger: 'debt overdue 7d', action: 'SMS+email', runs: 38, status: 'on' },
    { name: 'NPS < 7 → Звонок', trigger: 'NPS ≤6', action: 'Задача CRM', runs: 8, status: 'on' },
    { name: 'Покупка → Бонус через 7д', trigger: 'after purchase 7d', action: 'SMS', runs: 245, status: 'on' },
    { name: 'Спящий клиент → реактивация', trigger: 'no purchase 60d', action: 'Email-серия', runs: 56, status: 'off' },
  ]);
  return (
    <>
      <PageHeader title="⚡ Автоматизация" sub="Сценарии «Если → То» · согласования"
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast('Конструктор сценария')}>+ Сценарий</button>} />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="⚡" label="Активных" value={flows.filter(f => f.status === 'on').length} color="#5B4FE8" />
        <Tile icon="🚀" label="Запусков (мес)" value="489" delta={28} color="#22C55E" />
        <Tile icon="⏱️" label="Сэкономлено" value="84ч" sub="ручной работы" color="#FF6B2B" />
      </div>
      <Card icon="🤖" title="Сценарии">
        <table>
          <thead><tr><th></th><th>Название</th><th>Триггер</th><th>Действие</th><th style={{ textAlign: 'right' }}>Запусков</th><th></th></tr></thead>
          <tbody>
            {flows.map((f, i) => (
              <tr key={i}>
                <td>
                  <button onClick={() => setFlows(fs => fs.map((x, j) => j === i ? { ...x, status: x.status === 'on' ? 'off' : 'on' } : x))}
                    style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: f.status === 'on' ? '#22C55E' : '#9CA3AF', cursor: 'pointer', position: 'relative', padding: 0 }}>
                    <div style={{ position: 'absolute', top: 2, left: f.status === 'on' ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                  </button>
                </td>
                <td style={{ fontWeight: 700 }}>{f.name}</td>
                <td><code style={{ background: 'var(--bg-2)', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>{f.trigger}</code></td>
                <td><code style={{ background: 'var(--bg-2)', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>{f.action}</code></td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 800 }}>{f.runs}</td>
                <td><button className="btn btn-ghost btn-sm">⚙️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
