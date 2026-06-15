import React from 'react';
import { Card, Tile, Progress, Bars, PageHeader } from '../ui.jsx';
import { useTt } from '../tt.js';

export default function PlanningTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('🎯 Планирование')} sub={tt('План продаж · план закупок · бюджет')} />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="🎯" label={tt('План мес.')} value="1.2B" sub={tt('UZS · выручка')} color="#5B4FE8" />
        <Tile icon="✓" label={tt('Выполнено')} value="70%" sub="845M / 1.2B" delta={4} color="#22C55E" />
        <Tile icon="⏰" label={tt('Дней до конца')} value="6" color="#FF6B2B" />
      </div>
      <div className="grid-2">
        <Card icon="📊" title={tt('План vs Факт (5 мес)')}>
          <Bars data={[100, 95, 110, 88, 70]} color="#22C55E" />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
            <span>{tt('Янв')}</span><span>{tt('Фев')}</span><span>{tt('Мар')}</span><span>{tt('Апр')}</span><span>{tt('Май')}</span>
          </div>
        </Card>
        <Card icon="💰" title={tt('Бюджет на месяц')}>
          {[
            [tt('Закупки'), 420, 350, '#5B4FE8'],
            [tt('Зарплаты'), 180, 165, '#FF6B2B'],
            [tt('Маркетинг'), 60, 48, '#22C55E'],
            [tt('Аренда'), 50, 50, '#0EA5E9'],
            [tt('Прочее'), 40, 32, '#9094B0'],
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
