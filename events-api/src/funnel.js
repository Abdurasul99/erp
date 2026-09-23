'use strict';

// Воронка этапов мероприятия: шаблоны, расчёт сроков, развёртывание этапов.
//
// Встроенные шаблоны перенесены из макета «Редактор воронки процесса» дословно:
// этапы, ответственные роли, правила сроков, пункты приёмки и инструкции.
// Компания может завести свои шаблоны — тогда встроенный не используется.

const PROOF_TYPES = ['checklist', 'file', 'photo', 'video', 'none'];
const PROOF_LABELS = { checklist: 'Чеклист', file: 'Файл', photo: 'Фото', video: 'Видео', none: 'Без доказательства' };
const DEADLINE_ANCHORS = ['created', 'start', 'end'];

const HOUR = 3600 * 1000;

const req = (text) => ({ text, required: true });
const opt = (text) => ({ text, required: false });

const WEDDING_STAGES = [
  { name: 'Заявка', responsible_role: 'coordinator', proof_type: 'checklist', deadline_anchor: 'created', deadline_offset_hours: 24,
    checklist: [req('Данные клиента внесены в систему'), req('Тип и дата события подтверждены')],
    instructions: 'Зафиксировать заявку клиента, уточнить дату, тип события и ориентировочный бюджет, создать карточку в системе.' },
  { name: 'Смета', responsible_role: 'coordinator', proof_type: 'file', deadline_anchor: 'start', deadline_offset_hours: -14 * 24,
    checklist: [req('Смета согласована с клиентом'), req('Приложен файл сметы')],
    instructions: 'Составить смету на основе брифа клиента, согласовать позиции декора и итоговую стоимость.' },
  { name: 'Закуп', responsible_role: 'decorator', proof_type: 'checklist', deadline_anchor: 'start', deadline_offset_hours: -7 * 24,
    checklist: [req('Все позиции закуплены или зарезервированы'), opt('Наличие проверено на складе')],
    instructions: 'Оформить закуп недостающих материалов, зарезервировать прокатный инвентарь под событие.' },
  { name: 'Подготовка', responsible_role: 'florist', proof_type: 'photo', deadline_anchor: 'start', deadline_offset_hours: -2 * 24,
    checklist: [req('Материалы скомплектованы'), req('Инвентарь проверен на повреждения')],
    instructions: 'Собрать и упаковать все материалы и декор для отправки на площадку.' },
  { name: 'Монтаж', responsible_role: 'installer', proof_type: 'video', deadline_anchor: 'start', deadline_offset_hours: 0,
    checklist: [req('Видео снято при естественном освещении'), req('Показан общий план локации'), req('Оформление соответствует смете')],
    instructions: 'Смонтировать декор на площадке согласно утверждённой смете и схеме зала.' },
  { name: 'Проведение', responsible_role: 'coordinator', proof_type: 'photo', deadline_anchor: 'end', deadline_offset_hours: 0,
    checklist: [opt('Событие началось вовремя'), req('Нет замечаний от клиента')],
    instructions: 'Находиться на площадке, контролировать сохранность декора и оперативно решать вопросы.' },
  { name: 'Демонтаж', responsible_role: 'installer', proof_type: 'checklist', deadline_anchor: 'end', deadline_offset_hours: 12,
    checklist: [req('Весь инвентарь демонтирован'), req('Инвентарь погружен для возврата на склад')],
    instructions: 'Разобрать декор, проверить площадку на отсутствие оставленных вещей, погрузить инвентарь.' },
  { name: 'Закрытие', responsible_role: 'coordinator', proof_type: 'none', deadline_anchor: 'end', deadline_offset_hours: 48,
    checklist: [],
    instructions: 'Закрыть событие в системе, свести финальную смету и передать данные в финансы.' },
];

const CORPORATE_STAGES = [
  { name: 'Заявка', responsible_role: 'coordinator', proof_type: 'checklist', deadline_anchor: 'created', deadline_offset_hours: 24,
    checklist: [req('Бриф от компании получен')],
    instructions: 'Принять заявку от корпоративного клиента, уточнить формат и бюджет.' },
  { name: 'Смета', responsible_role: 'coordinator', proof_type: 'file', deadline_anchor: 'start', deadline_offset_hours: -10 * 24,
    checklist: [req('Смета утверждена ответственным лицом компании')],
    instructions: 'Согласовать смету с представителем компании-заказчика.' },
  { name: 'Закуп', responsible_role: 'decorator', proof_type: 'checklist', deadline_anchor: 'start', deadline_offset_hours: -5 * 24,
    checklist: [req('Брендированные элементы закуплены')],
    instructions: 'Закупить материалы и брендированный декор по ТЗ компании.' },
  { name: 'Монтаж', responsible_role: 'installer', proof_type: 'video', deadline_anchor: 'start', deadline_offset_hours: 0,
    checklist: [req('Брендинг размещён по схеме')],
    instructions: 'Смонтировать сцену, брендинг и декор согласно согласованной схеме.' },
  { name: 'Демонтаж', responsible_role: 'installer', proof_type: 'checklist', deadline_anchor: 'end', deadline_offset_hours: 12,
    checklist: [req('Всё оборудование вывезено')],
    instructions: 'Демонтировать оборудование и декор, вернуть инвентарь на склад.' },
  { name: 'Закрытие', responsible_role: 'coordinator', proof_type: 'none', deadline_anchor: 'end', deadline_offset_hours: 72,
    checklist: [],
    instructions: 'Закрыть событие, выставить закрывающие документы компании.' },
];

