import React, { useState, useCallback, useEffect } from 'react';
import PaperSizeControl from './PaperSizeControl.jsx';
import { loadPrintPrefs, savePrintPrefs } from './printLabel.js';

// Render ONE label (name + barcode + price) onto a high-DPI canvas. Drawing on
// canvas (instead of jsPDF text) lets Cyrillic names render via system fonts; the
// canvas then goes into a PDF page of the EXACT physical size — so the print has
// NO browser header/footer (date / about:blank) and is always 1:1 to the sticker.
function renderLabelCanvas(JsBarcode, item, wMm, hMm) {
  const scale = Math.max(8, Math.min(20, Math.round(2400 / Math.max(wMm, hMm)))); // px per mm
  const cw = Math.round(wMm * scale), ch = Math.round(hMm * scale);
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#000'; ctx.textAlign = 'center';
  const pad = Math.round(1 * scale);
  const innerW = cw - pad * 2;

  // vertical regions: name ~24% · barcode ~50% · price ~22%
  const nameTop = pad, nameH = ch * 0.24;
  const bcTop = nameTop + nameH, bcH = ch * 0.50;
  const priceTop = bcTop + bcH, priceH = ch - priceTop - pad;

  const fitFont = (text, maxW, startPx, minPx, weight) => {
    let s = startPx;
    do { ctx.font = `${weight} ${s}px Arial, sans-serif`; if (ctx.measureText(text).width <= maxW) break; s -= 1; } while (s > minPx);
    return s;
  };

  // ── Name (1–2 lines, centered) ──
  const name = (item.name || '').trim();
  if (name) {
    ctx.textBaseline = 'middle';
    const fs = fitFont(name, innerW, Math.round(nameH * 0.62), Math.round(nameH * 0.3), '700');
    ctx.font = `700 ${fs}px Arial, sans-serif`;
    if (ctx.measureText(name).width <= innerW) {
      ctx.fillText(name, cw / 2, nameTop + nameH / 2);
    } else {
      const words = name.split(' '); let l1 = '', l2 = '';
      for (const wd of words) {
        if (!l2 && ctx.measureText((l1 ? l1 + ' ' : '') + wd).width <= innerW) l1 = l1 ? l1 + ' ' + wd : wd;
        else l2 = l2 ? l2 + ' ' + wd : wd;
      }
      let s2 = l2; while (s2 && ctx.measureText(s2 + '…').width > innerW) s2 = s2.slice(0, -1);
      const lh = fs * 1.05;
      ctx.fillText(l1, cw / 2, nameTop + nameH / 2 - lh / 2);
      ctx.fillText(l2 === s2 ? l2 : (s2 + '…'), cw / 2, nameTop + nameH / 2 + lh / 2);
    }
  }

  // ── Barcode (with its number) ──
  if (item.barcode) {
    try {
      const bcv = document.createElement('canvas');
      JsBarcode(bcv, item.barcode, { format: 'CODE128', displayValue: true, width: 2, height: 70, fontSize: 20, margin: 0, background: '#ffffff' });
      const ar = bcv.height / bcv.width;
      let bw = innerW, bh = bw * ar;
      if (bh > bcH) { bh = bcH; bw = bh / ar; }
      ctx.drawImage(bcv, (cw - bw) / 2, bcTop + (bcH - bh) / 2, bw, bh);
    } catch (e) { /* unrenderable code */ }
  }

  // ── Price (bold, fit to width; чуть сдержаннее — не подавляет штрих-код) ──
  const price = (item.price || '').toString().replace(/\s+/g, ' ').trim();
  if (price) {
    ctx.textBaseline = 'middle';
    const fs = fitFont(price, innerW, Math.round(priceH * 0.74), Math.round(priceH * 0.42), '800');
    ctx.font = `800 ${fs}px Arial, sans-serif`;
    ctx.fillText(price, cw / 2, priceTop + priceH / 2);
  }
  return cv;
}

