import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// «Что если — Продажи»: 5 сценариев. Бэкенд отдаёт baseline,
// вся математика сценариев — на фронте (без новых таблиц).

const PRIMARY = 'var(--primary)';

function NumField({ label, value, onChange, suffix, step = 1 }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 130 }}>
      <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 8,
            border: '1px solid var(--border, #E3EAF3)', fontSize: 14, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg, #fff)', color: 'var(--text)',
          }}
        />
        {suffix && <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 700 }}>{suffix}</span>}
      </div>
    </label>
  );
}

function Row({ label, value, strong, color }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '7px 0', borderBottom: '1px dashed var(--border, #E3EAF3)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>
      <span className="mono" style={{
        fontSize: strong ? 16 : 14, fontWeight: strong ? 900 : 700,
        color: color || 'var(--text)',
      }}>{value}</span>
    </div>
  );
}

function Conclusion({ ok, children }) {
  const { tt } = useTt();
  const tone = ok == null ? 'var(--text2)' : ok ? '#16A34A' : '#DC2626';
  const bg = ok == null ? 'rgba(120,130,150,.08)' : ok ? 'rgba(22,163,74,.10)' : 'rgba(220,38,38,.10)';
  return (
    <div style={{
      marginTop: 12, padding: '10px 12px', borderRadius: 10, background: bg,
      fontSize: 12.5, fontWeight: 700, color: tone, lineHeight: 1.45,
    }}>
      {ok == null ? '' : ok ? `✅ ${tt('Вывод')}: ` : `⚠️ ${tt('Вывод')}: `}{children}
    </div>
  );
}

const pct = (v) => `${(Math.round((parseFloat(v) || 0) * 10) / 10).toLocaleString('ru-RU')}%`;

