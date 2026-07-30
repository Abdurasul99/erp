import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Badge, PageHeader, Pills, Tile, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';
import { useTaskInbox } from '../../hooks/useTaskInbox.jsx';
import TaskBoard from './TaskBoard.jsx';

// Окно «Задачи / Поручения» — тонкая обёртка над TaskBoard.
//
// Раньше здесь жила вторая, независимая реализация Kanban со своими копиями
// справочников приоритетов/статусов — они уже разъехались с остальными
// экранами. Теперь доска в проекте одна (TaskBoard), справочники — общие
// (owner/taskMeta.js), а этому окну остались шапка, период метрик и плитки.
//
// Фильтр «Все / Я поставил / Мне поручено» рисует сам TaskBoard, проп scope —
// лишь стартовое значение; второго такого переключателя здесь быть не должно.

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

export default function TasksTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const { version } = useTaskInbox();

  const [period, setPeriod] = useState('week');
  const [metrics, setMetrics] = useState({});
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  // Метрики тянем отдельно от доски: доска грузит карточки под своим фильтром
  // «кому задача», а плитки должны считаться по всему скоупу за выбранный
  // период (сервер так их и считает — scope/status на метрики не влияют).
  useEffect(() => {
    let ignore = false;
    const params = { view: 'kanban', period };
    // include_company_level — как на доске, иначе цифры плиток и карточек
    // разойдутся: задачи без филиала (директору) попадают только с ним.
    if (branchId) { params.branch_id = branchId; params.include_company_level = 1; }
    api.get('/tasks', { params })
      .then(r => { if (!ignore) { setMetrics(r.data?.metrics || {}); setError(null); } })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); });
    return () => { ignore = true; };
  }, [branchId, period, version, tick]);

  const refreshMetrics = useCallback(() => setTick(v => v + 1), []);

  const periodLabel = PERIODS.find(p => p.value === metrics.period)?.label || 'период';

  return (
    <>
      <PageHeader
        title={tt('Задачи / Поручения')}
        sub={tt('Kanban-доска поручений · ручные и авто-задачи из алертов')}
        actions={
          <Badge tone={metrics.overdue > 0 ? 'red' : 'green'}>
            {metrics.overdue > 0 ? `${metrics.overdue} ${tt('просрочено')}` : tt('Без просрочек')}
          </Badge>
        }
      />

      <div style={{ marginBottom: 14 }}>
        <Pills value={period} onChange={setPeriod} label="Период"
          options={PERIODS.map(p => ({ value: p.value, label: tt(p.label) }))} />
      </div>

      {error && <div style={{ color: '#DC2626', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{error}</div>}

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Tile label={tt('Активные')} value={fmtNum(metrics.active)} sub={tt('в работе и в очереди')} color="#1D4ED8" />
        <Tile label={tt('Выполнено сегодня')} value={fmtNum(metrics.done_today)} sub={tt('закрыто за день')} color="#16A34A" />
        <Tile label={tt('Просрочено')} value={fmtNum(metrics.overdue)} sub={tt('срок прошёл')} color="#DC2626" />
        <Tile label={tt('Выполнение')} value={metrics.completion_pct == null ? '—' : metrics.completion_pct + '%'}
          sub={`${tt('готово/назначено')} · ${tt(periodLabel)}`} color="#D97706" />
      </div>

      {/* compact — чтобы доска не повторила три из четырёх плиток выше */}
      <TaskBoard branchId={branchId} scope="all" compact onChanged={refreshMetrics} />
    </>
  );
}
