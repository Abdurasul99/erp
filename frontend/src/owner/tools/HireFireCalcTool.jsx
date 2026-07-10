import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Калькулятор найма/увольнения. ВСЯ математика — на фронте (без сохранения).
// Бэк опционален: GET /api/hr/calc-defaults вернёт средний оклад/маржу компании,
// чтобы подставить реалистичные значения по умолчанию.
//
// Модель НАЙМА (помесячно, горизонт H месяцев):
//   Затраты месяца:
//     - оклад × (1 + налог%)               — каждый месяц
//     - + рекрутинг + обустройство          — только месяц 1 (разово)
//   Отдача месяца (валовая прибыль, которую приносит сотрудник):
//     - в обучении (первые trainingDays/30 мес) productivity снижена до trainProd%
//     - после обучения отдача линейно растёт до 100% за rampMonths (рамп-ап)
//     - полная отдача = ожид.выручка × маржа%
//   Чистый эффект = отдача − затраты, накапливается помесячно.
//   Окупаемость = первый месяц, когда накопл. эффект ≥ 0.
//   Скорректированный эффект = чистый эффект за 12 мес × вероятность удержания.
//
// Модель УВОЛЬНЕНИЯ:
//   Затраты: выходное пособие (мес × оклад) + стоимость найма замены +
//            потери за gap-месяцы (пока ищем/обучаем замену недополучаем отдачу).
//   Отдача: устранённый текущий убыток/мес × горизонт.
//   Если сотрудник убыточен — увольнение окупается.

const VERDICT = {
  yes:   { icon: '✅', label: 'Рекомендуется',        color: '#16A34A', tone: 'green'  },
  no:    { icon: '❌', label: 'Не рекомендуется',     color: '#DC2626', tone: 'red'    },
  maybe: { icon: '⚠️', label: 'Спорно — на ваш риск', color: '#D97706', tone: 'amber'  },
};

// Поле ввода числа с подписью и суффиксом
function NumField({ label, value, onChange, suffix, step = 1, min = 0, hint }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="number" value={value} min={min} step={step}
          onChange={e => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 8,
            border: '1px solid var(--border, #E3EAF3)', fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, fontSize: 13.5, background: 'var(--card, #fff)', color: 'var(--text)',
          }} />
        {suffix && <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap' }}>{suffix}</span>}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{hint}</div>}
    </label>
  );
}

