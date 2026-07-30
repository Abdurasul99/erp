import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import AiAnalyze from '../AiAnalyze.jsx';
import { useTt } from '../tt.js';
import { normalizeDecimal } from '../../utils/decimalInput.js';

// «Что если — Финансы»: 3 сценария-калькулятора (открытие филиала / кредит / повышение цен).
// Baseline-цифры приходят с GET /api/finance/whatif-base, ВСЯ математика — на фронте.
// Деньги — UZS полным числом (fmtMoneyFull). Доступ — только учредитель/гендиректор.

// Значения полей хранятся СЫРЫМИ СТРОКАМИ. В onChange — только чистка символов,
// кламп диапазона — на onBlur: коэрсия в onChange не давала ввести «24.5» (на шаге
// «24.» parseFloat давал 24 и React стирал точку) и обрезала «50 000 000» до 50.
// toNum — единственное место превращения строки в число (в расчётах сценариев).
const toNum = (v, def = 0) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : def;
  const s = normalizeDecimal(v);
  if (s === '') return def;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : def;
};
// Приведение к диапазону при уходе из поля. Пустое остаётся пустым (в расчёте это 0).
const normNum = (v, min, max) => {
  const s = normalizeDecimal(v);
  if (s === '') return '';
  let n = parseFloat(s);
  if (!Number.isFinite(n)) return '';
  if (min != null) n = Math.max(min, n);
  if (max != null) n = Math.min(max, n);
  return String(n);
};

// Поле ввода с подписью (число).
// type="text" + inputMode="decimal", а не type="number": на промежуточно-невалидном
// вводе («50 000 000», «24,») Chrome отдаёт пустую строку и поле само себя очищает.
// step у текстового поля стрелок нет — величина шага остаётся только в вызовах.
function NumField({ label, value, onChange, suffix, min, max }) {
  const { tt } = useTt();
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 5 }}>{tt(label)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, ''))}
          onBlur={() => onChange(normNum(value, min, max))}
          style={{
            flex: 1, minWidth: 0, padding: '9px 12px', fontSize: 14, fontWeight: 600,
            border: '1.5px solid var(--border, #E3EAF3)', borderRadius: 10,
            color: 'var(--text)', background: 'var(--bg)',
          }}
        />
        {suffix && <span style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap' }}>{tt(suffix)}</span>}
      </div>
    </label>
  );
}

