import React, { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import eventsApi, { errorText } from '../api.js';
import { EDITOR_ROLES } from '../access.js';
import { money, dateTime } from '../format.js';
import { Card, PageHead, StatusBadge, Badge, Empty, Loading, ErrorAlert, Button, Pills } from '../ui.jsx';
import { EventsContext } from '../EventsShell.jsx';
import OrderForm from './OrderForm.jsx';

const FILTERS = [
  { value: 'active', label: 'Активные' },
  { value: 'completed', label: 'Завершённые' },
  { value: 'cancelled', label: 'Отменённые' },
  { value: '', label: 'Все' },
];

export default function Orders() {
  const navigate = useNavigate();
  const { me } = useContext(EventsContext);
  const canEdit = EDITOR_ROLES.includes(me.user.role);

  const [status, setStatus] = useState('active');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  // Номер запроса гасит гонку: быстрый набор в поиске не должен показать
  // ответ на более ранний, медленный запрос поверх свежего.
  const reqNo = useRef(0);

  useEffect(() => {
    const no = ++reqNo.current;
    const t = setTimeout(() => {
      setError('');
      const params = {};
      if (status) params.status = status;
      if (query.trim()) params.q = query.trim();
      eventsApi.get('/events', { params })
        .then(({ data }) => { if (no === reqNo.current) setItems(data.items); })
        .catch((e) => { if (no === reqNo.current) setError(errorText(e, 'Не удалось загрузить заказы')); });
    }, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [status, query]);

  return (
    <>
      <PageHead
        title="Заказы"
        sub={items ? `${items.length} в списке` : ' '}
        actions={canEdit && <Button onClick={() => setCreating(true)}>Новый заказ</Button>}
      />

      <Card>
        <div className="ev-toolbar" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
          <Pills value={status} options={FILTERS} onChange={setStatus} />
          <input
            className="ev-input"
            style={{ maxWidth: 280 }}
            type="search"
            placeholder="Поиск: название, клиент, площадка"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Поиск заказов"
          />
        </div>

        <ErrorAlert>{error}</ErrorAlert>
        {!items && !error && <Loading />}
        {items && items.length === 0 && (
          <Empty title={query ? 'Ничего не нашлось' : 'Заказов пока нет'}>
            {query ? 'Попробуйте другой запрос.' : (canEdit ? 'Создайте первый заказ кнопкой «Новый заказ».' : 'Здесь появятся мероприятия, в которых вы участвуете.')}
          </Empty>
        )}
        {items && items.length > 0 && (
          <div className="ev-table-wrap">
            <table className="ev-table">
              <thead>
                <tr>
                  <th>Дата</th><th>Мероприятие</th><th>Клиент</th><th>Статус</th>
                  <th className="ev-num">Стоимость</th><th className="ev-num">Остаток</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="is-link" onClick={() => navigate(`/events/orders/${e.id}`)}>
                    <td style={{ whiteSpace: 'nowrap' }}>{dateTime(e.starts_at)}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{e.title}</div>
                      <div className="ev-muted" style={{ fontSize: 12 }}>{[e.event_type, e.venue].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td>{e.client ? e.client.name : <span className="ev-muted">—</span>}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td className="ev-num">{money(e.total_price)}</td>
                    <td className="ev-num">
                      {e.total_price === 0 ? <span className="ev-muted">—</span>
                        : e.remaining <= 0 ? <Badge tone="good">оплачено</Badge>
                          : money(e.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <OrderForm onClose={() => setCreating(false)} onCreated={(card) => navigate(`/events/orders/${card.event.id}`)} />
      )}
    </>
  );
}
