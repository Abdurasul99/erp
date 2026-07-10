import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, LangContext } from '../App.jsx';
import { t } from '../i18n.js';
import api from '../api.js';
import JsBarcode from 'jsbarcode';
import { fmtMoney, fmtNum, filterByPeriod, formatDateTimeShort } from '../utils.js';
import PeriodFilter from '../components/PeriodFilter.jsx';
import useBarcodePrint from '../utils/useBarcodePrint.jsx';

function BarcodeImg({ value }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && value) {
      try { JsBarcode(ref.current, value, { format: 'CODE128', width: 2, height: 44, displayValue: true, fontSize: 12 }); } catch {}
    }
  }, [value]);
  if (!value) return null;
  return <svg ref={ref} style={{ maxWidth: '100%' }} />;
}

function Scanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let stopped = false;
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return;
      const s = new Html5Qrcode('seller-scanner', { verbose: false });
      s.start({ facingMode: 'environment' }, { fps: 15, qrbox: { width: 260, height: 140 }, aspectRatio: 1.5 },
        (code) => { if (!stopped) { stopped = true; s.stop().catch(() => {}); onScan(code); } },
        () => {}
      ).then(() => setReady(true)).catch(e => setError(e?.message || t('cameraUnavailable')));
    }).catch(() => setError(t('scannerLoadError')));
    return () => { stopped = true; };
  }, []);
  return (
    <div style={{ borderRadius: '14px', overflow: 'hidden', background: '#000', position: 'relative', minHeight: '160px' }}>
      <div id="seller-scanner" style={{ width: '100%' }} />
      {!ready && !error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.8)', color: '#fff', gap: '10px' }}>
          <div className="spinner" style={{ borderColor: 'rgba(255,255,255,.2)', borderTopColor: '#fff' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{t('cameraStarting')}</span>
        </div>
      )}
      {error && <div style={{ padding: '24px', textAlign: 'center', color: '#f87171', fontSize: '14px', fontWeight: 700 }}>{error}</div>}
      {ready && <div style={{ position: 'absolute', inset: 0, border: '3px solid #FF6B2B', borderRadius: '14px', pointerEvents: 'none' }} />}
      <button onClick={onClose} style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, background: 'rgba(0,0,0,.6)', border: 'none', color: '#fff', borderRadius: '20px', padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: "'Nunito', sans-serif" }}>✕</button>
    </div>
  );
}