// Строка результата «подпись → значение»
function ResultRow({ label, value, color, strong }) {
  const { tt } = useTt();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: '1px dashed var(--border, #E3EAF3)', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{tt(label)}</span>
      <span className="mono" style={{ fontSize: strong ? 15.5 : 14, fontWeight: strong ? 800 : 700, color: color || 'var(--text)', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

export default function FinWhatifTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Значения полей — строки (см. NumField), в числа переводит toNum в расчётах.
  // Сценарий 1 — филиал
  const [invest, setInvest] = useState('50000000');
  const [revShare, setRevShare] = useState('60');
  const [branchFixed, setBranchFixed] = useState('8000000');
  // Сценарий 2 — кредит
  const [loanAmount, setLoanAmount] = useState('50000000');
  const [loanRate, setLoanRate] = useState('24');
  const [loanTerm, setLoanTerm] = useState('24');
  // Сценарий 3 — цены
  const [priceUp, setPriceUp] = useState('10');
  const [demandDrop, setDemandDrop] = useState('8');

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/finance/whatif-base', { params })
      .then(r => { if (!ignore) setBase(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId]);

  const b = base || {};
  const curRevenue = parseFloat(b.current_revenue) || 0;
  const curProfit = parseFloat(b.current_profit) || 0;
  const curFixed = parseFloat(b.current_fixed_costs) || 0;
  const cogsRatio = parseFloat(b.cogs_ratio) || 0;       // доля себестоимости в выручке (0..1)
  const curBalance = parseFloat(b.current_balance) || 0;
  const minSafe = parseFloat(b.min_safe_balance) || 0;
  // Прочие переменные расходы кроме себестоимости (выручка − себестоимость − постоянные − прибыль)
  const otherVarRatio = curRevenue > 0 ? Math.max(0, (curRevenue - curRevenue * cogsRatio - curFixed - curProfit) / curRevenue) : 0;

  // === Сценарий 1: открытие филиала ===
  const s1 = useMemo(() => {
    const addRevenue = curRevenue * (Math.max(0, toNum(revShare)) / 100);
    const grossMargin = 1 - cogsRatio - otherVarRatio;       // валовая маржа (доля)
    const addProfit = addRevenue * grossMargin - Math.max(0, toNum(branchFixed));
    const totalProfit = curProfit + addProfit;
    const payback = addProfit > 0 ? Math.max(0, toNum(invest)) / addProfit : null;  // месяцев
    return { addRevenue, addProfit, totalProfit, payback };
  }, [curRevenue, revShare, cogsRatio, otherVarRatio, branchFixed, curProfit, invest]);

  // === Сценарий 2: кредит (аннуитет) ===
  const s2 = useMemo(() => {
    const P = Math.max(0, toNum(loanAmount));
    const n = Math.max(0, toNum(loanTerm));
    const r = (Math.max(0, toNum(loanRate)) / 100) / 12;    // месячная ставка
    let payment;
    if (n <= 0) payment = 0;
    else if (r === 0) payment = P / n;
    else payment = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPaid = payment * n;
    const overpay = totalPaid - P;
    const profitAfter = curProfit - payment;
    // Проверка по подушке безопасности: остаётся ли касса выше минимального безопасного остатка
    const safe = profitAfter >= 0 && (curBalance - payment) >= minSafe;
    return { payment, overpay, profitAfter, totalPaid, safe };
  }, [loanAmount, loanRate, loanTerm, curProfit, curBalance, minSafe]);

  // === Сценарий 3: повышение цен ===
  const s3 = useMemo(() => {
    const up = Math.max(0, toNum(priceUp)) / 100;
    const drop = Math.max(0, toNum(demandDrop)) / 100;
    const qFactor = 1 - drop;                              // объём падает на drop
    const newRevenue = curRevenue * (1 + up) * qFactor;   // цена растёт на up
    // Себестоимость и прочие переменные масштабируются с объёмом, постоянные — без изменений
    const newCogs = curRevenue * cogsRatio * qFactor;
    const newOtherVar = curRevenue * otherVarRatio * qFactor;
    const newProfit = newRevenue - newCogs - newOtherVar - curFixed;
    return { newRevenue, newProfit };
  }, [priceUp, demandDrop, curRevenue, cogsRatio, otherVarRatio, curFixed]);

  return (
    <>
      <PageHeader title={'🔮 ' + tt('Что если — Финансы')} sub={tt('Три сценария на реальных данных · только учредитель')} />

      {loading && !base ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={160} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !curRevenue ? (
        <Card><EmptyState icon="📊" title={tt('Недостаточно данных')} description={tt('Появятся продажи и расходы — сценарии заработают на реальных цифрах.')} /></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="💰" label={tt('Выручка (месяц)')} value={fmtMoneyFull(curRevenue)} sub={tt('сум')} color="#1D4ED8" />
            <Tile icon="📈" label={tt('Прибыль (месяц)')} value={fmtMoneyFull(curProfit)} sub={tt('сум')} color="#16A34A" />
            <Tile icon="🏭" label={tt('Постоянные расходы')} value={fmtMoneyFull(curFixed)} sub={tt('сум')} color="#D97706" />
            <Tile icon="🏦" label={tt('Остаток в кассе')} value={fmtMoneyFull(curBalance)} sub={tt('мин. безопасный') + ' ' + fmtMoneyFull(minSafe)} color="#0EA5E9" />
          </div>

          {/* === Сценарий 1: филиал === */}
          <Card icon="🏪" title={tt('Сценарий 1 — Что если открыть новый филиал')} style={{ marginBottom: 16 }}>
            <div className="grid-2" style={{ gap: 24 }}>
              <div>
                <NumField label="Инвестиции в открытие" value={invest} onChange={setInvest} suffix="сум" min={0} step={1000000} />
                <NumField label="Ожидаемая выручка (% от текущей)" value={revShare} onChange={setRevShare} suffix="%" min={0} max={300} step={5} />
                <NumField label="Постоянные расходы филиала / мес" value={branchFixed} onChange={setBranchFixed} suffix="сум" min={0} step={500000} />
              </div>
              <div>
                <ResultRow label="Доп. выручка / мес" value={fmtMoneyFull(s1.addRevenue)} color="#1D4ED8" />
                <ResultRow label="Доп. прибыль / мес" value={(s1.addProfit >= 0 ? '+' : '') + fmtMoneyFull(s1.addProfit)} color={s1.addProfit >= 0 ? 'var(--green)' : 'var(--red)'} />
                <ResultRow label="Общая прибыль / мес" value={fmtMoneyFull(s1.totalProfit)} strong />
                <ResultRow label="Окупаемость" value={s1.payback != null ? Math.ceil(s1.payback) + ' ' + tt('мес') : '—'} color="#D97706" strong />
                <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: 'var(--text2)' }}>
                  {s1.addProfit <= 0
                    ? <span style={{ color: 'var(--red)' }}>⚠️ {tt('При таких параметрах филиал убыточен — пересмотрите выручку или расходы.')}</span>
                    : s1.payback <= 18
                      ? <span style={{ color: 'var(--green)' }}>✅ {tt('Окупается быстро — открытие выглядит выгодным.')}</span>
                      : <span style={{ color: 'var(--orange)' }}>⏳ {tt('Окупаемость долгая — оцените риски перед запуском.')}</span>}
                </div>
              </div>
            </div>
          </Card>

          {/* === Сценарий 2: кредит === */}
          <Card icon="🏦" title={tt('Сценарий 2 — Что если взять кредит')} style={{ marginBottom: 16 }}>
            <div className="grid-2" style={{ gap: 24 }}>
              <div>
                <NumField label="Сумма кредита" value={loanAmount} onChange={setLoanAmount} suffix="сум" min={0} step={1000000} />
                {/* Верхняя граница ставки — 100% годовых: раньше здесь стояло max=24
                    (совпадало со значением по умолчанию) и ставку 24.5% ввести было нельзя. */}
                <NumField label="Ставка (% годовых)" value={loanRate} onChange={setLoanRate} suffix="%" min={0} max={100} step={1} />
                <NumField label="Срок (месяцев)" value={loanTerm} onChange={setLoanTerm} suffix="мес" min={1} max={120} step={1} />
              </div>
              <div>
                <ResultRow label="Платёж / мес" value={fmtMoneyFull(s2.payment)} color="#D97706" strong />
                <ResultRow label="Переплата итого" value={fmtMoneyFull(s2.overpay)} color="var(--red)" />
                <ResultRow label="Прибыль после выплат" value={(s2.profitAfter >= 0 ? '+' : '') + fmtMoneyFull(s2.profitAfter)} color={s2.profitAfter >= 0 ? 'var(--green)' : 'var(--red)'} strong />
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{tt('Потянем?')}</span>
                  <Badge tone={s2.safe ? 'green' : 'red'}>{s2.safe ? tt('Да, касса выдержит') : tt('Рискованно')}</Badge>
                </div>
                <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text2)' }}>
                  {s2.safe
                    ? tt('После платежа остаток в кассе остаётся выше минимального безопасного уровня.')
                    : tt('После платежа касса опускается ниже безопасного остатка или прибыль уходит в минус — высокий риск.')}
                </div>
              </div>
            </div>
          </Card>

          {/* === Сценарий 3: цены === */}
          <Card icon="📈" title={tt('Сценарий 3 — Что если поднять цены')} style={{ marginBottom: 16 }}>
            <div className="grid-2" style={{ gap: 24 }}>
              <div>
                <NumField label="Повышение цен" value={priceUp} onChange={setPriceUp} suffix="%" min={0} max={100} step={1} />
                <NumField label="Ожидаемое падение спроса" value={demandDrop} onChange={setDemandDrop} suffix="%" min={0} max={100} step={1} />
              </div>
              <div>
                <ResultRow label="Текущая выручка" value={fmtMoneyFull(curRevenue)} />
                <ResultRow label="Новая выручка" value={fmtMoneyFull(s3.newRevenue)} color="#1D4ED8" strong />
                <ResultRow label="Текущая прибыль" value={fmtMoneyFull(curProfit)} />
                <ResultRow label="Новая прибыль" value={(s3.newProfit >= 0 ? '+' : '') + fmtMoneyFull(s3.newProfit)} color={s3.newProfit >= curProfit ? 'var(--green)' : 'var(--red)'} strong />
                <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: 'var(--text2)' }}>
                  {s3.newProfit > curProfit
                    ? <span style={{ color: 'var(--green)' }}>✅ {tt('Стоит поднимать — прибыль растёт даже с учётом падения спроса.')}</span>
                    : <span style={{ color: 'var(--red)' }}>⚠️ {tt('Не стоит — падение спроса съедает выигрыш от цены.')}</span>}
                </div>
              </div>
            </div>
          </Card>

          <Card icon="🧮" title={tt('Как это считается')} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.7 }}>
              {tt('Базовые цифры — выручка, прибыль, постоянные расходы, доля себестоимости и остаток в кассе — берутся из реальных продаж и кассы за месяц. Вся математика сценариев считается у вас в браузере, ничего не сохраняется.')}
            </div>
          </Card>

          <AiAnalyze topic="finance-whatif" branchId={branchId} />
        </>
      )}
    </>
  );
}
