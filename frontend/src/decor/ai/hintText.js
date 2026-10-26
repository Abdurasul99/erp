// Подсказка Wave Intelligence → заголовок, текст, тон и переход (тексты на RU/UZ; сервер отдаёт код и параметры).
import { fm, fm2, fday } from '../i18n.js';

export const SEV_TONE = { bad: 'bad', warn: 'warn', info: 'blue', ok: 'ok' };

export function hintView(t, lang, h) {
  const list = a => (a || []).join(', ');
  switch (h.kind) {
    case 'conflict': return {
      title: t('hConflictT', { item: h.item, date: fday(h.day, lang) }),
      text: t('hConflictP', { need: h.need, have: h.have, short: h.short }) + (h.not_returned ? ` ${t('hConflictNb', { n: h.not_returned })}` : '') + (h.orders?.length ? ` (${list(h.orders)})` : ''),
      to: '/decor/booking', action: t('hGoBooking') };
    case 'not_returned': return {
      title: t('hNotBackT', { no: h.no }),
      text: t('hNotBackP', { n: h.days_late, items: (h.items || []).map(i => `${i.item} ${i.qty}`).join(', ') }),
      to: `/decor/warehouse?tab=notback&order=${h.order_id}`, action: t('nbAccept') };
    case 'pm_debt': return h.total_usd !== undefined
      ? { title: t('hDebtTotalT', { sum: fm(h.total_usd) }), text: t('hDebtP'), to: '/decor/finance?tab=money', action: t('hGoMoney') }
      : { title: t('hDebtT', { name: h.employee?.name || '—', sum: fm(h.amount_usd) }), text: t('hDebtP'), to: '/decor/finance?tab=money', action: t('hGoMoney') };
    case 'shortage_pending': return {
      title: t('hShortPendT', { no: h.no }),
      text: t('hShortPendP', { items: (h.items || []).map(i => `${i.item} ${i.qty}`).join(', '), team: list(h.team) || '—' }) + (h.amount_usd !== undefined ? ` · ${fm2(h.amount_usd)}` : ''),
      to: `/decor/warehouse?tab=shortage&order=${h.order_id}`, action: t('hGoWarehouse') };
    case 'below_cost': return {
      title: t('hBelowT', { no: h.no }), text: t('hBelowP', { price: fm(h.price_usd), full: fm2(h.full_usd) }),
      to: `/decor/orders?open=${h.order_id}`, action: t('card') };
    case 'shortage': return {
      title: t('hShortT', { no: h.no, sum: fm2(h.amount_usd) }),
      text: t('hShortP', { left: fm2(h.remaining_usd), team: list(h.team) || '—' }) + (h.recovered_usd > 0 ? ` ${t('hShortRec', { sum: fm2(h.recovered_usd) })}` : ''),
      to: `/decor/warehouse?tab=shortage&order=${h.order_id}`, action: t('hGoWarehouse') };
    case 'pending_reports': return {
      title: t('hReportsT', { n: h.count }), text: t('hReportsP') + (h.incomplete ? ` ${t('hReportsInc', { n: h.incomplete })}` : ''),
      to: '/decor/reports', action: t('hGoReports') };
    case 'evidence_missing': return h.orders !== undefined && h.stages === undefined
      ? { title: t('hEvIntelT', { n: h.orders }), text: t('hEvP'), to: '/decor/ai', action: t('hGoAi') }
      : { title: t('hEvT', { no: h.no }), text: `${(h.stages || []).map(s => t(`ev_${s.stage}`)).join(', ')} — ${t('hEvP')}`,
        to: `/decor/orders?open=${h.order_id}`, action: t('card') };
    case 'payroll_due': return {
      title: t('hPayT', { sum: fm(h.amount_usd) }), text: t('hPayP', { n: h.people }), to: '/decor/team?tab=pay', action: t('hGoTeam') };
    case 'fund_negative': return {
      title: t('hFundT', { sum: fm2(h.amount_usd) }), text: t('hFundP', { spent: fm2(h.spent_usd), acc: fm2(h.accumulated_usd) }),
      to: '/decor/finance?tab=fund', action: t('hGoFund') };
    default: return { title: t('hAllGoodT'), text: t('hAllGoodP'), to: '/decor/orders', action: t('hGoOrders') };
  }
}