// Живой предпросмотр этикетки в диалоге печати — рендерит ТОТ ЖЕ renderLabelCanvas,
// что уходит на принтер. Кассир сразу видит результат и понимает, совпадает ли
// выбранный размер с физической наклейкой (главная причина «обрезанной» печати).
function LabelPreview({ item, paper, uz }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let dead = false;
    if (!item || !paper?.w) { setSrc(null); return undefined; }
    import('jsbarcode').then(({ default: JsBarcode }) => {
      if (dead) return;
      try {
        const cv = renderLabelCanvas(JsBarcode, item, paper.w, paper.h);
        setSrc(cv.toDataURL('image/png'));
      } catch { setSrc(null); }
    }).catch(() => {});
    return () => { dead = true; };
  }, [item, paper?.w, paper?.h]);

  if (!src) return null;
  const maxW = 220;
  const wPx = Math.min(maxW, paper.w * 4);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#9094B0', marginBottom: 6 }}>
        {uz ? 'Oldindan ko‘rish' : 'Предпросмотр'} · {paper.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <img src={src} alt="" style={{
          width: wPx, height: wPx * (paper.h / paper.w),
          border: '1px solid #E2E4F0', borderRadius: 6,
          boxShadow: '0 2px 8px rgba(26,27,46,.08)', background: '#fff',
        }} />
        <div style={{ fontSize: 11.5, color: '#6B6F8A', lineHeight: 1.45, flex: 1 }}>
          {uz
            ? 'O‘lcham NAKLEYKANGIZ bilan bir xil bo‘lishi shart — aks holda printer chetini kesib tashlaydi. Chop etishda masshtab «100%» bo‘lsin.'
            : 'Размер должен совпадать с ВАШЕЙ наклейкой — иначе принтер обрежет край. В диалоге печати масштаб — «100%» (фактический размер).'}
        </div>
      </div>
    </div>
  );
}

