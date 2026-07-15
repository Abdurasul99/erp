import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

export default function AutomationTool() {
  const { tt } = useTt();
  const [flows, setFlows] = useState([
    { name: 'Низкий остаток → Заказ', trigger: 'stock < ROP', action: 'Создать PO', runs: 142, status: 'on' },
    { name: 'Долг > 7 дней → SMS', trigger: 'debt overdue 7d', action: 'SMS+email', runs: 38, status: 'on' },
    { name: 'NPS < 7 → Звонок', trigger: 'NPS ≤6', action: 'Задача CRM', runs: 8, status: 'on' },
    { name: 'Покупка → Бонус через 7д', trigger: 'after purchase 7d', action: 'SMS', runs: 245, status: 'on' },
    { name: 'Спящий клиент → реактивация', trigger: 'no purchase 60d', action: 'Email-серия', runs: 56, status: 'off' },
  ]);
  return (
    <>
      <PageHeader title={tt('⚡ Автоматизация')} sub={tt('Сценарии «Если → То» · согласования')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast(tt('Конструктор сценария'))}>{tt('+ Сценарий')}</button>} />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="⚡" label={tt('Активных')} value={flows.filter(f => f.status === 'on').length} color="#1D4ED8" />
        <Tile icon="🚀" label={tt('Запусков (мес)')} value="489" delta={28} color="#16A34A" />
        <Tile icon="⏱️" label={tt('Сэкономлено')} value="84ч" sub={tt('ручной работы')} color="#D97706" />
      </div>
      <Card icon="🤖" title={tt('Сценарии')}>
        <table>
          <thead><tr><th></th><th>{tt('Название')}</th><th>{tt('Триггер')}</th><th>{tt('Действие')}</th><th style={{ textAlign: 'right' }}>{tt('Запусков')}</th><th></th></tr></thead>
          <tbody>
            {flows.map((f, i) => (
              <tr key={i}>
                <td>
                  <button onClick={() => setFlows(fs => fs.map((x, j) => j === i ? { ...x, status: x.status === 'on' ? 'off' : 'on' } : x))}
                    style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: f.status === 'on' ? '#16A34A' : '#9CA3AF', cursor: 'pointer', position: 'relative', padding: 0 }}>
                    <div style={{ position: 'absolute', top: 2, left: f.status === 'on' ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--surface)', transition: 'left .2s' }} />
                  </button>
                </td>
                <td style={{ fontWeight: 700 }}>{tt(f.name)}</td>
                <td><code style={{ background: 'var(--bg-2)', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>{f.trigger}</code></td>
                <td><code style={{ background: 'var(--bg-2)', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>{tt(f.action)}</code></td>
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
