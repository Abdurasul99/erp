import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Card, Badge, PageHeader, Skeleton, EmptyState, fmtNum } from '../../owner/ui.jsx';

const TIER_TONE = { basic: 'blue', pro: 'orange', enterprise: 'purple' };

export default function FeatureFlags() {
  const [catalog, setCatalog] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [msg, setMsg] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [cat, mat, dash] = await Promise.all([
        api.get('/admin/features/catalog'),
        api.get('/admin/features'),
        api.get('/admin/dashboard'),
      ]);
      setCatalog(cat.data || []);
      setMatrix(mat.data || []);
      setCompanies((dash.data?.companies || []).map(c => ({ id: c.id, name: c.name })));
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || e.message });
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const isEnabled = (companyId, featureKey) =>
    matrix.some(m => m.company_id === companyId && m.feature_key === featureKey && m.enabled);

  const toggle = async (companyId, featureKey) => {
    const key = `${companyId}:${featureKey}`;
    setBusyKey(key); setMsg(null);
    const next = !isEnabled(companyId, featureKey);
    try {
      await api.post('/admin/features/toggle', { company_id: companyId, feature_key: featureKey, enabled: next });
      setMsg({ ok: true, text: `${next ? 'Включил' : 'Выключил'}: ${featureKey}` });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || e.message });
    }
    setBusyKey(null);
  };

  return (
    <>
      <PageHeader
        title="🚦 Фичи · тарифы"
        sub="Матрица «Компании × Премиум-фичи» — включи клиенту что он купил"
      />

      {msg && (
        <Card style={{ marginBottom: 16, borderLeft: `4px solid ${msg.ok ? 'var(--green)' : 'var(--red)'}` }}>
          <div style={{ color: msg.ok ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{msg.text}</div>
        </Card>
      )}

      {loading ? (
        <div className="card" style={{ padding: 20 }}>
          <Skeleton height={14} style={{ width: '30%', marginBottom: 16 }} />
          {[0, 1, 2, 3, 4].map(i => (
            <Skeleton key={i} height={36} style={{ marginBottom: 8 }} />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <EmptyState icon="🏢" title="Нет компаний" description="Сначала добавь хотя бы одну компанию через AdminPanel." />
      ) : (
        <>
          <Card icon="📋" title="Каталог премиум-фич" style={{ marginBottom: 16 }}>
            <div className="grid-3">
              {catalog.map(f => (
                <div key={f.key} style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{f.label}</div>
                    <Badge tone={TIER_TONE[f.tier] || 'gray'}>{f.tier}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>{f.desc}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{f.key}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card icon="🚦" title={`Матрица × ${companies.length} компани${companies.length === 1 ? 'я' : companies.length < 5 ? 'и' : 'й'}`}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Фича</th>
                    <th style={{ width: 80 }}>Тариф</th>
                    {companies.map(c => (
                      <th key={c.id} style={{ textAlign: 'center', minWidth: 130 }}>{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalog.map(f => (
                    <tr key={f.key}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{f.label}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{f.key}</div>
                      </td>
                      <td>
                        <Badge tone={TIER_TONE[f.tier] || 'gray'}>{f.tier}</Badge>
                      </td>
                      {companies.map(c => {
                        const on = isEnabled(c.id, f.key);
                        const busy = busyKey === `${c.id}:${f.key}`;
                        return (
                          <td key={c.id} style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => toggle(c.id, f.key)}
                              disabled={busy}
                              className="btn btn-sm"
                              style={{
                                background: on ? 'var(--green)' : 'var(--bg-2)',
                                color: on ? '#fff' : 'var(--text2)',
                                border: on ? 'none' : '1.5px solid var(--border)',
                                minWidth: 64,
                                opacity: busy ? .5 : 1,
                                cursor: busy ? 'wait' : 'pointer',
                              }}
                            >
                              {busy ? '...' : on ? '✓ ON' : '○ OFF'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ marginTop: 16, padding: 14, background: 'var(--primary-50)', borderRadius: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            💡 <strong>Подсказка:</strong> Включение фичи сразу даёт доступ юзерам компании. Выключение убирает фичу из UI (но данные в БД сохраняются). Все действия записываются в audit_log.
          </div>
        </>
      )}
    </>
  );
}
