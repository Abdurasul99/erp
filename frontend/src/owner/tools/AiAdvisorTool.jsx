import React, { useState } from 'react';
import { Card, Tile, Badge, PageHeader } from '../ui.jsx';
import { toast } from '../Modal.jsx';

const ANSWERS = {
  default: 'Анализирую данные за месяц... Готов отвечать на конкретные вопросы о бизнесе.',
  'почему': 'Падение продаж мужской одежды в мае на 18% связано с: 1) уход из ассортимента бренда X · 2) высокий сезон конкурентов · 3) ваш Instagram перешёл на другие категории.',
  'плохо': 'Топ-5 худших по продажам за месяц: Косметика партия 2, Шахматы 50×50, Латун ваза 30см, Чапан XXL, Тарелка 28см. Рекомендую скидку 25% на ликвидацию.',
  'маржа': 'Низкая маржа в категории «Одежда» (18%) — конкуренты делают аналог за меньшую цену. Поднять цену нельзя. Решение: перейти к локальным брендам с маржой 35%.',
  'закупить': 'Срочно закупить: Брус 50×100 (250 м³), Шахматы 40×40 (50 шт), Бейсболка синяя (80 шт). Прогноз бюджета: 124M UZS.',
};

const INSIGHTS = [
  { ic: '📈', tone: 'green', t: 'Поднять цену на «Шахматы 40×40» на 12%', b: 'Спрос +28%, конкуренты дороже на 18%. Прогноз: +4.2M маржи/мес.', impact: '+4.2M / мес' },
  { ic: '📦', tone: 'yellow', t: 'Закупить «Брус 50×100» сейчас', b: 'Запас на 4 дня. Не закажете до завтра — потеряете 8.5M.', impact: '−8.5M риск' },
  { ic: '🔥', tone: 'orange', t: 'Промо: «Косметика» −25%', b: 'Не продаётся 47 дней. Освободит 8.5M оборотки.', impact: '+8.5M cash' },
  { ic: '👤', tone: 'purple', t: 'Реактивировать «Алишер К.»', b: 'LTV 3.4M, не покупал 60 дн.', impact: '+340K вернуть' },
];

export default function AiAdvisorTool() {
  const [q, setQ] = useState('');
  const [chat, setChat] = useState([]);
  const ask = () => {
    if (!q.trim()) return;
    const key = Object.keys(ANSWERS).find(k => q.toLowerCase().includes(k));
    const a = ANSWERS[key] || 'Анализирую... Это сложный вопрос — обратитесь к подробным отчётам или уточните формулировку.';
    setChat(c => [...c, { u: q, a }]);
    setQ('');
  };
  return (
    <>
      <PageHeader title="🤖 AI-консультант" sub="Что-Где-Почему · симуляторы · рекомендации"
        actions={<Badge tone="purple">Claude 4.7 + GPT-5</Badge>} />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="💡" label="Инсайтов" value="12" sub="требуют действий" color="#7C3AED" />
        <Tile icon="🎯" label="Применено" value="48" sub="за месяц" delta={24} color="#22C55E" />
        <Tile icon="💰" label="Экономия от AI" value="84M" sub="UZS" color="#FF6B2B" />
      </div>

      <Card icon="🤖" title="Спроси у бизнеса">
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <input className="input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()}
            placeholder="«Почему продажи упали в мае?», «Что плохо продаётся?»..." style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={ask}>🚀 Спросить</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Почему продажи упали?', 'Что плохо продаётся?', 'Где теряем маржу?', 'Какие товары закупить?'].map(s => (
            <button key={s} onClick={() => setQ(s)} style={{ padding: '6px 12px', borderRadius: 20, border: '1.5px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', fontFamily: 'inherit' }}>{s}</button>
          ))}
        </div>

        {chat.length > 0 && (
          <div style={{ marginTop: 16, maxHeight: 320, overflowY: 'auto' }}>
            {chat.map((m, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                  <div style={{ background: 'var(--primary)', color: '#fff', padding: '8px 14px', borderRadius: 14, maxWidth: '75%', fontSize: 13.5 }}>{m.u}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #7c3aed, #5B4FE8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>🤖</div>
                  <div style={{ background: 'var(--bg-2)', padding: '10px 14px', borderRadius: 14, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>{m.a}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <h3 style={{ marginTop: 24, marginBottom: 14, fontSize: 14, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 800 }}>📥 Рекомендации сегодня</h3>
      <div className="grid-2">
        {INSIGHTS.map((x, i) => {
          const colors = { green: '#22C55E', yellow: '#F59E0B', orange: '#FF6B2B', purple: '#7c3aed' };
          const c = colors[x.tone];
          return (
            <Card key={i} style={{ borderLeft: '4px solid ' + c }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: c + '20', color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{x.ic}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{x.t}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 10 }}>{x.b}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => toast('Применено!')}>Применить</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toast('Отложено', 'info')}>Позже</button>
                    <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 800, color: c }}>{x.impact}</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