const BUILTIN_TEMPLATES = [
  { key: 'wedding', name: 'Свадьба (по умолчанию)', event_type: null, stages: WEDDING_STAGES },
  { key: 'corporate', name: 'Корпоратив', event_type: 'Корпоратив', stages: CORPORATE_STAGES },
];

// Срок этапа от дат мероприятия. Мероприятие без времени окончания считается
// закончившимся в момент начала — иначе «через 12 часов после» не посчитать.
function dueAt(stage, event) {
  const base = {
    created: event.created_at,
    start: event.starts_at,
    end: event.ends_at || event.starts_at,
  }[stage.deadline_anchor];
  if (!base) return null;
  const t = new Date(base).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + (Number(stage.deadline_offset_hours) || 0) * HOUR).toISOString();
}

// Человеческая формулировка правила — та же, что в макете.
//
// Падеж зависит от предлога: «за 2 дня» и «через 2 дня» — винительный, а
// «в течение 1 дня», «в течение 12 часов» — родительный. Одна форма на всё
// давала «в течение 1 день» — так в макете не написано и по-русски не говорят.
function deadlineLabel(anchor, offsetHours) {
  const h = Number(offsetHours) || 0;
  const span = (x, genitive) => {
    const a = Math.abs(x);
    const inDays = a % 24 === 0;
    const n = inDays ? a / 24 : a;
    const word = inDays
      ? (genitive ? genitivePlural(n, 'дня', 'дней') : plural(n, 'день', 'дня', 'дней'))
      : (genitive ? genitivePlural(n, 'часа', 'часов') : plural(n, 'час', 'часа', 'часов'));
    return `${n} ${word}`;
  };
  if (anchor === 'created') return h === 0 ? 'Сразу после обращения' : `В течение ${span(h, true)} после обращения`;
  if (anchor === 'start') {
    if (h === 0) return 'В день события, до начала';
    return h < 0 ? `За ${span(h)} до события` : `Через ${span(h)} после начала`;
  }
  if (h === 0) return 'Во время события';
  return h > 0 ? `В течение ${span(h, true)} после события` : `За ${span(h)} до окончания`;
}

// Родительный падеж после «в течение»: 1, 21, 31 дня — но 11 дней; прочие — дней.
function genitivePlural(n, one, many) {
  return n % 10 === 1 && n % 100 !== 11 ? one : many;
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// Шаблон для нового мероприятия: свой шаблон компании под этот тип, затем её
// шаблон по умолчанию, затем встроенный (корпоратив или свадьба).
async function pickTemplateStages(q, companyId, eventType) {
  const { rows: [tpl] } = await q.query(
    `SELECT id FROM ev_funnel_templates
      WHERE company_id = $1 AND deleted_at IS NULL AND (event_type = $2 OR is_default)
      -- COALESCE обязателен: у шаблона без типа сравнение даёт NULL, а при
      -- сортировке DESC Postgres ставит NULL ПЕРВЫМ — шаблон «по умолчанию»
      -- обогнал бы шаблон, точно подходящий под тип мероприятия.
      ORDER BY COALESCE(event_type = $2, false) DESC, is_default DESC, id
      LIMIT 1`, [companyId, eventType]);
  if (tpl) {
    const { rows } = await q.query(
      `SELECT name, responsible_role, proof_type, deadline_anchor, deadline_offset_hours, checklist, instructions
         FROM ev_funnel_stages WHERE template_id = $1 ORDER BY position, id`, [tpl.id]);
    if (rows.length) return rows;
  }
  return (BUILTIN_TEMPLATES.find((t) => t.event_type === eventType) || BUILTIN_TEMPLATES[0]).stages;
}

async function instantiateStages(q, event) {
  const stages = await pickTemplateStages(q, event.company_id, event.event_type);
  let position = 0;
  for (const s of stages) {
    position += 1;
    const checklist = (Array.isArray(s.checklist) ? s.checklist : [])
      .map((c) => ({ text: String(c.text || ''), required: !!c.required, done: false }))
      .filter((c) => c.text);
    await q.query(
      `INSERT INTO ev_event_stages
         (company_id, event_id, position, name, responsible_role, proof_type,
          deadline_anchor, deadline_offset_hours, due_at, checklist, instructions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)`,
      [event.company_id, event.id, position, s.name, s.responsible_role, s.proof_type,
        s.deadline_anchor, s.deadline_offset_hours, dueAt(s, event), JSON.stringify(checklist), s.instructions || null]);
  }
  return position;
}

// Мероприятие перенесли — сроки ещё не принятых этапов пересчитываются от новых
// дат. Принятые этапы не трогаем: их срок уже история.
async function recomputeDeadlines(q, event) {
  const { rows } = await q.query(
    `SELECT id, deadline_anchor, deadline_offset_hours FROM ev_event_stages
      WHERE event_id = $1 AND status <> 'accepted'`, [event.id]);
  for (const s of rows) {
    await q.query('UPDATE ev_event_stages SET due_at = $2 WHERE id = $1', [s.id, dueAt(s, event)]);
  }
  return rows.length;
}

module.exports = {
  PROOF_TYPES, PROOF_LABELS, DEADLINE_ANCHORS, BUILTIN_TEMPLATES,
  dueAt, deadlineLabel, pickTemplateStages, instantiateStages, recomputeDeadlines,
};
