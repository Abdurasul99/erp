import React from 'react';
import { Card, Tile, PageHeader } from '../ui.jsx';
import { useTt } from '../tt.js';

export default function PnlTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('📊 P&L отчёт')} sub={tt('Выручка → себестоимость → расходы → чистая прибыль')}
        actions={<><button className="btn btn-ghost btn-sm">{tt('📅 Май 2026 ▾')}</button><button className="btn btn-primary btn-sm">📥 Excel</button></>} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="💰" label={tt('Выручка')} value="168 000 000" sub="UZS" delta={14} color="#16A34A" />
        <Tile icon="📉" label={tt('Себестоимость')} value="98 000 000" delta={-8} color="#D97706" />
        <Tile icon="💎" label={tt('Валовая')} value="70 000 000" sub={tt('маржа 41.6%')} delta={26} color="#1D4ED8" />
        <Tile icon="🟢" label={tt('Чистая прибыль')} value="35 900 000" delta={18} color="#16A34A" />
      </div>
      <Card icon="📊" title={tt('P&L · Май 2026')}>
        <table>
          <tbody>
            {[
              [tt('Выручка'),           '+168 200 000', '#16A34A', true, false],
              [tt('− Себестоимость'),   '−98 400 000',  '#DC2626', false, false],
              [tt('= Валовая прибыль'), '+69 800 000',  '#1D4ED8', true, false],
              [tt('− Зарплаты'),        '−12 500 000',  '#DC2626', false, false],
              [tt('− Аренда'),          '−4 800 000',   '#DC2626', false, false],
              [tt('− Маркетинг'),       '−3 200 000',   '#DC2626', false, false],
              [tt('− Прочее'),          '−7 100 000',   '#DC2626', false, false],
              [tt('= EBITDA'),          '+42 200 000',  '#16A34A', true, false],
              [tt('− Налоги'),          '−6 300 000',   '#DC2626', false, false],
              [tt('= ЧИСТАЯ ПРИБЫЛЬ'),  '+35 900 000',  '#16A34A', true, true],
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
