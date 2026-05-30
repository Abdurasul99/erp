import React from 'react';
import { useTranslation } from '../useTranslation.js';

// Reusable period filter: День / Неделя / Месяц / Год / Период (custom).
// Props:
//   period — current key
//   setPeriod — setter
//   customRange — { from, to } YYYY-MM-DD strings
//   setCustomRange — setter
//   showAll — include "Все" button (default: false)
//   compact — smaller padding for tight layouts
export default function PeriodFilter({ period, setPeriod, customRange, setCustomRange, showAll = false, compact = false }) {
  const { t } = useTranslation();

  const buttons = [
    ['today', t('periodToday')],
    ['week',  t('periodWeek')],
    ['month', t('periodMonth')],
    ['year',  t('periodYear')],
    ...(showAll ? [['all', t('periodAll')]] : []),
    ['custom', t('periodCustom')],
  ];

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '4px', background: '#F4F5FA', borderRadius: '10px', padding: '4px' }}>
        {buttons.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setPeriod(key)} style={{
            padding: compact ? '5px 10px' : '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: '12px', fontFamily: "'Nunito', sans-serif",
            background: period === key ? '#fff' : 'transparent',
            color: period === key ? '#4338ca' : '#6B6F8A',
            boxShadow: period === key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
          }}>{label}</button>
        ))}
      </div>
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input type="date" className="input" style={{ width: '140px', padding: '6px 10px' }}
            value={customRange?.from || ''} onChange={e => setCustomRange({ ...customRange, from: e.target.value })} />
          <span style={{ color: '#9EA3BF' }}>—</span>
          <input type="date" className="input" style={{ width: '140px', padding: '6px 10px' }}
            value={customRange?.to || ''} onChange={e => setCustomRange({ ...customRange, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
