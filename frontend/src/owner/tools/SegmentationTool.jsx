import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoney, fmtNum, Pills } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Цвет балла R/F/M (1-5): 4-5 зелёный, 3 жёлтый, 1-2 красный.
const scoreColor = (s) => (s >= 4 ? '#16a34a' : s === 3 ? '#D97706' : '#DC2626');

function RfmChips({ r, f, m }) {
  const chip = (letter, v) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 10.5, fontWeight: 800,
      color: '#fff', background: scoreColor(v), borderRadius: 5, padding: '1px 5px',
    }}>{letter}{v}</span>
  );
  return <span style={{ display: 'inline-flex', gap: 4 }}>{chip('R', r)}{chip('F', f)}{chip('M', m)}</span>;
}

export default function SegmentationTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/customers/segments', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const segments = data?.segments || [];
  const customers = data?.customers || [];
  const total = data?.total || 0;
  const scoring = data?.scoring || {};
  const segByKey = Object.fromEntries(segments.map(s => [s.key, s]));
  const filtered = tab === 'all' ? customers : customers.filter(c => c.segment === tab);

  // 4 ключевых сегмента в обзоре (как в эталоне): Чемпионы, Лояльные, В зоне риска, Потерянные.
  const HIGHLIGHT = ['champions', 'loyal', 'at_risk', 'lost'];
  const HIGHLIGHT_COLOR = { champions: '#D97706', loyal: '#16A34A', at_risk: '#DC2626', lost: '#6B7280' };

  const tabs = [{ value: 'all', label: tt('Все') + ` (${total})` },
    ...segments.filter(s => s.count > 0).map(s => ({ value: s.key, label: `${s.icon} ${tt(s.label)} (${s.count})` }))];

  return (
    <>
      <PageHeader
        title={tt('🎯 RFM-сегментация клиентов')}
        sub={tt('Recency · Frequency · Monetary — кому звонить, кого возвращать')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          {/* Обзор — 4 ключевых сегмента */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {HIGHLIGHT.map(key => {
              const s = segByKey[key] || { count: 0, icon: '', label: key };
              return <Tile key={key} icon={s.icon} label={tt(s.label)} value={fmtNum(s.count)}
                sub={`${s.pct || 0}% · LTV ${fmtMoney(s.avg_ltv || 0)}`} color={HIGHLIGHT_COLOR[key]} />;
            })}
          </div>

          {/* Полная таблица 11 сегментов */}
          <Card icon="📊" title={tt('11 сегментов — распределение и действия')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Сегмент')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Клиентов')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Доля')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Средний LTV')}</th>
                    <th>{tt('Рекомендованное действие')}</th>
                  </tr>
                </thead>
                <tbody>
                  {segments.map(s => (
                    <tr key={s.key} style={{ opacity: s.count > 0 ? 1 : 0.5, cursor: s.count > 0 ? 'pointer' : 'default' }}
                      tabIndex={s.count > 0 ? 0 : -1} aria-label={`${tt(s.label)}: ${s.count}`}
                      onClick={() => s.count > 0 && setTab(s.key)}
                      onKeyDown={(e) => { if (s.count > 0 && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setTab(s.key); } }}>
                      <td style={{ fontWeight: 700 }}><Badge tone={s.tone}>{s.icon} {tt(s.label)}</Badge></td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(s.count)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{s.pct}%</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(s.avg_ltv)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{tt(s.action)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Таблица клиентов с фильтром по сегменту */}
          <Card icon="📋" title={`${tt('Клиенты')} (${filtered.length})`}
            actions={<Pills value={tab} onChange={setTab} options={tabs} />} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Клиент')}</th>
                    <th>{tt('Телефон')}</th>
                    <th>{tt('Сегмент')}</th>
                    <th>{tt('RFM')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Покупок')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('LTV')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Посл. покупка')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет клиентов в этом сегменте')}</td></tr>
                  ) : filtered.slice(0, 200).map(c => {
                    const s = segByKey[c.segment] || {};
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700 }}>{c.name}</td>
                        <td className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{c.phone || '—'}</td>
                        <td><Badge tone={s.tone}>{s.icon} {tt(c.segment_label || s.label || c.segment)}</Badge></td>
                        <td><RfmChips r={c.r_score} f={c.f_score} m={c.m_score} /></td>
                        <td className="mono" style={{ textAlign: 'right' }}>{c.deals}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(c.revenue)}</td>
                        <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text2)' }}>
                          {c.last_at ? `${c.days_since} ${tt('дн назад')}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > 200 && (
              <div style={{ textAlign: 'center', padding: 10, color: 'var(--text3)', fontSize: 12 }}>
                {tt('Показаны первые 200 из')} {filtered.length}
              </div>
            )}
          </Card>

          {/* Справка по шкале баллов R/F/M */}
          <Card icon="📐" title={tt('Как считаются баллы R / F / M (1-5)')}>
            <div className="grid-3">
              {[['R', tt('Recency — давность покупки'), scoring.r],
                ['F', tt('Frequency — частота покупок / год'), scoring.f],
                ['M', tt('Monetary — сумма покупок / год'), scoring.m]].map(([letter, title, items]) => (
                <div key={letter}>
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: '#fff', background: 'var(--primary)', borderRadius: 6, padding: '1px 7px' }}>{letter}</span> {title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
                    {(items || []).map((it, i) => <div key={i}>• {it}</div>)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
