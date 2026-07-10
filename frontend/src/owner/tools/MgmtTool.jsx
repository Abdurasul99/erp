import React from 'react';
import { Card, Tile, PageHeader } from '../ui.jsx';
import { useTt } from '../tt.js';

const MATRIX = [
  [
    { c: '#DC2626', label: 'СРОЧНО · ВАЖНО', items: ['🔥 Решить долг TashTrade', '🚨 Закрыть кассовый разрыв', '⚡ 1:1 с Anvar S.'] },
    { c: '#16A34A', label: 'НЕСРОЧНО · ВАЖНО', items: ['📚 Запустить онлайн-обучение', '🎯 Стратегия на 2027', '👥 Найм 2 менеджеров B2B'] },
  ],
  [
    { c: '#D97706', label: 'СРОЧНО · НЕВАЖНО', items: ['📞 Перезвонить поставщику X', '✉️ Ответить на email-ы (47)'] },
    { c: '#94A0B5', label: 'НЕСРОЧНО · НЕВАЖНО', items: ['🍽️ Корп. обед', '📺 Просмотр трендов'] },
  ],
];

export default function MgmtTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('🎓 Управление')} sub={tt('Матрица Эйзенхауэра · ССП · ORG · бизнес-процессы')} />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="🎯" label={tt('Стратегических целей')} value="6" sub={tt('на 2026')} color="#1D4ED8" />
        <Tile icon="👥" label={tt('В команде')} value="14" color="#D97706" />
        <Tile icon="📋" label={tt('Бизнес-процессов')} value="22" sub={tt('задокументировано')} color="#16A34A" />
      </div>
      <Card icon="🎯" title={tt('Матрица Эйзенхауэра — задачи дня')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {MATRIX.flat().map((m, i) => (
            <div key={i} style={{ padding: 16, borderRadius: 12, border: '2px dashed ' + m.c + '40', background: m.c + '08' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: m.c, marginBottom: 10, letterSpacing: .5 }}>{tt(m.label)}</div>
              {m.items.map(t => <div key={t} style={{ fontSize: 13, marginBottom: 6, fontWeight: 600 }}>{tt(t)}</div>)}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