function SuccessScreen({ product, qty, price, discount, onNext, uz }) {
  useEffect(() => { const t = setTimeout(onNext, 2800); return () => clearTimeout(t); }, []);
  const unitPrice = price != null ? price : parseFloat(product.price_sell || 0);
  const finalTotal = qty * unitPrice;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '24px', textAlign: 'center' }}>
      <div style={{ width: '90px', height: '90px', background: 'linear-gradient(135deg, #22C55E, #16a34a)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '44px', marginBottom: '24px', boxShadow: '0 8px 32px rgba(34,197,94,.4)', animation: 'pop .4s ease' }}>✓</div>
      <div style={{ fontWeight: 900, fontSize: '22px', color: '#1A1B2E', marginBottom: '8px' }}>{uz ? 'Sotuv amalga oshdi!' : 'Продажа оформлена!'}</div>
      <div style={{ fontSize: '16px', color: '#6B6F8A', marginBottom: '16px' }}>{product.name_ru}</div>
      {discount > 0 && (
        <div style={{ background: 'rgba(255,107,43,.1)', color: '#FF6B2B', fontWeight: 800, fontSize: '13px', padding: '6px 14px', borderRadius: '20px', marginBottom: '12px' }}>
          {uz ? 'Chegirma' : 'Скидка'}: −{fmtNum(discount)} UZS
        </div>
      )}
      <div style={{ background: '#F4F5FA', borderRadius: '14px', padding: '16px 24px', marginBottom: '24px', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', textAlign: 'center' }}>
          {[
            { label: uz ? 'Miqdor' : 'Кол-во', value: `${qty} ${product.unit}`, color: '#1A1B2E' },
            { label: uz ? 'Narxi (1 ta)' : 'Цена (1 ед.)', value: fmtNum(unitPrice), color: '#FF6B2B' },
            { label: uz ? 'Jami' : 'Итого', value: fmtNum(finalTotal), color: '#16a34a' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#9EA3BF', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '16px', color: s.color, marginTop: '4px' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: '13px', color: '#9EA3BF', marginBottom: '16px' }}>{uz ? 'Keyingisi uchun skanerlang...' : 'Сканируйте следующий товар...'}</div>
      <button onClick={onNext} style={{ background: 'none', border: '1.5px solid #E2E4F0', borderRadius: '10px', padding: '10px 28px', cursor: 'pointer', color: '#6B6F8A', fontWeight: 700, fontSize: '14px', fontFamily: "'Nunito', sans-serif" }}>
        {uz ? 'Yangi skanerlash' : 'Новый поиск'}
      </button>
    </div>
  );
}

export default function SellerView() {
  const { user, logout } = useContext(AuthContext);
  const { lang, changeLang } = useContext(LangContext);
  const navigate = useNavigate();
  const uz = lang === 'uz';
  // Unified barcode-print dialog (copies + size, saved per user) — same as warehouse/phone.
  const { openPrint, printModal } = useBarcodePrint(lang);

  const [scanning, setScanning] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [discount, setDiscount] = useState(0); // UZS, applied to total
  const [paymentMethod, setPaymentMethod] = useState('cash'); // cash / card / transfer / wire
  // Multi-currency sale: customer pays in non-UZS. Empty saleCurrency means UZS-priced (legacy).
  const [saleCurrency, setSaleCurrency] = useState('UZS');
  const [saleRate, setSaleRate] = useState('');         // 1 unit of saleCurrency = X UZS
  const [origUnitPrice, setOrigUnitPrice] = useState(''); // price per unit in saleCurrency
  const [notFound, setNotFound] = useState(false);
  const [selling, setSelling] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [editSale, setEditSale] = useState(null); // { id, qty, price, name }
  // Edit-request modal for approved sales
  const [editReq, setEditReq] = useState(null); // { sale, qty, price, note, reason }
  const [editReqErr, setEditReqErr] = useState('');
  // Customer-return modal: customer brings the goods back, money refunded.
  const [custReturn, setCustReturn] = useState(null); // { sale, quantity, refund_amount, payment_method, reason }
  const [custReturnErr, setCustReturnErr] = useState('');
  const [period, setPeriod] = useState('today');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [unsettled, setUnsettled] = useState({ total: 0, count: 0 });
  const searchRef = useRef(null);
  const suggRef = useRef(null);
  const debounceRef = useRef(null);

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username;

  const loadHistory = async () => {
    try {
      const { data } = await api.get('/stock/outcome-list');
      // Only own sales — filter by created_by
      setHistory(data.filter(s => s.created_by === user?.id));
    } catch {}
    try {
      const { data } = await api.get('/cash/settlement/my');
      setUnsettled(data);
    } catch {}
  };

  // Apply period filter on top of fetched history
  const filteredHistory = filterByPeriod(history, period, customRange);
  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [period, customRange.from, customRange.to]);
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedHistory = filteredHistory.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── KPI for this seller (this month) ──
  // Only count CONFIRMED sales (cashier has accepted the cash) toward KPI / totals.
  // Pending (cash_settled=false) doesn't count yet — until cashier confirms physically receiving the money.
  const isCounted = (s) => s.status === 'approved' && (s.cash_settled === true || s.cash_settled === 't');
  const monthHistory = filterByPeriod(history, 'month', {});
  const monthCount = monthHistory.filter(isCounted).length;
  const monthRevenue = monthHistory.filter(isCounted).reduce((s, x) => s + parseFloat(x.quantity) * parseFloat(x.price || 0), 0);
  const todayHistory = filterByPeriod(history, 'today', {});
  const todayCount = todayHistory.filter(isCounted).length;
  const todayRevenue = todayHistory.filter(isCounted).reduce((s, x) => s + parseFloat(x.quantity) * parseFloat(x.price || 0), 0);
  // Two pending states for a seller's sale:
  //   1) status='pending' — waiting for WAREHOUSE to approve (stock not yet decremented)
  //   2) status='approved' && cash_settled=false — waiting for CASHIER to accept the cash
  // Both are "in flight"; rejected sales are excluded.
  const isPending = (s) => s.status === 'pending' || (s.status === 'approved' && !(s.cash_settled === true || s.cash_settled === 't'));
  const pendingTodaySales  = todayHistory.filter(isPending);
  const pendingTodayCount  = pendingTodaySales.length;
  const pendingTodayRevenue = pendingTodaySales.reduce((s, x) => s + parseFloat(x.quantity) * parseFloat(x.price || 0), 0);
  const pendingMonthSales  = monthHistory.filter(isPending);
  const pendingMonthCount  = pendingMonthSales.length;
  const pendingMonthRevenue = pendingMonthSales.reduce((s, x) => s + parseFloat(x.quantity) * parseFloat(x.price || 0), 0);

  // ── Per-currency breakdown for KPI ──
  // Groups confirmed sales by sale currency. UZS amount = revenue in that period; original = sum in foreign cur.
  const byCurrency = (rows) => {
    const map = {};
    rows.filter(isCounted).forEach(s => {
      const cur = s.currency || 'UZS';
      const uzs = parseFloat(s.quantity) * parseFloat(s.price || 0);
      const orig = cur === 'UZS' ? uzs : parseFloat(s.quantity) * parseFloat(s.original_price || 0);
      if (!map[cur]) map[cur] = { uzs: 0, orig: 0, count: 0 };
      map[cur].uzs += uzs;
      map[cur].orig += orig;
      map[cur].count += 1;
    });
    return map;
  };
  const todayByCur = byCurrency(todayHistory);
  const monthByCur = byCurrency(monthHistory);
  const foreignKeys = (m) => Object.keys(m).filter(k => k !== 'UZS' && m[k].orig > 0);
  const curSymbol = { USD: '$', EUR: '€', RUB: '₽', KZT: '₸', CNY: '¥', TRY: '₺', KRW: '₩', GBP: '£', AED: 'د.إ' };

  useEffect(() => { loadHistory(); }, []);

  const [suggLoading, setSuggLoading] = useState(false);
  // Fetch suggestions — by search string or "browse all" if empty
  const fetchSuggestions = async (val) => {
    setSuggLoading(true);
    try {
      const params = val && val.trim() ? { search: val } : {};
      const { data } = await api.get('/products', { params });
      setSuggestions(data.slice(0, 8));
      setShowSugg(true);
    } catch {}
    setSuggLoading(false);
  };
  // Live search as user types — 180ms debounce
  const handleSearchChange = (val) => {
    setSearchText(val);
    setNotFound(false);
    setError('');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 180);
  };
  // On focus — show suggestions immediately (top of catalog if empty)
  const handleSearchFocus = () => {
    if (suggestions.length > 0) { setShowSugg(true); return; }
    fetchSuggestions(searchText);
  };

  const selectProduct = (p) => {
    setProduct(p);
    setSearchText(uz && p.name_uz ? p.name_uz : p.name_ru);
    setSuggestions([]);
    setShowSugg(false);
    setQty(1);
    setDiscount(0);
    setError('');
    setNotFound(false);
  };

  const doSearch = async (query, isBarcode = false) => {
    if (!query.trim()) return;
    setShowSugg(false);
    setSuggestions([]);
    try {
      const params = isBarcode ? { barcode: query } : { search: query };
      const { data } = await api.get('/products', { params });
      if (data.length === 1) {
        selectProduct(data[0]);
      } else if (data.length > 1) {
        setSuggestions(data.slice(0, 7));
        setShowSugg(true);
      } else {
        setNotFound(true);
        setProduct(null);
      }
    } catch {}
  };

  const handleScan = (code) => {
    setScanning(false);
    setSearchText(code);
    doSearch(code, true);
  };

  const handleSell = async () => {
    if (!product || qty <= 0) return;
    const stock = parseFloat(product.stock);
    if (stock <= 0) { setError(uz ? 'Omborda mahsulot yo\'q!' : 'Нет в наличии!'); return; }
    if (qty > stock) { setError(uz ? `Faqat ${stock} ${product.unit} bor` : `В наличии только ${stock} ${product.unit}`); return; }

    // Resolve unit price in UZS — either product's UZS price OR (foreign price × rate)
    const isForeign = saleCurrency !== 'UZS';
    let baseUnitUZS;
    if (isForeign) {
      const op = parseFloat(origUnitPrice);
      const r  = parseFloat(saleRate);
      if (!Number.isFinite(op) || op <= 0) { setError(uz ? 'Narxi noto\'g\'ri' : 'Введите цену в выбранной валюте'); return; }
      if (!Number.isFinite(r)  || r  <= 0) { setError(uz ? 'Kurs noto\'g\'ri' : 'Введите курс обмена'); return; }
      baseUnitUZS = op * r;
    } else {
      baseUnitUZS = parseFloat(product.price_sell || 0);
    }

    const gross = qty * baseUnitUZS;
    const disc = Math.max(0, parseFloat(discount) || 0);
    if (disc >= gross) { setError(uz ? 'Chegirma jami summadan ko\'p bo\'lmasligi kerak' : 'Скидка не может быть больше суммы'); return; }
    const effectivePrice = (gross - disc) / qty;

    setSelling(true); setError('');
    try {
      await api.post('/stock/outcome', {
        product_id: product.id,
        quantity: qty,
        price: effectivePrice,
        payment_method: paymentMethod,
        currency: saleCurrency,
        ...(isForeign && {
          original_price: (parseFloat(origUnitPrice) * qty - disc / parseFloat(saleRate)) / qty, // per-unit in foreign cur, post-discount
          exchange_rate: parseFloat(saleRate),
        }),
      });
      setSuccess({ product, qty, price: effectivePrice, discount: disc, paymentMethod, currency: saleCurrency });
      setProduct(null); setSearchText(''); setQty(1); setDiscount(0); setPaymentMethod('cash');
      setSaleCurrency('UZS'); setSaleRate(''); setOrigUnitPrice('');
      loadHistory();
    } catch (e) { setError(e.response?.data?.error || (uz ? 'Xato!' : 'Ошибка!')); }
    setSelling(false);
  };

  const reset = () => {
    setProduct(null); setNotFound(false); setSearchText('');
    setSuccess(null); setError(''); setQty(1); setDiscount(0); setSuggestions([]); setShowSugg(false);
    loadHistory();
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  const submitEditRequest = async () => {
    setEditReqErr('');
    try {
      const qty = parseFloat(editReq.qty);
      const price = parseFloat(editReq.price);
      if (!Number.isFinite(qty) || qty <= 0) { setEditReqErr(uz ? 'Miqdor noto\'g\'ri' : 'Кол-во некорректно'); return; }
      await api.post(`/stock/outcome/${editReq.sale.id}/edit-request`, {
        new_quantity: qty, new_price: price, new_note: editReq.note || '', reason: editReq.reason || '',
      });
      setEditReq(null);
      alert(uz ? 'Soʻrov yuborildi. Kassir tasdiqlashini kuting.' : 'Запрос отправлен. Ждите подтверждения кассира.');
    } catch (e) { setEditReqErr(e.response?.data?.error || (uz ? 'Xato' : 'Ошибка')); }
  };

  const submitCustomerReturn = async () => {
    setCustReturnErr('');
    try {
      const qty = parseFloat(custReturn.quantity);
      const refund = parseFloat(custReturn.refund_amount) || 0;
      const maxQty = parseFloat(custReturn.sale.quantity);
      if (!Number.isFinite(qty) || qty <= 0) { setCustReturnErr(uz ? 'Miqdor noto\'g\'ri' : 'Кол-во некорректно'); return; }
      if (qty > maxQty + 0.0001) { setCustReturnErr(uz ? `Maksimum: ${maxQty}` : `Максимум: ${maxQty}`); return; }
      await api.post('/stock/customer-return', {
        original_outcome_id: custReturn.sale.id,
        product_id: custReturn.sale.product_id,
        quantity: qty,
        refund_amount: refund,
        payment_method: custReturn.payment_method || 'cash',
        note: custReturn.reason || '',
      });
      setCustReturn(null);
      loadHistory();
      alert(uz ? 'Vozvrat ro\'yxatga olindi' : 'Возврат зарегистрирован');
    } catch (e) { setCustReturnErr(e.response?.data?.error || (uz ? 'Xato' : 'Ошибка')); }
  };

  const handleCancelSale = async (saleId) => {
    try {
      await api.delete(`/stock/outcome/${saleId}/cancel`);
      loadHistory();
    } catch (e) {
      alert(e.response?.data?.error || (uz ? 'Xato!' : 'Ошибка!'));
    }
  };

  const handleEditSaleSave = async () => {
    if (!editSale) return;
    try {
      // Update quantity via a custom endpoint or just show info
      // Since outcomes don't have a simple edit, we'll cancel and recreate
      // For simplicity, allow editing price only for pending sales
      await api.patch(`/stock/outcome/${editSale.id}`, { quantity: editSale.qty, price: editSale.price });
      setEditSale(null);
      loadHistory();
    } catch (e) {
      // Fallback: just show the sale info, editing not supported on backend yet
      setEditSale(null);
      alert(uz ? 'Tahrirlash imkonsiz. Bekor qiling va qayta skanerlang.' : 'Редактирование недоступно. Отмените и отсканируйте заново.');
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => { if (!suggRef.current?.contains(e.target) && !searchRef.current?.contains(e.target)) setShowSugg(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fmtQty = (v) => parseFloat(parseFloat(v).toFixed(3)).toString();
  const stock = parseFloat(product?.stock || 0);
  // Unit price in UZS — switches based on selected sale currency
  const unitPriceUZS = saleCurrency === 'UZS'
    ? parseFloat(product?.price_sell || 0)
    : (parseFloat(origUnitPrice) || 0) * (parseFloat(saleRate) || 0);
  const gross = qty * unitPriceUZS;
  const discNum = Math.max(0, Math.min(gross, parseFloat(discount) || 0));
  const total = gross - discNum;
  const effectiveUnitPrice = qty > 0 ? total / qty : 0;

  return (
    <div style={{ background: '#F4F5FA', minHeight: '100vh', maxWidth: '480px', margin: '0 auto', fontFamily: "'Nunito', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #FF6B2B, #FF8C55)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 200, boxShadow: '0 2px 16px rgba(255,107,43,.3)' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.company_name || (uz ? 'Sotuvchi' : 'Продавец')}
          </div>
          <div style={{ color: 'rgba(255,255,255,.75)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(localStorage.getItem('seller_branch_name') || user?.branch_name) ? `🏪 ${localStorage.getItem('seller_branch_name') || user.branch_name} · ` : ''}{fullName}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {['uz','ru'].map(l => (
            <button key={l} onClick={() => changeLang(l)} style={{ padding: '4px 9px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '11px', background: lang === l ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.2)', color: lang === l ? '#FF6B2B' : '#fff' }}>{l.toUpperCase()}</button>
          ))}
          <button onClick={() => {
              // Back = return to branch picker (not full logout).
              // Seller can choose another branch there, or use the picker's Chiqish button to log out fully.
              localStorage.removeItem('seller_branch_id');
              localStorage.removeItem('seller_branch_name');
              localStorage.removeItem('seller_branch_picked_date');
              navigate('/select-branch');
            }}
            title={uz ? 'Filialga qaytish' : 'Назад к выбору филиала'}
            style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '12px', fontFamily: "'Nunito', sans-serif" }}>←</button>
        </div>
      </div>

      {/* Success */}
      {success && <SuccessScreen product={success.product} qty={success.qty} price={success.price} discount={success.discount} onNext={reset} uz={uz} />}

      {!success && (
        <div style={{ padding: '12px 16px' }}>
          {/* KPI card — own monthly performance + cash owed */}
          <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #4338ca)', borderRadius: '14px', padding: '14px 16px', marginBottom: '12px', color: '#fff', boxShadow: '0 6px 20px rgba(67,56,202,.2)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, opacity: .7, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
              📊 {uz ? 'Mening KPI' : 'Мой KPI'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', opacity: .65, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{uz ? 'Bugun' : 'Сегодня'}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '16px', marginTop: '2px' }}>
                  {fmtMoney(todayRevenue + pendingTodayRevenue)}
                </div>
                <div style={{ fontSize: '10px', opacity: .65, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#86EFAC' }}>✓ {fmtNum(todayRevenue)}</span>
                  {pendingTodayCount > 0 && (
                    <>
                      <span style={{ opacity: .35 }}>·</span>
                      <span style={{ color: '#FCD34D' }}>⏳ {fmtNum(pendingTodayRevenue)}</span>
                    </>
                  )}
                </div>
                <div style={{ fontSize: '11px', opacity: .6, marginTop: '2px' }}>
                  {todayCount + pendingTodayCount} {uz ? 'ta sotuv' : 'продаж'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', opacity: .65, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{uz ? 'Oyiga' : 'За месяц'}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '18px', marginTop: '2px', color: '#FF8C55' }}>
                  {fmtMoney(monthRevenue + pendingMonthRevenue)}
                </div>
                <div style={{ fontSize: '10px', opacity: .65, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#86EFAC' }}>✓ {fmtNum(monthRevenue)}</span>
                  {pendingMonthCount > 0 && (
                    <>
                      <span style={{ opacity: .35 }}>·</span>
                      <span style={{ color: '#FCD34D' }}>⏳ {fmtNum(pendingMonthRevenue)}</span>
                    </>
                  )}
                </div>
                <div style={{ fontSize: '11px', opacity: .6, marginTop: '2px' }}>{monthCount + pendingMonthCount} {uz ? 'ta sotuv' : 'продаж'}</div>
              </div>
            </div>
            {/* Per-currency breakdown — shown only when foreign-currency sales exist */}
            {(foreignKeys(todayByCur).length > 0 || foreignKeys(monthByCur).length > 0) && (
              <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(255,255,255,.06)', borderRadius: '10px', fontSize: '11px' }}>
                <div style={{ opacity: .65, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 800, marginBottom: '4px' }}>
                  {uz ? 'Valyuta boʻyicha' : 'По валютам'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <div style={{ opacity: .5, fontSize: '9px' }}>{uz ? 'BUGUN' : 'СЕГОДНЯ'}</div>
                    {foreignKeys(todayByCur).map(k => (
                      <div key={k} className="mono" style={{ fontWeight: 700, fontSize: '12px' }}>
                        {curSymbol[k] || ''}{parseFloat(todayByCur[k].orig.toFixed(2)).toLocaleString('ru-RU')} <span style={{ opacity: .55, fontSize: '10px' }}>({k})</span>
                      </div>
                    ))}
                    {foreignKeys(todayByCur).length === 0 && <div style={{ opacity: .35, fontSize: '11px' }}>—</div>}
                  </div>
                  <div>
                    <div style={{ opacity: .5, fontSize: '9px' }}>{uz ? 'OY' : 'МЕСЯЦ'}</div>
                    {foreignKeys(monthByCur).map(k => (
                      <div key={k} className="mono" style={{ fontWeight: 700, fontSize: '12px' }}>
                        {curSymbol[k] || ''}{parseFloat(monthByCur[k].orig.toFixed(2)).toLocaleString('ru-RU')} <span style={{ opacity: .55, fontSize: '10px' }}>({k})</span>
                      </div>
                    ))}
                    {foreignKeys(monthByCur).length === 0 && <div style={{ opacity: .35, fontSize: '11px' }}>—</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Cash to hand over to cashier */}
            {unsettled.count > 0 && (
              <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(255,193,7,.18)', borderRadius: '10px', border: '1px solid rgba(255,193,7,.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 800, opacity: .8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>💰 {t('toSettle')}</div>
                  <div style={{ fontSize: '11px', opacity: .65, marginTop: '2px' }}>{unsettled.count} {t('salesCountShort')}</div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '18px', color: '#FFC107' }}>{fmtMoney(unsettled.total)}</div>
              </div>
            )}
          </div>

          {/* Scanner */}
          {scanning ? (
            <div style={{ marginBottom: '12px' }}>
              <Scanner onScan={handleScan} onClose={() => setScanning(false)} />
            </div>
          ) : (
            <button onClick={() => setScanning(true)} style={{
              width: '100%', border: '2.5px dashed #FF6B2B', borderRadius: '14px', padding: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              cursor: 'pointer', background: 'rgba(255,107,43,.04)', marginBottom: '12px',
              fontFamily: "'Nunito', sans-serif",
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                <line x1="8" y1="12" x2="16" y2="12" strokeWidth="2.5"/>
              </svg>
              <span style={{ color: '#FF6B2B', fontWeight: 800, fontSize: '15px' }}>
                {uz ? 'Shtrix-kodni skanerlash' : 'Сканировать штрих-код'}
              </span>
            </button>
          )}

          {/* Search with live suggestions */}
          <div style={{ position: 'relative', marginBottom: '12px' }} ref={suggRef}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', borderRadius: '12px', padding: '0 14px', boxShadow: '0 2px 12px rgba(0,0,0,.06)', border: `2px solid ${showSugg && suggestions.length > 0 ? '#FF6B2B' : 'transparent'}`, transition: 'border-color .2s' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#9EA3BF" strokeWidth="2" style={{ width: 16, height: 16, flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  ref={searchRef}
                  style={{ flex: 1, border: 'none', outline: 'none', padding: '14px 0', fontSize: '15px', background: 'transparent', fontFamily: "'Nunito', sans-serif" }}
                  value={searchText}
                  onChange={e => handleSearchChange(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch(searchText)}
                  onFocus={handleSearchFocus}
                  placeholder={uz ? 'Tovar nomini kiriting...' : 'Введите название товара...'}
                  autoComplete="off"
                />
                {searchText && (
                  <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9EA3BF', fontSize: '20px', lineHeight: 1, padding: '4px' }}>×</button>
                )}
              </div>
              <button onClick={() => doSearch(searchText)} disabled={!searchText.trim()}
                style={{ background: 'linear-gradient(135deg, #FF6B2B, #FF8C55)', border: 'none', color: '#fff', padding: '0 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, fontSize: '14px', fontFamily: "'Nunito', sans-serif", opacity: !searchText.trim() ? 0.5 : 1, flexShrink: 0 }}>
                {uz ? 'Topish' : 'Найти'}
              </button>
            </div>

            {/* Live suggestions dropdown */}
            {showSugg && (suggestions.length > 0 || suggLoading) && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,.15)', zIndex: 300, overflow: 'hidden', border: '1px solid #E2E4F0', maxHeight: '60vh', overflowY: 'auto' }}>
                <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 800, color: '#9EA3BF', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #F4F5FA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{searchText.trim() ? (uz ? 'Topilganlar' : 'Результаты') : (uz ? 'Tovarlar' : 'Товары')}</span>
                  {suggLoading && <span style={{ fontSize: '10px', color: '#FF6B2B', fontWeight: 700 }}>⏳ {uz ? 'qidirilmoqda...' : 'поиск...'}</span>}
                </div>
                {suggestions.map((p, i) => {
                  const name = (uz && p.name_uz) ? p.name_uz : p.name_ru;
                  const stockNum = parseFloat(p.stock || 0);
                  const stockColor = stockNum <= 0 ? '#dc2626' : stockNum < 5 ? '#d97706' : '#16a34a';
                  // Highlight matched substring
                  const q = (searchText || '').trim().toLowerCase();
                  let rendered;
                  if (q && name.toLowerCase().includes(q)) {
                    const idx = name.toLowerCase().indexOf(q);
                    rendered = (
                      <>
                        {name.slice(0, idx)}
                        <span style={{ background: 'rgba(255,107,43,.18)', color: '#FF6B2B', fontWeight: 900, padding: '0 1px', borderRadius: '3px' }}>
                          {name.slice(idx, idx + q.length)}
                        </span>
                        {name.slice(idx + q.length)}
                      </>
                    );
                  } else { rendered = name; }
                  return (
                  <div key={p.id} onClick={() => selectProduct(p)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                    cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #F4F5FA' : 'none',
                    transition: 'background .15s', opacity: stockNum <= 0 ? 0.55 : 1,
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F4F5FA'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {p.photo_url
                      ? <img src={p.photo_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,107,43,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px' }}>📦</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rendered}</div>
                      <div style={{ fontSize: '11px', color: '#9EA3BF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {p.type_name_ru && <span>{p.type_name_ru}</span>}
                        <span style={{ color: stockColor, fontWeight: 700 }}>{fmtQty(p.stock)} {p.unit}</span>
                        {p.barcode && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>· {p.barcode}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '14px', color: '#FF6B2B' }}>{fmtNum(p.price_sell || 0)}</div>
                      <div style={{ fontSize: '10px', color: '#9EA3BF' }}>UZS</div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Not found */}
          {notFound && (
            <div style={{ background: 'rgba(239,68,68,.06)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid rgba(239,68,68,.15)' }}>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>🔍</div>
              <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '15px' }}>
                {uz ? 'Topilmadi' : 'Не найдено'}
              </div>
              <div style={{ fontSize: '13px', color: '#9EA3BF', marginTop: '2px' }}>«{searchText}»</div>
              <div style={{ fontSize: '12px', color: '#9EA3BF', marginTop: '6px' }}>
                {uz ? 'Boshqacha nom bilan qidiring yoki omborchiga murojaat qiling' : 'Попробуйте другое название или обратитесь к кладовщику'}
              </div>
            </div>
          )}

          {/* Product card — NO overflow:hidden to fix + button */}
          {product && (
            <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
              {/* Product header */}
              <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #3730a3)', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center', borderRadius: '16px 16px 0 0' }}>
                {product.photo_url
                  ? <img src={product.photo_url} alt="" style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover', border: '2px solid rgba(255,255,255,.3)', flexShrink: 0 }} />
                  : <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '24px' }}>📦</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: '17px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {uz && product.name_uz ? product.name_uz : product.name_ru}
                  </div>
                  {product.type_name_ru && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.6)', marginTop: '2px' }}>{product.type_name_ru}</div>}
                  {product.barcode && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.4)', fontFamily: "'JetBrains Mono', monospace", marginTop: '2px' }}>{product.barcode}</div>}
                </div>
              </div>

              {/* Price + stock */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #F4F5FA' }}>
                <div style={{ padding: '14px 16px', borderRight: '1px solid #F4F5FA' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#9EA3BF', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{uz ? 'Narxi' : 'Цена'}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '22px', color: '#FF6B2B', marginTop: '2px' }}>
                    {fmtNum(product.price_sell || 0)}
                    <span style={{ fontSize: '12px', fontWeight: 400, color: '#9EA3BF', marginLeft: '4px' }}>UZS</span>
                  </div>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#9EA3BF', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{uz ? 'Qoldiq' : 'Остаток'}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '22px', color: stock > 0 ? '#16a34a' : '#dc2626', marginTop: '2px' }}>
                    {fmtQty(stock)}
                    <span style={{ fontSize: '12px', fontWeight: 400, color: '#9EA3BF', marginLeft: '4px' }}>{product.unit}</span>
                  </div>
                </div>
              </div>

              {/* Barcode + print */}
              {product.barcode && (
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #F4F5FA', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, textAlign: 'center', overflowX: 'auto' }}>
                    <BarcodeImg value={product.barcode} />
                  </div>
                  <button onClick={() => openPrint([product])} title={uz ? 'Shtrix-kod chop etish' : 'Печать штрих-кода'}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: '#F4F5FA', border: 'none', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer', color: '#4338ca', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" style={{ width: 20, height: 20 }}>
                      <polyline points="6 9 6 2 18 2 18 9"/>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                      <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    <span style={{ fontSize: '10px', fontWeight: 800, fontFamily: "'Nunito', sans-serif" }}>{uz ? 'Chop' : 'Печать'}</span>
                  </button>
                </div>
              )}

              {/* Quantity — key fix: no overflow hidden, box-sizing border-box */}
              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#9EA3BF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>
                  {uz ? 'Miqdor' : 'Количество'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 52px', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))}
                    style={{ height: '52px', borderRadius: '12px', border: '2px solid #E2E4F0', background: '#F4F5FA', fontSize: '26px', fontWeight: 700, cursor: 'pointer', color: '#FF6B2B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <input
                    type="number" min="1" step="any" value={qty}
                    onChange={e => setQty(parseFloat(e.target.value) || 1)}
                    style={{ height: '52px', textAlign: 'center', padding: '0 12px', border: '2px solid #E2E4F0', borderRadius: '12px', fontSize: '24px', fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                  <button onClick={() => setQty(q => q + 1)}
                    style={{ height: '52px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #FF6B2B, #FF8C55)', fontSize: '26px', fontWeight: 700, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,107,43,.3)' }}>+</button>
                </div>

                {/* Sale currency — choose UZS or accept payment in foreign currency */}
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#9EA3BF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px', display: 'block' }}>
                    {uz ? 'Valyuta' : 'Валюта продажи'}
                  </span>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {[
                      { c: 'UZS', f: '🇺🇿' }, { c: 'USD', f: '🇺🇸' }, { c: 'EUR', f: '🇪🇺' }, { c: 'RUB', f: '🇷🇺' },
                      { c: 'KZT', f: '🇰🇿' }, { c: 'CNY', f: '🇨🇳' }, { c: 'TRY', f: '🇹🇷' }, { c: 'KRW', f: '🇰🇷' },
                    ].map(o => (
                      <button key={o.c} type="button" onClick={() => {
                        setSaleCurrency(o.c);
                        if (o.c !== 'UZS' && !saleRate) {
                          const def = { USD: 12750, EUR: 13800, RUB: 140, KZT: 27, CNY: 1750, TRY: 350, KRW: 9.3, GBP: 16000, AED: 3470 }[o.c] || 1;
                          setSaleRate(String(def));
                        }
                        if (o.c === 'UZS') { setSaleRate(''); setOrigUnitPrice(''); }
                      }} style={{
                        flex: '1 1 0', padding: '8px 6px', borderRadius: '10px',
                        border: `2px solid ${saleCurrency === o.c ? '#FF6B2B' : '#E2E4F0'}`,
                        background: saleCurrency === o.c ? 'rgba(255,107,43,.08)' : '#fff',
                        color: saleCurrency === o.c ? '#FF6B2B' : '#6B6F8A',
                        cursor: 'pointer', fontWeight: 800, fontSize: '12px', fontFamily: "'Nunito', sans-serif",
                      }}>{o.f} {o.c}</button>
                    ))}
                  </div>
                </div>

                {/* Foreign-currency price + rate (only when non-UZS) */}
                {saleCurrency !== 'UZS' && (
                  <div style={{ marginBottom: '12px', background: 'rgba(67,56,202,.05)', border: '1px solid rgba(67,56,202,.12)', borderRadius: '12px', padding: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 800, color: '#6B6F8A', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>
                          {uz ? `Narxi (${saleCurrency}/dona)` : `Цена (${saleCurrency}/шт)`}
                        </label>
                        <input type="number" min="0" step="any" inputMode="decimal" value={origUnitPrice}
                          onChange={e => setOrigUnitPrice(e.target.value)} placeholder="0"
                          style={{ width: '100%', height: '40px', textAlign: 'right', padding: '0 10px', border: '1.5px solid #E2E4F0', borderRadius: '8px', fontSize: '15px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: 800, color: '#6B6F8A', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '4px' }}>
                          {uz ? `Kursi (1 ${saleCurrency})` : `Курс (1 ${saleCurrency})`}
                        </label>
                        <input type="number" min="0" step="any" inputMode="decimal" value={saleRate}
                          onChange={e => setSaleRate(e.target.value)} placeholder="0"
                          style={{ width: '100%', height: '40px', textAlign: 'right', padding: '0 10px', border: '1.5px solid #E2E4F0', borderRadius: '8px', fontSize: '15px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    {parseFloat(origUnitPrice) > 0 && parseFloat(saleRate) > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ color: '#6B6F8A', fontWeight: 700 }}>{uz ? '1 dona UZSda:' : '1 шт в UZS:'}</span>
                        <span className="mono" style={{ fontWeight: 800, color: '#4338ca' }}>{fmtMoney(parseFloat(origUnitPrice) * parseFloat(saleRate))}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Discount */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#9EA3BF', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      {uz ? 'Chegirma' : 'Скидка'} (UZS)
                    </span>
                    {discNum > 0 && (
                      <button onClick={() => setDiscount(0)} style={{ background: 'none', border: 'none', color: '#9EA3BF', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                        {uz ? 'tozalash' : 'сбросить'}
                      </button>
                    )}
                  </div>
                  <input type="number" min="0" step="any" inputMode="decimal" value={discount}
                    onChange={e => setDiscount(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    onFocus={e => { if (parseFloat(e.target.value) === 0) e.target.select(); }}
                    placeholder="0"
                    style={{ width: '100%', height: '46px', textAlign: 'right', padding: '0 14px', border: '2px solid #E2E4F0', borderRadius: '12px', fontSize: '18px', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", outline: 'none', boxSizing: 'border-box', color: discNum > 0 ? '#FF6B2B' : '#1A1B2E' }} />
                </div>

                {/* Total breakdown */}
                <div style={{ background: '#F4F5FA', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px' }}>
                  {discNum > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#9EA3BF' }}>{uz ? 'Jami summa:' : 'Сумма:'}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#9EA3BF', textDecoration: 'line-through' }}>{fmtNum(gross)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#FF6B2B', fontWeight: 700 }}>− {uz ? 'Chegirma' : 'Скидка'}:</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#FF6B2B', fontWeight: 700 }}>{fmtNum(discNum)}</span>
                      </div>
                      <div style={{ height: '1px', background: '#E2E4F0', margin: '6px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#9EA3BF', fontWeight: 700 }}>{uz ? "1 ta narxi (skidkadan keyin)" : '1 ед. после скидки'}:</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#6B6F8A', fontWeight: 700 }}>{fmtNum(effectiveUnitPrice)}</span>
                      </div>
                    </>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#6B6F8A' }}>{uz ? 'To\'lov:' : 'К оплате:'}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '22px', fontWeight: 900, color: discNum > 0 ? '#16a34a' : '#1A1B2E' }}>{fmtMoney(total)}</span>
                  </div>
                  {saleCurrency !== 'UZS' && parseFloat(saleRate) > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #E2E4F0', paddingTop: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#4338ca', fontWeight: 700 }}>
                        💱 {uz ? `${saleCurrency}da:` : `Принять в ${saleCurrency}:`}
                      </span>
                      <span className="mono" style={{ fontSize: '16px', fontWeight: 900, color: '#4338ca' }}>
                        {curSymbol[saleCurrency] || ''}{parseFloat((total / parseFloat(saleRate)).toFixed(2)).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Payment method picker */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#9EA3BF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
                    {uz ? 'To\'lov usuli' : 'Способ оплаты'}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { key: 'cash',     label: '💵 ' + (uz ? 'Naqd' : 'Нал') },
                      { key: 'card',     label: '💳 ' + (uz ? 'Karta' : 'Карта') },
                      { key: 'transfer', label: '🏦 ' + (uz ? 'O\'tkazma' : 'Перевод') },
                      { key: 'wire',     label: '📑 ' + (uz ? 'Hisobga oʻtkazish' : 'Перечисление') },
                    ].map(o => (
                      <button key={o.key} type="button" onClick={() => setPaymentMethod(o.key)}
                        style={{
                          flex: '1 1 auto', padding: '10px 12px', borderRadius: '12px',
                          border: `2px solid ${paymentMethod === o.key ? '#FF6B2B' : '#E2E4F0'}`,
                          background: paymentMethod === o.key ? 'rgba(255,107,43,.08)' : '#fff',
                          color: paymentMethod === o.key ? '#FF6B2B' : '#6B6F8A',
                          cursor: 'pointer', fontWeight: 800, fontSize: '12px', fontFamily: "'Nunito', sans-serif",
                          transition: 'all .15s',
                        }}>{o.label}</button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', fontWeight: 700, color: '#dc2626', marginBottom: '12px', textAlign: 'center' }}>
                    {error}
                  </div>
                )}

                <button onClick={handleSell} disabled={selling || stock <= 0}
                  style={{
                    width: '100%', padding: '18px', border: 'none', borderRadius: '14px',
                    background: stock <= 0 ? '#E2E4F0' : 'linear-gradient(135deg, #FF6B2B, #FF8C55)',
                    color: stock <= 0 ? '#9EA3BF' : '#fff',
                    fontWeight: 900, fontSize: '18px', cursor: stock <= 0 ? 'not-allowed' : 'pointer',
                    fontFamily: "'Nunito', sans-serif",
                    boxShadow: stock <= 0 ? 'none' : '0 6px 20px rgba(255,107,43,.4)',
                    transition: 'all .2s', letterSpacing: '0.3px',
                  }}>
                  {selling ? (uz ? 'Saqlanmoqda...' : 'Сохранение...') :
                   stock <= 0 ? (uz ? 'Omborda yo\'q' : 'Нет в наличии') :
                   `💰 ${uz ? 'Sotish' : 'Продать'} — ${qty} ${product.unit}`}
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!product && !notFound && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9EA3BF' }}>
              <div style={{ fontSize: '52px', marginBottom: '14px' }}>🛍️</div>
              <div style={{ fontWeight: 800, fontSize: '17px', marginBottom: '6px', color: '#6B6F8A' }}>
                {uz ? 'Tovarni skanerlang yoki qidiring' : 'Сканируйте или найдите товар'}
              </div>
              <div style={{ fontSize: '13px' }}>
                {uz ? 'Kamera yoki qidiruv maydoni orqali' : 'Через камеру или строку поиска'}
              </div>
            </div>
          )}

          {/* ── Sales history with period filter ── */}
          {history.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#1A1B2E' }}>
                  {uz ? 'Sotuvlar tarixi' : 'История продаж'}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, background: 'rgba(255,107,43,.1)', color: '#FF6B2B', padding: '3px 10px', borderRadius: '10px' }}>
                    {filteredHistory.length} {uz ? 'ta' : 'шт'}
                  </span>
                  <button onClick={loadHistory} style={{ background: 'none', border: '1.5px solid #E2E4F0', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#6B6F8A', fontFamily: "'Nunito', sans-serif" }}>
                    {uz ? 'Yangilash' : 'Обновить'}
                  </button>
                </div>
              </div>

              {/* Period filter */}
              <div style={{ marginBottom: '10px' }}>
                <PeriodFilter period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} compact />
              </div>

              {filteredHistory.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9EA3BF', padding: '20px', fontSize: '13px', background: '#fff', borderRadius: '12px' }}>
                  {uz ? 'Bu davr uchun sotuv yo\'q' : 'За этот период продаж нет'}
                </div>
              ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pagedHistory.map(sale => {
                  const canCancel = sale.status === 'pending';
                  // For sellers, "Подтверждено" only AFTER cashier has accepted the cash (cash_settled = true).
                  // Until then it stays "Ожидает подтверждения" — even if stock_outcome is already approved.
                  const cashSettled = sale.cash_settled === true || sale.cash_settled === 't';
                  const effectiveStatus = sale.status === 'approved' && !cashSettled ? 'awaiting_cash' : sale.status;
                  const statusColor = effectiveStatus === 'approved' ? '#16a34a'
                                    : effectiveStatus === 'rejected' ? '#dc2626'
                                    : '#d97706';
                  const statusLabel = effectiveStatus === 'approved' ? (uz ? 'Tasdiqlangan' : 'Подтверждено') :
                                      effectiveStatus === 'rejected' ? (uz ? 'Rad etilgan' : 'Отклонено') :
                                      effectiveStatus === 'awaiting_cash' ? (uz ? 'Kassir tasdiqlashini kutmoqda' : 'Ждёт подтверждения кассира') :
                                      (uz ? 'Kutilmoqda' : 'Ожидает');
                  return (
                    <div key={sale.id} style={{ background: '#fff', borderRadius: '12px', padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', border: `1px solid ${canCancel ? 'rgba(245,158,11,.2)' : 'var(--border, #E2E4F0)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sale.name_ru}</div>
                          <div style={{ fontSize: '12px', color: '#6B6F8A', marginTop: '2px' }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                              {parseFloat(parseFloat(sale.quantity).toFixed(3)).toString()} {sale.unit}
                            </span>
                            {' × '}
                            <span style={{ color: '#FF6B2B', fontWeight: 700 }}>{fmtNum(sale.price || 0)}</span>
                            {' = '}
                            <span style={{ fontWeight: 800, color: '#1A1B2E' }}>
                              {fmtMoney(parseFloat(sale.quantity) * parseFloat(sale.price || 0))}
                            </span>
                          </div>
                          {sale.currency && sale.currency !== 'UZS' && parseFloat(sale.original_price) > 0 && (
                            <div className="mono" style={{ fontSize: '11px', color: '#4338ca', marginTop: '3px', background: 'rgba(67,56,202,.06)', display: 'inline-block', padding: '1px 8px', borderRadius: '8px' }}>
                              💱 {curSymbol[sale.currency] || ''}{parseFloat((parseFloat(sale.original_price) * parseFloat(sale.quantity)).toFixed(2)).toLocaleString('ru-RU')} {sale.currency}
                              {' @ '}{fmtNum(sale.exchange_rate)}
                            </div>
                          )}
                          <div style={{ fontSize: '11px', color: '#9EA3BF', marginTop: '3px' }}>
                            {formatDateTimeShort(sale.created_at)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: statusColor, background: statusColor + '18', padding: '2px 8px', borderRadius: '10px' }}>
                            {statusLabel}
                          </span>
                          {canCancel && (
                            <button onClick={() => handleCancelSale(sale.id)} style={{
                              background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
                              color: '#dc2626', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer',
                              fontWeight: 700, fontSize: '11px', fontFamily: "'Nunito', sans-serif",
                            }}>
                              {uz ? 'Bekor' : 'Отменить'}
                            </button>
                          )}
                          {sale.status === 'approved' && cashSettled && (
                            <button onClick={() => setEditReq({ sale, qty: parseFloat(sale.quantity), price: parseFloat(sale.price), note: sale.note || '', reason: '' })}
                              style={{
                                background: 'rgba(67,56,202,.08)', border: '1px solid rgba(67,56,202,.2)',
                                color: '#4338ca', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer',
                                fontWeight: 700, fontSize: '11px', fontFamily: "'Nunito', sans-serif",
                              }}>
                              ✏️ {uz ? 'Tahrirlash' : 'Изменить'}
                            </button>
                          )}
                          {sale.status === 'approved' && cashSettled && sale.outcome_type !== 'return_to_supplier' && sale.outcome_type !== 'writeoff' && sale.outcome_type !== 'customer_return' && (
                            <button onClick={() => setCustReturn({
                              sale,
                              quantity: parseFloat(sale.quantity),
                              refund_amount: (parseFloat(sale.quantity) * parseFloat(sale.price || 0)).toString(),
                              payment_method: 'cash',
                              reason: '',
                            })} style={{
                              background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)',
                              color: '#dc2626', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer',
                              fontWeight: 700, fontSize: '11px', fontFamily: "'Nunito', sans-serif",
                            }}>
                              ↩️ {uz ? 'Vozvrat' : 'Возврат'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}

              {/* Pagination — numbered pages */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    style={{ background: '#fff', border: '1.5px solid #E2E4F0', borderRadius: '8px', padding: '5px 10px', fontSize: '13px', fontWeight: 700, color: currentPage === 1 ? '#D1D5DB' : '#6B6F8A', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontFamily: "'Nunito', sans-serif" }}>‹</button>
                  {(() => {
                    // Show up to 5 page numbers around current
                    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                    const end   = Math.min(totalPages, start + 4);
                    const items = [];
                    for (let p = start; p <= end; p++) items.push(p);
                    return items.map(p => (
                      <button key={p} onClick={() => setPage(p)} style={{
                        minWidth: '32px', padding: '5px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        fontWeight: 800, fontSize: '13px', fontFamily: "'Nunito', sans-serif",
                        background: p === currentPage ? '#FF6B2B' : '#fff',
                        color: p === currentPage ? '#fff' : '#6B6F8A',
                        boxShadow: p === currentPage ? '0 2px 6px rgba(255,107,43,.3)' : '0 1px 2px rgba(0,0,0,.05)',
                      }}>{p}</button>
                    ));
                  })()}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    style={{ background: '#fff', border: '1.5px solid #E2E4F0', borderRadius: '8px', padding: '5px 10px', fontSize: '13px', fontWeight: 700, color: currentPage === totalPages ? '#D1D5DB' : '#6B6F8A', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontFamily: "'Nunito', sans-serif" }}>›</button>
                </div>
              )}

              {/* Period total */}
              {filteredHistory.length > 0 && (
                <div style={{ background: 'linear-gradient(135deg, #FF6B2B, #FF8C55)', borderRadius: '12px', padding: '14px 16px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: '14px' }}>{uz ? 'Jami:' : 'Итого:'}</span>
                  <span style={{ color: '#fff', fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: '18px' }}>
                    {fmtMoney(filteredHistory.filter(s => s.status !== 'rejected').reduce((sum, s) => sum + parseFloat(s.quantity) * parseFloat(s.price || 0), 0))}
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      <div style={{ height: '32px' }} />

      {/* Edit-request modal */}
      {editReq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={() => setEditReq(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)', fontFamily: "'Nunito', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontWeight: 800, fontSize: '17px' }}>✏️ {uz ? 'Tahrir uchun soʻrov' : 'Запрос на изменение'}</div>
              <button onClick={() => setEditReq(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9EA3BF' }}>×</button>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '14px' }}>
              {uz ? 'Kassir tasdiqlagandan keyin oʻzgartiriladi' : 'Применится после одобрения кассиром'}
            </div>
            <div style={{ background: '#F4F5FA', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{editReq.sale.name_ru}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>#{editReq.sale.id}</div>
            </div>
            <div className="form-grid" style={{ marginBottom: '10px' }}>
              <div>
                <label className="label">{uz ? 'Miqdor' : 'Кол-во'}</label>
                <input className="input mono" type="number" min="0.001" step="any"
                  value={editReq.qty} onChange={e => setEditReq({ ...editReq, qty: e.target.value })} />
              </div>
              <div>
                <label className="label">{uz ? 'Narxi' : 'Цена'}</label>
                <input className="input mono" type="number" min="0" step="any"
                  value={editReq.price} onChange={e => setEditReq({ ...editReq, price: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label className="label">{uz ? 'Izoh' : 'Примечание'}</label>
              <input className="input" value={editReq.note}
                onChange={e => setEditReq({ ...editReq, note: e.target.value })} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="label">{uz ? 'Sabab (kassir uchun)' : 'Причина (для кассира)'}</label>
              <textarea className="input" rows={2} value={editReq.reason}
                onChange={e => setEditReq({ ...editReq, reason: e.target.value })}
                placeholder={uz ? 'Masalan: noto\'g\'ri miqdor kiritildi' : 'Например: ошибся в количестве'} />
            </div>
            {editReqErr && <div className="alert alert-error">{editReqErr}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={submitEditRequest} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                {uz ? 'Soʻrov yuborish' : 'Отправить запрос'}
              </button>
              <button onClick={() => setEditReq(null)} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
                {uz ? 'Bekor' : 'Отмена'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer-return modal */}
      {custReturn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={() => setCustReturn(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)', fontFamily: "'Nunito', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontWeight: 800, fontSize: '17px' }}>↩️ {uz ? 'Mijozdan qaytarish' : 'Возврат от клиента'}</div>
              <button onClick={() => setCustReturn(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9EA3BF' }}>×</button>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '14px' }}>
              {uz ? 'Tovar omborga qaytadi, mijozga pul qaytariladi (kassa rasxodi)' : 'Товар вернётся на склад, клиенту вернётся сумма (расход кассы)'}
            </div>
            <div style={{ background: '#F4F5FA', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{custReturn.sale.name_ru}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                {uz ? 'Sotuv' : 'Продажа'} #{custReturn.sale.id} · {parseFloat(custReturn.sale.quantity)} {custReturn.sale.unit} × {fmtNum(custReturn.sale.price || 0)}
              </div>
            </div>
            <div className="form-grid" style={{ marginBottom: '10px' }}>
              <div>
                <label className="label">{uz ? 'Qaytarish miqdori' : 'Сколько возвращают'} *</label>
                <input className="input mono" type="number" min="0.001" step="any" max={parseFloat(custReturn.sale.quantity)}
                  value={custReturn.quantity} onChange={e => {
                    const q = e.target.value;
                    const auto = (parseFloat(q) || 0) * parseFloat(custReturn.sale.price || 0);
                    setCustReturn({ ...custReturn, quantity: q, refund_amount: auto.toString() });
                  }} />
                <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>
                  {uz ? `Maks: ${parseFloat(custReturn.sale.quantity)}` : `Макс: ${parseFloat(custReturn.sale.quantity)}`}
                </div>
              </div>
              <div>
                <label className="label">{uz ? 'Qaytariladigan summa' : 'Сумма возврата'}</label>
                <input className="input mono" type="number" min="0" step="any"
                  value={custReturn.refund_amount} onChange={e => setCustReturn({ ...custReturn, refund_amount: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label className="label">{uz ? 'Qaytarish usuli' : 'Способ возврата'}</label>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[
                  { key: 'cash',     label: '💵 ' + (uz ? 'Naqd' : 'Нал') },
                  { key: 'card',     label: '💳 ' + (uz ? 'Karta' : 'Карта') },
                  { key: 'transfer', label: '🏦 ' + (uz ? 'Oʻtkazma' : 'Перевод') },
                  { key: 'wire',     label: '📑 ' + (uz ? 'Hisobga oʻtkazish' : 'Перечисление') },
                ].map(o => (
                  <button key={o.key} type="button" onClick={() => setCustReturn({ ...custReturn, payment_method: o.key })}
                    style={{
                      padding: '6px 10px', borderRadius: '20px',
                      border: `1.5px solid ${custReturn.payment_method === o.key ? '#dc2626' : '#E2E4F0'}`,
                      background: custReturn.payment_method === o.key ? 'rgba(220,38,38,.08)' : '#fff',
                      color: custReturn.payment_method === o.key ? '#dc2626' : '#6B6F8A',
                      cursor: 'pointer', fontWeight: 700, fontSize: '11px', fontFamily: "'Nunito', sans-serif",
                    }}>{o.label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="label">{uz ? 'Sabab' : 'Причина'}</label>
              <textarea className="input" rows={2} value={custReturn.reason}
                onChange={e => setCustReturn({ ...custReturn, reason: e.target.value })}
                placeholder={uz ? 'Masalan: tovar yoqmadi / nuqsonli' : 'Например: не подошло / брак'} />
            </div>
            {custReturnErr && <div className="alert alert-error">{custReturnErr}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={submitCustomerReturn} className="btn" style={{ flex: 2, justifyContent: 'center', background: '#dc2626', color: '#fff' }}>
                {uz ? 'Qaytarishni saqlash' : 'Оформить возврат'}
              </button>
              <button onClick={() => setCustReturn(null)} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
                {uz ? 'Bekor' : 'Отмена'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pop {
          0% { transform: scale(0.4); opacity: 0; }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      {printModal}
    </div>
  );
}
