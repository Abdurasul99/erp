import React, { useState } from 'react';
import { Card, Tile, PageHeader } from '../ui.jsx';

export default function ModelingTool() {
  const [pct, setPct] = useState(12);
  const base = 168;
  const projected = base * (1 + pct/100);
  const lostUnits = Math.round(247 * (pct / 100) * 0.6);
  const marginDelta = (pct * 0.6).toFixed(1);
  return (
    <>
      <PageHeader title="🎰 Что-если симулятор" sub="Цена · скидка · закупка — мгновенный прогноз" />
      <Card icon="🎯" title="Сценарий: изменить цены на X%">
        <div style={{ padding: '24px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700 }}>Изменение цен по всему ассортименту:</span>
            <span className="mono" style={{ fontWeight: 900, fontSize: 28, color: pct > 0 ? '#22C55E' : pct < 0 ? '#EF4444' : '#5B4FE8' }}>
              {pct > 0 ? '+' : ''}{pct}%
            </span>
          </div>
          <input type="range" min="-30" max="50" value={pct} onChange={e => setPct(parseInt(e.target.value))}
            style={{ width: '100%', height: 8, appearance: 'none', background: 'linear-gradient(90deg, #EF4444, #5B4FE8, #22C55E)', borderRadius: 4, outline: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
            <span>−30%</span><span>0</span><span>+50%</span>
          </div>
        </div>

        <div className="grid-4" style={{ marginTop: 18 }}>
          <Tile icon="💰" label="Прогноз выручки" value={projected.toFixed(0) + 'M'} sub={`vs ${base}M`} color="#5B4FE8" />
          <Tile icon="📉" label="Потеря штук" value={lostUnits} sub="клиенты уйдут" color="#EF4444" />
          <Tile icon="💎" label="Маржа" value={(pct >= 0 ? '+' : '') + marginDelta + '%'} color="#22C55E" />
          <Tile icon="🎯" label="Рекомендация" value={pct > 0 && pct < 18 ? '✅' : pct >= 18 ? '⚠️' : '❌'}
            sub={pct > 0 && pct < 18 ? 'Безопасно' : pct >= 18 ? 'Высокий риск' : 'Невыгодно'}
            color={pct > 0 && pct < 18 ? '#22C55E' : '#EF4444'} />
        </div>

        <div style={{ marginTop: 18, padding: 14, background: 'var(--bg-2)', borderRadius: 10, fontSize: 13, color: 'var(--text2)' }}>
          <strong>💡 Интерпретация:</strong> При изменении на <strong>{pct}%</strong> выручка перейдёт с {base}M до <strong className="mono" style={{ color: 'var(--primary)' }}>~{projected.toFixed(0)}M UZS</strong>,
          но ~<strong>{lostUnits}</strong> клиентов могут уйти из-за чувствительности к цене. Чистая прибыль улучшится на <strong>{marginDelta}%</strong>
          (≈ <strong className="mono">{(base * pct * 0.6 / 100).toFixed(1)}M UZS</strong> дополнительной маржи в месяц).
        </div>
      </Card>

      <div className="grid-3" style={{ marginTop: 18 }}>
        {['Запустить скидку −25%', 'Увеличить запас 1.5×', 'Открыть 2-й филиал', 'Реклама бюджет 5M', 'Новый поставщик', 'ФОТ −15%'].map(t => (
          <Card key={t} style={{ padding: 14, cursor: 'pointer' }}>
            <div style={{ fontWeight: 800, fontSize: 13.5 }}>{t}</div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>🎰 Симулировать →</button>
          </Card>
        ))}
      </div>
    </>
  );
}
