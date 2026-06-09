import React from 'react';
import { Card, Tile, PageHeader } from '../ui.jsx';

export default function PnlTool() {
  return (
    <>
      <PageHeader title="📊 P&L отчёт" sub="Выручка → себестоимость → расходы → чистая прибыль"
        actions={<><button className="btn btn-ghost btn-sm">📅 Май 2026 ▾</button><button className="btn btn-primary btn-sm">📥 Excel</button></>} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="💰" label="Выручка" value="168M" sub="UZS" delta={14} color="#22C55E" />
        <Tile icon="📉" label="Себестоимость" value="98M" delta={-8} color="#FF6B2B" />
        <Tile icon="💎" label="Валовая" value="70M" sub="маржа 41.6%" delta={26} color="#5B4FE8" />
        <Tile icon="🟢" label="Чистая прибыль" value="35.9M" delta={18} color="#22C55E" />
      </div>
      <Card icon="📊" title="P&L · Май 2026">
        <table>
          <tbody>
            {[
              ['Выручка',           '+168 200 000', '#22C55E', true, false],
              ['− Себестоимость',   '−98 400 000',  '#EF4444', false, false],
              ['= Валовая прибыль', '+69 800 000',  '#5B4FE8', true, false],
              ['− Зарплаты',        '−12 500 000',  '#EF4444', false, false],
              ['− Аренда',          '−4 800 000',   '#EF4444', false, false],
              ['− Маркетинг',       '−3 200 000',   '#EF4444', false, false],
              ['− Прочее',          '−7 100 000',   '#EF4444', false, false],
              ['= EBITDA',          '+42 200 000',  '#22C55E', true, false],
              ['− Налоги',          '−6 300 000',   '#EF4444', false, false],
              ['= ЧИСТАЯ ПРИБЫЛЬ',  '+35 900 000',  '#22C55E', true, true],
            ].map(([l, v, c, bold, big], i) => (
              <tr key={i} style={big ? { background: 'rgba(34,197,94,.06)' } : {}}>
                <td style={{ fontSize: big ? 15 : 13.5, fontWeight: bold ? 800 : 600 }}>{l}</td>
                <td className="mono" style={{ textAlign: 'right', fontSize: big ? 18 : 14, fontWeight: bold ? 900 : 700, color: c }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
