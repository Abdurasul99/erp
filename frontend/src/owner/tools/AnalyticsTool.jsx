import React from 'react';
import { Card, Bars, PageHeader, Badge } from '../ui.jsx';
import { toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

export default function AnalyticsTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={`📈 ${tt('Аналитика')}`} sub={tt('Дашборды по отделам · готовые отчёты')}
        actions={<button className="btn btn-primary btn-sm" onClick={() => toast(tt('Новый дашборд'))}>+ {tt('Дашборд')}</button>} />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Card icon="📊" title={tt('По отделам')}>
          {[['💰', 'Финансы'], ['🛒', 'Продажи'], ['📦', 'Склад'], ['👥', 'HR'], ['📣', 'Маркетинг']].map(([ic, n]) => (
            <div key={n} className="list-item"><span style={{ flex: 1, fontWeight: 700 }}>{ic} {tt(n)}</span><button className="btn btn-ghost btn-sm">→</button></div>
          ))}
        </Card>
        <Card icon="📄" title={tt('Готовые отчёты')}>
          {['Продажи за период', 'Топ товаров', 'Маржа по категориям', 'Эффективность продавцов', 'ABC-анализ', 'Долги клиентов'].map(r => (
            <div key={r} className="list-item"><span style={{ flex: 1, fontSize: 13 }}>{tt(r)}</span><button className="btn btn-ghost btn-sm" onClick={() => toast(tt('Excel сгенерирован'))}>📥 XLSX</button></div>
          ))}
        </Card>
        <Card icon="🔔" title={tt('Подписки')}>
          {[['📧 ', 'Ежедневный сводный'], ['📱 ', 'Telegram: топ-3'], ['📊 ', 'Понедельник недельный']].map(([ic, s]) => (
            <div key={s} className="list-item"><span style={{ flex: 1, fontSize: 13 }}>{ic}{tt(s)}</span><Badge tone="green">{tt('включён')}</Badge></div>
          ))}
        </Card>
      </div>
      <Card icon="📈" title={tt('Главный дашборд')}>
        <div className="grid-2">
          <div><div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 8 }}>{tt('Выручка по дням')}</div><Bars data={[42, 51, 38, 64, 73, 58, 81, 92, 76, 85, 94, 110, 88, 105]} color="#5B4FE8" /></div>
          <div><div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 8 }}>{tt('Маржа по дням')}</div><Bars data={[28, 31, 24, 38, 41, 35, 47, 53, 44, 49, 54, 62, 50, 58]} color="#FF6B2B" /></div>
        </div>
      </Card>
    </>
  );
}
