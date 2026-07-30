import React, { useState, useEffect, useRef } from 'react';
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
// Допустимый диапазон своего размера в см — те же границы, что зажимает
// makeCustomPaperSize (10…300 мм).
const CM_MIN = 1;
const CM_MAX = 30;

export default function PaperSizeControl({ value, onChange, compact = false, lang = 'ru' }) {
  const isCustom = value?.id === 'custom';

  // Localized labels — full words (not single letters), so the Uzbek UI no longer
  // shows Russian «Ш/В».
  const L = {
    ru: { w: 'Ширина', h: 'Высота', unit: 'см', wTitle: 'Ширина в см (1 см = 10 мм)', hTitle: 'Высота в см (1 см = 10 мм)' },
    uz: { w: 'Eni',    h: "Bo'yi",  unit: 'sm', wTitle: 'Eni, sm (1 sm = 10 mm)',     hTitle: "Bo'yi, sm (1 sm = 10 mm)" },
    en: { w: 'Width',  h: 'Height', unit: 'cm', wTitle: 'Width in cm (1 cm = 10 mm)', hTitle: 'Height in cm (1 cm = 10 mm)' },
  };
  const tt = L[lang] || L.ru;

  // Размеры хранятся СТРОКАМИ — поле можно полностью очистить и ввести заново
  // (числовой стейт с «|| 0» мгновенно возвращал значение и стереть было нельзя).
  const [wCm, setWCm] = useState(() => String(+(value.w / 10).toFixed(1)));
  const [hCm, setHCm] = useState(() => String(+(value.h / 10).toFixed(1)));

  // Что мы сами отдали наверх — чтобы обратная синхронизация не переписывала
  // текст, который человек прямо сейчас набирает («5.80» → «5.8» под пальцами).
  const pushedRef = useRef(null);
  // Трогали ли поля руками — чтобы простой уход фокуса не переключал готовый
  // пресет в «своё».
  const touchedRef = useRef(false);

  useEffect(() => {
    const p = pushedRef.current;
    if (p && p.id === value.id && p.w === value.w && p.h === value.h) return;
    setWCm(String(+(value.w / 10).toFixed(1)));
    setHCm(String(+(value.h / 10).toFixed(1)));
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
    pushedRef.current = null;
    if (id === 'custom') {
      const cm = loadSavedCustomDimensions();
      onChange(makeCustomPaperSize(cm.w, cm.h));
    } else {
      onChange(getPaperSize(id));
    }
  };

  const parseCm = (s) => parseFloat(String(s).replace(',', '.'));
  const inRange = (n) => Number.isFinite(n) && n >= CM_MIN && n <= CM_MAX;

  // Пишем в поля как есть (пустая строка допустима). Наверх отдаём размер ТОЛЬКО
  // когда оба значения валидны и попадают в допустимый диапазон. Иначе размер
  // этикетки не трогаем: makeCustomPaperSize зажимает 1…30 см, и раньше этот
  // зажатый результат тут же возвращался в поле — стираешь точку в «5.8», а поле
  // само становилось «30». Выход за диапазон поправим на blur.
  const onCustom = (newW, newH) => {
    touchedRef.current = true;
    setWCm(newW);
    setHCm(newH);
    const w = parseCm(newW);
    const h = parseCm(newH);
    if (inRange(w) && inRange(h)) {
      saveCustomDimensions(w, h);
      savePaperSize('custom');
      const next = makeCustomPaperSize(w, h);
      pushedRef.current = next;
      onChange(next);
    }
  };

  // Ушли из поля — приводим к допустимому виду: пустое/мусор возвращаем к текущему
  // размеру этикетки, выход за границы зажимаем в 1…30 см.
  const onBlurDims = () => {
    if (!touchedRef.current) return;
    touchedRef.current = false;
    const w = parseCm(wCm);
    const h = parseCm(hCm);
    // Округляем до 0.1 см ЗДЕСЬ, а не только при выводе — иначе поле показывало
    // «4.6», а этикетка печаталась 45.8 мм.
    const norm = (n, fallbackMm) => (Number.isFinite(n) && n > 0
      ? Math.round(Math.min(CM_MAX, Math.max(CM_MIN, n)) * 10) / 10
      : Math.round(fallbackMm) / 10);
    const fixW = norm(w, value.w);
    const fixH = norm(h, value.h);
    setWCm(String(fixW));
    setHCm(String(fixH));
    saveCustomDimensions(fixW, fixH);
    savePaperSize('custom');
    const next = makeCustomPaperSize(fixW, fixH);
    pushedRef.current = next;
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: compact ? 12 : 13 }}>📄</span>
      <select value={value.id} onChange={onPickPreset} style={selectStyle}>
        {PAPER_SIZES.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      <span style={labelStyle}>{tt.w}</span>
      <input
        type="text" inputMode="decimal"
        value={wCm}
        onChange={e => onCustom(e.target.value.replace(/[^\d.,]/g, ''), hCm)}
        onBlur={onBlurDims}
        title={tt.wTitle}
        style={inputStyle}
      />
      <span style={labelStyle}>×</span>
      <span style={labelStyle}>{tt.h}</span>
      <input
        type="text" inputMode="decimal"
        value={hCm}
        onChange={e => onCustom(wCm, e.target.value.replace(/[^\d.,]/g, ''))}
        onBlur={onBlurDims}
        title={tt.hTitle}
        style={inputStyle}
      />
      <span style={labelStyle}>{tt.unit}</span>
    </div>
  );
}
