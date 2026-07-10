import React from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { useTt } from '../tt.js';

export default function LoyaltyTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('🎁 Программа лояльности')} sub={tt('Уровни · кэшбек · реферальная программа')} />
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile icon="🥉" label="Bronze" value="1 487" sub={tt('0-2 покупки')} color="#A07655" />
        <Tile icon="🥈" label="Silver" value="486" sub={tt('3-9 покупок')} color="#9CA3AF" />
        <Tile icon="🥇" label="Gold" value="184" sub="10-29" color="#D97706" />
        <Tile icon="💎" label="Platinum" value="47" sub="30+" color="#1D4ED8" />
      </div>
      <Card icon="🎯" title={tt('Условия уровней')}>
        <div className="grid-4">
          {[
            ['🥉 Bronze', '5%', tt('Базовый кэшбек')],
            ['🥈 Silver', '8%', tt('+ поздравления с ДР')],
            ['🥇 Gold', '12%', tt('+ персональный менеджер')],
            ['💎 Platinum', '15%', tt('+ закрытые распродажи')],
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
      <Card icon="🤝" title={tt('Реферальная программа')} style={{ marginTop: 18 }}>
        <div className="grid-3">
          <Tile icon="👥" label={tt('Приглашённых')} value="148" color="#1D4ED8" />
          <Tile icon="💰" label={tt('Конверсия')} value="34%" sub={tt('реферал → клиент')} color="#16A34A" />
          <Tile icon="🎁" label={tt('Выплачено бонусов')} value="12 400 000" sub="UZS" color="#D97706" />
        </div>
      </Card>
    </>
  );
}
