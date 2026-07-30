// Shared label-print utility used by Mobile.jsx and WarehouseBalance.jsx.
// Produces an HTML page that the browser will send to a thermal printer.
//
// Key design: size-adaptive.
// - Caller passes width/height in mm (e.g. 58×40, 58×30, 40×30, 80×50, A4 …).
// - The CSS `@page { size: ${w}mm ${h}mm }` tells the printer driver the exact label dimensions.
// - Inside the page, layout uses % of the page size, so name+barcode+price scale proportionally.
// - Padding is kept absolute (2mm) so we never print to the edge where many printers crop.
//
// `renderPrintBarcodes(win, opts)` fills the SVG placeholders with actual barcodes via JsBarcode.
// JsBarcode width/height are derived from page size so bars stay readable at any label size.

export const PAPER_SIZES = [
  { id: '58x40', label: '58×40 мм',  w: 58,  h: 40,  hint: 'термостикер (классика)' },
  { id: '58x30', label: '58×30 мм',  w: 58,  h: 30,  hint: 'термостикер (узкий)' },
  { id: '58x60', label: '58×60 мм',  w: 58,  h: 60,  hint: 'термостикер (высокий)' },
  { id: '40x30', label: '40×30 мм',  w: 40,  h: 30,  hint: 'малый стикер' },
  { id: '40x25', label: '40×25 мм',  w: 40,  h: 25,  hint: 'узкий малый' },
  { id: '29x19', label: '29×19 мм · 1 ШК', w: 29, h: 19, hint: 'мини-этикетка 2.9×1.9 см — один штрих-код' },
  { id: '50x30', label: '50×30 мм',  w: 50,  h: 30,  hint: 'небольшой' },
  { id: '80x50', label: '80×50 мм',  w: 80,  h: 50,  hint: 'крупный стикер' },
  { id: '100x50', label: '100×50 мм', w: 100, h: 50, hint: 'широкий стикер' },
  { id: 'a4',    label: 'A4 (210×297)', w: 210, h: 297, hint: 'лист — для печати на офисном принтере' },
  { id: 'custom', label: 'Своё (см)',  w: null, h: null, hint: 'свой размер — задай Ш и В в см ниже' },
];

const DEFAULT_PAPER = PAPER_SIZES[0];
const STORAGE_KEY = 'wareapp_print_paper_size';
const CUSTOM_KEY  = 'wareapp_print_paper_custom_cm';

// Build a paper-size object from custom cm dimensions.
// `wCm` / `hCm` allow decimals (e.g. 5.8 × 4.0 cm = 58×40mm).
export function makeCustomPaperSize(wCm, hCm) {
  // NaN не должен молча превращаться в край диапазона — откатываемся к 5.8×4.0 см.
  const mm = (cm, fallback) => {
    const n = Math.round(parseFloat(cm) * 100) / 10;
    return Number.isFinite(n) && n > 0 ? Math.max(10, Math.min(300, n)) : fallback;
  };
  const w = mm(wCm, 58);
  const h = mm(hCm, 40);
  return {
    id: 'custom',
    label: `${(w / 10).toFixed(1)}×${(h / 10).toFixed(1)} см (своё)`,
    w, h,
    hint: 'свой размер',
  };
}

// Persist the last custom { wCm, hCm } the user entered, so reload restores it.
export function loadSavedCustomDimensions() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (raw) {
      const { w, h } = JSON.parse(raw);
      if (typeof w === 'number' && w > 0 && typeof h === 'number' && h > 0) return { w, h };
    }
  } catch {}
  return { w: 5.8, h: 4.0 };
}

export function saveCustomDimensions(wCm, hCm) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify({ w: wCm, h: hCm })); } catch {}
}

export function loadSavedPaperSize() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'custom') {
      const { w, h } = loadSavedCustomDimensions();
      return makeCustomPaperSize(w, h);
    }
    if (saved) {
      const p = PAPER_SIZES.find(s => s.id === saved && s.id !== 'custom');
      if (p) return p;
    }
  } catch {}
  return DEFAULT_PAPER;
}

export function savePaperSize(id) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
}

