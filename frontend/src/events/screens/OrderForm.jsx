import React, { useContext, useEffect, useState } from 'react';
import eventsApi, { errorText } from '../api.js';
import { parseAmount, toLocalInput } from '../format.js';
import { Modal, Field, Button, AmountInput, ErrorAlert } from '../ui.jsx';
import { EventsContext } from '../EventsShell.jsx';

const COMPANY_WIDE = ['founder', 'project_manager'];

// Новый заказ или правка основных полей существующего.
// initial — карточка заказа для правки; без неё — создание.
export default function OrderForm({ initial, onClose, onCreated, onSaved }) {
  const { me } = useContext(EventsContext);
  const editing = !!initial;
  const ev = initial?.event;

  const [meta, setMeta] = useState({ event_types: [] });
  const [clients, setClients] = useState([]);
  const [branches, setBranches] = useState([]);

  const [title, setTitle] = useState(ev?.title || '');
  const [eventType, setEventType] = useState(ev?.event_type || 'Свадьба');
  const [startsAt, setStartsAt] = useState(ev ? toLocalInput(ev.starts_at) : '');
  const [endsAt, setEndsAt] = useState(ev?.ends_at ? toLocalInput(ev.ends_at) : '');
  const [venue, setVenue] = useState(ev?.venue || '');
  const [address, setAddress] = useState(ev?.address || '');
  const [price, setPrice] = useState(ev ? String(ev.total_price || '') : '');
  const [notes, setNotes] = useState(ev?.notes || '');
  const [branchId, setBranchId] = useState(ev?.branch_id ? String(ev.branch_id) : '');
  // Клиент: 'new' — завести нового, иначе id существующего.
  const [clientChoice, setClientChoice] = useState(ev?.client_id ? String(ev.client_id) : 'new');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const companyWide = COMPANY_WIDE.includes(me.user.role);

  useEffect(() => {
    eventsApi.get('/events/meta').then(({ data }) => setMeta(data)).catch(() => {});
    eventsApi.get('/clients').then(({ data }) => setClients(data.items)).catch(() => {});
    if (companyWide) eventsApi.get('/branches').then(({ data }) => setBranches(data.items)).catch(() => {});
  }, [companyWide]);

  const priceValue = parseAmount(price);
  const priceInvalid = price.trim() !== '' && priceValue === null;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Укажите название мероприятия'); return; }
    if (!startsAt) { setError('Укажите дату и время начала'); return; }
    if (priceInvalid) { setError('Стоимость должна быть числом, например 24 500 000'); return; }
    if (endsAt && endsAt < startsAt) { setError('Окончание раньше начала'); return; }

    const body = {
      title: title.trim(),
      event_type: eventType,
      starts_at: startsAt,
      ends_at: endsAt || null,
      venue: venue.trim() || null,
      address: address.trim() || null,
      total_price: priceValue ?? 0,
      notes: notes.trim() || null,
    };
    if (companyWide) body.branch_id = branchId ? Number(branchId) : null;
    if (clientChoice === 'new') {
      if (clientName.trim()) body.client = { name: clientName.trim(), phone: clientPhone.trim() || null };
      else if (editing) body.client_id = null;
    } else {
      body.client_id = Number(clientChoice);
    }

    setSaving(true);
    try {
      const { data } = editing
        ? await eventsApi.put(`/events/${ev.id}`, body)
        : await eventsApi.post('/events', body);
      if (editing) onSaved?.(data); else onCreated?.(data);
      onClose();
    } catch (err) {
      setError(errorText(err, 'Не удалось сохранить заказ'));
    } finally {
      setSaving(false);
    }
  }

  // Копия, а не ссылка на состояние: push в массив из useState изменил бы его в обход React.
  const types = [...(meta.event_types.length ? meta.event_types : ['Свадьба', 'Юбилей', 'Корпоратив', 'Помолвка', 'Другое'])];
  if (eventType && !types.includes(eventType)) types.push(eventType);

  return (
    <Modal
      title={editing ? 'Изменить заказ' : 'Новый заказ на мероприятие'}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button type="submit" form="ev-order-form" disabled={saving}>{saving ? 'Сохраняю…' : (editing ? 'Сохранить' : 'Создать заказ')}</Button>
        </>
      )}
    >
      <form id="ev-order-form" onSubmit={submit} className="ev-form-grid" noValidate>
        <Field label="Название" className="span-2">
          <input className="ev-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Свадьба Азиз и Нилуфар" maxLength={200} />
        </Field>
        <Field label="Тип мероприятия">
          <select className="ev-select" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Стоимость для клиента" hint={editing ? undefined : 'Можно уточнить позже'}>
          <AmountInput value={price} onChange={setPrice} invalid={priceInvalid} placeholder="24 500 000" />
        </Field>
        <Field label="Начало">
          <input className="ev-input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </Field>
        <Field label="Окончание" hint="Необязательно">
          <input className="ev-input" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </Field>
        <Field label="Площадка">
          <input className="ev-input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Ресторан «Бахор»" maxLength={200} />
        </Field>
        <Field label="Адрес">
          <input className="ev-input" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
        </Field>

        <Field label="Клиент" className="span-2">
          <select className="ev-select" value={clientChoice} onChange={(e) => setClientChoice(e.target.value)}>
            <option value="new">{editing ? 'Без клиента / новый клиент' : 'Новый клиент'}</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
          </select>
        </Field>
        {clientChoice === 'new' && (
          <>
            <Field label="Имя клиента">
              <input className="ev-input" value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={200} />
            </Field>
            <Field label="Телефон клиента">
              <input className="ev-input" type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+998 90 000 00 00" maxLength={40} />
            </Field>
          </>
        )}

        {companyWide && branches.length > 0 && (
          <Field label="Филиал" className="span-2">
            <select className="ev-select" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Без филиала (вся компания)</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        )}

        <Field label="Заметки" className="span-2">
          <textarea className="ev-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
        </Field>
        <div className="span-2"><ErrorAlert>{error}</ErrorAlert></div>
      </form>
    </Modal>
  );
}
