import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoney, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';
import { Modal } from '../Modal.jsx';

// Цвет lift: чем выше — тем «крепче» связь.
function liftTone(lift) {
  if (lift >= 3) return 'green';
  if (lift >= 2) return 'blue';
  return 'amber';
}
function confColor(v) {
  if (v >= 60) return 'rgba(22,163,74,.85)';
  if (v >= 45) return 'rgba(34,197,94,.55)';
  if (v >= 30) return 'rgba(245,158,11,.55)';
  return 'rgba(148,163,184,.45)';
}

export default function BasketTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Модалка рекомендаций по товару.
  const [recProduct, setRecProduct] = useState(null); // { id, name }
  const [recData, setRecData] = useState(null);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/analytics/basket/pairs', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  function openRecommend(productId, name) {
    setRecProduct({ id: productId, name });
    setRecData(null); setRecLoading(true);
    const params = { product_id: productId };
    if (branchId) params.branch_id = branchId;
    api.get('/analytics/basket/recommend', { params })
      .then(r => setRecData(r.data))
      .catch(e => setRecData({ error: e.response?.data?.error || e.message, recommendations: [] }))
      .finally(() => setRecLoading(false));
  }

  const summary = data?.summary || {};
  const pairs = data?.pairs || [];
  const th = summary.thresholds || {};

  return (
    <>
      <PageHeader
        title={tt('🧺 Анализ корзины')}
        sub={tt('Какие товары покупают вместе · support · confidence · lift')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && (
        <Card><div style={{ color: 'var(--red)' }}>⚠️ {error}</div></Card>
      )}

      {loading ? (
        <Card>
          <Skeleton width="40%" height={18} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={120} />
        </Card>
      ) : pairs.length === 0 ? (
        <EmptyState
          icon="🧺"
          title={tt('Пока нет устойчивых пар')}
          description={tt('Пары появятся, когда наберётся достаточно совместных покупок (≥5 совпадений, support ≥1%, lift >1.5). Источник — одобренные продажи, где в один момент клиенту продано несколько товаров.')}
        />
      ) : (
        <>
          {/* Сводка */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🔗" label={tt('Найдено пар')} value={fmtNum(summary.pair_count)} color="#1D4ED8"
              sub={tt('прошли пороги')} />
            <Tile icon="💪" label={tt('Крепких связей')} value={fmtNum(summary.strong_pairs)} color="#16a34a"
              sub={tt('lift ≥ 3')} />
            <Tile icon="🧺" label={tt('Корзин в анализе')} value={fmtNum(summary.baskets_total)} color="#1D4ED8"
              sub={tt('многотоварных')} />
            <Tile icon="💰" label={tt('Средний чек пары')} value={fmtMoney(summary.avg_pair_check)} color="#D97706" />
          </div>

          {/* Пояснение приближения */}
          <Card style={{ marginBottom: 16, borderColor: 'rgba(245,158,11,.30)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.5 }}>
              <span style={{ fontSize: 18 }}>ℹ️</span>
              <div style={{ color: 'var(--text2)' }}>
                {tt('«Корзина» определяется как товары, проданные одним продавцом одному клиенту в один момент времени (по минуте), так как в продажах нет единого номера чека. Это близкое приближение реального чека.')}
                <div style={{ marginTop: 4, color: 'var(--text3)' }}>
                  {tt('Пороги')}: support ≥ {th.support_min}% · confidence ≥ {th.confidence_min}% · {tt('совпадений')} ≥ {th.together_min} · lift &gt; {th.lift_min}
                </div>
              </div>
            </div>
          </Card>

          {/* Таблица пар */}
          <Card icon="🔗" title={tt('Топ пар совместно покупаемых товаров')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Товар A')}</th>
                    <th>{tt('Товар B')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Вместе')}</th>
                    <th style={{ textAlign: 'right' }} title={tt('% корзин, где встретилась пара')}>{tt('Support')}</th>
                    <th style={{ textAlign: 'center' }} title={tt('P(B|A) — если купили A, вероятность купить B')}>{tt('A→B')}</th>
                    <th style={{ textAlign: 'center' }} title={tt('P(A|B)')}>{tt('B→A')}</th>
                    <th style={{ textAlign: 'right' }} title={tt('Во сколько раз связь крепче случайной')}>{tt('Lift')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Средний чек')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, maxWidth: 180 }}>{p.name_a}</td>
                      <td style={{ fontWeight: 600, maxWidth: 180 }}>{p.name_b}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(p.together_count)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{p.support}%</td>
                      <td style={{ textAlign: 'center', background: confColor(p.confidence_a_b), color: p.confidence_a_b >= 45 ? '#fff' : 'var(--text)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 700, borderRadius: 4 }}>{p.confidence_a_b}%</td>
                      <td style={{ textAlign: 'center', background: confColor(p.confidence_b_a), color: p.confidence_b_a >= 45 ? '#fff' : 'var(--text)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 700, borderRadius: 4 }}>{p.confidence_b_a}%</td>
                      <td style={{ textAlign: 'right' }}><Badge tone={liftTone(p.lift)}>×{p.lift}</Badge></td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(p.avg_basket_uzs)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openRecommend(p.product_a_id, p.name_a)} title={tt('Что докупают к этому товару')}>
                          {tt('К A →')}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openRecommend(p.product_b_id, p.name_b)} title={tt('Что докупают к этому товару')}>
                          {tt('К B →')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text3)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span><b>Support</b> — {tt('доля корзин с парой')}</span>
              <span><b>A→B</b> — {tt('если купили A, как часто берут B')}</span>
              <span><b>Lift</b> — {tt('× к случайной вероятности (>1 = связь есть)')}</span>
            </div>
          </Card>
        </>
      )}

      {/* Модалка: рекомендации к товару (POS-сценарий «докупите ещё») */}
      <Modal
        open={!!recProduct}
        onClose={() => setRecProduct(null)}
        title={recProduct ? `${tt('Докупают к')}: ${recProduct.name}` : ''}
        icon="🧺"
        width={600}
      >
        {recLoading ? (
          <Skeleton width="100%" height={120} />
        ) : recData?.error ? (
          <div style={{ color: 'var(--red)' }}>⚠️ {recData.error}</div>
        ) : (recData?.recommendations || []).length === 0 ? (
          <EmptyState icon="🤷" title={tt('Нет рекомендаций')}
            description={tt('Для этого товара пока нет устойчивых пар выше порогов.')} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{tt('Товар')}</th>
                <th style={{ textAlign: 'right' }}>{tt('Цена')}</th>
                <th style={{ textAlign: 'center' }}>{tt('Вероятность')}</th>
                <th style={{ textAlign: 'right' }}>{tt('Lift')}</th>
                <th style={{ textAlign: 'right' }}>{tt('Вместе')}</th>
              </tr>
            </thead>
            <tbody>
              {(recData?.recommendations || []).map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(r.price_sell)}</td>
                  <td style={{ textAlign: 'center', background: confColor(r.confidence), color: r.confidence >= 45 ? '#fff' : 'var(--text)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, borderRadius: 4 }}>{r.confidence}%</td>
                  <td style={{ textAlign: 'right' }}><Badge tone={liftTone(r.lift)}>×{r.lift}</Badge></td>
                  <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(r.together_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </>
  );
}