import React from 'react';
import { Card, Tile, PageHeader, Bars, Sparkline } from '../ui.jsx';

export default function CashflowTool() {
  return (
    <>
      <PageHeader title="💸 Cash Flow" sub="Движение денег по дням · приход и расход" />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="📥" label="Приход (мес)" value="+184M" color="#22C55E" />
        <Tile icon="📤" label="Расход (мес)" value="−112M" color="#EF4444" />
        <Tile icon="💎" label="Сальдо" value="+72M" delta={18} color="#5B4FE8" />
      </div>
      <Card icon="📊" title="Движение по дням (млн UZS)">
        <Bars data={[8, 12, 6, 14, 18, 11, 22, 16, 19, 14, 8, 21, 17, 24]} color="#22C55E" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          <span>17 май</span><span>23 май</span><span>30 май</span>
        </div>
      </Card>
      <Card icon="📈" title="Прогноз на 7 дней" style={{ marginTop: 18 }}>
        <Sparkline data={[18, 22, 26, 24, 28, 31, 35]} color="#5B4FE8" />
        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text2)' }}>
          🤖 AI прогноз: при сохранении динамики касса вырастет до <strong style={{ color: 'var(--primary)' }}>+180M UZS</strong> к концу недели.
        </div>
      </Card>
    </>
  );
}
