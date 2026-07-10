import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// «Что если — Персонал»: считаем последствия HR-решений ДО их принятия.
// Бэкенд даёт baseline (ФОТ, выручка, маржа, средняя ЗП продавца, рабочих дней),
// три сценария считаются на фронте от этих базовых чисел.

function NumInput({ value, onChange, suffix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        style={{
          flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 10,
          border: '1.5px solid var(--border, #E3EAF3)', background: 'var(--bg, #fff)',
          color: 'var(--text)', fontSize: 14, fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      />
      {suffix && <span style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{suffix}</span>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

function ResultRow({ label, value, strong, color }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '8px 0', borderBottom: '1px dashed var(--border, #E3EAF3)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>
      <span className="mono" style={{
        fontSize: strong ? 16 : 14, fontWeight: strong ? 800 : 700,
        color: color || 'var(--text)',
      }}>{value}</span>
    </div>
  );
}

export default function HrWhatifTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Сценарий 1 — повышение ЗП
  const [raisePct, setRaisePct] = useState(10);
  const [salesGrowth, setSalesGrowth] = useState(8);

  // Сценарий 2 — найм нового продавца
  const [hireSalary, setHireSalary] = useState(0);
  const [hireCommission, setHireCommission] = useState(5);
  const [hireDailyRev, setHireDailyRev] = useState(0);
  const [hireDays, setHireDays] = useState(0);

  // Сценарий 3 — пересборка мотивации
  const [oldBase, setOldBase] = useState(0);
  const [oldCommission, setOldCommission] = useState(5);
  const [newBase, setNewBase] = useState(0);
  const [newCommission, setNewCommission] = useState(10);
  const [sellerRevenue, setSellerRevenue] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/hr/whatif-base', { params })
      .then(r => {
        if (ignore) return;
        const d = r.data || {};
        setBase(d);
        // Префилл инпутов разумными значениями из baseline
        setHireSalary(Math.round(d.avg_seller_salary || 0));
        setHireDailyRev(Math.round((d.revenue_month || 0) / Math.max(d.work_days || 22, 1) / Math.max(d.sellers_count || 1, 1)));
        setHireDays(d.work_days || 22);
        setOldBase(Math.round(d.avg_seller_salary || 0));
        setNewBase(Math.round((d.avg_seller_salary || 0) * 0.6));
        setSellerRevenue(Math.round((d.revenue_month || 0) / Math.max(d.sellers_count || 1, 1)));
      })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId]);

  const margin = base ? (base.gross_margin_pct || 0) / 100 : 0;
  const payroll = base?.payroll_month || 0;
  const revenue = base?.revenue_month || 0;

  // ── Сценарий 1: повышение ЗП ──
  const s1 = useMemo(() => {
    const newPayroll = payroll * (1 + (raisePct || 0) / 100);
    const extraCost = newPayroll - payroll;
    const extraRevenue = revenue * ((salesGrowth || 0) / 100);
    const extraProfit = extraRevenue * margin;
    const net = extraProfit - extraCost;
    return { newPayroll, extraCost, extraRevenue, extraProfit, net };
  }, [payroll, revenue, margin, raisePct, salesGrowth]);

  // ── Сценарий 2: найм нового продавца ──
  const s2 = useMemo(() => {
    const monthRevenue = (hireDailyRev || 0) * (hireDays || 0);
    const grossProfit = monthRevenue * margin;
    const commissionCost = monthRevenue * ((hireCommission || 0) / 100);
    const totalCost = (hireSalary || 0) + commissionCost;
    const net = grossProfit - totalCost;
    return { monthRevenue, grossProfit, commissionCost, totalCost, net };
  }, [hireDailyRev, hireDays, margin, hireCommission, hireSalary]);

  // ── Сценарий 3: пересборка мотивации ──
  const s3 = useMemo(() => {
    const oldPay = (oldBase || 0) + (sellerRevenue || 0) * ((oldCommission || 0) / 100);
    const newPay = (newBase || 0) + (sellerRevenue || 0) * ((newCommission || 0) / 100);
    const diff = newPay - oldPay;
    return { oldPay, newPay, diff };
  }, [oldBase, oldCommission, newBase, newCommission, sellerRevenue]);

  return (
    <>
      <PageHeader title={tt('🤔 Что если — Персонал')} sub={tt('Считаем последствия HR-решений до их принятия')} />

      {loading && !base ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !base || (!payroll && !revenue) ? (
        <Card>
          <EmptyState
            icon="🤷"
            title={tt('Недостаточно данных')}
            description={tt('Нет продаж или сотрудников для расчёта базы. Добавьте сотрудников и продажи.')}
          />
        </Card>
      ) : (
        <>
          {/* Baseline */}
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile icon="💰" label={tt('ФОТ (оценка)')} value={fmtMoneyFull(payroll)} sub={tt('сум/мес')} color="#9333EA" />
            <Tile icon="📈" label={tt('Выручка')} value={fmtMoneyFull(revenue)} sub={tt('сум/мес')} color="#16A34A" />
            <Tile icon="🧮" label={tt('Валовая маржа')} value={`${(base.gross_margin_pct || 0).toFixed(0)}%`} sub={tt('средняя')} color="#0EA5E9" />
            <Tile icon="🧑‍💼" label={tt('Ср. ЗП продавца')} value={fmtMoneyFull(base.avg_seller_salary || 0)} sub={`${base.work_days || 22} ${tt('раб. дней')}`} color="#D97706" />
          </div>

          {/* Сценарий 1 */}
          <Card icon="📊" title={tt('Сценарий 1 · Повышение зарплат')} style={{ marginBottom: 18 }}>
            <div className="grid-2" style={{ gap: 24 }}>
              <div>
                <Field label={tt('Повышение ЗП, %')}>
                  <NumInput value={raisePct} onChange={setRaisePct} suffix="%" />
                </Field>
                <Field label={tt('Ожидаемый рост продаж от мотивации, %')}>
                  <NumInput value={salesGrowth} onChange={setSalesGrowth} suffix="%" />
                </Field>
              </div>
              <div>
                <ResultRow label={tt('Новый ФОТ')} value={fmtMoneyFull(s1.newPayroll)} />
                <ResultRow label={tt('Доп. расходы / мес')} value={fmtMoneyFull(s1.extraCost)} color="var(--red)" />
                <ResultRow label={tt('Доп. выручка / мес')} value={fmtMoneyFull(s1.extraRevenue)} />
                <ResultRow label={tt('Доп. прибыль (с маржи)')} value={fmtMoneyFull(s1.extraProfit)} />
                <ResultRow label={tt('Чистая выгода')} value={fmtMoneyFull(s1.net)} strong color={s1.net >= 0 ? 'var(--green)' : 'var(--red)'} />
                <div style={{ marginTop: 12 }}>
                  <Badge tone={s1.net >= 0 ? 'green' : 'red'}>
                    {s1.net >= 0 ? tt('✅ Стоит повышать') : tt('❌ Не окупится')}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Сценарий 2 */}
          <Card icon="➕" title={tt('Сценарий 2 · Нанять нового продавца')} style={{ marginBottom: 18 }}>
            <div className="grid-2" style={{ gap: 24 }}>
              <div>
                <Field label={tt('Оклад нового сотрудника, сум/мес')}>
                  <NumInput value={hireSalary} onChange={setHireSalary} suffix={tt('сум')} />
                </Field>
                <Field label={tt('Комиссия, %')}>
                  <NumInput value={hireCommission} onChange={setHireCommission} suffix="%" />
                </Field>
                <Field label={tt('Ожидаемая выручка в день, сум')}>
                  <NumInput value={hireDailyRev} onChange={setHireDailyRev} suffix={tt('сум')} />
                </Field>
                <Field label={tt('Рабочих дней в месяц')}>
                  <NumInput value={hireDays} onChange={setHireDays} suffix={tt('дн')} />
                </Field>
              </div>
              <div>
                <ResultRow label={tt('Доп. выручка / мес')} value={fmtMoneyFull(s2.monthRevenue)} />
                <ResultRow label={tt('Валовая прибыль')} value={fmtMoneyFull(s2.grossProfit)} />
                <ResultRow label={tt('Комиссия')} value={fmtMoneyFull(s2.commissionCost)} color="var(--red)" />
                <ResultRow label={tt('Всего расходы на сотрудника')} value={fmtMoneyFull(s2.totalCost)} color="var(--red)" />
                <ResultRow label={tt('Чистая прибыль / мес')} value={fmtMoneyFull(s2.net)} strong color={s2.net >= 0 ? 'var(--green)' : 'var(--red)'} />
                <div style={{ marginTop: 12 }}>
                  <Badge tone={s2.net >= 0 ? 'green' : 'red'}>
                    {s2.net >= 0 ? tt('✅ Окупится') : tt('❌ Убыточно')}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Сценарий 3 */}
          <Card icon="🎯" title={tt('Сценарий 3 · Пересборка мотивации')}>
            <div className="grid-2" style={{ gap: 24 }}>
              <div>
                <Field label={tt('Текущий оклад, сум')}>
                  <NumInput value={oldBase} onChange={setOldBase} suffix={tt('сум')} />
                </Field>
                <Field label={tt('Текущая комиссия, %')}>
                  <NumInput value={oldCommission} onChange={setOldCommission} suffix="%" />
                </Field>
                <Field label={tt('Новый оклад (ниже), сум')}>
                  <NumInput value={newBase} onChange={setNewBase} suffix={tt('сум')} />
                </Field>
                <Field label={tt('Новая комиссия, %')}>
                  <NumInput value={newCommission} onChange={setNewCommission} suffix="%" />
                </Field>
                <Field label={tt('Выручка продавца / мес, сум')}>
                  <NumInput value={sellerRevenue} onChange={setSellerRevenue} suffix={tt('сум')} />
                </Field>
              </div>
              <div>
                <ResultRow label={tt('ЗП по текущей системе')} value={fmtMoneyFull(s3.oldPay)} />
                <ResultRow label={tt('ЗП по новой системе')} value={fmtMoneyFull(s3.newPay)} />
                <ResultRow label={tt('Разница для сотрудника')} value={fmtMoneyFull(s3.diff)} strong color={s3.diff >= 0 ? 'var(--green)' : 'var(--red)'} />
                <div style={{ marginTop: 12 }}>
                  <Badge tone={s3.diff >= 0 ? 'green' : 'orange'}>
                    {s3.diff >= 0
                      ? tt('💪 Продавец зарабатывает больше — сильнее мотивация')
                      : tt('⚠️ Продавец теряет в деньгах — риск ухода')}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 14 }}>
            {tt('ℹ️ База (ФОТ, маржа, выручка) рассчитана из реальных продаж и сотрудников. Сценарии — гипотетические расчёты на основе ваших вводных.')}
          </div>
        </>
      )}
    </>
  );
}
