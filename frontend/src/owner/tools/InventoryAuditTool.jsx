import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Progress, EmptyState, SkeletonCard, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt, fmtDate } from '../tt.js';

// Инвентаризация склада — снапшот учётных остатков (product_stock) → ввод факта → отклонения.
// Статусы позиции: match (факт = учёт), shortage (недостача), surplus (излишек).

const STATUS_META = {
  match:    { color: '#16A34A', label: 'Норма' },
  shortage: { color: '#DC2626', label: 'Недостача' },
  surplus:  { color: '#D97706', label: 'Излишек' },
};

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

function statusOf(book, actual) {
  if (actual == null) return 'pending';
  if (actual === book) return 'match';
  return actual < book ? 'shortage' : 'surplus';
}

export default function InventoryAuditTool() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);

  const [list, setList] = useState([]);          // история инвентаризаций
  const [active, setActive] = useState(null);    // выбранная инвентаризация (детали)
  const [items, setItems] = useState([]);        // позиции активной инвентаризации
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');

  const branchParam = useCallback(() => (branchId ? { branch_id: branchId } : {}), [branchId]);

  const loadList = useCallback(() => {
    setLoading(true); setError(null);
    api.get('/warehouse/audits', { params: { period, ...branchParam() } })
      .then(r => {
        const rows = r.data?.audits || [];
        setList(rows);
        // авто-открыть последнюю инвентаризацию
        if (rows.length && !active) loadAudit(rows[0].id);
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, branchParam]);

  const loadAudit = useCallback((id) => {
    api.get('/warehouse/audits', { params: { id, ...branchParam() } })
      .then(r => {
        setActive(r.data?.audit || null);
        setItems(r.data?.items || []);
      })
      .catch(e => setError(e.response?.data?.error || e.message));
  }, [branchParam]);

  useEffect(() => { loadList(); }, [loadList]);

  const startAudit = () => {
    setBusy(true); setError(null);
    api.post('/warehouse/audits', branchParam())
      .then(r => {
        const id = r.data?.audit?.id;
        loadList();
        if (id) loadAudit(id);
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const finishAudit = () => {
    if (!active) return;
    setBusy(true);
    api.patch('/warehouse/audits', { audit_id: active.id, finish: true })
      .then(() => { loadAudit(active.id); loadList(); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const saveActual = (item, val) => {
    const actual = val === '' ? null : Math.max(0, parseFloat(val) || 0);
    api.patch('/warehouse/audits', { item_id: item.id, actual_qty: actual })
      .then(r => {
        const upd = r.data?.item;
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...(upd || {}), actual_qty: actual } : i));
      })
      .catch(e => setError(e.response?.data?.error || e.message));
  };

  // Сводка по позициям активной инвентаризации
  const checked = items.filter(i => i.actual_qty != null).length;
  const matched = items.filter(i => statusOf(Number(i.book_qty), i.actual_qty == null ? null : Number(i.actual_qty)) === 'match').length;
  const shortage = items.filter(i => statusOf(Number(i.book_qty), i.actual_qty == null ? null : Number(i.actual_qty)) === 'shortage').length;
  const surplus = items.filter(i => statusOf(Number(i.book_qty), i.actual_qty == null ? null : Number(i.actual_qty)) === 'surplus').length;
  const lossSum = items.reduce((s, i) => s + Math.min(0, Number(i.diff_sum) || 0), 0);
  const total = items.length;

  const lastDate = active?.started_at ? fmtDate(new Date(active.started_at), { day: '2-digit', month: '2-digit', year: 'numeric' }, lang) : '—';
  const isOpen = active && active.status === 'open';

  const filtered = items.filter(i => {
    if (filter === 'all') return true;
    return statusOf(Number(i.book_qty), i.actual_qty == null ? null : Number(i.actual_qty)) === filter;
  });

  return (
    <>
      <PageHeader
        title={tt('🧮 Инвентаризация')}
        sub={tt('Снапшот учётных остатков · ввод факта · отклонения и потери')}
      />

      {/* Контролы в ТЕЛЕ инструмента (не в топбаре): иначе startAudit берёт устаревший branch_id
          момента монтирования → инвентаризация могла уйти в чужой филиал при смене филиала. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />
        <button className="btn-primary" onClick={startAudit} disabled={busy}>
          {busy ? tt('...') : tt('Старт инвентаризации')}
        </button>
      </div>

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <SkeletonCard lines={4} />
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📅" label={tt('Последняя инвентаризация')} value={lastDate}
              sub={active ? (isOpen ? tt('идёт сейчас') : tt('завершена')) : tt('нет данных')} color="var(--primary)" />
            <Tile icon="📦" label={tt('Проверено позиций')} value={`${fmtNum(checked)} / ${fmtNum(total)}`} sub={tt('факт введён')} color="var(--text)" />
            <Tile icon="✅" label={tt('Совпадение (норма)')} value={fmtNum(matched)} sub={tt('факт = учёт')} color="#16A34A" />
            <Tile icon="📉" label={tt('Потери (сумма)')} value={fmtMoneyFull(Math.abs(lossSum))} sub={tt('недостача, сум')} color="#DC2626" />
          </div>

          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🔻" label={tt('Недостача')} value={fmtNum(shortage)} sub={tt('факт меньше учёта')} color="#DC2626" />
            <Tile icon="🔺" label={tt('Излишек')} value={fmtNum(surplus)} sub={tt('факт больше учёта')} color="#D97706" />
            <Tile icon="🏷️" label={tt('Всего позиций')} value={fmtNum(total)} sub={tt('в снапшоте')} color="var(--text)" />
            <div className="tile">
              <div className="tile-label">📊 {tt('Прогресс')}</div>
              <div style={{ marginTop: 8 }}>
                <Progress value={checked} max={total || 1} color="var(--primary)" />
                <div className="tile-sub" style={{ marginTop: 6 }}>{total ? Math.round((checked / total) * 100) : 0}% {tt('проверено')}</div>
              </div>
            </div>
          </div>

          {/* История инвентаризаций */}
          {list.length > 1 && (
            <Card icon="🗂️" title={tt('История инвентаризаций')} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {list.map(a => (
                  <button key={a.id} type="button"
                    className={'pill' + (active && a.id === active.id ? ' active' : '')}
                    onClick={() => loadAudit(a.id)}>
                    {fmtDate(new Date(a.started_at), { day: '2-digit', month: '2-digit', year: 'numeric' }, lang)}
                    {' · '}{a.status === 'open' ? tt('идёт') : tt('завершена')}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {!active ? (
            <Card>
              <EmptyState icon="🧮" title={tt('Инвентаризация не проводилась')}
                description={tt('Нажмите «Старт инвентаризации», чтобы создать снапшот учётных остатков и ввести фактические количества.')} />
            </Card>
          ) : (
            <Card
              icon="📋"
              title={`${tt('Результаты инвентаризации')} (${filtered.length})`}
              actions={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Pills value={filter} onChange={setFilter} options={[
                    { value: 'all', label: tt('Все') },
                    { value: 'shortage', label: tt('Недостача') },
                    { value: 'surplus', label: tt('Излишек') },
                    { value: 'match', label: tt('Норма') },
                  ]} />
                  {isOpen && (
                    <button className="btn-primary" onClick={finishAudit} disabled={busy}>
                      {tt('Завершить')}
                    </button>
                  )}
                </div>
              }
            >
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Наименование')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('По учёту (шт)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Факт (шт)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Разница (шт)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сумма разницы (сум)')}</th>
                      <th style={{ textAlign: 'center' }}>{tt('Статус')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет позиций')}</td></tr>
                    ) : filtered.slice(0, 300).map(it => {
                      const book = Number(it.book_qty);
                      const act = it.actual_qty == null ? null : Number(it.actual_qty);
                      const st = statusOf(book, act);
                      const diff = act == null ? null : act - book;
                      const meta = STATUS_META[st];
                      return (
                        <tr key={it.id}>
                          <td style={{ fontWeight: 700 }}>{it.name}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(book)}</td>
                          <td style={{ textAlign: 'right' }}>
                            {isOpen ? (
                              <input
                                type="number" min="0"
                                defaultValue={act == null ? '' : act}
                                onBlur={e => saveActual(it, e.target.value)}
                                style={{ width: 90, textAlign: 'right', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 8 }}
                              />
                            ) : (
                              <span className="mono">{act == null ? '—' : fmtNum(act)}</span>
                            )}
                          </td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: diff == null ? 'var(--text3)' : diff < 0 ? '#DC2626' : diff > 0 ? '#D97706' : '#16A34A' }}>
                            {diff == null ? '—' : (diff > 0 ? '+' : '') + fmtNum(diff)}
                          </td>
                          <td className="mono" style={{ textAlign: 'right', color: (Number(it.diff_sum) || 0) < 0 ? '#DC2626' : 'var(--text2)' }}>
                            {it.diff_sum == null || act == null ? '—' : fmtMoneyFull(it.diff_sum)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {meta ? (
                              <span style={{ background: meta.color + '20', color: meta.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12 }}>
                                {tt(meta.label)}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text3)', fontSize: 12 }}>{tt('Ожидает')}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