export default function SalesWhatifTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/sales/whatif-base', { params })
      .then(r => setBase(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  // ----- scenario inputs -----
  const [priceDelta, setPriceDelta] = useState(-10);   // %
  const [demandDelta, setDemandDelta] = useState(15);  // %
  const [discount, setDiscount] = useState(15);        // %
  const [salesGrowth, setSalesGrowth] = useState(30);  // %
  const [newClientsGrowth, setNewClientsGrowth] = useState(20); // %
  const [conversion, setConversion] = useState(15);    // %
  const [recoveryRate, setRecoveryRate] = useState(20);// %
  const [recoveredCheck, setRecoveredCheck] = useState(45000);

  // sync defaults from baseline once loaded
  useEffect(() => {
    if (base?.best_seller_avg_check) setRecoveredCheck(Math.round(base.avg_check || 45000));
  }, [base]);

  const b = base || {};
  const monthlyRevenue = b.current_revenue || 0;      // за 30 дней
  const costRatio = b.cost_ratio != null ? b.cost_ratio : 0.5; // доля себестоимости (0..1)
  const marginRatio = 1 - costRatio;

  // --- Scenario 2: discount promo ---
  const s2 = useMemo(() => {
    const revNo = monthlyRevenue;
    const profitNo = revNo * marginRatio;
    const newQtyFactor = 1 + (salesGrowth || 0) / 100;
    const priceFactor = 1 - (discount || 0) / 100;
    const revWith = revNo * newQtyFactor * priceFactor;
    // себестоимость растёт с количеством, цена-скидка её не меняет
    const costWith = revNo * costRatio * newQtyFactor;
    const profitWith = revWith - costWith;
    return { revNo, profitNo, revWith, profitWith, ok: profitWith >= profitNo };
  }, [monthlyRevenue, marginRatio, costRatio, salesGrowth, discount]);

  // --- Scenario 1: price change (на всей выручке) ---
  const s1 = useMemo(() => {
    const revNo = monthlyRevenue;
    const profitNo = revNo * marginRatio;
    const priceFactor = 1 + (priceDelta || 0) / 100;
    const qtyFactor = 1 + (demandDelta || 0) / 100;
    const revWith = revNo * priceFactor * qtyFactor;
    const costWith = revNo * costRatio * qtyFactor;
    const profitWith = revWith - costWith;
    const newMargin = revWith > 0 ? (profitWith / revWith) * 100 : 0;
    return { revNo, profitNo, revWith, profitWith, newMargin, ok: profitWith >= profitNo };
  }, [monthlyRevenue, marginRatio, costRatio, priceDelta, demandDelta]);

  // --- Scenario 3: align sellers to best ---
  const s3 = useMemo(() => {
    const sellers = b.sellers_count || 0;
    const ordersDay = b.orders_per_day || 0;
    const avgCheck = b.avg_check || 0;
    const bestCheck = b.best_seller_avg_check || avgCheck;
    const dailyNow = ordersDay * avgCheck;
    const dailyIfBest = ordersDay * bestCheck;
    const dailyGain = dailyIfBest - dailyNow;
    const monthlyGain = dailyGain * 30;
    return { sellers, dailyNow, dailyIfBest, dailyGain, monthlyGain, bestCheck, avgCheck };
  }, [b]);

  // --- Scenario 4: new customer acquisition ---
  const s4 = useMemo(() => {
    const cur = b.new_clients_per_month || 0;
    const projected = cur * (1 + (newClientsGrowth || 0) / 100);
    const newRegulars = projected * (conversion || 0) / 100;
    const ltv = b.avg_ltv || 0;
    const ltvBaseGrowth = newRegulars * ltv;
    // доп. месячная выручка от новых клиентов: новые клиенты × средний чек
    const monthlyExtra = (projected - cur) * (b.avg_check || 0);
    return { cur, projected, newRegulars, ltvBaseGrowth, monthlyExtra };
  }, [b, newClientsGrowth, conversion]);

  // --- Scenario 5: reactivate sleeping ---
  const s5 = useMemo(() => {
    const sleeping = b.sleeping_clients || 0;
    const recovered = sleeping * (recoveryRate || 0) / 100;
    const revenue = recovered * (recoveredCheck || 0);
    const ltv = b.avg_ltv || 0;
    const restoredLtv = recovered * ltv;
    return { sleeping, recovered, revenue, restoredLtv };
  }, [b, recoveryRate, recoveredCheck]);

  return (
    <>
      <PageHeader
        title={tt('🔮 Что если — Продажи')}
        sub={tt('5 сценариев на ваших данных · 30 дней · суммы в UZS')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : !base ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">📭</div><div>{tt('Нет данных')}</div></div></Card>
      ) : (
        <>
          {/* Baseline tiles */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="💰" label={tt('Выручка / мес')} value={fmtMoneyFull(monthlyRevenue)} sub="UZS · 30 дн" color={PRIMARY} />
            <Tile icon="🧾" label={tt('Средний чек')} value={fmtMoneyFull(b.avg_check)} sub="UZS" color="#1D4ED8" />
            <Tile icon="📦" label={tt('Заказов / день')} value={fmtNum(b.orders_per_day)} sub={`${tt('продавцов')}: ${fmtNum(b.sellers_count)}`} color="#16A34A" />
            <Tile icon="🏷️" label={tt('Доля себестоимости')} value={pct(costRatio * 100)} sub={`${tt('маржа')} ${pct(marginRatio * 100)}`} color="#D97706" />
          </div>

          {/* Scenario 1 */}
          <Card icon="🏷️" title={tt('Сценарий 1 · Изменение цены')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <NumField label={tt('Изменение цены')} value={priceDelta} onChange={setPriceDelta} suffix="%" />
              <NumField label={tt('Изменение спроса')} value={demandDelta} onChange={setDemandDelta} suffix="%" />
            </div>
            <Row label={tt('Выручка сейчас / мес')} value={`${fmtMoneyFull(s1.revNo)} UZS`} />
            <Row label={tt('Новая выручка / мес')} value={`${fmtMoneyFull(s1.revWith)} UZS`} strong color={PRIMARY} />
            <Row label={tt('Прибыль сейчас / мес')} value={`${fmtMoneyFull(s1.profitNo)} UZS`} />
            <Row label={tt('Новая прибыль / мес')} value={`${fmtMoneyFull(s1.profitWith)} UZS`} strong color={s1.ok ? '#16A34A' : '#DC2626'} />
            <Row label={tt('Новая маржа')} value={pct(s1.newMargin)} />
            <Conclusion ok={s1.ok}>
              {s1.ok
                ? tt('изменение увеличивает прибыль — можно тестировать')
                : tt('изменение снижает прибыль — рискованно')}
            </Conclusion>
          </Card>

          {/* Scenario 2 */}
          <Card icon="🎟️" title={tt('Сценарий 2 · Скидочная акция')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <NumField label={tt('Размер скидки')} value={discount} onChange={setDiscount} suffix="%" />
              <NumField label={tt('Ожидаемый рост продаж')} value={salesGrowth} onChange={setSalesGrowth} suffix="%" />
            </div>
            <Row label={tt('Выручка без акции')} value={`${fmtMoneyFull(s2.revNo)} UZS`} />
            <Row label={tt('Выручка с акцией')} value={`${fmtMoneyFull(s2.revWith)} UZS`} strong color={PRIMARY} />
            <Row label={tt('Прибыль без акции')} value={`${fmtMoneyFull(s2.profitNo)} UZS`} />
            <Row label={tt('Прибыль с акцией')} value={`${fmtMoneyFull(s2.profitWith)} UZS`} strong color={s2.ok ? '#16A34A' : '#DC2626'} />
            <Conclusion ok={s2.ok}>
              {s2.ok
                ? tt('акция выгодна — прибыль не падает')
                : tt('акция съедает прибыль — нужен больший рост продаж')}
            </Conclusion>
          </Card>

          {/* Scenario 3 */}
          <Card icon="🧑‍💼" title={tt('Сценарий 3 · Подтянуть продавцов к лучшему')} style={{ marginBottom: 16 }}>
            <div className="grid-4" style={{ marginBottom: 14 }}>
              <Tile icon="🧾" label={tt('Средний чек команды')} value={fmtMoneyFull(s3.avgCheck)} sub="UZS" />
              <Tile icon="🏆" label={tt('Чек лучшего')} value={fmtMoneyFull(s3.bestCheck)} sub="UZS" color="#16A34A" />
              <Tile icon="👥" label={tt('Продавцов')} value={fmtNum(s3.sellers)} />
              <Tile icon="📦" label={tt('Заказов / день')} value={fmtNum(b.orders_per_day)} />
            </div>
            <Row label={tt('Выручка / день сейчас')} value={`${fmtMoneyFull(s3.dailyNow)} UZS`} />
            <Row label={tt('Выручка / день если все как лучший')} value={`${fmtMoneyFull(s3.dailyIfBest)} UZS`} strong color={PRIMARY} />
            <Row label={tt('Прирост / день')} value={`${fmtMoneyFull(s3.dailyGain)} UZS`} color="#16A34A" />
            <Row label={tt('Прирост / мес')} value={`${fmtMoneyFull(s3.monthlyGain)} UZS`} strong color="#16A34A" />
            <Conclusion ok={s3.monthlyGain > 0}>
              {s3.monthlyGain > 0
                ? tt('обучение команды до уровня лучшего даёт ощутимый прирост')
                : tt('команда уже работает на уровне лучшего')}
            </Conclusion>
          </Card>

          {/* Scenario 4 */}
          <Card icon="🆕" title={tt('Сценарий 4 · Привлечение новых клиентов')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <NumField label={tt('Рост новых клиентов')} value={newClientsGrowth} onChange={setNewClientsGrowth} suffix="%" />
              <NumField label={tt('Конверсия в постоянных')} value={conversion} onChange={setConversion} suffix="%" />
            </div>
            <Row label={tt('Новых клиентов сейчас / мес')} value={fmtNum(Math.round(s4.cur))} />
            <Row label={tt('Прогноз новых / мес')} value={fmtNum(Math.round(s4.projected))} strong color={PRIMARY} />
            <Row label={tt('Станут постоянными')} value={fmtNum(Math.round(s4.newRegulars))} color="#16A34A" />
            <Row label={tt('Прирост базы LTV')} value={`${fmtMoneyFull(s4.ltvBaseGrowth)} UZS`} strong color="#16A34A" />
            <Row label={tt('Доп. выручка / мес')} value={`${fmtMoneyFull(s4.monthlyExtra)} UZS`} color={PRIMARY} />
            <Conclusion ok={s4.monthlyExtra > 0}>
              {tt('каждый постоянный клиент приносит средний LTV')}: {fmtMoneyFull(b.avg_ltv)} UZS
            </Conclusion>
          </Card>

          {/* Scenario 5 */}
          <Card icon="😴" title={tt('Сценарий 5 · Реактивация спящих клиентов')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <NumField label={tt('Спящих клиентов')} value={s5.sleeping} onChange={() => {}} />
              <NumField label={tt('Доля возврата')} value={recoveryRate} onChange={setRecoveryRate} suffix="%" />
              <NumField label={tt('Чек возвращённого')} value={recoveredCheck} onChange={setRecoveredCheck} step={1000} suffix="UZS" />
            </div>
            <Row label={tt('Спящих клиентов в базе')} value={fmtNum(Math.round(s5.sleeping))} />
            <Row label={tt('Вернётся клиентов')} value={fmtNum(Math.round(s5.recovered))} strong color={PRIMARY} />
            <Row label={tt('Выручка от реактивации')} value={`${fmtMoneyFull(s5.revenue)} UZS`} strong color="#16A34A" />
            <Row label={tt('Восстановленный LTV')} value={`${fmtMoneyFull(s5.restoredLtv)} UZS`} color="#16A34A" />
            <Conclusion ok={s5.revenue > 0}>
              {s5.revenue > 0
                ? tt('кампания возврата окупается — спящая база это «горячий» резерв')
                : tt('нет спящих клиентов для возврата')}
            </Conclusion>
          </Card>
        </>
      )}
    </>
  );
}
