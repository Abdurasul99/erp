import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { toast } from '../Modal.jsx';

const ORDERS = [
  { id: 'PO-031', sup: 'Tashkent Wood', items: '4 поз · 280 м³', sum: '14.2M', s: 'wait',  due: '4ч ⚠️' },
  { id: 'PO-030', sup: 'Karpov Games',   items: '2 поз · 50 шт',  sum: '8.4M',  s: 'confirmed', due: '—' },
  { id: 'PO-029', sup: 'Buxoro Latun',   items: '1 поз · 20 шт',  sum: '6.8M',  s: 'shipping', due: '—' },
  { id: 'PO-028', sup: 'Tex Mart',       items: '6 поз · 124 шт', sum: '12.1M', s: 'wait',   due: '18ч' },
  { id: 'PO-027', sup: 'Local Craft',    items: '3 поз · 80 шт',  sum: '5.6M',  s: 'delivered', due: '—' },
];

export default function ProcurementTool() {
  return (
    <>
      <PageHeader title="📋 Закупки" sub="Заказы поставщикам · 24ч подтверждение · авто-замена"
        actions={<><button className="btn btn-ghost btn-sm">🌐 Портал</button><button className="btn btn-primary btn-sm" onClick={() => toast('Новый заказ')}>+ Заказ</button></>} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="📦" label="Открытых" value="14" color="#5B4FE8" />
        <Tile icon="⏳" label="Ждут 24ч" value="3" color="#F59E0B" />
        <Tile icon="🏢" label="Поставщиков" value="48" color="#0EA5E9" />
        <Tile icon="💰" label="Долг" value="18.5M" color="#EF4444" />
      </div>
      <Card>
        <table>
          <thead><tr><th>#</th><th>Поставщик</th><th>Состав</th><th>Сумма</th><th>Статус</th><th>Подтвердить до</th><th></th></tr></thead>
          <tbody>
            {ORDERS.map(r => (
              <tr key={r.id}>
                <td className="mono" style={{ color: 'var(--text3)' }}>{r.id}</td>
                <td style={{ fontWeight: 700 }}>{r.sup}</td>
                <td>{r.items}</td>
                <td className="mono" style={{ fontWeight: 800, color: 'var(--primary)' }}>{r.sum}</td>
                <td>{r.s === 'wait' && <Badge tone="yellow">⏳ Ждёт</Badge>}{r.s === 'confirmed' && <Badge tone="blue">✓ Подтверждено</Badge>}{r.s === 'shipping' && <Badge tone="purple">🚚 В пути</Badge>}{r.s === 'delivered' && <Badge tone="green">✓ Доставлено</Badge>}</td>
                <td style={{ color: r.due.includes('⚠️') ? 'var(--red)' : 'var(--text3)', fontWeight: 700 }}>{r.due}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => toast('Открыта детализация ' + r.id)}>👁️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
