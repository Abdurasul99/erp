import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtNum, fmtSum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

// Тон бейджа по уровню серьёзности алерта.
function sevTone(sev) {
  if (sev === 'high') return 'red';
  if (sev === 'medium') return 'yellow';
  return 'gray';
}
function sevLabel(sev, tt) {
  if (sev === 'high') return tt('Высокий');
  if (sev === 'medium') return tt('Средний');
  return tt('Низкий');
}

const FILTERS = [
  { value: 'all',  label: 'Все' },
  { value: 'high', label: 'High' },
  { value: 'new',  label: 'Новые' },
];

export default function StorePoliceTool() {
  const { tt } = useTt();
  const { branchId, period } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period: period || 'month' };
    if (branchId) params.branch_id = branchId;
    api.get('/police/alerts', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period, reloadKey]);

  async function setStatus(alert, status) {
    setBusyId(alert.id);
    try {
      await api.post(`/police/alerts/${encodeURIComponent(alert.id)}/status`, {
        status,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        est_loss: alert.est_loss,
        rule_code: alert.rule_code,
        branch_id: alert.branch_id || null,
        employee_id: alert.employee_id || null,
      });
      toast(status === 'resolved' ? tt('Алерт проверен') : tt('Алерт скрыт'), 'success');
      setReloadKey(k => k + 1);
    } catch (e) {
      toast(e.response?.data?.error || e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const kpi = data?.kpi || {};
  const alerts = data?.alerts || [];
  const hotspots = data?.hotspots || [];

  const filtered = alerts.filter(a => {
    if (filter === 'high') return a.severity === 'high';
    if (filter === 'new') return a.status === 'new';
    return true;
  });

  return (
    <>
      <PageHeader
        title={tt('🚓 Полиция магазина')}
        sub={tt('Авто-детектор аномалий и махинаций: отмены, скидки, расхождения, операции вне смены')}
        actions={<Pills value={filter} onChange={setFilter} options={FILTERS.map(f => ({ ...f, label: tt(f.label) }))} />}
      />

      {error && <Card icon="⚠️"><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><Skeleton height={20} style={{ marginBottom: 12 }} /><Skeleton height={220} /></Card>
      ) : (
        <>
          <div className="grid-3" style={{ marginBottom: 18 }}>
            <Tile
              icon="🚨"
              label={tt('Алертов за период')}
              value={fmtNum(kpi.alerts_total || 0)}
              sub={`${tt('из них High')}: ${fmtNum(kpi.alerts_high || 0)}`}
              color="#D97706"
            />
            <Tile
              icon="💸"
              label={tt('Оценка потерь')}
              value={fmtSum(kpi.est_loss_total || 0)}
              sub={tt('по подозрительным операциям')}
              color="#DC2626"
            />
            <Tile
              icon="🔥"
              label={tt('Горячих точек')}
              value={fmtNum(hotspots.length || 0)}
              sub={tt('проблемные сотрудники/филиалы')}
              color="#1D4ED8"
            />
          </div>

          {/* Горячие точки */}
          {hotspots.length > 0 && (
            <Card icon="🔥" title={tt('Горячие точки')} style={{ marginBottom: 18 }}>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Сотрудник / филиал')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Алертов')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('High')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Оценка потерь')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotspots.map((h, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700 }}>
                          {h.name || tt('—')}
                          {h.branch_name && <span style={{ color: 'var(--text3)', fontWeight: 500, marginLeft: 6, fontSize: 12 }}>· {h.branch_name}</span>}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 800 }}>{fmtNum(h.alerts || 0)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {h.high > 0 ? <Badge tone="red">{fmtNum(h.high)}</Badge> : <span style={{ color: 'var(--text3)' }}>0</span>}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--red, var(--text2))' }}>{fmtSum(h.est_loss || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Лента алертов */}
          <Card icon="📋" title={tt('Лента алертов')}>
            {filtered.length === 0 ? (
              <EmptyState
                icon="✅"
                title={tt('Алертов нет')}
                description={tt('За выбранный период подозрительных операций не обнаружено')}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map(a => (
                  <div key={a.id} style={{
                    border: '1px solid var(--border, #E3EAF3)',
                    borderLeft: `4px solid ${a.severity === 'high' ? '#DC2626' : a.severity === 'medium' ? '#D97706' : '#94A0B5'}`,
                    borderRadius: 10, padding: '12px 14px',
                    background: a.status === 'new' ? 'var(--bg, #fff)' : 'rgba(148,160,181,.06)',
                    opacity: a.status === 'resolved' || a.status === 'ignored' ? 0.7 : 1,
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Badge tone={sevTone(a.severity)}>{sevLabel(a.severity, tt)}</Badge>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{tt(a.title)}</span>
                      {a.status === 'new' && <Badge tone="blue">{tt('Новый')}</Badge>}
                      {a.status === 'resolved' && <Badge tone="green">{tt('Проверен')}</Badge>}
                      {a.status === 'ignored' && <Badge tone="gray">{tt('Скрыт')}</Badge>}
                      {a.est_loss > 0 && (
                        <span style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--red, #DC2626)', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                          ≈ {fmtSum(a.est_loss)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 8 }}>
                      {tt(a.description)}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--text3)' }}>
                      {a.employee_name && <span>👤 {a.employee_name}</span>}
                      {a.branch_name && <span>🏪 {a.branch_name}</span>}
                      {a.created_at && <span className="mono">{new Date(a.created_at).toLocaleString('ru-RU')}</span>}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-sm"
                          disabled={busyId === a.id || a.status === 'resolved'}
                          onClick={() => setStatus(a, 'resolved')}
                        >
                          {tt('✓ Проверить')}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === a.id || a.status === 'ignored'}
                          onClick={() => setStatus(a, 'ignored')}
                        >
                          {tt('Игнорировать')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, padding: '12px 4px 0' }}>
            {tt('Правила: много отмен продаж, частые скидки выше нормы, расхождения склада, операции вне смены, возвраты и списания. Алерты вычисляются автоматически из журнала операций и продаж за период. «Проверить» закрывает алерт, «Игнорировать» скрывает его из ленты.')}
          </div>
        </>
      )}
    </>
  );
}
