import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import api from '../../api.js';
import { PageHeader, Card } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';
import { normalizeDecimal } from '../../utils/decimalInput.js';

// ═══ Воронка продаж — адаптация Google-таблицы «Sotuv voronkasi» ═══════════════
// Математика перенесена 1:1 (проверена на числах оригинала):
//   • Общая конверсия      = лиды последнего этапа / лиды первого × 100
//   • Потеря до этапа      = (первый − текущий) / первый          (нарастающим итогом)
//   • Потеря с прошлого    = (предыдущий − текущий) / предыдущий  (шаг)
//   • Худший этап          = максимальная шаговая потеря
//   • Диаграмма-воронка    = центрирование, отступ = (max − текущий) / 2
//   • Бюджет этапа         = сумма включённых инструментов × их цена
//   • Доход                = продажи (последний этап) × цена услуги
//   • Состояние бюджета    = стартовая инвестиция − потрачено на инструменты
// Адаптация «под нас»: должность и ответственный подтягиваются из НАШИХ сотрудников,
// а «факт» — из реальных лидов компании (Лид-трекер), а не только ручной ввод.
// Скорость: всё считается в useMemo на клиенте, ввод не ходит на сервер.

const LS_KEY = 'sales_funnel_v2';

// Цены инструментов из таблицы: косвенные $400, прямые $500 (редактируются).
const DEFAULT_TOOL_PRICE = { indirect: 400, direct: 500 };

const DEFAULT = {
  investment: 100000,
  audience: 1000000,
  price: 100,
  currency: '$',
  toolPrice: { ...DEFAULT_TOOL_PRICE },
  stages: [
    { role: 'Отдел маркетинга', owner: '', name: 'Холодные лиды',   leads: 1000, tools: [] },
    { role: 'Оператор',         owner: '', name: 'Звонок',          leads: 900,  tools: [] },
    { role: 'Оператор',         owner: '', name: 'Разговор',        leads: 800,  tools: [] },
    { role: 'Оператор',         owner: '', name: 'Интерес',         leads: 700,  tools: [] },
    { role: 'Оператор',         owner: '', name: 'Повторный контакт', leads: 660, tools: [] },
    { role: 'Менеджер продаж',  owner: '', name: 'Оценка / цена',   leads: 650,  tools: [] },
    { role: 'Менеджер продаж',  owner: '', name: 'Скидка',          leads: 640,  tools: [] },
    { role: 'Менеджер продаж',  owner: '', name: 'Переговоры',      leads: 429,  tools: [] },
    { role: 'Менеджер продаж',  owner: '', name: 'Встреча',         leads: 346,  tools: [] },
    { role: 'Менеджер продаж',  owner: '', name: 'Продажа',         leads: 80,   tools: [] },
  ],
};

// ── Числовые поля ─────────────────────────────────────────────────────────────
// Значения полей лежат в состоянии СЫРЫМИ СТРОКАМИ: в onChange только чистка
// символов, кламп и округление — на onBlur. Коэрсия в onChange (parseFloat||0)
// не давала стереть последнюю цифру («5» → Backspace → снова «0»), съедала точку
// в «0.5» и молча обрезала «12 500» до 12.
// toNum — единственное место, где строка превращается в число (расчёт и вывод).
const toNum = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = normalizeDecimal(v);
  if (s === '') return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const toNum0 = (v) => Math.max(0, toNum(v));
// Чистка ввода: дробные — цифры, точка, запятая, пробел; целые — только цифры.
const cleanDec = (v) => String(v ?? '').replace(/[^\d.,\s]/g, '');
const cleanInt = (v) => String(v ?? '').replace(/[^\d\s]/g, '');
// Нормализация на blur. Пустое поле остаётся пустым (в расчёте это 0).
const normDec = (v) => {
  const s = normalizeDecimal(v);
  if (s === '') return '';
  const n = parseFloat(s);
  return Number.isFinite(n) ? String(Math.max(0, n)) : '';
};
const normInt = (v) => {
  const s = normalizeDecimal(v);
  if (s === '') return '';
  const n = parseFloat(s);
  return Number.isFinite(n) ? String(Math.max(0, Math.round(n))) : '';
};