export function getPaperSize(id) {
  if (id === 'custom') {
    const { w, h } = loadSavedCustomDimensions();
    return makeCustomPaperSize(w, h);
  }
  return PAPER_SIZES.find(s => s.id === id && s.id !== 'custom') || DEFAULT_PAPER;
}

// ─── Per-user print preferences (label size + copies) ──────────────────────────
// Saved under a key suffixed with the current user's id, so several cashiers sharing
// one device each keep their own default size/copies. Falls back to a global key
// when there's no logged-in user.
const PREFS_KEY = 'wareapp_print_prefs';
function prefsKey() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u && u.id ? `${PREFS_KEY}_u${u.id}` : PREFS_KEY;
  } catch { return PREFS_KEY; }
}

// Returns { paper, copies, hasSaved }.
//   paper    — saved paper-size object (preset or custom), or 58×40 default.
//   copies   — saved copy count, or null if the user has never chosen (forces a pick).
//   hasSaved — whether this user has saved print prefs before.
export function loadPrintPrefs() {
  try {
    const raw = localStorage.getItem(prefsKey());
    if (raw) {
      const p = JSON.parse(raw);
      const paper = p.sizeId === 'custom'
        ? makeCustomPaperSize(p.wCm, p.hCm)
        : (PAPER_SIZES.find(s => s.id === p.sizeId && s.id !== 'custom') || DEFAULT_PAPER);
      const copies = (typeof p.copies === 'number' && p.copies > 0) ? Math.min(50, p.copies) : null;
      return { paper, copies, hasSaved: true };
    }
  } catch {}
  return { paper: DEFAULT_PAPER, copies: null, hasSaved: false };
}

// Persist the user's chosen size + copies as their new default.
export function savePrintPrefs(paper, copies) {
  try {
    localStorage.setItem(prefsKey(), JSON.stringify({
      sizeId: paper.id,
      wCm: +(paper.w / 10).toFixed(2),
      hCm: +(paper.h / 10).toFixed(2),
      copies: Math.max(1, Math.min(50, parseInt(copies, 10) || 1)),
    }));
  } catch {}
}