// Single source of barcode-label printing for the whole app (desktop + phone).
//
// Usage:
//   const { openPrint, printModal } = useBarcodePrint(lang);
//   <button onClick={() => openPrint(items)}>🖨️</button>
//   {printModal}
//
// `items` — one object or an array of { name|name_ru, barcode, price|price_sell }.
//           Items without a barcode are skipped.
//
// Product behaviour:
//   • Clicking print opens a dialog — NOTHING prints until the user confirms.
//   • Copies must be chosen (the "Печать" button is disabled until a count is set).
//   • The chosen size + copies are saved as the user's default (per-user localStorage),
//     so the next time the dialog opens pre-filled and one tap prints.
export default function useBarcodePrint(lang = 'ru') {
  const uz = lang === 'uz';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [paper, setPaper] = useState(() => loadPrintPrefs().paper);
  // Количество копий хранится СТРОКОЙ — поле можно полностью очистить и набрать
  // заново (числовой стейт с «|| 1» не давал стереть единицу — жалоба клиента).
  // `copies` — производное число: null, пока корректное значение не введено.
  const [copiesInput, setCopiesInput] = useState(() => {
    const c = loadPrintPrefs().copies;
    return c ? String(c) : '';
  });
  const copies = (() => {
    const n = parseInt(copiesInput, 10);
    return Number.isFinite(n) && n > 0 ? Math.min(50, n) : null;
  })();
  const setCopies = (n) => setCopiesInput(n == null ? '' : String(n));

  // Accept both normalized ({name, price}) and raw product ({name_ru, price_sell}) shapes.
  const norm = (it) => ({
    name: it.name || it.name_ru || '',
    barcode: it.barcode,
    price: (it.price != null && it.price !== '')
      ? it.price
      : (it.price_sell ? `${parseFloat(it.price_sell).toLocaleString('ru-RU')} UZS` : ''),
  });

  const openPrint = useCallback((its) => {
    const list = Array.isArray(its) ? its : [its];
    const valid = list.filter(it => it && it.barcode).map(norm);
    if (valid.length === 0) { alert(uz ? 'Mahsulotda shtrix-kod yo‘q' : 'У товара нет штрих-кода'); return; }
    const prefs = loadPrintPrefs();        // reload so the latest saved default applies
    setPaper(prefs.paper);
    setCopies(prefs.copies);
    setItems(valid);
    setOpen(true);
  }, [uz]);

  // Пишем в поле как есть (пустая строка допустима); ограничение 1..50 — на blur.
  const setCopiesClamped = (v) => setCopiesInput(String(v).replace(/[^\d]/g, '').slice(0, 2));
  const clampCopiesOnBlur = () => {
    if (copiesInput === '') return;              // пусто — оставляем пустым
    const n = parseInt(copiesInput, 10);
    setCopiesInput(Number.isFinite(n) && n > 0 ? String(Math.min(50, n)) : '');
  };

  const doPrint = async () => {
    if (!copies || copies < 1) return;     // guard: must choose a count
    savePrintPrefs(paper, copies);         // this choice becomes the user's default
    try {
      const [{ jsPDF }, { default: JsBarcode }] = await Promise.all([import('jspdf'), import('jsbarcode')]);
      const W = paper.w, H = paper.h, landscape = W >= H;
      const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: landscape ? 'landscape' : 'portrait', compress: true });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      let first = true;
      for (const it of items) {
        for (let c = 0; c < copies; c++) {
          if (!first) doc.addPage([W, H], landscape ? 'landscape' : 'portrait');
          first = false;
          const cv = renderLabelCanvas(JsBarcode, it, pw, ph);
          doc.addImage(cv.toDataURL('image/png'), 'PNG', 0, 0, pw, ph);
        }
      }
      // Print via a hidden iframe — prints the PDF directly through the browser:
      // no new tab, no popup blocker, no "download instead of open" issue, and a
      // PDF carries NO browser header/footer (so no date / about:blank on the label).
      const blobUrl = URL.createObjectURL(doc.output('blob'));
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0;visibility:hidden;';
      frame.src = blobUrl;
      frame.onload = () => {
        setTimeout(() => {
          try { frame.contentWindow.focus(); frame.contentWindow.print(); }
          catch (e) { window.open(blobUrl, '_blank'); } // fallback: open the PDF in a tab
        }, 350);
        setTimeout(() => { try { document.body.removeChild(frame); } catch {} URL.revokeObjectURL(blobUrl); }, 120000);
      };
      document.body.appendChild(frame);
    } catch (e) {
      console.error('pdf print err', e);
      alert(uz ? 'Chop etishda xato' : 'Ошибка печати');
    }
    setOpen(false);
  };

  const presetBtn = (n) => (
    <button key={n} type="button" onClick={() => setCopies(n)} style={{
      padding: '6px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer',
      fontWeight: 800, fontSize: '13px',
      background: copies === n ? '#fff' : 'transparent',
      color: copies === n ? '#4338ca' : '#6B6F8A',
      boxShadow: copies === n ? '0 1px 3px rgba(26,27,46,.1)' : 'none',
    }}>×{n}</button>
  );

  const printModal = open ? (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: '20px' }}
      onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,.25)', fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ fontWeight: 800, fontSize: '18px', color: '#1A1B2E' }}>🖨️ {uz ? 'Shtrix-kod chop etish' : 'Печать штрих-кода'}</div>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9EA3BF' }}>×</button>
        </div>
        <div style={{ fontSize: '12px', color: '#6B6F8A', marginBottom: '18px' }}>
          {uz
            ? `Tanlangan: ${items.length} ta mahsulot. Nusxa soni va etiketka o‘lchamini tanlang.`
            : `Выбрано: ${items.length} товар(ов). Задайте количество копий и размер этикетки.`}
        </div>

        {/* Copies */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#9094B0', marginBottom: 6 }}>{uz ? 'Har bir mahsulot uchun nusxalar' : 'Копий каждого ценника'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px', background: '#F4F5FA', padding: '4px', borderRadius: '10px' }}>
              {[1, 3, 6, 9].map(presetBtn)}
            </div>
            <input type="text" inputMode="numeric" value={copiesInput}
              placeholder="—"
              onChange={e => setCopiesClamped(e.target.value)}
              onBlur={clampCopiesOnBlur}
              title={uz ? 'O‘z soningiz (1–50)' : 'Своё количество (1–50)'}
              style={{ width: 64, padding: '7px 8px', border: '1.5px solid #E2E4F0', borderRadius: 8, fontWeight: 800, fontSize: 13, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", color: '#1A1B2E' }} />
          </div>
        </div>

        {/* Label size */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#9094B0', marginBottom: 6 }}>{uz ? 'Etiketka o‘lchami' : 'Размер этикетки'}</div>
          <PaperSizeControl value={paper} onChange={setPaper} lang={lang} />
        </div>

        {/* Живой предпросмотр — что реально уйдёт на принтер при выбранном размере */}
        <LabelPreview item={items[0]} paper={paper} uz={uz} />

        {/* Total preview / required-choice hint */}
        {copies ? (
          <div style={{ background: '#EEF3FF', borderRadius: 10, padding: '10px 12px', marginBottom: '18px', fontSize: '13px', fontWeight: 700, color: '#4338ca' }}>
            {uz ? 'Jami etiketka' : 'Всего этикеток'}: {items.length} × {copies} = {items.length * copies}
            <span style={{ color: '#9094B0', fontWeight: 600 }}> · {paper.label}</span>
          </div>
        ) : (
          <div style={{ background: '#FFF6E5', borderRadius: 10, padding: '10px 12px', marginBottom: '18px', fontSize: '12px', fontWeight: 700, color: '#92400E' }}>
            {uz ? 'Avval nusxalar sonini tanlang' : 'Сначала выберите количество копий'}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={doPrint} disabled={!copies}
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center', opacity: copies ? 1 : 0.5, cursor: copies ? 'pointer' : 'not-allowed' }}>
            🖨️ {uz ? 'Chop etish' : 'Печать'}
          </button>
          <button onClick={() => setOpen(false)} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
            {uz ? 'Bekor qilish' : 'Отмена'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { openPrint, printModal };
}
