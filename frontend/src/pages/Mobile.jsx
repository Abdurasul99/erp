import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, LangContext } from '../App.jsx';
import { t } from '../i18n.js';
import api from '../api.js';
import JsBarcode from 'jsbarcode';
import { fmtMoney } from '../utils.js';

const S = {
  page: {
    background: '#F4F5FA', minHeight: '100vh',
    maxWidth: '480px', margin: '0 auto',
    fontFamily: "'Nunito', sans-serif",
  },
  header: {
    background: 'linear-gradient(135deg, #3D33C4, #5B4FE8)',
    padding: '14px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 100,
  },
  headerLeft: { display: 'flex', flexDirection: 'column' },
  headerTitle: { color: '#fff', fontWeight: 800, fontSize: '16px', lineHeight: 1.2 },
  headerSub: { color: 'rgba(255,255,255,.65)', fontSize: '12px', marginTop: '2px' },
  backBtn: {
    background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
    padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
    fontWeight: 700, fontSize: '13px',
  },
  card: {
    background: '#fff', borderRadius: '14px',
    boxShadow: '0 2px 12px rgba(91,79,232,.08)',
    padding: '16px', margin: '12px 16px 0',
  },
  scanZone: {
    border: '2px dashed #5B4FE8', borderRadius: '12px',
    padding: '28px 16px', textAlign: 'center', cursor: 'pointer',
    background: 'rgba(91,79,232,.03)', transition: 'all .2s',
  },
  scanZoneActive: {
    border: '2px solid #FF6B2B', background: 'rgba(255,107,43,.04)',
  },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: '#fff', borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(91,79,232,.08)',
    padding: '0 14px', margin: '10px 16px 0',
    border: '2px solid transparent', transition: 'border-color .2s',
  },
  searchInput: {
    flex: 1, border: 'none', outline: 'none',
    padding: '14px 0', fontSize: '14px', background: 'transparent',
    fontFamily: "'Nunito', sans-serif",
  },
  divider: {
    textAlign: 'center', margin: '14px 16px 0',
    fontSize: '11px', fontWeight: 800, color: '#9EA3BF',
    letterSpacing: '0.8px', textTransform: 'uppercase',
    display: 'flex', alignItems: 'center', gap: '10px',
  },
  dividerLine: { flex: 1, height: '1px', background: '#E2E4F0' },
  label: {
    fontSize: '11px', fontWeight: 800, color: '#6B6F8A',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    marginBottom: '5px', display: 'block',
  },
  input: {
    width: '100%', padding: '11px 12px',
    border: '1.5px solid #E2E4F0', borderRadius: '8px',
    fontSize: '14px', fontFamily: "'Nunito', sans-serif",
    outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s',
  },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' },
  saveBtn: {
    width: '100%', padding: '14px',
    background: 'linear-gradient(135deg, #5B4FE8, #3D33C4)',
    border: 'none', borderRadius: '10px', color: '#fff',
    fontWeight: 800, fontSize: '15px', cursor: 'pointer',
    fontFamily: "'Nunito', sans-serif", marginTop: '14px',
    boxShadow: '0 4px 15px rgba(91,79,232,.3)',
  },
  productCard: {
    background: 'linear-gradient(135deg, #5B4FE8, #3D33C4)',
    borderRadius: '14px', padding: '16px', color: '#fff',
  },
  qtyRow: {
    display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px',
  },
  qtyBtn: {
    width: '40px', height: '40px', borderRadius: '8px', border: 'none',
    cursor: 'pointer', fontSize: '20px', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  qtyInput: {
    flex: 1, textAlign: 'center', padding: '10px',
    border: '2px solid #E2E4F0', borderRadius: '8px',
    fontSize: '20px', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
    outline: 'none',
  },
  actionBtn: {
    flex: 1, padding: '13px', border: 'none', borderRadius: '10px',
    fontWeight: 800, fontSize: '14px', cursor: 'pointer',
    fontFamily: "'Nunito', sans-serif",
  },
};

// HTML for a 58×40mm thermal label.
// Forces @page size, scales SVG to 54mm wide (2mm margin each side),
// clamps name to 2 lines max so layout is predictable.
function makeLabel58x40({ name, price, svgData }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${name || 'Label'}</title>
<style>
  @page { size: 58mm 40mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 58mm; height: 40mm; padding: 2mm;
    font-family: 'Helvetica', 'Arial', sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: space-between;
    overflow: hidden; background: #fff;
  }
  .n {
    font-size: 9pt; font-weight: 700; text-align: center;
    line-height: 1.15; max-height: 9mm; overflow: hidden;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    width: 100%; word-break: break-word;
  }
  .p { font-size: 11pt; font-weight: 800; text-align: center; margin-top: 1mm; }
  .bc { width: 100%; flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
  .bc svg { width: 54mm !important; height: auto !important; max-height: 22mm; display: block; }
  @media print { body { margin: 0; } }
</style></head>
<body>
  ${name ? `<div class="n">${name}</div>` : ''}
  ${price ? `<div class="p">${price}</div>` : ''}
  <div class="bc">${svgData}</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),120);<\/script>
