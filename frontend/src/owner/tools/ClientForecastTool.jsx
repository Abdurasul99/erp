import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, EmptyState, fmtMoney, fmtNum, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Цвет дельты: рост зелёный, падение красный, ноль серый.
const deltaColor = (d) => (d > 0 ? '#16a34a' : d < 0 ? '#DC2626' : 'var(--text3)');
const deltaStr = (d) => (d > 0 ? `+${fmtNum(d)}` : d < 0 ? `${fmtNum(d)}` : '0');

const URGENCY = {
  high:   { tone: 'red',    label: 'Срочно' },
  medium: { tone: 'yellow', label: 'Важно' },
  low:    { tone: 'blue',   label: 'Плановое' },
};
const TYPE_LABEL = {
  reactivation:  'Реактивация',
  mass_campaign: 'Массовая кампания',
};

export default function ClientForecastTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [horizon, setHorizon] = useState('month');
  const [creatingRec, setCreatingRec] = useState(null);
  const [recMsg, setRecMsg] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { horizon };
    if (branchId) params.branch_id = branchId; // на сервере не применяется (RFM — компанийный)
    api.get('/crm/forecast', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, horizon]);

  // Рекомендация → задача: замыкает прогноз RFM на исполнение (поручение в «Задачи»).
  const createRecTask = (r, i) => {
    setCreatingRec(i); setRecMsg(null);
    const prio = r.urgency === 'high' ? 'high' : (r.urgency === 'low' ? 'low' : 'medium');
    const title = `${tt('Реактивация сегмента')}: ${tt(r.label)} (${fmtNum(r.customer_count)} ${tt('клиентов')})`;
    const description = `${tt(r.action)}. ${tt('Выручка под риском')}: ${fmtMoneyFull(r.revenue_at_risk)}.`;
    api.post('/tasks', { title, description, priority: prio })
      .then(() => setRecMsg({ tone: 'green', text: tt('✓ Задача создана — см. «Задачи / Поручения»') }))
      .catch(e => setRecMsg({ tone: 'red', text: e.response?.data?.error || e.message }))
      .finally(() => { setCreatingRec(null); setTimeout(() => setRecMsg(null), 4000); });
  };

  const summary = data?.summary || {};
  const bySegment = data?.by_segment || [];
  const recs = data?.recommendations || [];
  const enough = !!data?.enough_data;

  const horizonOpts = [
    { value: 'month', label: tt('1 месяц') },
    { value: '6m', label: tt('6 месяцев') },
  ];

  return (
    <>
      <PageHeader
        title={tt('🔮 Прогноз клиентской базы')}
        sub={tt('Матрица переходов RFM · отток · рост · что сделать сейчас')}
        actions={<Pills value={horizon} onChange={setHorizon} options={horizonOpts} />}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}
      {recMsg && <div style={{ marginBottom: 12 }}><Badge tone={recMsg.tone}>{recMsg.text}</Badge></div>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : !data ? (
        <Card><EmptyState icon="📊" title={tt('Нет данных')} description={tt('Прогноз не получен от сервера. Попробуйте позже.')} /></Card>
      ) : (
        <>
          {!enough && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 26 }}>📈</span>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 800, marginBottom: 2 }}>{tt('Копим историю для прогноза')}</div>
                  <div style={{ color: 'var(--text2)' }}>
                    {tt('Прогноз строится на матрице переходов между месяцами. Сейчас собрано периодов:')}{' '}
                    <b>{data.periods_collected || 0}</b>. {tt('Нужно минимум 2 месяца снапшотов RFM. Ниже — текущее распределение базы.')}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Сводка прогноза */}
          {enough && (
            <div className="grid-4" style={{ marginBottom: 16 }}>
              <Tile icon="🆕" label={tt('Новых клиентов (прогноз)')} value={fmtNum(summary.new_customers || 0)}
                sub={tt('приток за горизонт')} color="#3B82F6" />
              <Tile icon="👋" label={tt('Уйдут в потерянные')} value={fmtNum(summary.lost_customers || 0)}
                sub={tt('прогноз оттока')} color="#DC2626" />
              <Tile icon="📊" label={tt('Чистый прирост')} value={deltaStr(summary.net_growth || 0)}
                sub={tt('итог по базе')} color={(summary.net_growth || 0) >= 0 ? '#16a34a' : '#DC2626'} />
              <Tile icon="💰" label={tt('Прогноз LTV новых')} value={fmtMoney(summary.avg_new_ltv || 0)}
                sub={tt('средний на клиента')} color="#D97706" />
            </div>
          )}

          {/* Прогноз по сегментам */}
          <Card icon="🧭" title={tt('Прогноз по сегментам')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Сегмент')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Сейчас')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Прогноз')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Изменение')}</th>
                    <th>{tt('Причина')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bySegment.map(s => (
                    <tr key={s.segment}>
                      <td style={{ fontWeight: 700 }}><Badge tone={s.tone}>{s.icon} {tt(s.label)}</Badge></td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(s.current)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(s.forecast)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: deltaColor(s.change) }}>
                        {deltaStr(s.change)}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{tt(s.reason)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Рекомендации */}
          {enough && (
            <Card icon="🎯" title={tt('Что сделать прямо сейчас')}>
              {recs.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>
                  {tt('Сегментов в зоне риска нет — база здоровая')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recs.map((r, i) => {
                    const u = URGENCY[r.urgency] || URGENCY.medium;
                    return (
                      <div key={i} style={{
                        border: '1px solid var(--border)', borderRadius: 12, padding: 14,
                        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
                      }}>
                        <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                            <Badge tone={u.tone}>{tt(u.label)}</Badge>
                            <Badge tone={r.tone}>{r.icon} {tt(r.label)}</Badge>
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
                              {tt(TYPE_LABEL[r.type] || r.type)}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{tt(r.action)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('Клиентов')}</div>
                          <div className="mono" style={{ fontWeight: 800 }}>{fmtNum(r.customer_count)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('Выручка под риском')}</div>
                          <div className="mono" style={{ fontWeight: 800, color: '#DC2626' }}>{fmtMoneyFull(r.revenue_at_risk)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('Ожид. реактивация')}</div>
                          <div className="mono" style={{ fontWeight: 800, color: '#16a34a' }}>{fmtNum(r.expected_reactivation)}</div>
                        </div>
                        <button className="btn btn-sm" disabled={creatingRec === i}
                          title={tt('Создать поручение по этому сегменту')}
                          onClick={() => createRecTask(r, i)} style={{ alignSelf: 'center', flexShrink: 0 }}>
                          {creatingRec === i ? tt('...') : tt('📋 Поставить задачу')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </>
  );
}