import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';

export default function LoyaltyTool() {
  return (
    <>
      <PageHeader title="🎁 Программа лояльности" sub="Уровни · кэшбек · реферальная программа" />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="🥉" label="Bronze" value="1 487" sub="0-2 покупки" color="#A07655" />
        <Tile icon="🥈" label="Silver" value="486" sub="3-9 покупок" color="#9CA3AF" />
        <Tile icon="🥇" label="Gold" value="184" sub="10-29" color="#F59E0B" />
        <Tile icon="💎" label="Platinum" value="47" sub="30+" color="#7C3AED" />
      </div>
      <Card icon="🎯" title="Условия уровней">
        <div className="grid-4">
          {[
            ['🥉 Bronze', '5%', 'Базовый кэшбек'],
            ['🥈 Silver', '8%', '+ поздравления с ДР'],
            ['🥇 Gold', '12%', '+ персональный менеджер'],
            ['💎 Platinum', '15%', '+ закрытые распродажи'],
          ].map(([n, c, p]) => (
            <div key={n} style={{ padding: 16, background: 'var(--bg-2)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 32 }}>{n.split(' ')[0]}</div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>{n.split(' ').slice(1).join(' ')}</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 900, color: 'var(--orange)', margin: '8px 0' }}>{c}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{p}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card icon="🤝" title="Реферальная программа" style={{ marginTop: 18 }}>
        <div className="grid-3">
          <Tile icon="👥" label="Приглашённых" value="148" color="#5B4FE8" />
          <Tile icon="💰" label="Конверсия" value="34%" sub="реферал → клиент" color="#22C55E" />
          <Tile icon="🎁" label="Выплачено бонусов" value="12.4M" sub="UZS" color="#FF6B2B" />
        </div>
      </Card>
    </>
  );
}