</body></html>`;
}

// simple barcode with external ref for printing
function BarcodeImgRef({ value, svgRef }) {
  useEffect(() => {
    if (svgRef.current && value) {
      try { JsBarcode(svgRef.current, value, { format: 'CODE128', width: 2, height: 44, displayValue: true, fontSize: 12 }); }
      catch {}
    }
  }, [value]);
  return <svg ref={svgRef} style={{ maxWidth: '100%' }} />;
}

// ─── Barcode SVG + Print ───────────────────────────────────────────────────────
function BarcodeImg({ value, productName, showPrint = false, lang }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && value) {
      try { JsBarcode(ref.current, value, { format: 'CODE128', width: 2, height: 50, displayValue: true, fontSize: 13 }); }
      catch {}
    }
  }, [value]);

  const handlePrint = () => {
    const svgEl = ref.current;
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const win = window.open('', '_blank', 'width=300,height=240');
    win.document.write(makeLabel58x40({ name: productName, svgData }));
    win.document.close();
  };

  if (!value) return null;
  return (
    <div style={{ background: '#fff', borderRadius: '8px', padding: '10px', textAlign: 'center', marginTop: '10px' }}>
      <svg ref={ref} />
      {showPrint && (
        <button onClick={handlePrint} style={{
          marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px',
          margin: '8px auto 0', padding: '8px 20px',
          background: '#1e1b4b', color: '#fff', border: 'none', borderRadius: '8px',
          cursor: 'pointer', fontWeight: 700, fontSize: '13px',
          fontFamily: "'Nunito', sans-serif",
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          {lang === 'uz' ? 'Chop etish' : 'Распечатать'}
        </button>
      )}
    </div>
  );
}

// ─── Camera Scanner ────────────────────────────────────────────────────────────
function CameraScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const instanceRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const elementId = 'html5-qrcode-scanner';
    let stopped = false;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return;
      const scanner = new Html5Qrcode(elementId, { verbose: false });
      instanceRef.current = scanner;

      scanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 150 }, aspectRatio: 1.5 },
        (decodedText) => {
          if (!stopped) {
            stopped = true;
            scanner.stop().catch(() => {});
            onScan(decodedText);
          }
        },
        () => {}
      ).then(() => setReady(true))
       .catch(e => setError(e?.message || t('noCameraAccess')));
    }).catch(() => setError(t('scannerLoadError')));

    return () => {
      stopped = true;
      instanceRef.current?.stop().catch(() => {});
    };
  }, []);

  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#000', position: 'relative' }}>
      {/* html5-qrcode рендерит video внутри этого div */}
      <div id="html5-qrcode-scanner" ref={scannerRef} style={{ width: '100%' }} />

      {!ready && !error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: '13px', fontWeight: 700 }}>
          {t('cameraLoading')}
        </div>
      )}

      {error && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#f87171', fontSize: '13px', fontWeight: 700 }}>
          {error}
        </div>
      )}

      {/* Overlay frame */}
      {ready && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          border: '3px solid #FF6B2B', borderRadius: '12px',
        }} />
      )}

      <button onClick={onClose} style={{
        position: 'absolute', top: '10px', right: '10px', zIndex: 10,
        background: 'rgba(0,0,0,.6)', border: 'none', color: '#fff',
        borderRadius: '20px', padding: '6px 14px', cursor: 'pointer',
        fontWeight: 700, fontSize: '13px', fontFamily: "'Nunito', sans-serif",
      }}>{t('stopScan')}</button>
    </div>
  );
}

// ─── Add Product Form ──────────────────────────────────────────────────────────
function AddProductForm({ initialBarcode, initialName, onSaved, onCancel, lang }) {
  const uz = lang === 'uz';
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({
    name_ru: initialName || '', type_id: '', price_sell: '', price_buy: '', quantity: '1',
    color_size: '', brand: '', barcode: initialBarcode || '', photo_url: '', unit: 'шт',
  });
  const [customUnit, setCustomUnit] = useState('');
  const [newType, setNewType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [showOptional, setShowOptional] = useState(false);
  const [generatedBarcode, setGeneratedBarcode] = useState(initialBarcode || '');

  useEffect(() => {
    api.get('/types').then(r => setTypes(r.data));
    if (!initialBarcode) genBarcode();
  }, []);

  const genBarcode = async () => {
    const { data } = await api.post('/products/generate-barcode');
    setGeneratedBarcode(data.barcode);
    setForm(f => ({ ...f, barcode: data.barcode }));
  };

  const handleAddType = async () => {
    if (!newType.trim()) return;
    const { data } = await api.post('/types', { name_ru: newType, name_uz: newType });
    setTypes(prev => [...prev, data]);
    setForm(f => ({ ...f, type_id: String(data.id) }));
    setNewType('');
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    const fd = new FormData();
    fd.append('photo', file);
    try {
      const { data } = await api.post('/upload/photo', fd);
      setForm(f => ({ ...f, photo_url: data.url }));
    } catch (err) {
      const status = err.response?.status;
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const errText = status === 413
        ? (uz ? `Fayl juda katta (${sizeMB} MB). Max 15 MB.` : `Файл слишком большой (${sizeMB} MB). Макс 15 MB.`)
        : (err.response?.data?.error || (uz ? 'Yuklashda xato' : 'Ошибка загрузки'));
      setMsg(errText);
    }
    // Reset the input so picking the SAME file again still triggers onChange
    e.target.value = '';
    setUploading(false);
  };

  // Validate required fields before creating product
  const validateForm = () => {
    if (!form.name_ru || !form.name_ru.trim()) {
      setMsg(uz ? 'Tovar nomini kiriting' : 'Введите название товара');
      return false;
    }
    return true;
  };

  // Create product, then record initial transaction (income or outcome)
  const handleSaveWith = async (txType) => {
    if (!validateForm()) return;
    setMsg(null);
    setSaving(true);
    const qty = parseFloat(form.quantity) || 0;
    try {
      const product = await api.post('/products', {
        name_ru: form.name_ru,
        name_uz: form.name_ru,
        type_id: form.type_id ? parseInt(form.type_id) : null,
        barcode: form.barcode,
        photo_url: form.photo_url || null,
        price_sell: parseFloat(form.price_sell) || 0,
        price_buy: parseFloat(form.price_buy) || 0,
        color_size: form.color_size || null,
        brand: form.brand || null,
        unit: form.unit || 'шт',
      });
      const pid = product.data.id;
      let finalStock = 0;
      if (qty > 0) {
        if (txType === 'income') {
          await api.post('/stock/income', {
            product_id: pid, quantity: qty,
            price: parseFloat(form.price_buy) || parseFloat(form.price_sell) || 0,
            supplier: '',
          });
          finalStock = qty;
        } else if (txType === 'outcome') {
          // For "Расход" on a brand-new product: register income first (so we have stock),
          // then outcome (so we record the sale). Net stock = 0, but both movements tracked.
          await api.post('/stock/income', {
            product_id: pid, quantity: qty,
            price: parseFloat(form.price_buy) || parseFloat(form.price_sell) || 0,
            supplier: '',
          });
          await api.post('/stock/outcome', {
            product_id: pid, quantity: qty,
            price: parseFloat(form.price_sell) || 0,
          });
          finalStock = 0;
        }
      }
      setSaved(product.data.name_ru || '✓');
      setTimeout(() => setSaved(null), 3000);
      onSaved({ ...product.data, stock: finalStock });
    } catch (err) {
      setMsg(err.response?.data?.error || t('error'));
    }
    setSaving(false);
  };

  // Form submit (Enter key) defaults to "income"
  const handleSubmit = (e) => { e.preventDefault(); handleSaveWith('income'); };

  return (
    <form onSubmit={handleSubmit}>
      {saved && (
        <div style={{ background: 'rgba(34,197,94,.12)', color: '#16a34a', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          ✓ {uz ? `"${saved}" saqlandi` : `"${saved}" сохранён`}
        </div>
      )}
      {msg && (
        <div style={{ background: 'rgba(239,68,68,.1)', color: '#dc2626', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: 600 }}>
          {msg}
        </div>
      )}

      {/* Name — required, prominent */}
      <div style={{ marginBottom: '14px' }}>
        <label style={S.label}>{uz ? 'NOMI *' : 'НАИМЕНОВАНИЕ *'}</label>
        <input
          style={{ ...S.input, fontSize: '15px', padding: '13px 14px' }}
          value={form.name_ru}
          onChange={e => setForm({ ...form, name_ru: e.target.value })}
          placeholder={uz ? 'Tovar nomini kiriting' : 'Введите название товара'}
          autoFocus required
        />
      </div>

      {/* Type — pill chips */}
      <div style={{ marginBottom: '14px' }}>
        <label style={S.label}>{uz ? 'TURI' : 'ТИП ТОВАРА'}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '8px' }}>
          {types.map(tp => {
            const selected = String(tp.id) === form.type_id;
            return (
              <button key={tp.id} type="button"
                onClick={() => setForm(f => ({ ...f, type_id: selected ? '' : String(tp.id) }))}
                style={{
                  padding: '8px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 700, fontFamily: "'Nunito', sans-serif",
                  background: selected ? '#4338ca' : '#F4F5FA',
                  color: selected ? '#fff' : '#6B6F8A',
                  boxShadow: selected ? '0 2px 8px rgba(67,56,202,.3)' : 'none',
                  transition: 'all .15s',
                }}>
                {uz ? tp.name_uz : tp.name_ru}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            style={{ ...S.input, flex: 1, fontSize: '13px', padding: '10px 12px' }}
            value={newType}
            onChange={e => setNewType(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddType())}
            placeholder={uz ? '+ Yangi tur...' : '+ Новый тип...'}
          />
          {newType.trim() && (
            <button type="button" onClick={handleAddType} style={{
              padding: '0 16px', border: 'none', borderRadius: '8px',
              background: '#4338ca', color: '#fff', fontWeight: 800, cursor: 'pointer',
              fontSize: '18px', fontFamily: "'Nunito', sans-serif",
            }}>+</button>
          )}
        </div>
      </div>

      {/* Unit picker — определяет в чём измеряется товар */}
      <div style={{ marginBottom: '14px' }}>
        <label style={S.label}>{uz ? 'O\'LCHOV BIRLIGI' : 'ЕДИНИЦА ИЗМЕРЕНИЯ'}</label>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {[
            { u: 'шт',     l: uz ? 'dona'     : 'шт',     i: '📦' },
            { u: 'кг',     l: uz ? 'kg'       : 'кг',     i: '⚖️' },
            { u: 'г',      l: uz ? 'gr'       : 'г',      i: '🧪' },
            { u: 'л',      l: uz ? 'litr'     : 'л',      i: '💧' },
            { u: 'мл',     l: uz ? 'ml'       : 'мл',     i: '💦' },
            { u: 'м',      l: uz ? 'metr'     : 'м',      i: '📏' },
            { u: 'см',     l: uz ? 'sm'       : 'см',     i: '📐' },
            { u: 'м²',     l: 'м²',                       i: '🟦' },
            { u: 'м³',     l: 'м³',                       i: '🟨' },
            { u: 'упак',   l: uz ? 'paket'    : 'упак',   i: '📦' },
            { u: 'коробка', l: uz ? 'quti'    : 'коробка', i: '📦' },
            { u: 'ящик',   l: uz ? 'yaschik'  : 'ящик',   i: '🗃️' },
            { u: 'рулон',  l: uz ? 'rulon'    : 'рулон',  i: '🧻' },
            { u: 'пара',   l: uz ? 'juft'     : 'пара',   i: '👟' },
            { u: 'компл',  l: uz ? 'komplekt' : 'компл',  i: '🎁' },
            { u: 'пачка',  l: uz ? 'pachka'   : 'пачка',  i: '📚' },
          ].map(o => (
            <button key={o.u} type="button" onClick={() => setForm({ ...form, unit: o.u })}
              style={{
                padding: '7px 12px', borderRadius: '20px',
                border: `1.5px solid ${form.unit === o.u ? '#4338ca' : '#E2E4F0'}`,
                background: form.unit === o.u ? 'rgba(67,56,202,.08)' : '#fff',
                color: form.unit === o.u ? '#4338ca' : '#6B6F8A',
                cursor: 'pointer', fontWeight: 700, fontSize: '12px', fontFamily: "'Nunito', sans-serif",
                whiteSpace: 'nowrap', transition: 'all .15s ease',
              }}>{o.i} {o.l}</button>
          ))}
        </div>
        {/* Custom unit input — for unusual cases */}
        <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
          <input
            style={{ ...S.input, flex: 1, fontSize: '13px', padding: '8px 11px' }}
            value={customUnit}
            onChange={e => setCustomUnit(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && customUnit.trim()) {
                e.preventDefault();
                setForm({ ...form, unit: customUnit.trim() });
                setCustomUnit('');
              }
            }}
            placeholder={uz ? '+ Boshqa birlik...' : '+ Своя единица...'}
          />
          {customUnit.trim() && (
            <button type="button"
              onClick={() => { setForm({ ...form, unit: customUnit.trim() }); setCustomUnit(''); }}
              style={{
                padding: '8px 14px', background: '#4338ca', color: '#fff',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 700, fontSize: '13px', fontFamily: "'Nunito', sans-serif",
              }}>OK</button>
          )}
        </div>
      </div>

      {/* Price + Quantity — side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        <div>
          <label style={S.label}>
            {uz ? "NARXI (SO'M / " + form.unit + ")" : 'ЦЕНА ПРОДАЖИ (за ' + form.unit + ')'}
          </label>
          <input
            style={{ ...S.input, fontSize: '15px', padding: '12px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}
            type="number" min="0" inputMode="numeric"
            value={form.price_sell}
            onChange={e => setForm({ ...form, price_sell: e.target.value })}
            placeholder="0"
          />
        </div>
        <div>
          <label style={S.label}>
            {uz ? 'MIQDOR (' + form.unit + ')' : 'КОЛИЧЕСТВО (' + form.unit + ')'}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button type="button"
              onClick={() => setForm(f => ({ ...f, quantity: String(Math.max(0, parseFloat(f.quantity || 0) - 1)) }))}
              style={{ width: '38px', height: '42px', borderRadius: '8px', border: '1.5px solid #E2E4F0', background: '#F4F5FA', fontSize: '20px', cursor: 'pointer', fontWeight: 700, color: '#4338ca', flexShrink: 0 }}>−</button>
            <input
              style={{ ...S.input, flex: 1, fontSize: '16px', fontWeight: 800, textAlign: 'center', padding: '10px 4px', fontFamily: "'JetBrains Mono', monospace" }}
              type="number" min="0" step="any" inputMode="decimal"
              value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })}
            />
            <button type="button"
              onClick={() => setForm(f => ({ ...f, quantity: String(parseFloat(f.quantity || 0) + 1) }))}
              style={{ width: '38px', height: '42px', borderRadius: '8px', border: 'none', background: '#4338ca', fontSize: '20px', cursor: 'pointer', fontWeight: 700, color: '#fff', flexShrink: 0 }}>+</button>
          </div>
        </div>
      </div>

      {/* Photo — 2 options: camera or gallery */}
      <div style={{ marginBottom: '14px' }}>
        <label style={S.label}>{uz ? 'RASM' : 'ФОТО'}</label>
        {form.photo_url ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            border: '1.5px solid #E2E4F0', borderRadius: '10px',
            padding: '10px', background: 'rgba(91,79,232,.04)',
          }}>
            <img src={form.photo_url} alt="" style={{ height: '56px', width: '56px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: '12px', color: 'var(--text2)', fontWeight: 600 }}>
              {uz ? 'Rasm yuklandi' : 'Фото загружено'}
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, photo_url: '' }))}
              style={{ background: 'rgba(239,68,68,.1)', border: 'none', color: '#dc2626',
                padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '12px',
                fontFamily: "'Nunito', sans-serif", flexShrink: 0 }}>
              {uz ? 'Olib tashlash' : 'Удалить'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {/* Camera */}
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              border: '1.5px dashed #E2E4F0', borderRadius: '10px',
              padding: '14px', textAlign: 'center', cursor: 'pointer', background: '#fafafa',
            }}>
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
              <span style={{ fontSize: '13px', color: '#6B6F8A', fontWeight: 700 }}>
                📷 {uz ? 'Kamera' : 'Камера'}
              </span>
            </label>
            {/* Gallery */}
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              border: '1.5px dashed #E2E4F0', borderRadius: '10px',
              padding: '14px', textAlign: 'center', cursor: 'pointer', background: '#fafafa',
            }}>
              <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
              <span style={{ fontSize: '13px', color: '#6B6F8A', fontWeight: 700 }}>
                🖼️ {uz ? 'Galereya' : 'Галерея'}
              </span>
            </label>
          </div>
        )}
        {uploading && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--primary)', fontWeight: 700, textAlign: 'center' }}>
            ⏳ {uz ? 'Yuklanmoqda...' : 'Загрузка...'}
          </div>
        )}
      </div>

      {/* Optional fields toggle */}
      <button type="button" onClick={() => setShowOptional(v => !v)} style={{
        width: '100%', padding: '10px', background: 'none', border: '1.5px dashed #E2E4F0',
        borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
        color: '#9EA3BF', fontFamily: "'Nunito', sans-serif", marginBottom: '10px',
      }}>
        {showOptional ? '▲' : '▼'} {uz ? 'Qo\'shimcha ma\'lumotlar' : 'Дополнительные поля'}
      </button>

      {showOptional && (
        <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={S.label}>{uz ? 'TAN NARXI (SO\'M)' : 'ЦЕНА ЗАКУПКИ'}</label>
            <input style={{ ...S.input, fontSize: '14px', padding: '11px 12px' }}
              type="number" min="0" inputMode="numeric"
              value={form.price_buy}
              onChange={e => setForm({ ...form, price_buy: e.target.value })}
              placeholder="0" />
          </div>
          <div>
            <label style={S.label}>{uz ? "RANG / O'LCHAM" : 'ЦВЕТ / РАЗМЕР'}</label>
            <input style={{ ...S.input, fontSize: '14px', padding: '11px 12px' }} value={form.color_size}
              onChange={e => setForm({ ...form, color_size: e.target.value })}
              placeholder={uz ? "Rang, o'lcham..." : 'Цвет, размер...'} />
          </div>
          <div>
            <label style={S.label}>{uz ? 'BREND' : 'БРЕНД'}</label>
            <input style={{ ...S.input, fontSize: '14px', padding: '11px 12px' }} value={form.brand}
              onChange={e => setForm({ ...form, brand: e.target.value })}
              placeholder={uz ? 'Brend nomi...' : 'Название бренда...'} />
          </div>
        </div>
      )}

      {/* Barcode row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', padding: '8px 10px', background: '#F4F5FA', borderRadius: '8px' }}>
        <span style={{ fontSize: '12px', color: '#6B6F8A', fontWeight: 700, flexShrink: 0 }}>
          {uz ? 'Shtrix-kod:' : 'Штрих-код:'}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#4338ca', fontWeight: 700, fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {form.barcode}
        </span>
        <button type="button" onClick={genBarcode} title={uz ? 'Yangilash' : 'Обновить'} style={{
          background: 'none', border: '1.5px solid #E2E4F0', borderRadius: '6px',
          padding: '4px 8px', cursor: 'pointer', color: '#9EA3BF', lineHeight: 1,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#9EA3BF" strokeWidth="2" style={{ width: 13, height: 13 }}>
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>
      <BarcodeImg value={generatedBarcode} productName={form.name_ru} showPrint lang={lang} />

      {/* Action: only "Приход" — new products always come INTO stock */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving} style={{
            padding: '14px 18px', border: '1.5px solid #E2E4F0', borderRadius: '10px',
            background: '#fff', color: '#9EA3BF', fontWeight: 700, fontSize: '14px',
            cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Nunito', sans-serif",
          }}>✕</button>
        )}
        <button type="button" disabled={saving} onClick={() => handleSaveWith('income')} style={{
          flex: 1, padding: '14px', border: 'none', borderRadius: '10px',
          background: saving ? '#9EA3BF' : 'linear-gradient(135deg, #22C55E, #16a34a)',
          color: '#fff', fontWeight: 800, fontSize: '15px',
          cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Nunito', sans-serif",
          boxShadow: saving ? 'none' : '0 4px 12px rgba(34,197,94,.3)',
        }}>
          📥 {saving ? (uz ? 'Saqlanmoqda...' : 'Сохранение...') : (uz ? 'Saqlash va kirim' : 'Сохранить и приход')}
        </button>
      </div>
    </form>
  );
}

// format: removes trailing zeros (2.000 → 2, 1.500 → 1.5)
const fmtQty = (val) => parseFloat(parseFloat(val).toFixed(3)).toString();

// ─── Product Found Card ────────────────────────────────────────────────────────
function FoundProduct({ product, role, lang, onReset }) {
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(product);
  const barcodeRef = useRef(null);

  const doAction = async (type) => {
    setLoading(true); setMsg(null);
    try {
      const price = type === 'income' ? currentProduct.price_buy : currentProduct.price_sell;
      await api.post(`/stock/${type}`, {
        product_id: currentProduct.id, quantity: qty, price: price || 0,
      });
      const { data } = await api.get(`/products/${currentProduct.id}`);
      setCurrentProduct(data);
      setMsg({ ok: true, text: `${fmtQty(qty)} ${currentProduct.unit} — ${type === 'income' ? (lang === 'uz' ? 'qabul qilindi' : 'принято') : (lang === 'uz' ? 'chiqarildi' : 'продано')}` });
      setQty(1);
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || t('error') });
    }
    setLoading(false);
  };

  const handlePrint = () => {
    const svgEl = barcodeRef.current;
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const price = currentProduct.price_sell ? `${parseFloat(currentProduct.price_sell).toLocaleString('ru-RU')} UZS` : '';
    const win = window.open('', '_blank', 'width=300,height=240');
    win.document.write(makeLabel58x40({ name: currentProduct.name_ru, price, svgData }));
    win.document.close();
  };

  const uz = lang === 'uz';
  const rows = [
    { label: uz ? 'Nomi' : 'Наименование', value: uz && currentProduct.name_uz ? currentProduct.name_uz : currentProduct.name_ru, bold: true },
    { label: uz ? 'Turi' : 'Тип', value: currentProduct.type_name_ru || '—' },
    { label: uz ? 'Rang/o\'lcham' : 'Цвет/размер', value: currentProduct.color_size || '—' },
    { label: uz ? 'Brend' : 'Бренд', value: currentProduct.brand || '—' },
    { label: uz ? 'Birlik' : 'Единица', value: currentProduct.unit },
    { label: uz ? 'Narxi' : 'Цена', value: fmtMoney(currentProduct.price_sell || 0), color: '#fbbf24' },
    { label: uz ? 'Qoldiq' : 'Остаток', value: `${fmtQty(currentProduct.stock)} ${currentProduct.unit}`, color: currentProduct.stock > 0 ? '#4ade80' : '#f87171' },
  ];

  return (
    <div>
      {/* Product card — table layout */}
      <div style={{ ...S.productCard, margin: '12px 16px 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
          {currentProduct.photo_url ? (
            <img src={currentProduct.photo_url} alt="" style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover', border: '2px solid rgba(255,255,255,.3)', flexShrink: 0 }} />
          ) : (
            <div style={{ width: '52px', height: '52px', borderRadius: '10px', background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" style={{ width: 24, height: 24 }}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
          )}
          <div style={{ fontWeight: 900, fontSize: '17px', lineHeight: 1.3 }}>
            {uz && currentProduct.name_uz ? currentProduct.name_uz : currentProduct.name_ru}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: '10px', overflow: 'hidden' }}>
          {rows.filter(r => r.value && r.value !== '—').map((row, i) => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px',
              borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,.08)' : 'none',
            }}>
              <span style={{ fontSize: '12px', opacity: .65, fontWeight: 600 }}>{row.label}</span>
              <span style={{
                fontSize: '13px', fontWeight: row.bold ? 800 : 700,
                color: row.color || '#fff',
                fontFamily: row.label.includes('ст') || row.label.includes('old') || row.label.includes('арх') || row.label.includes('arx') ? "'JetBrains Mono', monospace" : 'inherit',
              }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Barcode + print side by side */}
        {currentProduct.barcode && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, background: '#fff', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <BarcodeImgRef value={currentProduct.barcode} svgRef={barcodeRef} />
              </div>
              <button onClick={handlePrint} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '10px',
                padding: '12px 14px', cursor: 'pointer', color: '#fff', flexShrink: 0,
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" style={{ width: 22, height: 22 }}>
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                <span style={{ fontSize: '10px', fontWeight: 800, fontFamily: "'Nunito', sans-serif" }}>
                  {uz ? 'Chop' : 'Печать'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quantity + actions */}
      <div style={{ ...S.card, marginTop: '10px' }}>
        <label style={S.label}>{t('quantity')}</label>
        <div style={S.qtyRow}>
          <button type="button" onClick={() => setQty(q => Math.max(0.001, q - 1))} style={{ ...S.qtyBtn, background: '#F4F5FA', color: '#5B4FE8' }}>−</button>
          <input style={S.qtyInput} type="number" min="0.001" step="any" value={qty}
            onChange={e => setQty(parseFloat(e.target.value) || 1)} />
          <button type="button" onClick={() => setQty(q => q + 1)} style={{ ...S.qtyBtn, background: '#5B4FE8', color: '#fff' }}>+</button>
        </div>

        {msg && (
          <div style={{ margin: '10px 0', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, background: msg.ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: msg.ok ? '#16a34a' : '#dc2626' }}>
            {msg.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {role === 'seller' ? (
            <button onClick={() => doAction('outcome')} disabled={loading} style={{ ...S.actionBtn, background: 'linear-gradient(135deg, #FF6B2B, #FF8C55)', color: '#fff', boxShadow: '0 4px 12px rgba(255,107,43,.3)' }}>
              💰 {uz ? 'Sotish' : 'Продать'}
            </button>
          ) : (
            <>
              <button onClick={() => doAction('income')} disabled={loading} style={{ ...S.actionBtn, background: 'linear-gradient(135deg, #22C55E, #16a34a)', color: '#fff' }}>
                📥 {uz ? 'Kirim' : 'Приход'}
              </button>
              <button onClick={() => doAction('outcome')} disabled={loading} style={{ ...S.actionBtn, background: 'linear-gradient(135deg, #FF6B2B, #FF8C55)', color: '#fff' }}>
                📤 {uz ? 'Chiqim' : 'Расход'}
              </button>
            </>
          )}
        </div>
        <button onClick={onReset} style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'none', border: '1.5px solid #E2E4F0', borderRadius: '8px', cursor: 'pointer', color: '#9EA3BF', fontWeight: 700, fontSize: '13px', fontFamily: "'Nunito', sans-serif" }}>
          🔍 {lang === 'uz' ? 'Yangi qidirish' : 'Новый поиск'}
        </button>
      </div>
    </div>
  );
}

// ─── Compact product result (shown below search) ──────────────────────────────
function CompactProductResult({ product, role, lang, onClear }) {
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(product);
  const barcodeRef = useRef(null);
  const uz = lang === 'uz';
  const fmtQty = (v) => parseFloat(parseFloat(v).toFixed(3)).toString();

  useEffect(() => { setCurrentProduct(product); setQty(1); setMsg(null); }, [product]);

  const doAction = async (type) => {
    setLoading(true); setMsg(null);
    try {
      const price = type === 'income' ? currentProduct.price_buy : currentProduct.price_sell;
      await api.post(`/stock/${type}`, { product_id: currentProduct.id, quantity: qty, price: price || 0 });
      const { data } = await api.get(`/products/${currentProduct.id}`);
      setCurrentProduct(data);
      setMsg({ ok: true, text: `${fmtQty(qty)} ${currentProduct.unit} ${type === 'income' ? (uz ? 'kirim' : 'приход') : (uz ? 'chiqim' : 'расход')}` });
      setQty(1);
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || 'Ошибка' });
    }
    setLoading(false);
  };

  const handlePrint = () => {
    const svgEl = barcodeRef.current;
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const price = currentProduct.price_sell ? `${parseFloat(currentProduct.price_sell).toLocaleString('ru-RU')} UZS` : '';
    const win = window.open('', '_blank', 'width=300,height=240');
    win.document.write(makeLabel58x40({ name: currentProduct.name_ru, price, svgData }));
    win.document.close();
  };

  const stock = parseFloat(currentProduct.stock);

  return (
    <div style={{ margin: '6px 16px 0', background: '#fff', borderRadius: '14px', boxShadow: '0 4px 20px rgba(67,56,202,.12)', border: '2px solid rgba(67,56,202,.15)', overflow: 'hidden' }}>
      {/* Product header */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #3730a3)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {currentProduct.photo_url
          ? <img src={currentProduct.photo_url} alt="" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', border: '2px solid rgba(255,255,255,.3)', flexShrink: 0 }} />
          : <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.5" style={{ width: 20, height: 20 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {uz && currentProduct.name_uz ? currentProduct.name_uz : currentProduct.name_ru}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.6)', marginTop: '2px' }}>
            {currentProduct.type_name_ru || ''}
            {currentProduct.brand ? ` · ${currentProduct.brand}` : ''}
          </div>
        </div>
        <button onClick={onClear} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Nunito', sans-serif", flexShrink: 0 }}>✕</button>
      </div>

      {/* Info row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #F4F5FA' }}>
        {[
          { label: uz ? 'Qoldiq' : 'Остаток', value: `${fmtQty(stock)} ${currentProduct.unit}`, color: stock > 0 ? '#16a34a' : '#dc2626' },
          { label: uz ? 'Narxi' : 'Цена', value: fmtMoney(currentProduct.price_sell || 0), color: '#4338ca' },
          { label: uz ? 'Shtrix-kod' : 'Штрих-код', value: currentProduct.barcode || '—', mono: true, small: true },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 12px', borderRight: '1px solid #F4F5FA' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#9EA3BF', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
            <div style={{ fontWeight: 700, fontSize: s.small ? '11px' : '13px', color: s.color || '#1A1B2E', marginTop: '2px', fontFamily: s.mono ? "'JetBrains Mono', monospace" : 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Barcode + print */}
      {currentProduct.barcode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderBottom: '1px solid #F4F5FA' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <BarcodeImgRef value={currentProduct.barcode} svgRef={barcodeRef} />
          </div>
          <button onClick={handlePrint} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            background: '#F4F5FA', border: 'none', borderRadius: '8px', padding: '10px 12px',
            cursor: 'pointer', color: '#4338ca', flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" style={{ width: 20, height: 20 }}>
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            <span style={{ fontSize: '10px', fontWeight: 800, fontFamily: "'Nunito', sans-serif" }}>{uz ? 'Chop' : 'Печать'}</span>
          </button>
        </div>
      )}

      {/* Quantity + actions */}
      <div style={{ padding: '12px 16px' }}>
        {msg && (
          <div style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, background: msg.ok ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)', color: msg.ok ? '#16a34a' : '#dc2626' }}>
            {msg.text}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <button onClick={() => setQty(q => Math.max(0.001, q - 1))} style={{ ...S.qtyBtn, background: '#F4F5FA', color: '#4338ca', width: '36px', height: '36px' }}>−</button>
          <input style={{ ...S.qtyInput, fontSize: '18px' }} type="number" min="0.001" step="any" value={qty}
            onChange={e => setQty(parseFloat(e.target.value) || 1)} />
          <button onClick={() => setQty(q => q + 1)} style={{ ...S.qtyBtn, background: '#4338ca', color: '#fff', width: '36px', height: '36px' }}>+</button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {role === 'seller' ? (
            <button onClick={() => doAction('outcome')} disabled={loading}
              style={{ ...S.actionBtn, background: 'linear-gradient(135deg, #FF6B2B, #FF8C55)', color: '#fff', flex: 1, justifyContent: 'center' }}>
              {uz ? 'Sotish' : 'Продать'}
            </button>
          ) : (
            <>
              <button onClick={() => doAction('income')} disabled={loading}
                style={{ ...S.actionBtn, background: 'linear-gradient(135deg, #16a34a, #22C55E)', color: '#fff', flex: 1, justifyContent: 'center' }}>
                {uz ? 'Kirim' : 'Приход'}
              </button>
              <button onClick={() => doAction('outcome')} disabled={loading}
                style={{ ...S.actionBtn, background: 'linear-gradient(135deg, #FF6B2B, #FF8C55)', color: '#fff', flex: 1, justifyContent: 'center' }}>
                {uz ? 'Chiqim' : 'Расход'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Mobile() {
  const { user, logout } = useContext(AuthContext);
  const { lang, changeLang } = useContext(LangContext);
  const navigate = useNavigate();

  const [scanning, setScanning] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [foundProduct, setFoundProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [searching, setSearching] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addKey, setAddKey] = useState(0);
  // Live suggestions while typing — debounced
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const debounceRef = React.useRef(null);

  const canAdd = ['admin', 'cashier', 'warehouse'].includes(user?.role);
  const uz = lang === 'uz';

  const roleLabel = () => ({
    admin: uz ? 'Administrator' : 'Администратор',
    cashier: uz ? 'Kassir · Ombor' : 'Кассир · Склад',
    warehouse: uz ? 'Omborchi' : 'Складовщик',
    seller: uz ? 'Sotuvchi' : 'Продавец',
  })[user?.role] || user?.role;

  const doSearch = async (query, isBarcode = false) => {
    if (!query.trim()) return;
    setSearching(true); setFoundProduct(null); setNotFound(false); setShowSugg(false);
    try {
      const params = isBarcode ? { barcode: query } : { search: query };
      const { data } = await api.get('/products', { params });
      if (data.length > 0) {
        setFoundProduct(data[0]);
        setNotFound(false);
      } else {
        setNotFound(true);
        setScannedBarcode(isBarcode ? query : '');
      }
    } catch {}
    setSearching(false);
  };

  // Debounced live suggestions — fires 250ms after user stops typing
  const fetchSuggestions = async (val) => {
    if (!val || val.trim().length < 1) { setSuggestions([]); setShowSugg(false); return; }
    try {
      const { data } = await api.get('/products', { params: { search: val } });
      setSuggestions(data.slice(0, 8));
      setShowSugg(true);
    } catch {}
  };
  const onSearchChange = (val) => {
    setSearchText(val);
    if (foundProduct) setFoundProduct(null);
    if (notFound) setNotFound(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Empty input → clear dropdown IMMEDIATELY (no debounce wait)
    if (!val || !val.trim()) {
      setSuggestions([]);
      setShowSugg(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };
  const pickSuggestion = (p) => {
    setFoundProduct(p); setSearchText(p.name_ru); setShowSugg(false); setSuggestions([]); setNotFound(false);
  };

  const handleScan = (barcode) => {
    setScanning(false);
    setSearchText(barcode);
    doSearch(barcode, true);
  };

  const clearSearch = () => {
    setFoundProduct(null); setNotFound(false); setSearchText(''); setScannedBarcode('');
    setShowAddForm(false);
    setSuggestions([]); setShowSugg(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.headerTitle}>{user?.company_name || roleLabel()}</span>
          <span style={S.headerSub}>
            {user?.branch_name ? `${user.branch_name} · ` : ''}{roleLabel()} · @{user?.username}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {['uz', 'ru'].map(l => (
            <button key={l} onClick={() => changeLang(l)} style={{
              padding: '4px 9px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              fontWeight: 800, fontSize: '11px',
              background: lang === l ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.15)',
              color: lang === l ? '#4338ca' : '#fff',
            }}>{l.toUpperCase()}</button>
          ))}
          {user?.role !== 'seller' && (
            <button onClick={() => navigate('/select')} style={{ ...S.backBtn, fontSize: '11px', padding: '5px 10px' }}>
              {uz ? 'Menyu' : 'Меню'}
            </button>
          )}
          <button onClick={() => { logout(); navigate('/login'); }} style={S.backBtn}>
            {uz ? '← Chiqish' : '← Выход'}
          </button>
        </div>
      </div>

      {/* ── Scanner zone ── */}
      <div style={{ margin: '12px 16px 0' }}>
        {scanning ? (
          <CameraScanner onScan={handleScan} onClose={() => setScanning(false)} />
        ) : (
          <div style={S.scanZone} onClick={() => setScanning(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="1.5" style={{ width: 40, height: 40, marginBottom: 8 }}>
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              <line x1="8" y1="12" x2="16" y2="12" strokeWidth="2.5"/>
            </svg>
            <div style={{ color: '#4338ca', fontWeight: 800, fontSize: '14px' }}>
              {uz ? 'Shtrix-kodni skanerlash' : 'Сканировать штрих-код'}
            </div>
            <div style={{ color: '#9EA3BF', fontSize: '12px', marginTop: '3px' }}>
              {uz ? 'Bosilsin' : 'Нажмите для сканирования'}
            </div>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <div style={{ ...S.searchBox }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#9EA3BF" strokeWidth="2" style={{ width: 16, height: 16, flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          style={S.searchInput}
          value={searchText}
          onChange={e => onSearchChange(e.target.value)}
          onFocus={() => { if (searchText.trim() && suggestions.length > 0) setShowSugg(true); }}
          onKeyDown={e => e.key === 'Enter' && doSearch(searchText)}
          placeholder={uz ? 'Nomi bo\'yicha qidirish...' : 'Поиск по наименованию...'}
        />
        {searchText ? (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => doSearch(searchText)} style={{
              background: '#4338ca', color: '#fff', border: 'none',
              padding: '7px 14px', borderRadius: '7px', cursor: 'pointer',
              fontWeight: 700, fontSize: '12px', fontFamily: "'Nunito', sans-serif",
            }}>{uz ? 'Topish' : 'Найти'}</button>
            <button onClick={clearSearch} style={{
              background: '#F4F5FA', color: '#9EA3BF', border: 'none',
              padding: '7px 10px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
            }}>✕</button>
          </div>
        ) : null}
      </div>

      {/* ── Live suggestions dropdown ── */}
      {showSugg && suggestions.length > 0 && !foundProduct && (
        <div style={{
          margin: '6px 16px 0', background: '#fff', borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(26,27,46,.12), 0 2px 6px rgba(26,27,46,.06)',
          overflow: 'hidden', maxHeight: '320px', overflowY: 'auto', padding: '4px',
        }}>
          {suggestions.map(p => {
            const stockNum = parseFloat(p.stock || 0);
            const stockColor = stockNum <= 0 ? '#dc2626' : stockNum < 10 ? '#d97706' : '#16a34a';
            return (
              <div key={p.id} onClick={() => pickSuggestion(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px', cursor: 'pointer', borderRadius: '8px',
                  transition: 'background-color .08s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F4F5FA'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{
                  width: 34, height: 34, borderRadius: 8, background: '#F4F5FA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                }}>📦</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1B2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(uz && p.name_uz) || p.name_ru}
                  </div>
                  {p.barcode && (
                    <div className="mono" style={{ fontSize: 11, color: '#9EA3BF', marginTop: 1 }}>{p.barcode}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: stockColor }}>
                    {parseFloat(parseFloat(p.stock || 0).toFixed(3))} {p.unit}
                  </div>
                  <div style={{ fontSize: 9, color: '#9EA3BF', textTransform: 'uppercase', letterSpacing: '0.3px', fontWeight: 700 }}>
                    {uz ? 'qoldiq' : 'остаток'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Search result (compact, below search) ── */}
      {searching && (
        <div style={{ margin: '6px 16px 0', padding: '10px 14px', background: '#fff', borderRadius: '10px', fontSize: '13px', color: '#9EA3BF', boxShadow: 'var(--shadow)' }}>
          {uz ? 'Qidirilmoqda...' : 'Поиск...'}
        </div>
      )}

      {notFound && !searching && (
        <div style={{ margin: '6px 16px 0', padding: '10px 14px', background: 'rgba(239,68,68,.06)', borderRadius: '10px', border: '1px solid rgba(239,68,68,.15)', fontSize: '13px', color: '#dc2626', fontWeight: 700 }}>
          {uz ? `"${searchText}" — topilmadi` : `"${searchText}" — не найден`}
        </div>
      )}

      {foundProduct && !searching && (
        <CompactProductResult product={foundProduct} role={user?.role} lang={lang} onClear={clearSearch} />
      )}

      {/* ── Add product form — only when not found OR user clicked add ── */}
      {canAdd && (notFound || showAddForm) && (
        <>
          <div style={S.divider}>
            <div style={S.dividerLine} />
            {uz ? 'YANGI TOVAR' : 'НОВЫЙ ТОВАР'}
            <div style={S.dividerLine} />
          </div>
          <div style={S.card}>
            <div style={{ fontWeight: 800, fontSize: '15px', color: '#4338ca', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" style={{ width: 18, height: 18 }}>
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {uz ? 'Yangi tovar qo\'shish' : 'Добавить новый товар'}
            </div>
            <AddProductForm
              key={addKey}
              initialBarcode={notFound ? scannedBarcode : ''}
              initialName={notFound ? searchText : ''}
              lang={lang}
              onCancel={showAddForm && !notFound ? () => setShowAddForm(false) : undefined}
              onSaved={(p) => {
                // Reset form for next product — but show the just-saved product above so user can act on it
                setAddKey(k => k + 1);
                setSearchText('');
                setScannedBarcode('');
                setNotFound(false);
                setFoundProduct(p || null);
                setShowAddForm(true);
              }}
            />
          </div>
        </>
      )}

      {/* ── Add new product button (initial state, no active product) ── */}
      {canAdd && !foundProduct && !notFound && !showAddForm && (
        <div style={{ margin: '14px 16px 0' }}>
          <button onClick={() => setShowAddForm(true)} style={{
            width: '100%', padding: '14px',
            background: 'linear-gradient(135deg, #5B4FE8, #3D33C4)',
            border: 'none', borderRadius: '12px', color: '#fff',
            fontWeight: 800, fontSize: '15px', cursor: 'pointer',
            fontFamily: "'Nunito', sans-serif",
            boxShadow: '0 4px 15px rgba(91,79,232,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ width: 18, height: 18 }}>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {uz ? 'Yangi tovar qo\'shish' : 'Добавить новый товар'}
          </button>
        </div>
      )}

      <div style={{ height: '40px' }} />
    </div>
  );
}