const num = (v) => Math.round(toNum(v)).toLocaleString('ru-RU');
const pct1 = (v) => (Math.round((Number(v) || 0) * 10) / 10).toFixed(1);
// Цвет по величине потери — как в таблице: чем краснее, тем больше утекает.
const lossColor = (d) => (d >= 50 ? '#DC2626' : d >= 25 ? '#EA580C' : d >= 10 ? '#D97706' : '#16A34A');

const inputBase = {
  width: '100%', padding: '7px 9px', border: '1.5px solid var(--border, #E2E4F0)',
  borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff',
};

// Плитка верхних показателей. Объявлена НА УРОВНЕ МОДУЛЯ: внутри компонента она
// пересоздавалась на каждый рендер, React размонтировал поле и фокус слетал после
// первого же символа — ввести значение было невозможно.
function Tile({ label, value, sub, color, suffix, editValue, editMode, onEdit, onEditBlur }) {
  return (
    <div style={{ flex: '1 1 150px', minWidth: 140, background: 'var(--surface,#fff)', border: '1px solid var(--border,#E5E7F0)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>{label}</div>
      {onEdit
        ? <input value={editValue} onChange={onEdit} onBlur={onEditBlur} inputMode={editMode || 'decimal'}
            style={{ ...inputBase, border: 'none', padding: 0, fontSize: 19, fontWeight: 800, color: color || 'var(--text)', background: 'transparent' }} />
        : <div style={{ fontSize: 19, fontWeight: 800, color: color || 'var(--text)', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {value}{suffix}
          </div>}
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function SalesFunnelTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);

  const [state, setState] = useState(() => {
    try {
      const s = localStorage.getItem(LS_KEY);
      if (s) {
        const p = JSON.parse(s);
        return { ...DEFAULT, ...p, toolPrice: { ...DEFAULT_TOOL_PRICE, ...(p.toolPrice || {}) } };
      }
    } catch { /* повреждённый кэш — берём пример */ }
    return DEFAULT;
  });
  const [staff, setStaff] = useState([]);
  const [fact, setFact] = useState(null);      // факт из реальных лидов
  const [showFact, setShowFact] = useState(false);

  // Сохраняем план локально — мгновенно, без обращения к серверу (нет лага при вводе).
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  }, [state]);

  // Наши сотрудники — для выбора ответственного за этап.
  useEffect(() => {
    api.get('/users')
      .then(r => setStaff(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  // Факт по воронке из НАШИХ лидов (Лид-трекер): сколько лидов дошло до каждого статуса.
  const loadFact = useCallback(() => {
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/marketing/leads', { params })
      .then(r => {
        const leads = r.data?.leads || [];
        const by = (s) => leads.filter(l => l.status === s).length;
        const total = leads.length;
        const won = by('won');
        // Ступени факта — «дошёл не менее чем до»: воронка всегда убывает.
        const inWork = leads.filter(l => ['in_progress', 'negotiation', 'won'].includes(l.status)).length;
        const negotiation = leads.filter(l => ['negotiation', 'won'].includes(l.status)).length;
        setFact({ total, inWork, negotiation, won, lost: by('lost'), returned: by('returned') });
      })
      .catch(() => setFact(null));
  }, [branchId]);
  useEffect(() => { if (showFact) loadFact(); }, [showFact, loadFact]);

  // Ввод — сырая строка (только чистка символов); кламп — в blur-обработчиках ниже.
  const setTop = (k, v) => setState(s => ({ ...s, [k]: k === 'audience' ? cleanInt(v) : cleanDec(v) }));
  const blurTop = (k) => setState(s => ({ ...s, [k]: k === 'audience' ? normInt(s[k]) : normDec(s[k]) }));
  const setToolPrice = (k, v) => setState(s => ({ ...s, toolPrice: { ...s.toolPrice, [k]: cleanDec(v) } }));
  const blurToolPrice = (k) => setState(s => ({ ...s, toolPrice: { ...s.toolPrice, [k]: normDec(s.toolPrice?.[k]) } }));
  const setStage = (i, k, v) => setState(s => ({
    ...s,
    stages: s.stages.map((x, j) => j === i
      ? { ...x, [k]: (k === 'leads') ? cleanInt(v) : v }
      : x),
  }));
  const blurStageLeads = (i) => setState(s => ({
    ...s,
    stages: s.stages.map((x, j) => j === i ? { ...x, leads: normInt(x.leads) } : x),
  }));
  const addStage = () => setState(s => ({ ...s, stages: [...s.stages, { role: '', owner: '', name: tt('Новый этап'), leads: 0, tools: [] }] }));
  const removeStage = (i) => setState(s => ({ ...s, stages: s.stages.filter((_, j) => j !== i) }));
  const moveStage = (i, dir) => setState(s => {
    const j = i + dir;
    if (j < 0 || j >= s.stages.length) return s;
    const st = [...s.stages];
    [st[i], st[j]] = [st[j], st[i]];
    return { ...s, stages: st };
  });
  const addTool = (i, kind) => setState(s => ({
    ...s,
    stages: s.stages.map((x, j) => j === i
      ? { ...x, tools: [...(x.tools || []), { name: '', kind, on: true }] }
      : x),
  }));
  const setTool = (i, ti, patch) => setState(s => ({
    ...s,
    stages: s.stages.map((x, j) => j === i
      ? { ...x, tools: (x.tools || []).map((t, k) => k === ti ? { ...t, ...patch } : t) }
      : x),
  }));
  const removeTool = (i, ti) => setState(s => ({
    ...s,
    stages: s.stages.map((x, j) => j === i ? { ...x, tools: (x.tools || []).filter((_, k) => k !== ti) } : x),
  }));
  const reset = () => { if (window.confirm(tt('Сбросить воронку к примеру?'))) setState(DEFAULT); };

  // ── Весь расчёт одним проходом (быстро, без пересчёта на каждый рендер) ──
  const calc = useMemo(() => {
    const st = state.stages || [];
    // Поля хранят строки — превращаем в числа здесь, один раз, с полом в 0.
    const leadsOf = (x) => toNum0(x?.leads);
    const first = st.length ? leadsOf(st[0]) : 0;
    const last = st.length ? leadsOf(st[st.length - 1]) : 0;
    const maxLeads = Math.max(1, ...st.map(leadsOf));
    const tp = state.toolPrice || DEFAULT_TOOL_PRICE;
    const priceIndirect = toNum0(tp.indirect);
    const priceDirect = toNum0(tp.direct);

    let spent = 0;
    const rows = st.map((x, i) => {
      const prev = i > 0 ? leadsOf(st[i - 1]) : null;
      const leads = leadsOf(x);
      // Шаговая потеря — «Avvalgi bosqichdan yoqotilgan lidlar»
      const lostStep = prev != null ? Math.max(0, prev - leads) : 0;
      const lossStepPct = prev != null && prev > 0 ? (lostStep / prev) * 100 : 0;
      // Нарастающая потеря — «Shu bosqichgacha yoqotilgan lidlar»
      const lostCum = Math.max(0, first - leads);
      const lossCumPct = first > 0 ? (lostCum / first) * 100 : 0;
      const convFromFirst = first > 0 ? (leads / first) * 100 : 0;
      const convFromPrev = prev != null && prev > 0 ? (leads / prev) * 100 : null;
      // Бюджет этапа — сумма включённых инструментов по их цене
      const budget = (x.tools || []).reduce(
        (a, t) => a + (t.on ? (t.kind === 'direct' ? priceDirect : priceIndirect) : 0), 0);
      spent += budget;
      // Центрирование бара воронки, как в таблице: offset = (max − leads) / 2
      const widthPct = (leads / maxLeads) * 100;
      const offsetPct = (100 - widthPct) / 2;
      // leadsRaw — то, что человек набрал: поле ввода показывает строку как есть
      // (иначе на «1.» React переписал бы DOM в «1» и точку набрать нельзя).
      const leadsRaw = x.leads == null ? '' : String(x.leads);
      return { ...x, leads, leadsRaw, lostStep, lossStepPct, lostCum, lossCumPct, convFromFirst, convFromPrev, budget, widthPct, offsetPct };
    });

    let worstIdx = -1, worstLoss = -1;
    rows.forEach((r, i) => { if (i > 0 && r.lossStepPct > worstLoss) { worstLoss = r.lossStepPct; worstIdx = i; } });

    const overallConv = first > 0 ? (last / first) * 100 : 0;
    const revenue = last * toNum0(state.price);
    const budgetLeft = toNum0(state.investment) - spent;
    const lostTotal = Math.max(0, first - last);
    const cpl = last > 0 ? spent / last : 0;         // стоимость одной продажи
    const roi = spent > 0 ? ((revenue - spent) / spent) * 100 : null;

    return { rows, first, last, overallConv, worstIdx, worstLoss, spent, revenue, budgetLeft, lostTotal, cpl, roi };
  }, [state]);

  const cur = state.currency || '$';
  const money = (v) => `${num(v)} ${cur}`;
  const staffNames = useMemo(
    () => staff.map(u => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username).filter(Boolean),
    [staff]);

  // Пропсы редактируемой плитки: значение показываем сырым, кламп — на blur.
  const editTile = (k, mode) => ({
    editValue: state[k] == null ? '' : String(state[k]),
    editMode: mode,
    onEdit: (e) => setTop(k, e.target.value),
    onEditBlur: () => blurTop(k),
  });

  return (
    <>
      <PageHeader
        title={tt('Воронка продаж')}
        sub={tt('План по этапам · где теряются клиенты · сколько это стоит')}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowFact(v => !v)}>
              {showFact ? tt('Скрыть факт') : tt('Показать факт')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>{tt('Пример')}</button>
          </div>
        }
      />

      {/* Верхние показатели — как шапка таблицы */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Tile label={tt('Стартовая инвестиция')} {...editTile('investment', 'decimal')} color="#7C3AED" sub={cur} />
        <Tile label={tt('Аудитория')} {...editTile('audience', 'numeric')} color="#0A84FF" sub={tt('человек')} />
        <Tile label={tt('Цена услуги')} {...editTile('price', 'decimal')} color="#D97706" sub={cur} />
        <Tile label={tt('Доход')} value={money(calc.revenue)} color="#16A34A"
          sub={`${num(calc.last)} × ${num(state.price)}`} />
        <Tile label={tt('Бюджет')} value={money(calc.budgetLeft)} color={calc.budgetLeft < 0 ? '#DC2626' : '#16A34A'}
          sub={`${tt('потрачено')} ${money(calc.spent)}`} />
        <Tile label={tt('Общая конверсия')} value={pct1(calc.overallConv)} suffix="%" color="#0A84FF"
          sub={`${num(calc.last)} ${tt('из')} ${num(calc.first)}`} />
        <Tile label={tt('Потеряно лидов')} value={num(calc.lostTotal)} color="#DC2626"
          sub={`${tt('худший этап')}: ${calc.worstIdx > 0 ? state.stages[calc.worstIdx]?.name : '—'}`} />
        <Tile label={tt('Цена продажи')} value={money(calc.cpl)} color="#0EA5E9"
          sub={calc.roi == null ? tt('нет расходов') : `ROI ${pct1(calc.roi)}%`} />
      </div>

      {/* Факт из наших лидов — то, чего нет в таблице: сверка плана с реальностью */}
      {showFact && (
        <Card icon="" title={tt('Факт по нашим лидам')} style={{ marginBottom: 14 }}>
          {!fact ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>{tt('Загрузка…')}</div>
          ) : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                [tt('Всего лидов'), fact.total, '#0A84FF'],
                [tt('В работе'), fact.inWork, '#D97706'],
                [tt('Переговоры'), fact.negotiation, '#7C3AED'],
                [tt('Продано'), fact.won, '#16A34A'],
                [tt('Отказ'), fact.lost, '#DC2626'],
                [tt('Возврат'), fact.returned, '#9333EA'],
              ].map(([l, v, c]) => (
                <div key={l} style={{ minWidth: 110 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{l}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c, fontVariantNumeric: 'tabular-nums' }}>{num(v)}</div>
                </div>
              ))}
              <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text2)' }}>
                {tt('Реальная конверсия')}: <strong>{fact.total > 0 ? pct1((fact.won / fact.total) * 100) : '0.0'}%</strong>
                <span style={{ color: 'var(--text3)' }}> {tt('против плана')} {pct1(calc.overallConv)}%</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Диаграмма-воронка (центрированная, как в таблице) */}
      <Card icon="" title={tt('Воронка')} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {calc.rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 150, flexShrink: 0, fontSize: 12, fontWeight: 700, color: i === calc.worstIdx ? '#DC2626' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.name}
              </div>
              <div style={{ flex: 1, position: 'relative', height: 26, minWidth: 0 }}>
                <div style={{
                  position: 'absolute', left: `${r.offsetPct}%`, width: `${Math.max(1.5, r.widthPct)}%`,
                  top: 0, height: 26, borderRadius: 5,
                  background: `linear-gradient(90deg, ${lossColor(r.lossStepPct)}CC, ${lossColor(r.lossStepPct)})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11.5, fontWeight: 800, transition: 'width .18s ease, left .18s ease',
                  whiteSpace: 'nowrap', overflow: 'hidden',
                }}>
                  {r.widthPct > 12 ? num(r.leads) : ''}
                </div>
              </div>
              <div style={{ width: 118, flexShrink: 0, textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                {i === 0
                  ? <span style={{ color: 'var(--text3)' }}>{num(r.leads)}</span>
                  : <><span style={{ color: lossColor(r.lossStepPct), fontWeight: 800 }}>−{pct1(r.lossStepPct)}%</span>
                      <span style={{ color: 'var(--text3)' }}> · {num(r.leads)}</span></>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Таблица этапов — как в оригинале: должность, ответственный, этап, лиды, потери */}
      <Card icon="" title={tt('Этапы воронки')} style={{ marginBottom: 14 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 940, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.03em' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', width: 150 }}>{tt('Должность')}</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', width: 160 }}>{tt('Ответственный')}</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', width: 175 }}>{tt('Этап')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', width: 95 }}>{tt('Лиды')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', width: 105 }}>{tt('Потеря с пред.')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', width: 105 }}>{tt('Потеря всего')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', width: 90 }}>{tt('Конверсия')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', width: 95 }}>{tt('Бюджет')}</th>
                <th style={{ width: 62 }} />
              </tr>
            </thead>
            <tbody>
              {calc.rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border,#EDF1F7)', background: i === calc.worstIdx ? 'rgba(220,38,38,.05)' : 'transparent' }}>
                  <td style={{ padding: '5px 8px' }}>
                    <input value={r.role || ''} onChange={e => setStage(i, 'role', e.target.value)}
                      placeholder={tt('напр. Оператор')} style={{ ...inputBase, fontSize: 12.5 }} />
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    {/* Ответственный — из НАШИХ сотрудников */}
                    <input value={r.owner || ''} onChange={e => setStage(i, 'owner', e.target.value)}
                      list="funnel-staff" placeholder={tt('выбрать')} style={{ ...inputBase, fontSize: 12.5 }} />
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    <input value={r.name} onChange={e => setStage(i, 'name', e.target.value)}
                      style={{ ...inputBase, fontWeight: 700, fontSize: 12.5 }} />
                  </td>
                  <td style={{ padding: '5px 8px' }}>
                    <input value={r.leadsRaw} onChange={e => setStage(i, 'leads', e.target.value)}
                      onBlur={() => blurStageLeads(i)} inputMode="numeric"
                      style={{ ...inputBase, textAlign: 'right', fontWeight: 700 }} />
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
                    {i === 0 ? <span style={{ color: 'var(--text3)' }}>—</span> : (
                      <><span style={{ color: lossColor(r.lossStepPct), fontWeight: 800 }}>{pct1(r.lossStepPct)}%</span>
                        <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>−{num(r.lostStep)}</div></>
                    )}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: 'var(--text2)', fontWeight: 700 }}>{pct1(r.lossCumPct)}%</span>
                    <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>−{num(r.lostCum)}</div>
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800, fontSize: 12.5, color: '#0A84FF', fontVariantNumeric: 'tabular-nums' }}>
                    {pct1(r.convFromFirst)}%
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {r.budget > 0 ? money(r.budget) : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '5px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button onClick={() => moveStage(i, -1)} disabled={i === 0} title={tt('Выше')}
                      style={{ border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#D8DCE8' : 'var(--text3)', fontSize: 13, padding: '0 2px' }}>↑</button>
                    <button onClick={() => moveStage(i, 1)} disabled={i === calc.rows.length - 1} title={tt('Ниже')}
                      style={{ border: 'none', background: 'none', cursor: i === calc.rows.length - 1 ? 'default' : 'pointer', color: i === calc.rows.length - 1 ? '#D8DCE8' : 'var(--text3)', fontSize: 13, padding: '0 2px' }}>↓</button>
                    {calc.rows.length > 2 && (
                      <button onClick={() => removeStage(i)} title={tt('Удалить')}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 14, padding: '0 2px' }}>×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <datalist id="funnel-staff">{staffNames.map(n => <option key={n} value={n} />)}</datalist>
        <button className="btn btn-ghost btn-sm" onClick={addStage} style={{ marginTop: 10 }}>+ {tt('Добавить этап')}</button>
      </Card>

      {/* Инструменты по этапам — как в таблице: чекбокс + цена (косвенный/прямой) */}
      <Card icon="" title={tt('Инструменты и бюджет')} style={{ marginBottom: 14 }}
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text3)' }}>
              {tt('Косвенный')}
              <input value={state.toolPrice.indirect ?? ''} onChange={e => setToolPrice('indirect', e.target.value)}
                onBlur={() => blurToolPrice('indirect')} inputMode="decimal"
                style={{ ...inputBase, width: 74, padding: '4px 7px', textAlign: 'right', fontSize: 12 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text3)' }}>
              {tt('Прямой')}
              <input value={state.toolPrice.direct ?? ''} onChange={e => setToolPrice('direct', e.target.value)}
                onBlur={() => blurToolPrice('direct')} inputMode="decimal"
                style={{ ...inputBase, width: 74, padding: '4px 7px', textAlign: 'right', fontSize: 12 }} />
            </label>
          </div>
        }>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {calc.rows.map((r, i) => (
            <div key={i} style={{ border: '1px solid var(--border,#E5E7F0)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
                <div style={{ fontWeight: 800, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: r.budget > 0 ? '#16A34A' : 'var(--text3)', flexShrink: 0, marginLeft: 8 }}>{money(r.budget)}</div>
              </div>
              {(r.tools || []).map((t, ti) => (
                <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <input type="checkbox" checked={!!t.on} onChange={e => setTool(i, ti, { on: e.target.checked })} />
                  <input value={t.name} onChange={e => setTool(i, ti, { name: e.target.value })}
                    placeholder={tt('название инструмента')} style={{ ...inputBase, fontSize: 12, padding: '4px 7px', flex: 1, opacity: t.on ? 1 : .55 }} />
                  <select value={t.kind} onChange={e => setTool(i, ti, { kind: e.target.value })}
                    style={{ ...inputBase, fontSize: 11.5, padding: '4px 5px', width: 96 }}>
                    <option value="indirect">{tt('косвенный')}</option>
                    <option value="direct">{tt('прямой')}</option>
                  </select>
                  <button onClick={() => removeTool(i, ti)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}>×</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11.5, padding: '4px 9px' }} onClick={() => addTool(i, 'indirect')}>+ {tt('косвенный')}</button>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11.5, padding: '4px 9px' }} onClick={() => addTool(i, 'direct')}>+ {tt('прямой')}</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.55 }}>
        {tt('Формулы как в исходной таблице: «Потеря с пред.» = (предыдущий этап − текущий) ÷ предыдущий; «Потеря всего» = (первый этап − текущий) ÷ первый; «Конверсия» = текущий ÷ первый; общая конверсия = последний ÷ первый. Худший этап (максимальная потеря) подсвечен красным. Бюджет этапа = сумма включённых инструментов. Всё считается мгновенно и хранится в этом браузере — на сервер ничего не уходит.')}
      </div>
    </>
  );
}
