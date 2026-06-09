import React, { useState, useEffect } from 'react';
import {
  PAPER_SIZES,
  getPaperSize,
  savePaperSize,
  makeCustomPaperSize,
  loadSavedCustomDimensions,
  saveCustomDimensions,
} from './printLabel.js';

// Combined paper-size picker: preset dropdown + custom W×H (cm) inputs.
// Props:
//   value    — current paper size object (from PAPER_SIZES or makeCustomPaperSize).
//   onChange — fired when preset OR custom dimensions change with the new paper-size object.
//   compact  — smaller paddings/fonts for use inside dense toolbars.
export default function PaperSizeControl({ value, onChange, compact = false }) {
  const isCustom = value?.id === 'custom';

  const [wCm, setWCm] = useState(() => +(value.w / 10).toFixed(1));
  const [hCm, setHCm] = useState(() => +(value.h / 10).toFixed(1));

  useEffect(() => {
    setWCm(+(value.w / 10).toFixed(1));
    setHCm(+(value.h / 10).toFixed(1));
  }, [value.id, value.w, value.h]);

  const selectStyle = {
    padding: compact ? '4px 8px' : '5px 10px',
    border: '1.5px solid #E2E4F0',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: compact ? 11 : 12,
    color: '#4338ca',
    fontFamily: "'Nunito', sans-serif",
  };
  const inputStyle = {
    width: 52,
    padding: compact ? '4px 6px' : '5px 6px',
    border: '1.5px solid #E2E4F0',
    borderRadius: 8,
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: compact ? 11 : 12,
    color: '#1A1B2E',
    textAlign: 'center',
    background: isCustom ? '#fff' : '#F4F5FA',
  };
  const labelStyle = { fontSize: 10, fontWeight: 800, color: '#9094B0' };

  const onPickPreset = (e) => {
    const id = e.target.value;
    savePaperSize(id);
    if (id === 'custom') {
      const cm = loadSavedCustomDimensions();
      onChange(makeCustomPaperSize(cm.w, cm.h));
    } else {
      onChange(getPaperSize(id));
    }
  };

  const onCustom = (newW, newH) => {
    setWCm(newW);
    setHCm(newH);
    if (newW > 0 && newH > 0) {
      saveCustomDimensions(newW, newH);
      savePaperSize('custom');
      onChange(makeCustomPaperSize(newW, newH));
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: compact ? 12 : 13 }}>📄</span>
      <select value={value.id} onChange={onPickPreset} style={selectStyle}>
        {PAPER_SIZES.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      <span style={labelStyle}>Ш</span>
      <input
        type="number" min="1" max="30" step="0.1"
        value={wCm}
        onChange={e => onCustom(parseFloat(e.target.value) || 0, hCm)}
        title="Ширина в см (1 см = 10 мм)"
        style={inputStyle}
      />
      <span style={labelStyle}>×</span>
      <span style={labelStyle}>В</span>
      <input
        type="number" min="1" max="30" step="0.1"
        value={hCm}
        onChange={e => onCustom(wCm, parseFloat(e.target.value) || 0)}
        title="Высота в см (1 см = 10 мм)"
        style={inputStyle}
      />
      <span style={labelStyle}>см</span>
    </div>
  );
}
