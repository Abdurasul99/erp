import React, { useState } from 'react';
import { Card, PageHeader, Badge } from '../ui.jsx';

const SCRIPTS = [
  { id: 'cold', title: 'Холодный звонок', icon: '📞',
    steps: [
      { t: 'Hook (5 сек)',  s: '«Здравствуйте, я знаю что ваш бизнес работает с деревом. У меня 30 секунд?»' },
      { t: 'Боль',           s: '«Многие наши клиенты теряли деньги на нестабильных поставщиках...»' },
      { t: 'Решение',        s: '«Мы делаем так, что [результат за число]»' },
      { t: 'CTA',            s: '«Можем встретиться завтра в 11 или после обеда — что удобнее?»' },
    ] },
  { id: 'odc', title: 'ODC техника', icon: '🎯',
    steps: [
      { t: 'Open question',   s: 'Открытый вопрос — заставляет клиента думать. «Что для вас важнее: цена или качество?»' },
      { t: 'Detail',          s: 'Углубление в ответ. «Почему именно качество?»' },
      { t: 'Close',           s: 'Прицельный пушинг к сделке. «Тогда у нас есть именно то что вам нужно — берём?»' },
    ] },
  { id: 'psm', title: "Pul-Sog'liq-Munosabat", icon: '🇺🇿',
    steps: [
      { t: "Pul (Деньги)",         s: 'Триггерим экономию или зарабатывание денег' },
      { t: "Sog'liq (Здоровье)",   s: 'Триггерим здоровье семьи, безопасность' },
      { t: "Munosabat (Отношения)", s: 'Триггерим уважение, статус, отношения' },
    ] },
];

const OBJECTIONS = [
  { o: '«Дорого»',                    a: 'А с чем сравниваете? Покажу выгоду в долгосрочной перспективе.' },
  { o: '«Подумаю»',                   a: 'Что именно вас останавливает? Давайте разберём прямо сейчас.' },
  { o: '«У конкурентов дешевле»',     a: 'Конкретно у кого? Сравним по 5 параметрам — часто разница в качестве.' },
  { o: '«Нет бюджета»',                a: 'А когда планируете? Зафиксирую цену для вас на 30 дней.' },
  { o: '«Не сейчас»',                  a: 'Какой триггер должен случиться чтобы стало актуально?' },
  { o: '«Сейчас не до этого»',         a: 'Я понимаю. А когда у вас будет 10 минут — на этой неделе или в среду?' },
];

export default function ScriptsTool() {
  const [active, setActive] = useState('cold');
  const cur = SCRIPTS.find(s => s.id === active);
  return (
    <>
      <PageHeader title="📞 Скрипты продаж" sub="Cold call · ODC · возражения · Pul-Sog'liq-Munosabat" />
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {SCRIPTS.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)} style={{
            padding: '10px 16px', borderRadius: 10, border: '1.5px solid ' + (active === s.id ? '#5B4FE8' : '#E6E8F2'),
            background: active === s.id ? 'rgba(91,79,232,.08)' : '#fff', color: active === s.id ? '#5B4FE8' : 'var(--text2)',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>{s.icon} {s.title}</button>
        ))}
      </div>

      <Card icon={cur.icon} title={cur.title}>
        <div className="flow">
          {cur.steps.map((s, i) => (
            <div key={i} className="flow-step" style={{ minWidth: 220 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: .5 }}>{i + 1}. {s.t}</div>
              <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.5, color: 'var(--text2)' }}>{s.s}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card icon="🛡️" title="Топ возражений и готовые ответы" style={{ marginTop: 18 }}>
        <div className="list">
          {OBJECTIONS.map(o => (
            <div key={o.o} className="list-item" style={{ alignItems: 'flex-start' }}>
              <Badge tone="yellow">{o.o}</Badge>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{o.a}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
