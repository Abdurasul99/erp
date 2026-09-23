import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import eventsApi, { errorText } from '../api.js';
import { ROLE_LABELS } from '../access.js';
import { money, relativeDays, date, time } from '../format.js';
import { Card, Kpi, PageHead, StatusBadge, Badge, Empty, Loading, ErrorAlert, Button } from '../ui.jsx';
import OrderForm from './OrderForm.jsx';

// Главная: что происходит сейчас и где нужно вмешаться руководителю.
export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setError('');
    eventsApi.get('/dashboard')
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(errorText(e, 'Не удалось загрузить главную')));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorAlert>{error}</ErrorAlert>;
  if (!data) return <Loading />;

  const { counts, money: m, stages, upcoming, debtors } = data;

  return (
    <>
      <PageHead
        title="Главная"
        sub={`Сегодня ${date(new Date().toISOString(), { weekday: 'long' })}`}
        actions={<Button onClick={() => setCreating(true)}>Новый заказ</Button>}
      />

      <div className="ev-grid ev-grid-4" style={{ marginBottom: 16 }}>
        <Kpi label="Активных заказов" value={counts.active} hint={counts.drafts ? `из них черновиков: ${counts.drafts}` : 'без черновиков'} />
        <Kpi label="Выручка месяца" value={money(m.revenue_month)} hint={`мероприятий в месяце: ${counts.this_month}`} />
        <Kpi label="К получению" value={money(m.to_collect)} hint="остаток по подтверждённым" tone={m.to_collect > 0 ? 'warn' : undefined} />
        <Kpi
          label="Этапы"
          value={stages.overdue ? `${stages.overdue} просрочено` : 'в срок'}
          hint={stages.awaiting_review ? `ждут проверки: ${stages.awaiting_review}` : 'нет отчётов на проверке'}
          tone={stages.overdue ? 'alert' : undefined}
        />
      </div>

      <div className="ev-grid ev-grid-main">
        <Card title="Ближайшие мероприятия" extra={<small>{upcoming.length ? `${upcoming.length}` : ''}</small>}>
          {upcoming.length === 0 ? (
            <Empty title="Ближайших мероприятий нет">Создайте заказ — он появится здесь вместе со сроками этапов.</Empty>
          ) : (
            <div className="ev-table-wrap">
              <table className="ev-table">
                <thead>
                  <tr><th>Дата</th><th>Мероприятие</th><th>Следующий этап</th><th>Статус</th><th className="ev-num">Остаток</th></tr>
                </thead>
                <tbody>
                  {upcoming.map((e) => (
                    <tr key={e.id} className="is-link" onClick={() => navigate(`/events/orders/${e.id}`)}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {/* Дата и время раздельно: одной строкой «29 сентября в 18:00»
                            переносилась посередине и читалась как две записи. */}
                        <div style={{ fontWeight: 700 }}>{date(e.starts_at)}</div>
                        <div className="ev-muted" style={{ fontSize: 12 }}>{time(e.starts_at)} · {relativeDays(e.starts_at)}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{e.title}</div>
                        <div className="ev-muted" style={{ fontSize: 12 }}>{[e.event_type, e.client_name, e.venue].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td>
                        {e.next_stage ? (
                          <>
                            <div style={{ fontWeight: 600 }}>{e.next_stage.name}</div>
                            <div style={{ fontSize: 12 }} className={e.next_stage.overdue ? 'ev-bad' : 'ev-muted'}>
                              {ROLE_LABELS[e.next_stage.role] || e.next_stage.role}
                              {e.next_stage.due_at ? ` · ${e.next_stage.overdue ? 'просрочен ' : 'до '}${date(e.next_stage.due_at)}` : ''}
                            </div>
                          </>
                        ) : <span className="ev-muted">все этапы приняты</span>}
                      </td>
                      <td><StatusBadge status={e.status} /></td>
                      <td className="ev-num">{e.remaining > 0 ? money(e.remaining) : <Badge tone="good">оплачено</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Должники" extra={<small>после мероприятия прошло больше {data.settings.payment_overdue_days} дн.</small>}>
          {debtors.length === 0 ? (
            <Empty title="Должников нет">Все прошедшие мероприятия оплачены.</Empty>
          ) : (
            <div className="ev-list">
              {debtors.map((d) => (
                <div key={d.id} className="ev-list-row is-link" onClick={() => navigate(`/events/orders/${d.id}`)}>
                  <div className="ev-list-main">
                    <div className="ev-list-title">{d.title}</div>
                    <div className="ev-list-sub">{[d.client_name, date(d.starts_at)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="ev-num ev-bad" style={{ fontWeight: 800 }}>{money(d.remaining)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {creating && (
        <OrderForm
          onClose={() => setCreating(false)}
          onCreated={(card) => navigate(`/events/orders/${card.event.id}`)}
        />
      )}
    </>
  );
}
