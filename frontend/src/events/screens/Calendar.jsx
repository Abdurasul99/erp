import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import eventsApi, { errorText } from '../api.js';
import { dayKey, todayKey, time, date } from '../format.js';
import { Card, PageHead, Button, Empty, Loading, ErrorAlert, StatusBadge } from '../ui.jsx';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

// Дни месячной сетки: с понедельника первой недели по воскресенье последней.
// Всё в строках 'YYYY-MM-DD' и UTC-арифметике — без сдвигов часового пояса.
function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // понедельник = 0
  const start = Date.UTC(year, month, 1 - lead);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => {
    const d = new Date(start + i * 86400000);
    return { key: d.toISOString().slice(0, 10), day: d.getUTCDate(), inMonth: d.getUTCMonth() === month };
  });
}

export default function Calendar() {
  const navigate = useNavigate();
  const today = todayKey();
  const [cursor, setCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const reqNo = useRef(0);

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  useEffect(() => {
    const no = ++reqNo.current;
    setItems(null);
    setError('');
    // Берём всю видимую сетку, а не только месяц: в первой и последней неделе
    // видны дни соседних месяцев, и мероприятия в них тоже должны отображаться.
    eventsApi.get('/events', { params: { from: grid[0].key, to: grid[grid.length - 1].key } })
      .then(({ data }) => { if (no === reqNo.current) setItems(data.items); })
      .catch((e) => { if (no === reqNo.current) setError(errorText(e, 'Не удалось загрузить календарь')); });
  }, [grid]);

  const byDay = useMemo(() => {
    const map = {};
    for (const e of items || []) (map[dayKey(e.starts_at)] ||= []).push(e);
    for (const k of Object.keys(map)) map[k].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    return map;
  }, [items]);

  const shift = (delta) => setCursor(({ year, month }) => {
    const m = month + delta;
    return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
  });

  const monthItems = (items || []).filter((e) => dayKey(e.starts_at).slice(0, 7) === `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`);

  return (
    <>
      <PageHead
        title="Календарь мероприятий"
        sub={`${MONTHS[cursor.month][0].toUpperCase()}${MONTHS[cursor.month].slice(1)} ${cursor.year}`}
        actions={(
          <>
            <Button variant="ghost" onClick={() => shift(-1)} aria-label="Предыдущий месяц">←</Button>
            <Button variant="ghost" onClick={() => setCursor({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 })}>Сегодня</Button>
            <Button variant="ghost" onClick={() => shift(1)} aria-label="Следующий месяц">→</Button>
          </>
        )}
      />
      <ErrorAlert>{error}</ErrorAlert>
      {!items && !error && <Loading />}

      {items && (
        <>
          <div className="ev-cal ev-cal-desktop">
            {WEEKDAYS.map((w) => <div key={w} className="ev-cal-head">{w}</div>)}
            {grid.map((cell) => (
              <div key={cell.key} className={`ev-cal-day ${cell.inMonth ? '' : 'is-other'} ${cell.key === today ? 'is-today' : ''}`}>
                <div className="ev-cal-num">{cell.day}</div>
                {(byDay[cell.key] || []).slice(0, 4).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className={`ev-cal-event s-${e.status}`}
                    title={`${time(e.starts_at)} ${e.title}`}
                    onClick={() => navigate(`/events/orders/${e.id}`)}
                  >
                    {time(e.starts_at)} {e.title}
                  </button>
                ))}
                {(byDay[cell.key] || []).length > 4 && (
                  <div className="ev-muted" style={{ fontSize: 11, marginTop: 2 }}>ещё {(byDay[cell.key].length - 4)}</div>
                )}
              </div>
            ))}
          </div>

          {/* На телефоне сетка 7×6 нечитаема — показываем мероприятия месяца списком. */}
          <Card className="ev-cal-mobile">
            {monthItems.length === 0 ? <Empty title="В этом месяце мероприятий нет" /> : (
              <div className="ev-list">
                {monthItems
                  .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
                  .map((e) => (
                    <div key={e.id} className="ev-list-row is-link" onClick={() => navigate(`/events/orders/${e.id}`)}>
                      <div style={{ width: 54, flex: 'none', fontWeight: 800 }}>{date(e.starts_at, { month: 'short' })}</div>
                      <div className="ev-list-main">
                        <div className="ev-list-title">{e.title}</div>
                        <div className="ev-list-sub">{[time(e.starts_at), e.venue].filter(Boolean).join(' · ')}</div>
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
