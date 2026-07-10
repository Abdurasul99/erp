import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { useTt } from '../tt.js';

// Редактор HR-критериев (учредитель / директор / менеджер задают правила на компанию).
// tool: 'workday' | 'fire' | 'health'. Тянет /hr/criteria, сохраняет через PUT.
const FIELDS = {
  workday: [['workday', 'day_start', 'Начало окна (ч)', 0, 23], ['workday', 'day_end', 'Конец окна (ч)', 1, 24]],
  fire: [
    ['fire', 'keep', 'KEEP при рейтинге ≥', 1, 100], ['fire', 'watch', 'WATCH при рейтинге ≥', 0, 99],
    ['fire', 'w_conversion', 'Вес: конверсия %', 0, 100], ['fire', 'w_avg_check', 'Вес: чек %', 0, 100], ['fire', 'w_discipline', 'Вес: дисциплина %', 0, 100],
  ],
  health: [['health', 'risk_low', 'Красная зона: score <', 0, 99], ['health', 'risk_mid', 'Жёлтая зона: score <', 1, 100]],
};

export default function HrCriteriaBar({ tool }) {
  const { tt } = useTt();
  const [open, setOpen] = useState(false);
  const [c, setC] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api.get('/hr/criteria').then(r => setC(r.data)).catch(() => {}); }, []);
  if (!c) return null;
  const set = (grp, key, val) => setC(prev => ({ ...prev, [grp]: { ...prev[grp], [key]: val } }));
  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put('/hr/criteria', { workday: c.workday, fire: c.fire, health: c.health });
      setC(x => ({ ...x, workday: r.data.workday, fire: r.data.fire, health: r.data.health }));
      setMsg('✅ Сохранено — обнови данные');
    } catch (e) { setMsg('⚠️ ' + (e.response?.data?.error || 'Ошибка')); }
    finally { setSaving(false); setTimeout(() => setMsg(null), 3000); }
  };
  const fields = FIELDS[tool] || [];
  return (
    <div className="card" style={{ marginBottom: 14, padding: open ? 16 : '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>{tt('⚙️ Мои критерии')} {open ? '▾' : '▸'}</div>
        {msg ? <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>{tt(msg)}</span>
             : <span style={{ fontSize: 11, color: 'var(--text3)' }}>{tt('настроить пороги под свою компанию')}</span>}
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {fields.map(([g, k, label, mn, mx]) => (
              <div key={g + k}>
                <label className="label" style={{ fontSize: 11 }}>{tt(label)}</label>
                <input className="input" type="number" min={mn} max={mx} style={{ width: 130 }}
                  value={c[g]?.[k] ?? ''} onChange={e => set(g, k, e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
            ))}
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>{saving ? '…' : tt('Сохранить')}</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{tt('Критерии — на всю компанию. Меняют учредитель, директор и менеджер.')}</div>
        </div>
      )}
    </div>
  );
}
