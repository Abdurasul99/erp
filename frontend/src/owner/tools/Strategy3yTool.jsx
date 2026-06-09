import React from 'react';
import { Card, PageHeader, Badge } from '../ui.jsx';

const YEARS = [
  { y: '2026', f: 'Закрепление в Ташкенте', k: '+40% выручка', tac: ['Запустить B2B-канал', 'Реф. программа', 'Усилить Instagram'] },
  { y: '2027', f: 'Расширение в регионы',   k: 'Открыть 3 филиала', tac: ['Самарканд + Бухара + Фергана', 'Локальные посредники', 'Маркетплейсы UZ'] },
  { y: '2028', f: 'Экспорт',                k: 'Выход на 2 страны', tac: ['KZ + RU исследовать', 'Eng/Ru сайт', 'Международные выставки'] },
];

export default function Strategy3yTool() {
  return (
    <>
      <PageHeader title="🗓️ Стратегия 3 года" sub="Сезонность · этапы · KPI на год" />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        {YEARS.map(y => (
          <Card key={y.y} icon="🎯" title={y.y + ' · ' + y.f}>
            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 12 }}>{y.k}</div>
            {y.tac.map(t => <div key={t} style={{ padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>✓ {t}</div>)}
          </Card>
        ))}
      </div>
      <Card icon="📅" title="Сезонный календарь">
        <div className="grid-4">
          {[
            ['Январь', 'Новогодние подарки → сезон', '#0EA5E9'],
            ['Февраль', '14 февраля + 8 марта', '#EC4899'],
            ['Март', '8 марта пик · Навруз', '#22C55E'],
            ['Апрель', 'Свадьбы начинаются', '#FF6B2B'],
            ['Май', 'Туристический сезон', '#5B4FE8'],
            ['Июнь', 'Высокий B2C', '#F59E0B'],
            ['Июль', 'Затишье B2C, активный B2B', '#9094B0'],
            ['Август', 'Школа · корп. подарки', '#0EA5E9'],
            ['Сентябрь', 'Новый сезон', '#EC4899'],
            ['Октябрь', 'Подготовка к НГ', '#22C55E'],
            ['Ноябрь', 'НГ-распродажи', '#FF6B2B'],
            ['Декабрь', 'Пик НГ · 31 декабря', '#5B4FE8'],
          ].map(([m, n, c]) => (
            <div key={m} style={{ padding: 12, background: c + '12', borderRadius: 10, borderLeft: '3px solid ' + c }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: c }}>{m}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, lineHeight: 1.4 }}>{n}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
