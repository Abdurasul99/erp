// Справочники сферы «Декор»: статусы, действия, должности, уровни и значения по умолчанию для новой компании.
// Коды совпадают с CHECK-ограничениями в sql/D10_decor_domain.sql; названия на экране — в i18n фронтенда.

// Канбан: Лид → Дизайн → Предоплата → Забронирован → Монтаж → Приёмка → Демонтаж → Закрыт
const STATUSES = ['lead', 'design', 'prepay', 'booked', 'install', 'acceptance', 'dismantle', 'closed'];

// Полномочия (матрица должность × действие в decor_permissions)
const ACTIONS = [
  'create_order', 'change_status', 'handle_decor', 'take_money', 'confirm_money',
  'upload_report', 'approve_report', 'pay_team', 'see_finance', 'edit_settings',
  'manage_items',   // D25: заводить вещи, название, архив, приход, списание, инвентаризация (цена и ресурс — edit_settings)
];
// Учредитель и ген. директор могут всё; их полномочия не хранятся и не выключаются
const OWNERS = ['founder', 'gen_dir'];
// Должности с настраиваемыми полномочиями = роли пользователей
const POSITIONS = ['cashier', 'warehouse', 'pm'];

// Уровни сотрудников: ПМ, ученик, кассир, кладовщик
const LEVELS = ['pm', 'trainee', 'cashier', 'storekeeper'];
const ORDER_TYPES = ['big', 'small'];
// issue — выдача, extra — довыдача, left — возврат остатка, final — финальный возврат по вещи (может быть 0),
// late_return — поздний возврат: вещь из «недостачи под вопросом» нашлась и вернулась на склад
const MOVE_TYPES = ['issue', 'extra', 'left', 'final', 'late_return'];
const PAYMENT_KINDS = ['prepay', 'final', 'topup'];
const REPORT_STAGES = ['install', 'acceptance', 'dismantle'];
// Этапы с обязательными доказательствами (фото/видео): выдача со склада, отчёты монтажа, приёмки и демонтажа,
// финальный возврат, «сдал кассиру». Требования задаёт учредитель (decor_evidence_rules, D24).
const EVIDENCE_STAGES = ['issue', 'install', 'acceptance', 'dismantle', 'final', 'handover'];
// По умолчанию (решение пользователя 2026-10-24): приёмка — 3 фото + видео, финал при недостаче — комментарий или ещё фото
const DEFAULT_EVIDENCE = {
  issue: { min_photos: 1, need_video: false, shortage_note: false },
  install: { min_photos: 1, need_video: false, shortage_note: false },
  acceptance: { min_photos: 3, need_video: true, shortage_note: false },
  dismantle: { min_photos: 1, need_video: false, shortage_note: false },
  final: { min_photos: 1, need_video: false, shortage_note: true },
  handover: { min_photos: 1, need_video: false, shortage_note: false },
};
// «Купил декор» с вещью: цена вещи — средняя (по умолчанию), цена покупки или без изменений
const PRICE_MODES = ['average', 'replace', 'keep'];

// Разделы нижней панели, которые учредитель может выключить («Управление панелью»); Главная и Настройки — всегда
const PANEL_SECTIONS = ['tools', 'orders', 'calc', 'booking', 'decor', 'finance', 'team', 'reports', 'ai'];

// Полномочия по умолчанию: «кассир — оформление, деньги, подтверждение; кладовщик — склад;
// ПМ — статусы, приём денег, отчёты» (ТЗ и прототип). Учредитель меняет их сам в Настройках.
const DEFAULT_PERMISSIONS = {
  cashier: ['create_order', 'change_status', 'take_money', 'confirm_money', 'pay_team'],
  warehouse: ['handle_decor', 'manage_items'],
  pm: ['change_status', 'take_money', 'upload_report'],
};

// Ставки сдельной оплаты за заказ, $ (из прототипа)
const DEFAULT_RATES = {
  pm: { big: 100, small: 60 },
  trainee: { big: 35, small: 20 },
};

module.exports = {
  STATUSES, ACTIONS, OWNERS, POSITIONS, LEVELS, ORDER_TYPES, MOVE_TYPES, PAYMENT_KINDS, REPORT_STAGES, PANEL_SECTIONS,
  EVIDENCE_STAGES, DEFAULT_EVIDENCE, PRICE_MODES, DEFAULT_PERMISSIONS, DEFAULT_RATES,
};
