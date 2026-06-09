import React from 'react';
import { Card, Tile, Progress, Bars, PageHeader } from '../ui.jsx';

export default function PlanningTool() {
  return (
    <>
      <PageHeader title="🎯 Планирование" sub="План продаж · план закупок · бюджет" />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="🎯" label="План мес." value="1.2B" sub="UZS · выручка" color="#5B4FE8" />
        <Tile icon="✓" label="Выполнено" value="70%" sub="845M / 1.2B" delta={4} color="#22C55E" />
        <Tile icon="⏰" label="Дней до конца" value="6" color="#FF6B2B" />
      </div>
      <div className="grid-2">
        <Card icon="📊" title="План vs Факт (5 мес)">
          <Bars data={[100, 95, 110, 88, 70]} color="#22C55E" />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
            <span>Янв</span><span>Фев</span><span>Мар</span><span>Апр</span><span>Май</span>
          </div>
        </Card>
        <Card icon="💰" title="Бюджет на месяц">
          {[
            ['Закупки', 420, 350, '#5B4FE8'],
            ['Зарплаты', 180, 165, '#FF6B2B'],
            ['Маркетинг', 60, 48, '#22C55E'],
            ['Аренда', 50, 50, '#0EA5E9'],
            ['Прочее', 40, 32, '#9094B0'],
          ].map(([name, plan, fact, c]) => (
            <div key={name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 700 }}>{name}</span>
                <span className="mono"><span style={{ color: c, fontWeight: 800 }}>{fact}M</span> <span style={{ color: 'var(--text3)' }}>/ {plan}M</span></span>
              </div>
              <Progress value={fact} max={plan} color={c} />
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
