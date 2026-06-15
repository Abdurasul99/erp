import React, { useState } from 'react';
import { Card, PageHeader, Badge } from '../ui.jsx';
import { useTt } from '../tt.js';

const SCRIPTS = (tt) => [
  { id: 'cold', title: tt('Холодный звонок'), icon: '📞',
    steps: [
      { t: tt('Hook (5 сек)'),  s: tt('«Здравствуйте, я знаю что ваш бизнес работает с деревом. У меня 30 секунд?»') },
      { t: tt('Боль'),           s: tt('«Многие наши клиенты теряли деньги на нестабильных поставщиках...»') },
      { t: tt('Решение'),        s: tt('«Мы делаем так, что [результат за число]»') },
      { t: 'CTA',            s: tt('«Можем встретиться завтра в 11 или после обеда — что удобнее?»') },
    ] },
  { id: 'odc', title: tt('ODC техника'), icon: '🎯',
    steps: [
      { t: 'Open question',   s: tt('Открытый вопрос — заставляет клиента думать. «Что для вас важнее: цена или качество?»') },
      { t: 'Detail',          s: tt('Углубление в ответ. «Почему именно качество?»') },
      { t: 'Close',           s: tt('Прицельный пушинг к сделке. «Тогда у нас есть именно то что вам нужно — берём?»') },
    ] },
  { id: 'psm', title: "Pul-Sog'liq-Munosabat", icon: '🇺🇿',
    steps: [
      { t: tt("Pul (Деньги)"),         s: tt('Триггерим экономию или зарабатывание денег') },
      { t: tt("Sog'liq (Здоровье)"),   s: tt('Триггерим здоровье семьи, безопасность') },
      { t: tt("Munosabat (Отношения)"), s: tt('Триггерим уважение, статус, отношения') },
    ] },
];

const OBJECTIONS = (tt) => [
  { o: tt('«Дорого»'),                    a: tt('А с чем сравниваете? Покажу выгоду в долгосрочной перспективе.') },
  { o: tt('«Подумаю»'),                   a: tt('Что именно вас останавливает? Давайте разберём прямо сейчас.') },
  { o: tt('«У конкурентов дешевле»'),     a: tt('Конкретно у кого? Сравним по 5 параметрам — часто разница в качестве.') },
  { o: tt('«Нет бюджета»'),                a: tt('А когда планируете? Зафиксирую цену для вас на 30 дней.') },
  { o: tt('«Не сейчас»'),                  a: tt('Какой триггер должен случиться чтобы стало актуально?') },
  { o: tt('«Сейчас не до этого»'),         a: tt('Я понимаю. А когда у вас будет 10 минут — на этой неделе или в среду?') },
];

export default function ScriptsTool() {
  const { tt } = useTt();
  const [active, setActive] = useState('cold');
  const scripts = SCRIPTS(tt);
  const objections = OBJECTIONS(tt);
  const cur = scripts.find(s => s.id === active);
  return (
    <>
      <PageHeader title={tt('📞 Скрипты продаж')} sub={tt("Cold call · ODC · возражения · Pul-Sog'liq-Munosabat")} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {scripts.map(s => (
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

      <Card icon="🛡️" title={tt('Топ возражений и готовые ответы')} style={{ marginTop: 18 }}>
        <div className="list">
          {objections.map(o => (
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