// Generate the print HTML.
// `paper` = { w, h } in mm (use getPaperSize or pass custom).
// `labels` = array of { name, price, barcode } objects, one per sticker.
// `count` (optional) = repeat each label this many times (back-compat with old signature).
export function makeLabelHTML({ paper = DEFAULT_PAPER, labels = [], count = 1 }) {
  const w = paper.w, h = paper.h;
  const safe = (s) => (s || '').toString().replace(/</g, '&lt;');

  // Page proportions — keep readable at any paper size.
  // 2mm padding (absolute, prevents edge crop) regardless of total size.
  // Name occupies ~25% of vertical space, barcode ~55%, price ~20%.
  const padMm = Math.min(2, w * 0.05);
  const nameFontPt = clamp(Math.round(h * 0.20 * 2.83), 6, 13); // 1mm ≈ 2.83pt
  // Низкие этикетки (<32мм) — 1 строка имени с многоточием; выше — 2 строки.
  // Высота блока имени считается ОТ реальной высоты строк (раньше фикс-25% высоты
  // срезал низ второй строки или прятал её целиком без «…»).
  const nameLines = h >= 32 ? 2 : 1;
  const nameBlockMm = +(nameFontPt * 1.2 * nameLines / 2.83).toFixed(1);
  const priceFontPt = clamp(Math.round(h * 0.26 * 2.83), 7, 16);
  const barcodeMaxW = Math.max(10, w - padMm * 2); // mm

  const availPt = barcodeMaxW * 2.8346; // usable width in points (1mm ≈ 2.8346pt)
  const pages = [];
  for (const lab of labels) {
    const safeName = safe(lab.name);
    const safePrice = lab.price ? safe(lab.price) : '';
    // Auto-fit the price font so even a long (8–10 digit) sum fits on ONE line
    // across the label width. Short prices keep the normal (height-based) size.
    const pricePt = safePrice
      ? Math.max(5, Math.min(priceFontPt, Math.round((availPt / (safePrice.length * 0.62)) * 10) / 10))
      : priceFontPt;
    const pageHtml = `
    <div class="page">
      ${safeName ? `<div class="n">${safeName}</div>` : ''}
      <div class="bc"><svg class="bc-svg" data-code="${safe(lab.barcode)}"></svg></div>
      ${safePrice ? `<div class="p" style="font-size:${pricePt}pt">${safePrice}</div>` : ''}
    </div>`;
    for (let i = 0; i < Math.max(1, count); i++) pages.push(pageHtml);
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title> </title>
<style>
  /* size + zero margin tells Chrome to drop its header/footer (date / URL) and
     print the label at its exact physical size. The user must still keep
     "Margins: None" and "Headers & footers: off" in the print dialog. */
  @page { size: ${w}mm ${h}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: 'Nunito', 'Helvetica', 'Arial', sans-serif; -webkit-print-color-adjust: exact; }
  .page {
    width: ${w}mm;
    height: ${h}mm;
    padding: ${padMm}mm;
    display: flex; flex-direction: column;
    align-items: center; justify-content: space-between;
    overflow: hidden;
    page-break-after: always; break-after: page;
  }
  .page:last-child { page-break-after: avoid; break-after: avoid; }
  .n {
    font-size: ${nameFontPt}pt;
    font-weight: 700;
    text-align: center;
    line-height: 1.2;
    max-height: ${nameBlockMm}mm;
    overflow: hidden;
    width: 100%;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: ${nameLines};
    -webkit-box-orient: vertical;
  }
  .bc {
    width: 100%;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
  }
  /* ВАЖНО: масштаб даёт viewBox (проставляет renderPrintBarcodes) + width/height
     100% + preserveAspectRatio meet → код ЦЕЛИКОМ (штрихи и цифры) вписывается
     в отведённое место на любом размере бумаги. Без viewBox svg не масштабируется
     и обрезался справа/снизу («не до конца»). */
  .bc-svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .p {
    font-size: ${priceFontPt}pt;
    font-weight: 800;
    text-align: center;
    margin-top: ${(padMm * 0.5).toFixed(1)}mm;
    max-height: ${(h * 0.22).toFixed(1)}mm;
    line-height: 1;
    overflow: hidden;
    width: 100%;
    white-space: nowrap;
  }
  @media print { body { margin: 0; } }
</style></head>
<body>
${pages.join('')}
</body></html>`;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Render barcodes into the printed window's SVG placeholders.
// JsBarcode dimensions scale with paper width — for narrow labels we shrink bar width.
export function renderPrintBarcodes(win, JsBarcode, paper = DEFAULT_PAPER) {
  if (!win || !JsBarcode) return;
  // Scale barcode bar width and height proportionally to paper dimensions.
  // Reference: 58mm width → width:2, height:50, fontSize:12. Scale linearly from there.
  const refW = 58;
  const scale = clamp(paper.w / refW, 0.6, 1.6);
  const barWidth = +(2 * scale).toFixed(2);
  const barHeight = Math.round(50 * clamp(paper.h / 40, 0.55, 1.5));
  const fontSize = Math.round(clamp(paper.h * 0.16 * 2.83, 8, 16));

  win.document.querySelectorAll('.bc-svg').forEach(svg => {
    const code = svg.getAttribute('data-code');
    if (!code) return;
    try {
      JsBarcode(svg, code, {
        format: 'CODE128',
        width: barWidth,
        height: barHeight,
        fontSize,
        margin: 1,
        displayValue: true,
      });
      // КРИТИЧНО: JsBarcode не ставит viewBox — без него svg не масштабируется
      // под CSS-ширину, и штрихи/цифры ОБРЕЗАЮТСЯ на печати («не до конца»).
      // Переносим натуральные размеры в viewBox → браузер вписывает код целиком
      // в этикетку с сохранением пропорций на любом размере бумаги.
      const natW = parseFloat(svg.getAttribute('width'));
      const natH = parseFloat(svg.getAttribute('height'));
      if (natW > 0 && natH > 0) {
        svg.setAttribute('viewBox', `0 0 ${natW} ${natH}`);
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
    } catch (e) { /* ignore unrenderable codes */ }
  });

  setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 200);
}