export default function HireFireCalcTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);

  const [mode, setMode] = useState('hire'); // 'hire' | 'fire'

  // ===== Найм =====
  const [salary, setSalary] = useState(6000000);       // оклад / мес
  const [taxPct, setTaxPct] = useState(12);            // налог / отчисления %
  const [recruitCost, setRecruitCost] = useState(2000000); // стоимость рекрутинга (разово)
  const [trainDays, setTrainDays] = useState(14);      // дни обучения
  const [setupCost, setSetupCost] = useState(1500000); // обустройство рабочего места (разово)
  const [trainProd, setTrainProd] = useState(30);      // продуктивность во время обучения %
  const [expRevenue, setExpRevenue] = useState(30000000); // ожид. выручка от сотрудника / мес
  const [marginPct, setMarginPct] = useState(35);      // маржа %
  const [rampMonths, setRampMonths] = useState(3);     // рамп-ап (мес до полной отдачи)
  const [horizon, setHorizon] = useState(12);          // горизонт расчёта (мес)
  const [retentionPct, setRetentionPct] = useState(80); // вероятность удержания %

  // ===== Увольнение =====
  const [severanceMonths, setSeveranceMonths] = useState(2); // месяцы выходного пособия
  const [replace, setReplace] = useState(true);              // нужна ли замена
  const [gapMonths, setGapMonths] = useState(2);             // gap-месяцы без замены
  const [gapLoss, setGapLoss] = useState(15000000);          // потери за каждый gap-месяц
  const [currentLoss, setCurrentLoss] = useState(8000000);   // текущий убыток/мес от сотрудника

  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  // Подтянуть реалистичные значения по умолчанию (необязательно)
  useEffect(() => {
    let ignore = false;
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/hr/calc-defaults', { params })
      .then(r => {
        if (ignore || !r.data) return;
        const d = r.data;
        if (d.avg_salary > 0) setSalary(Math.round(d.avg_salary));
        if (d.margin_pct > 0) setMarginPct(Math.round(d.margin_pct));
        if (d.avg_revenue_per_emp > 0) {
          setExpRevenue(Math.round(d.avg_revenue_per_emp));
          setGapLoss(Math.round(d.avg_revenue_per_emp * (d.margin_pct > 0 ? d.margin_pct / 100 : 0.35)));
        }
        setDefaultsLoaded(true);
      })
      .catch(() => { /* бэк опционален — тихо игнорируем */ });
    return () => { ignore = true; };
  }, [branchId]);

  // ===== Расчёт НАЙМА помесячно =====
  const hireCalc = useMemo(() => {
    const H = Math.max(1, Math.min(36, Math.round(horizon)));
    const monthlyPayroll = salary * (1 + taxPct / 100);
    const fullOutput = expRevenue * (marginPct / 100); // полная отдача (валовая прибыль)/мес
    const trainMonths = trainDays / 30;
    const ramp = Math.max(0, rampMonths);

    const rows = [];
    let cumulative = 0;
    let payback = null;
    for (let m = 1; m <= H; m++) {
      // Затраты
      let cost = monthlyPayroll;
      if (m === 1) cost += recruitCost + setupCost;
      // Производительность месяца
      let prodFactor;
      const monthEnd = m;          // считаем продуктивность к концу месяца (консервативно — к середине)
      const t = m - 0.5;           // середина месяца по оси времени
      if (t <= trainMonths) {
        prodFactor = trainProd / 100;
      } else {
        const afterTrain = t - trainMonths;
        prodFactor = ramp > 0 ? Math.min(1, afterTrain / ramp) : 1;
        // во время рамп-апа отдача не ниже, чем была в обучении
        prodFactor = Math.max(prodFactor, trainProd / 100);
      }
      const output = fullOutput * prodFactor;
      const net = output - cost;
      cumulative += net;
      if (payback === null && cumulative >= 0) payback = m;
      rows.push({ month: m, cost, output, net, cumulative });
    }

    // Эффект за 12 мес (или за горизонт, если он меньше)
    const cap12 = Math.min(12, H);
    const net12 = rows.slice(0, cap12).reduce((a, r) => a + r.net, 0);
    const adjusted = net12 * (retentionPct / 100);

    let verdict;
    if (adjusted > 0 && payback !== null && payback <= 6) verdict = 'yes';
    else if (adjusted > 0) verdict = 'maybe';
    else verdict = 'no';

    return { rows, payback, net12, adjusted, verdict, monthlyPayroll, fullOutput, cap12 };
  }, [salary, taxPct, recruitCost, trainDays, setupCost, trainProd, expRevenue, marginPct, rampMonths, horizon, retentionPct]);

  // ===== Расчёт УВОЛЬНЕНИЯ помесячно =====
  const fireCalc = useMemo(() => {
    const H = Math.max(1, Math.min(36, Math.round(horizon)));
    const monthlyPayroll = salary * (1 + taxPct / 100);
    const severance = severanceMonths * salary;        // выходное пособие (разово)
    const replaceCost = replace ? (recruitCost + setupCost) : 0; // найм замены (разово)
    const totalGapLoss = replace ? gapLoss * gapMonths : 0;      // потери пока нет замены

    const rows = [];
    let cumulative = 0;
    let payback = null;
    for (let m = 1; m <= H; m++) {
      // Затраты месяца: разово в м.1 — выходное + найм замены; gap-потери в первые gapMonths
      let cost = 0;
      if (m === 1) cost += severance + replaceCost;
      if (replace && m <= gapMonths) cost += gapLoss;
      // Отдача месяца: устранённый текущий убыток + сэкономленный ФОТ (если без замены)
      let benefit = currentLoss;
      if (!replace) benefit += monthlyPayroll; // экономим ФОТ, если не нанимаем замену
      const net = benefit - cost;
      cumulative += net;
      if (payback === null && cumulative >= 0) payback = m;
      rows.push({ month: m, cost, output: benefit, net, cumulative });
    }

    const cap12 = Math.min(12, H);
    const net12 = rows.slice(0, cap12).reduce((a, r) => a + r.net, 0);
    const oneOff = severance + replaceCost + totalGapLoss;
    const adjusted = net12; // для увольнения корректировка не применяется

    let verdict;
    if (net12 > 0 && payback !== null && payback <= 6) verdict = 'yes';
    else if (net12 > 0) verdict = 'maybe';
    else verdict = 'no';

    return { rows, payback, net12, adjusted, verdict, oneOff, cap12 };
  }, [salary, taxPct, recruitCost, setupCost, severanceMonths, replace, gapMonths, gapLoss, currentLoss, horizon]);

  const calc = mode === 'hire' ? hireCalc : fireCalc;
  const v = VERDICT[calc.verdict];

  return (
    <>
      <PageHeader
        title={tt('🧮 Калькулятор найма / увольнения')}
        sub={tt('Окупаемость и чистый эффект решения — расчёт на лету, без сохранения')}
        actions={defaultsLoaded ? <Badge tone="blue">{tt('Данные компании')}</Badge> : null}
      />

      {/* Тумблер режима */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: 'var(--text2)' }}>{tt('Что считаем:')}</span>
          <Pills
            value={mode}
            onChange={setMode}
            label={tt('Режим расчёта')}
            options={[
              { value: 'hire', label: tt('👋 Найм') },
              { value: 'fire', label: tt('🚪 Увольнение') },
            ]}
          />
        </div>
      </Card>

      <div className="grid-2" style={{ alignItems: 'start', gap: 16 }}>
        {/* ===== Инпуты ===== */}
        <Card icon="⚙️" title={tt('Параметры')}>
          {mode === 'hire' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <NumField label={tt('Оклад / мес')} value={salary} onChange={setSalary} suffix={tt('сум')} step={500000} />
              <NumField label={tt('Налог / отчисления')} value={taxPct} onChange={setTaxPct} suffix="%" />
              <NumField label={tt('Стоимость рекрутинга')} value={recruitCost} onChange={setRecruitCost} suffix={tt('сум')} step={500000} hint={tt('разово')} />
              <NumField label={tt('Обустройство рабочего места')} value={setupCost} onChange={setSetupCost} suffix={tt('сум')} step={500000} hint={tt('разово')} />
              <NumField label={tt('Дни обучения')} value={trainDays} onChange={setTrainDays} suffix={tt('дн')} />
              <NumField label={tt('Продуктивность в обучении')} value={trainProd} onChange={setTrainProd} suffix="%" />
              <NumField label={tt('Ожид. выручка / мес')} value={expRevenue} onChange={setExpRevenue} suffix={tt('сум')} step={1000000} />
              <NumField label={tt('Маржа')} value={marginPct} onChange={setMarginPct} suffix="%" />
              <NumField label={tt('Рамп-ап (выход на 100%)')} value={rampMonths} onChange={setRampMonths} suffix={tt('мес')} />
              <NumField label={tt('Горизонт расчёта')} value={horizon} onChange={setHorizon} suffix={tt('мес')} />
              <NumField label={tt('Вероятность удержания')} value={retentionPct} onChange={setRetentionPct} suffix="%" hint={tt('что сотрудник останется')} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <NumField label={tt('Оклад / мес')} value={salary} onChange={setSalary} suffix={tt('сум')} step={500000} />
              <NumField label={tt('Налог / отчисления')} value={taxPct} onChange={setTaxPct} suffix="%" />
              <NumField label={tt('Текущий убыток / мес')} value={currentLoss} onChange={setCurrentLoss} suffix={tt('сум')} step={500000} hint={tt('сколько теряем из-за сотрудника')} />
              <NumField label={tt('Месяцы выходного пособия')} value={severanceMonths} onChange={setSeveranceMonths} suffix={tt('мес')} />
              <NumField label={tt('Горизонт расчёта')} value={horizon} onChange={setHorizon} suffix={tt('мес')} />
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{tt('Нужна замена?')}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <button type="button" onClick={() => setReplace(true)}
                    className={'pill' + (replace ? ' active' : '')}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#E3EAF3)', fontWeight: 700, background: replace ? 'var(--primary)' : 'transparent', color: replace ? '#fff' : 'var(--text2)' }}>
                    {tt('Да')}
                  </button>
                  <button type="button" onClick={() => setReplace(false)}
                    className={'pill' + (!replace ? ' active' : '')}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#E3EAF3)', fontWeight: 700, background: !replace ? 'var(--primary)' : 'transparent', color: !replace ? '#fff' : 'var(--text2)' }}>
                    {tt('Нет')}
                  </button>
                </div>
              </label>
              {replace && <NumField label={tt('Стоимость найма замены')} value={recruitCost} onChange={setRecruitCost} suffix={tt('сум')} step={500000} hint={tt('рекрутинг разово')} />}
              {replace && <NumField label={tt('Обустройство замены')} value={setupCost} onChange={setSetupCost} suffix={tt('сум')} step={500000} hint={tt('разово')} />}
              {replace && <NumField label={tt('Gap-месяцы (без замены)')} value={gapMonths} onChange={setGapMonths} suffix={tt('мес')} />}
              {replace && <NumField label={tt('Потери за gap-месяц')} value={gapLoss} onChange={setGapLoss} suffix={tt('сум')} step={1000000} />}
            </div>
          )}
        </Card>

        {/* ===== Результаты ===== */}
        <div>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Tile icon="⏱️" label={tt('Окупаемость')}
              value={calc.payback !== null ? `${calc.payback} ${tt('мес')}` : tt('не окупается')}
              color={calc.payback !== null && calc.payback <= 6 ? '#16A34A' : calc.payback !== null ? '#D97706' : '#DC2626'} />
            <Tile icon="💰" label={`${tt('Чистый эффект')} / ${calc.cap12} ${tt('мес')}`}
              value={(calc.net12 >= 0 ? '+' : '') + fmtMoneyFull(calc.net12)} sub={tt('сум')}
              color={calc.net12 >= 0 ? '#16A34A' : '#DC2626'} />
            <Tile icon="🎯" label={mode === 'hire' ? tt('Скорр. эффект (с удержанием)') : tt('Итоговый эффект')}
              value={(calc.adjusted >= 0 ? '+' : '') + fmtMoneyFull(calc.adjusted)} sub={tt('сум')}
              color={calc.adjusted >= 0 ? '#16A34A' : '#DC2626'} />
            <Tile icon={v.icon} label={tt('Вердикт')} value={v.icon} sub={tt(v.label)} color={v.color} />
          </div>

          <Card icon="📋" title={tt('Помесячная раскладка')}>
            <div style={{ overflowX: 'auto', maxHeight: 360 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right' }}>{tt('Мес')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Затраты')}</th>
                    <th style={{ textAlign: 'right' }}>{mode === 'hire' ? tt('Отдача') : tt('Выгода')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Чистый')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Накопл.')}</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.rows.map(r => (
                    <tr key={r.month} style={{ background: r.cumulative >= 0 && calc.payback === r.month ? 'rgba(22,163,74,.08)' : 'transparent' }}>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{r.month}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtMoneyFull(r.cost)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtMoneyFull(r.output)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: r.net >= 0 ? 'var(--green,#16A34A)' : 'var(--red,#DC2626)' }}>
                        {(r.net >= 0 ? '+' : '') + fmtMoneyFull(r.net)}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: r.cumulative >= 0 ? 'var(--green,#16A34A)' : 'var(--red,#DC2626)' }}>
                        {(r.cumulative >= 0 ? '+' : '') + fmtMoneyFull(r.cumulative)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ marginTop: 14, padding: 14, background: 'var(--bg-2)', borderRadius: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            <strong>💡 {tt('Вывод:')}</strong>{' '}
            {mode === 'hire' ? (
              calc.verdict === 'yes'
                ? <>{tt('Найм окупается за')} <strong>{calc.payback} {tt('мес')}</strong> {tt('и даёт')} <strong style={{ color: 'var(--green)' }}>+{fmtMoneyFull(calc.adjusted)} {tt('сум')}</strong> {tt('за год с учётом удержания. Можно нанимать.')}</>
                : calc.verdict === 'maybe'
                  ? <>{tt('Найм в плюсе, но окупается медленно')}{calc.payback !== null ? <> ({calc.payback} {tt('мес')})</> : ''}. {tt('Решение спорное — взвесьте риск ухода сотрудника.')}</>
                  : <>{tt('Найм не окупается на горизонте')} {Math.min(12, Math.round(horizon))} {tt('мес — отдача меньше затрат. Не рекомендуется без пересмотра параметров.')}</>
            ) : (
              calc.verdict === 'yes'
                ? <>{tt('Увольнение окупается за')} <strong>{calc.payback} {tt('мес')}</strong> {tt('и экономит')} <strong style={{ color: 'var(--green)' }}>+{fmtMoneyFull(calc.net12)} {tt('сум')}</strong> {tt('за год. Решение оправдано.')}</>
                : calc.verdict === 'maybe'
                  ? <>{tt('Увольнение в плюсе, но эффект небольшой. Разовые затраты')} <strong className="mono">{fmtMoneyFull(calc.oneOff)} {tt('сум')}</strong>. {tt('Взвесьте необходимость.')}</>
                  : <>{tt('Увольнение невыгодно: разовые затраты')} <strong className="mono">{fmtMoneyFull(calc.oneOff)} {tt('сум')}</strong> {tt('не окупаются за')} {Math.min(12, Math.round(horizon))} {tt('мес. Лучше сохранить сотрудника или снизить его убыточность.')}</>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>
            ℹ️ {tt('Все расчёты выполняются на лету и нигде не сохраняются. Цифры — оценка; уточняйте параметры под свою ситуацию.')}
          </div>
        </div>
      </div>
    </>
  );
}
