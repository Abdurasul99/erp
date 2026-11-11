// Название задачи на языке экрана: автозадачу «позвонить» сервер хранит по-русски — здесь собираем её из полей
// (вид даты, клиент, родственник, дата), обычную — как написал человек.
import { fdm } from '../i18n.js';

export const QUADRANTS = [
  { id: 'q1', urgent: true, important: true },
  { id: 'q2', urgent: false, important: true },
  { id: 'q3', urgent: true, important: false },
  { id: 'q4', urgent: false, important: false },
];
export const quadrantOf = x => QUADRANTS.find(q => q.urgent === !!x.urgent && q.important === !!x.important).id;
export const TASK_STATUSES = ['new', 'in_progress', 'review', 'done'];
export const STATUS_TONE = { new: 'gray', in_progress: 'blue', review: 'warn', done: 'ok' };

export function taskTitle(t, lang, x) {
  if (x.source !== 'auto_client_date' || !x.auto_kind) return x.title;
  const client = x.client?.name || x.client || '—';
  const date = fdm(x.event_date, lang);
  if (x.auto_kind === 'client_birthday') return t('tkAutoClientBd', { client, date });
  if (x.auto_kind === 'relative_birthday') {
    const r = x.relative && typeof x.relative === 'object' ? x.relative : { name: x.relative || '', relation: 'other' };
    return t('tkAutoRelBd', { client, rel: t(`rel_${r.relation || 'other'}`), name: r.name, date });
  }
  return t('tkAutoAnniv', { client, date });
}
