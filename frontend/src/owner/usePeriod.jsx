import React, { useContext, useMemo } from 'react';
import { BranchScope, PERIOD_PRESETS } from './OwnerShell.jsx';
import { useTt } from './tt.js';

// ═══ Единый источник периода+филиала для инструментов ══════════════════════
// Проблема, которую чиним: у каждого инструмента был свой внутренний период-пикер,
// а глобальный селектор в топбаре его игнорировали. Теперь топбар авторитетен —
// инструменты берут период отсюда, и любой из них может его сменить (глобально).

// Готовые params для api.get — покрывают все 3 контракта бэкенда сразу, эндпоинт
// берёт что знает, лишнее игнорирует:
// - period     — строка-пресет ('today'|'week'|'month'|'year'|'all'|'custom');
// - from/to    — точное окно (ISO) для эндпоинтов на диапазон;
// - days       — вычислено из окна, для legacy-эндпоинтов на `days` (без правок бэка);
// - branch_id  — текущий филиал.
// Мемоизирован по примитивам, поэтому стабилен для useEffect([params]).
export function usePeriodParams(extra) {
  const { period, periodFrom, periodTo, branchId } = useContext(BranchScope);
  const extraKey = extra ? JSON.stringify(extra) : '';
  return useMemo(() => {
    const params = { ...(extra || {}) };
    if (period) params.period = period;
    if (periodFrom) params.from = periodFrom;
    if (periodTo) params.to = periodTo;
    if (periodFrom) {
      const to = periodTo ? new Date(periodTo) : new Date();
      params.days = Math.max(1, Math.round((to - new Date(periodFrom)) / 86400000));
    } else {
      // Период «Всё» — окна нет; для legacy-эндпоинтов даём максимум.
      params.days = 366;
    }
    if (branchId) params.branch_id = branchId;
    return params;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, periodFrom, periodTo, branchId, extraKey]);
}

// Панель фильтров инструмента: показывает активный период (пилюли) + филиал.
// Переключение периода меняет ГЛОБАЛЬНЫЙ период (setPeriod из BranchScope) —
// значит, консистентно во всех инструментах и в топбаре.
export function ToolFilters({ showBranch = true, style }) {
  const { tt } = useTt();
  const { period, setPeriod, periodLabel, branchId, branches, role } = useContext(BranchScope);
  const branchName = branchId
    ? (branches.find(b => b.id === branchId)?.name || `#${branchId}`)
    : tt('Все филиалы');

  return (
    <div className="tool-filters" style={style}>
      <span className="tool-filters-label">{tt('Период')}</span>
      <div className="tool-filters-pills">
        {PERIOD_PRESETS.map(p => (
          <button
            key={p.value} type="button"
            className={'tool-filters-pill' + ((period === p.value) ? ' active' : '')}
            onClick={() => setPeriod(p.value)}
          >
            {tt(p.label)}
          </button>
        ))}
        {period === 'custom' && <span className="tool-filters-pill active">{periodLabel}</span>}
      </div>
      {showBranch && role !== 'manager' && (
        <span className="tool-filters-branch" title={tt('Задаётся в топбаре')}>
          <span className="tool-filters-dot" /> {branchName}
        </span>
      )}
    </div>
  );
}
