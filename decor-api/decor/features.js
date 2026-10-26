// Функции компании сферы «Декор» для общей админки Wave (как FEATURE_CATALOG в server.js и SPHERE_FEATURES в sphere_admin.js).
// Админ Wave включает и выключает их в компании; выключенная функция прячет свои разделы у всех сотрудников.
// tier 'basic' включается сам при создании компании.
module.exports = [
  { key: 'decor-orders',    label: 'Заказы, калькулятор и бронь', tier: 'basic', desc: 'Канбан заказов, калькулятор дизайна, бронь декора на даты' },
  { key: 'decor-warehouse', label: 'Склад и износ',               tier: 'basic', desc: 'Выдача, довыдача, возврат остатка, финальный возврат, недостача' },
  { key: 'decor-finance',   label: 'Себестоимость и деньги',      tier: 'basic', desc: 'Себестоимость заказов, деньги проект-менеджеров → касса' },
  { key: 'decor-team',      label: 'Сдельная оплата',             tier: 'basic', desc: 'Начисления за одобренную приёмку, выплаты' },
  { key: 'decor-reports',   label: 'Фото и видео отчёты',         tier: 'basic', desc: 'Отчёты с объекта, одобрение и возврат' },
  { key: 'decor-ai',        label: 'Подсказки Wave Intelligence', tier: 'basic', desc: 'Конфликты брони, несданные деньги, заказы в минус' },
];
