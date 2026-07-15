import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader, Card } from '../ui.jsx';
import { useTt } from '../tt.js';

// Планировщик воронки продаж (адаптация Google-таблицы «Sotuv voronkasi» под наш дизайн).
// Логика: ступени с числом лидов → конверсии (ступенчатая + общая), потери (по ступеням + нарастающим),
// худшая ступень, инвестиция/аудитория/цена → выручка и бюджет. Расчёт на фронте, сохраняется в localStorage.
const LS_KEY = 'sales_funnel_v1';
const DEFAULT = {
  investment: 100000000, audience: 1000000, price: 500000, currency: "so'm",
  stages: [
    { name: 'Просмотры / охват', leads: 50000, budget: 0 },
    { name: 'Проявили интерес', leads: 14500, budget: 0 },
    { name: 'Оставили заявку (лид)', leads: 3770, budget: 0 },
    { name: 'Разговор / квалификация', leads: 566, budget: 0 },
    { name: 'Назначили встречу', leads: 543, budget: 0 },
    { name: 'Пришли на встречу', leads: 271, budget: 0 },
    { name: 'Оплатили', leads: 37, budget: 0 },
  ],
};
const fmt = (v) => Math.round(v || 0).toLocaleString('ru-RU');
const pct = (v) => (Math.round((v || 0) * 10) / 10).toFixed(1);
const dropColor = (d) => d >= 50 ? '#dc2626' : d >= 25 ? '#ea580c' : d >= 10 ? '#d97706' : '#16a34a';

