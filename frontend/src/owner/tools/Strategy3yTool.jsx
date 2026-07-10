import React from 'react';
import { Card, PageHeader, Badge } from '../ui.jsx';
import { useTt } from '../tt.js';

const YEARS = (tt) => [
  { y: '2026', f: tt('Закрепление в Ташкенте'), k: tt('+40% выручка'), tac: [tt('Запустить B2B-канал'), tt('Реф. программа'), tt('Усилить Instagram')] },
  { y: '2027', f: tt('Расширение в регионы'),   k: tt('Открыть 3 филиала'), tac: [tt('Самарканд + Бухара + Фергана'), tt('Локальные посредники'), tt('Маркетплейсы UZ')] },
  { y: '2028', f: tt('Экспорт'),                k: tt('Выход на 2 страны'), tac: [tt('KZ + RU исследовать'), tt('Eng/Ru сайт'), tt('Международные выставки')] },
];

export default function Strategy3yTool() {
  const { tt } = useTt();
  return (
    <>
      <PageHeader title={tt('🗓️ Стратегия 3 года')} sub={tt('Сезонность · этапы · KPI на год')} />
      <div className="grid-3" style={{ marginBottom: 18 }}>
        {YEARS(tt).map(y => (
          <Card key={y.y} icon="🎯" title={y.y + ' · ' + y.f}>
            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 12 }}>{y.k}</div>
            {y.tac.map(t => <div key={t} style={{ padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>✓ {t}</div>)}
          </Card>
        ))}
      </div>
      <Card icon="📅" title={tt('Сезонный календарь')}>
        <div className="grid-4">
          {[
            [tt('Январь'), tt('Новогодние подарки → сезон'), '#0EA5E9'],
            [tt('Февраль'), tt('14 февраля + 8 марта'), '#EC4899'],
            [tt('Март'), tt('8 марта пик · Навруз'), '#16A34A'],
            [tt('Апрель'), tt('Свадьбы начинаются'), '#D97706'],
            [tt('Май'), tt('Туристический сезон'), '#1D4ED8'],
            [tt('Июнь'), tt('Высокий B2C'), '#D97706'],
            [tt('Июль'), tt('Затишье B2C, активный B2B'), '#94A0B5'],
            [tt('Август'), tt('Школа · корп. подарки'), '#0EA5E9'],
            [tt('Сентябрь'), tt('Новый сезон'), '#EC4899'],
            [tt('Октябрь'), tt('Подготовка к НГ'), '#16A34A'],
            [tt('Ноябрь'), tt('НГ-распродажи'), '#D97706'],
            [tt('Декабрь'), tt('Пик НГ · 31 декабря'), '#1D4ED8'],
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
