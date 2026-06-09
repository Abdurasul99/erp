import React from 'react';
import { Card, Tile, PageHeader } from '../ui.jsx';

const MATRIX = [
  [
    { c: '#EF4444', label: 'СРОЧНО · ВАЖНО', items: ['🔥 Решить долг TashTrade', '🚨 Закрыть кассовый разрыв', '⚡ 1:1 с Anvar S.'] },
    { c: '#22C55E', label: 'НЕСРОЧНО · ВАЖНО', items: ['📚 Запустить онлайн-обучение', '🎯 Стратегия на 2027', '👥 Найм 2 менеджеров B2B'] },
  ],
  [
    { c: '#F59E0B', label: 'СРОЧНО · НЕВАЖНО', items: ['📞 Перезвонить поставщику X', '✉️ Ответить на email-ы (47)'] },
    { c: '#9094B0', label: 'НЕСРОЧНО · НЕВАЖНО', items: ['🍽️ Корп. обед', '📺 Просмотр трендов'] },
  ],
];

export default function MgmtTool() {
  return (
    <>
      <PageHeader title="🎓 Управление" sub="Матрица Эйзенхауэра · ССП · ORG · бизнес-процессы" />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Tile icon="🎯" label="Стратегических целей" value="6" sub="на 2026" color="#5B4FE8" />
        <Tile icon="👥" label="В команде" value="14" color="#FF6B2B" />
        <Tile icon="📋" label="Бизнес-процессов" value="22" sub="задокументировано" color="#22C55E" />
      </div>
      <Card icon="🎯" title="Матрица Эйзенхауэра — задачи дня">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {MATRIX.flat().map((m, i) => (
            <div key={i} style={{ padding: 16, borderRadius: 12, border: '2px dashed ' + m.c + '40', background: m.c + '08' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: m.c, marginBottom: 10, letterSpacing: .5 }}>{m.label}</div>
              {m.items.map(t => <div key={t} style={{ fontSize: 13, marginBottom: 6, fontWeight: 600 }}>{t}</div>)}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