export default function SalesFunnelTool() {
  const { tt } = useTt();
  const [state, setState] = useState(() => {
    try { const s = localStorage.getItem(LS_KEY); if (s) return { ...DEFAULT, ...JSON.parse(s) }; } catch {}
    return DEFAULT;
  });
  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} }, [state]);

  const setTop = (k, v) => setState(s => ({ ...s, [k]: Math.max(0, parseFloat(v) || 0) }));
  const setStage = (i, k, v) => setState(s => { const st = s.stages.map((x, j) => j === i ? { ...x, [k]: k === 'name' ? v : Math.max(0, parseFloat(v) || 0) } : x); return { ...s, stages: st }; });
  const addStage = () => setState(s => ({ ...s, stages: [...s.stages, { name: tt('Новая ступень'), leads: 0, budget: 0 }] }));
  const removeStage = (i) => setState(s => ({ ...s, stages: s.stages.filter((_, j) => j !== i) }));
  const reset = () => { if (window.confirm(tt('Сбросить воронку к примеру?'))) setState(DEFAULT); };

  const calc = useMemo(() => {
    const st = state.stages;
    const first = st[0]?.leads || 0;
    const maxL = Math.max(1, ...st.map(x => x.leads || 0));
    const rows = st.map((x, i) => {
      const prev = i > 0 ? (st[i - 1].leads || 0) : null;
      const convPrev = prev != null && prev > 0 ? (x.leads / prev) * 100 : null;
      const lostPrev = prev != null ? Math.max(0, prev - x.leads) : 0;
      const dropPrev = prev != null && prev > 0 ? (lostPrev / prev) * 100 : 0;
      const cumConv = first > 0 ? (x.leads / first) * 100 : 0;
      const cumLost = Math.max(0, first - x.leads);
      return { ...x, convPrev, lostPrev, dropPrev, cumConv, cumLost, barW: (x.leads / maxL) * 100 };
    });
    const last = st[st.length - 1]?.leads || 0;
    const overall = first > 0 ? (last / first) * 100 : 0;
    let worstIdx = -1, worstDrop = -1;
    rows.forEach((r, i) => { if (i > 0 && r.dropPrev > worstDrop) { worstDrop = r.dropPrev; worstIdx = i; } });
    const totalBudget = st.reduce((a, x) => a + (x.budget || 0), 0);
    const revenue = last * (state.price || 0);
    const budgetStatus = (state.investment || 0) - totalBudget;
    return { rows, first, last, overall, worstIdx, worstDrop, totalBudget, revenue, budgetStatus };
  }, [state]);

  const cur = state.currency || "so'm";
  const numInput = { width: '100%', padding: '7px 9px', border: '1.5px solid #E2E4F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', textAlign: 'right', outline: 'none' };

  const Tile = ({ label, value, sub, color, editable, k }) => (
    <div style={{ flex: '1 1 140px', minWidth: 130, background: 'var(--bg-2,#F4F7FE)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>{label}</div>
      {editable
        ? <input value={state[k]} onChange={e => setTop(k, e.target.value)} style={{ ...numInput, textAlign: 'left', fontSize: 17, fontWeight: 800, border: 'none', background: 'transparent', padding: 0, color: color || 'var(--text1)' }} />
        : <div style={{ fontSize: 19, fontWeight: 900, color: color || 'var(--text1)', lineHeight: 1.1 }}>{value}</div>}
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{sub}</div>}
    </div>
  );

  return (
    <>
      <PageHeader title={tt('🎯 Воронка продаж')} sub={tt('Спланируй ступени, увидь где теряешь клиентов и сколько это стоит')}
        actions={<button className="btn btn-ghost btn-sm" onClick={reset}>↺ {tt('Пример')}</button>} />

      {/* Верхние показатели */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Tile label={tt('Начальная инвестиция')} k="investment" editable color="#7c3aed" sub={cur} />
        <Tile label={tt('Аудитория')} k="audience" editable color="#1D4ED8" sub={tt('чел')} />
        <Tile label={tt('Цена услуги')} k="price" editable color="#d97706" sub={cur} />
        <Tile label={tt('Выручка')} value={fmt(calc.revenue) + ' ' + cur} color="#16a34a" sub={`${fmt(calc.last)} ${tt('продаж')} × ${fmt(state.price)}`} />
        <Tile label={tt('Бюджет')} value={fmt(calc.budgetStatus) + ' ' + cur} color={calc.budgetStatus < 0 ? '#dc2626' : '#16a34a'} sub={`${tt('инвест')} − ${fmt(calc.totalBudget)}`} />
        <Tile label={tt('Общая конверсия')} value={pct(calc.overall) + '%'} color="#1D4ED8" sub={`${fmt(calc.last)}/${fmt(calc.first)}`} />
        <Tile label={tt('Худшая ступень')} value={calc.worstIdx > 0 ? `−${pct(calc.worstDrop)}%` : '—'} color="#dc2626" sub={calc.worstIdx > 0 ? state.stages[calc.worstIdx]?.name : ''} />
      </div>

      {/* Воронка + метрики */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', width: 210 }}>{tt('Ступень')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', width: 100 }}>{tt('Лиды')}</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', minWidth: 160 }}>{tt('Воронка')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>{tt('Конв. от пред.')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>{tt('Потеря')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>{tt('Общая конв.')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', width: 120 }}>{tt('Бюджет')}</th>
                <th style={{ width: 30 }} />
              </tr>
            </thead>
            <tbody>
              {calc.rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #EDF1F7', background: i === calc.worstIdx ? 'rgba(220,38,38,.05)' : 'transparent' }}>
                  <td style={{ padding: '6px 8px' }}>
                    <input value={r.name} onChange={e => setStage(i, 'name', e.target.value)} style={{ ...numInput, textAlign: 'left', fontWeight: 700, fontSize: 13 }} />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input value={r.leads} onChange={e => setStage(i, 'leads', e.target.value)} style={numInput} />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <div style={{ height: 22, borderRadius: 5, background: dropColor(r.dropPrev), width: `${Math.max(3, r.barW)}%`, minWidth: 8, transition: 'width .2s', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, color: '#fff', fontSize: 11, fontWeight: 800 }}>
                      {r.barW > 18 ? fmt(r.leads) : ''}
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: r.convPrev == null ? 'var(--text3)' : r.convPrev >= 100 ? '#16a34a' : 'var(--text1)' }}>{r.convPrev == null ? '—' : pct(r.convPrev) + '%'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 13, color: r.dropPrev > 0 ? dropColor(r.dropPrev) : 'var(--text3)', fontWeight: 700 }}>{i === 0 ? '—' : `−${fmt(r.lostPrev)}`}<span style={{ fontSize: 11, opacity: .8 }}>{i === 0 ? '' : ` (${pct(r.dropPrev)}%)`}</span></td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#1D4ED8' }}>{pct(r.cumConv)}%</td>
                  <td style={{ padding: '6px 8px' }}>
                    <input value={r.budget} onChange={e => setStage(i, 'budget', e.target.value)} style={numInput} placeholder="0" />
                  </td>
                  <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                    {calc.rows.length > 2 && <button onClick={() => removeStage(i)} title={tt('Удалить')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 15 }}>×</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={addStage} style={{ marginTop: 10 }}>+ {tt('Добавить ступень')}</button>
      </Card>

      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
        {tt('Ступени и числа редактируются прямо в таблице — расчёты обновляются на лету. «Конв. от пред.» = лиды ступени / предыдущей. «Общая конв.» = лиды ступени / первой. «Потеря» = сколько ушло с прошлой ступени. Худшая ступень (макс. потеря) подсвечена. Бюджет ступени — сколько тратишь на инструменты этого этапа. Всё сохраняется в этом браузере.')}
      </div>
    </>
  );
}
