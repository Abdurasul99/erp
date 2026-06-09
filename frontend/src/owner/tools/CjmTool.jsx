import React from 'react';
import { Card, Badge, PageHeader } from '../ui.jsx';

const JOURNEY = [
  { p: 'Узнавание',    e: '👀', t: 'Реклама Telegram',     a: 'Видит пост',     em: '🤔', pain: 'Скепсис',                          bonus: '—' },
  { p: 'Интерес',       e: '🔍', t: 'Переход на сайт',      a: 'Изучает каталог', em: '😊', pain: 'Не понимает разницу с конкурентами', bonus: 'Видео обзор' },
  { p: 'Рассмотрение', e: '🤝', t: 'Чат с менеджером',     a: 'Задаёт вопросы',  em: '🤩', pain: 'Долгие ответы',                  bonus: 'Скидка 10% на 1-ю покупку' },
  { p: 'Покупка',      e: '💳', t: 'Касса / онлайн',        a: 'Оплачивает',      em: '😄', pain: 'Сложная форма',                  bonus: 'Подарок' },
  { p: 'Получение',    e: '📦', t: 'Доставка',              a: 'Распаковывает',   em: '🥳', pain: 'Долго едет',                     bonus: 'Открытка от руки' },
  { p: 'Использование', e: '✨', t: 'Сам товар',             a: 'Использует',      em: '😍', pain: 'Не разобрался',                  bonus: 'Видео-урок in-app' },
  { p: 'Лояльность',   e: '💎', t: 'NPS · реф. программа', a: 'Рекомендует',     em: '🥰', pain: '—',                              bonus: 'Кэшбек 5%' },
];

export default function CjmTool() {
  return (
    <>
      <PageHeader title="🗺️ Customer Journey Map" sub="Путь клиента · 7 этапов · точки боли · бонусы" />
      <Card icon="🗺️" title="B2C розничный покупатель">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 980 }}>
            <thead><tr><th>Этап</th><th>Точка касания</th><th>Действие</th><th>Эмоция</th><th>Боль</th><th>Наш бонус</th></tr></thead>
            <tbody>
              {JOURNEY.map((j, i) => (
                <tr key={i}>
                  <td><Badge tone="purple">{j.e} {j.p}</Badge></td>
                  <td style={{ fontWeight: 700 }}>{j.t}</td>
                  <td>{j.a}</td>
                  <td style={{ fontSize: 24 }}>{j.em}</td>
                  <td style={{ color: 'var(--red)', fontSize: 12 }}>{j.pain}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 700, fontSize: 12 }}>{j.bonus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
