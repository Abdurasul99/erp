import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Skeleton, EmptyState, fmtMoneyFull } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';
import { normalizeDecimal } from '../../utils/decimalInput.js';

// «Что если — Персонал»: считаем последствия HR-решений ДО их принятия.
// Бэкенд даёт baseline (ФОТ, выручка, маржа, средняя ЗП продавца, рабочих дней),
// три сценария считаются на фронте от этих базовых чисел.

// ── Числовые поля ──
// Стейт поля — СТРОКА: в onChange только чистка символов (Number('1.') = 1 и
// Number('85 000') = NaN не дают вводить дроби и роняют весь расчёт в NaN).
// type="text" + inputMode, т.к. type="number" на промежуточно невалидном вводе
// («1500,», «1.») возвращает e.target.value = '' — поле само себя очищает.
const cleanDec = (raw) => {
  let s = normalizeDecimal(raw).replace(/[^\d.-]/g, '');
  const neg = s.startsWith('-');            // минус допустим только первым символом
  s = s.replace(/-/g, '');
  const dot = s.indexOf('.');               // и только одна точка
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  return (neg ? '-' : '') + s;
};
const cleanInt = (raw) => String(raw ?? '').replace(/[^\d]/g, '');
// Аккуратный вид — на onBlur, не в onChange: «1.» → «1», «-» → пусто, «007» → «7».
const tidy = (raw, int) => {
  const s = int ? cleanInt(raw) : cleanDec(raw);
  const n = int ? parseInt(s, 10) : parseFloat(s);
  return Number.isFinite(n) ? String(n) : '';
};
// Значение для математики: пустое/недописанное поле = 0, никогда не NaN.
const num = (raw, def = 0) => {
  const n = parseFloat(normalizeDecimal(raw));
  return Number.isFinite(n) ? n : def;
};

function NumInput({ value, onChange, suffix, int = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="text"
        inputMode={int ? 'numeric' : 'decimal'}
        value={value}
        onChange={(e) => onChange(int ? cleanInt(e.target.value) : cleanDec(e.target.value))}
        onBlur={(e) => onChange(tidy(e.target.value, int))}
        style={{
          flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 10,
          border: '1.5px solid var(--border, #E3EAF3)', background: 'var(--bg, #fff)',
          color: 'var(--text)', fontSize: 14, fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
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

  // Все инпуты сценариев хранятся СТРОКАМИ (см. cleanDec/num), число берём в расчёте.
  // Сценарий 1 — повышение ЗП
  const [raisePct, setRaisePct] = useState('10');
  const [salesGrowth, setSalesGrowth] = useState('8');

  // Сценарий 2 — найм нового продавца
  const [hireSalary, setHireSalary] = useState('0');
  const [hireCommission, setHireCommission] = useState('5');
  const [hireDailyRev, setHireDailyRev] = useState('0');
  const [hireDays, setHireDays] = useState('0');

  // Сценарий 3 — пересборка мотивации
  const [oldBase, setOldBase] = useState('0');
  const [oldCommission, setOldCommission] = useState('5');
  const [newBase, setNewBase] = useState('0');
  const [newCommission, setNewCommission] = useState('10');
  const [sellerRevenue, setSellerRevenue] = useState('0');

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
        // Префилл инпутов разумными значениями из baseline (строками — стейт полей строковый;
        // через num(), чтобы строка/NULL из БД не превратились в «NaN» прямо в поле)
        const salary = num(d.avg_seller_salary);
        const revMonth = num(d.revenue_month);
        const workDays = Math.round(num(d.work_days)) || 22;
        const sellers = num(d.sellers_count) || 1;
        setHireSalary(String(Math.round(salary)));
        setHireDailyRev(String(Math.round(revMonth / Math.max(workDays, 1) / Math.max(sellers, 1))));
        setHireDays(String(workDays));
        setOldBase(String(Math.round(salary)));
        setNewBase(String(Math.round(salary * 0.6)));
        setSellerRevenue(String(Math.round(revMonth / Math.max(sellers, 1))));
      })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId]);

  // База из API: numeric из БД приходит строкой — через num(), иначе NaN протечёт в итоги.
  const margin = num(base?.gross_margin_pct) / 100;
  const payroll = num(base?.payroll_month);
  const revenue = num(base?.revenue_month);

  // ── Сценарий 1: повышение ЗП ──
  const s1 = useMemo(() => {
    const newPayroll = payroll * (1 + num(raisePct) / 100);
    const extraCost = newPayroll - payroll;
    const extraRevenue = revenue * (num(salesGrowth) / 100);
    const extraProfit = extraRevenue * margin;
    const net = extraProfit - extraCost;
    return { newPayroll, extraCost, extraRevenue, extraProfit, net };
  }, [payroll, revenue, margin, raisePct, salesGrowth]);

  // ── Сценарий 2: найм нового продавца ──
  const s2 = useMemo(() => {
    const monthRevenue = num(hireDailyRev) * num(hireDays);
    const grossProfit = monthRevenue * margin;
    const commissionCost = monthRevenue * (num(hireCommission) / 100);
    const totalCost = num(hireSalary) + commissionCost;
    const net = grossProfit - totalCost;
    return { monthRevenue, grossProfit, commissionCost, totalCost, net };
  }, [hireDailyRev, hireDays, margin, hireCommission, hireSalary]);

  // ── Сценарий 3: пересборка мотивации ──
  const s3 = useMemo(() => {
    const oldPay = num(oldBase) + num(sellerRevenue) * (num(oldCommission) / 100);
    const newPay = num(newBase) + num(sellerRevenue) * (num(newCommission) / 100);
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
            <Tile icon="🧮" label={tt('Валовая маржа')} value={`${num(base.gross_margin_pct).toFixed(0)}%`} sub={tt('средняя')} color="#0EA5E9" />
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
                  <NumInput value={hireDays} onChange={setHireDays} suffix={tt('дн')} int />
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
