import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, LangContext } from '../App.jsx';
import { t } from '../i18n.js';
import api from '../api.js';
import JsBarcode from 'jsbarcode';
import { fmtMoney } from '../utils.js';
import useBarcodePrint from '../utils/useBarcodePrint.jsx';
import MyTasks from '../components/MyTasks.jsx';
import { useTaskInbox } from '../hooks/useTaskInbox.jsx';

const S = {
  page: {
    background: '#F4F5FA', minHeight: '100vh',
    maxWidth: '480px', margin: '0 auto',
    fontFamily: "'Nunito', sans-serif",
  },
  header: {
    background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)',
    padding: '14px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 100,
    // На 360px пять кнопок справа (Задачи, UZ, RU, Меню, Выход) плюс название
    // компании не влезали в строку и уносили экран вбок на 113px. Разрешаем
    // перенос и даём левому блоку сжиматься.
    flexWrap: 'wrap', gap: '8px', rowGap: '10px',
  },
  headerLeft: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 140px' },
  headerTitle: {
    color: '#fff', fontWeight: 800, fontSize: '16px', lineHeight: 1.2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  headerSub: {
    color: 'rgba(255,255,255,.65)', fontSize: '12px', marginTop: '2px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  backBtn: {
    background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
    padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
    fontWeight: 700, fontSize: '13px',
  },
  card: {
    background: '#fff', borderRadius: '14px',
    boxShadow: '0 2px 12px rgba(10,132,255,.08)',
    padding: '16px', margin: '12px 16px 0',
  },
  scanZone: {
    border: '2px dashed #0A84FF', borderRadius: '12px',
    padding: '28px 16px', textAlign: 'center', cursor: 'pointer',
    background: 'rgba(10,132,255,.03)', transition: 'all .2s',
  },
  scanZoneActive: {
    border: '2px solid #FF6B2B', background: 'rgba(255,107,43,.04)',
  },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: '#fff', borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(10,132,255,.08)',
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
    background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)',
    border: 'none', borderRadius: '10px', color: '#fff',
    fontWeight: 800, fontSize: '15px', cursor: 'pointer',
    fontFamily: "'Nunito', sans-serif", marginTop: '14px',
    boxShadow: '0 4px 15px rgba(10,132,255,.3)',
  },
  productCard: {
    background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)',
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

// ─── Числовой ввод ────────────────────────────────────────────────────────────
// Стейт — СТРОКА, в onChange только чистка символов, нормализация и кламп — на
// onBlur. Дополнительно: у input type="number" Chrome отдаёт e.target.value === ''
// на промежуточно-невалидном вводе («12,5» с ru/uz-клавиатуры, «1 500 000»
// с пробелами в разрядах) — контролируемое поле само себя очищало, и цену
// физически нельзя было ввести. Поэтому у всех денег и количеств здесь
// type="text" + inputMode="decimal".
const numClean = (v) => String(v ?? '').replace(/[^\d.,\s]/g, '');
const numNorm = (v) => {
  let s = String(v ?? '').replace(/\s+/g, '');
  const seps = (s.match(/[.,]/g) || []).length;
  // Два и больше разделителя — это разряды тысяч («1.500.000», «1,500,000»).
  s = seps > 1 ? s.replace(/[.,]/g, '') : s.replace(',', '.');
  if (!s || s === '.') return '';
  const n = parseFloat(s);
  return Number.isFinite(n) ? String(n) : '';
};
const numClamp = (v, min) => {
  const s = numNorm(v);
  if (s === '') return '';
  const n = parseFloat(s);
  return String(min != null && n < min ? min : n);
};
// Число из «сырого» поля — на случай отправки формы без blur.
const numVal = (v) => { const s = numNorm(v); return s === '' ? NaN : parseFloat(s); };

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
  const { openPrint, printModal } = useBarcodePrint(lang);
  useEffect(() => {
    if (ref.current && value) {
      try { JsBarcode(ref.current, value, { format: 'CODE128', width: 2, height: 50, displayValue: true, fontSize: 13 }); }
      catch {}
    }
  }, [value]);

  if (!value) return null;
  return (
    <div style={{ background: '#fff', borderRadius: '8px', padding: '10px', textAlign: 'center', marginTop: '10px' }}>
      <svg ref={ref} />
      {showPrint && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
          <button onClick={() => openPrint([{ name: productName, barcode: value }])} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px',
            background: '#141419', color: '#fff', border: 'none', borderRadius: '8px',
            cursor: 'pointer', fontWeight: 700, fontSize: '13px',
            fontFamily: "'Nunito', sans-serif",
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" style={{ width: 15, height: 15 }}>
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            {lang === 'uz' ? 'Chop etish' : 'Распечатать'}
          </button>
        </div>
      )}
      {printModal}
    </div>
  );
}

// ─── Camera Scanner ────────────────────────────────────────────────────────────
// Быстрый скан ЛИНЕЙНОГО штрих-кода. Скорость упиралась в четыре вещи сразу
// (проверено по коду html5-qrcode 2.3.8 в node_modules):
//  1) qrbox задаёт не рамку, а РАЗМЕР CANVAS декодера в CSS-пикселях
//     видоискателя (setupUi → createCanvasElement(qrRegion.*)). При жёстких
//     250x150 у EAN-13 (95 модулей) код обязан был занять ~76% ширины рамки,
//     иначе на модуль приходилось меньше 2 px — отсюда «поднеси телефон и жди».
//     Теперь: видоискатель держим логически широким (SCAN_VIEW_W CSS-px) и
//     визуально сжимаем трансформацией под ширину экрана, а qrbox считаем
//     ФУНКЦИЕЙ от его размеров — широкой невысокой полосой. Коридор дистанции,
//     на котором код читается, становится примерно вдвое шире.
//  2) formatsToSupport не был задан → getSupportedFormats возвращал ВСЕ 17
//     форматов, и ZXing на каждый кадр гонял 2D-ридеры (QR/DataMatrix/Aztec/
//     PDF417) плюс 11 одномерных. Оставляем только то, что реально печатаем
//     и встречаем на упаковке.
//  3) декодеры чередуются через кадр (code-decoder.js getDecoder), поэтому
//     нативный BarcodeDetector включаем явно, а чтобы «дешёвым» был и
//     ZXing-кадр — см. п.2.
//  4) disableFlip не был задан → default false, и КАЖДЫЙ неудачный кадр
//     декодировался второй раз в зеркале (линейному коду это бесполезно).
//     Плюс videoConstraints с непрерывным автофокусом и aspectRatio убран:
//     он применялся жёстким applyConstraints уже после открытия потока и на
//     части телефонов ронял start() с включённой камерой.
const SCAN_VIEW_W = 480;

function CameraScanner({ onScan, onClose, lang }) {
  const hostRef = useRef(null);
  // id генерируем на монтирование: с жёсткой строкой два инстанса (StrictMode,
  // повторное открытие) боролись за один и тот же div, и clearElement() одного
  // сносил video/canvas другого.
  const idRef = useRef('h5qr-' + Math.random().toString(36).slice(2));
  const instRef = useRef(null);
  const capsRef = useRef(null);
  const doneRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  // Язык через ref: он не должен попадать в deps эффекта, иначе переключение
  // RU/UZ перезапускало бы камеру.
  const langRef = useRef(lang);
  langRef.current = lang;

  const [attempt, setAttempt] = useState(0);
  const [scale, setScale] = useState(1);
  const [viewH, setViewH] = useState(0);
  const [error, setError] = useState('');
  const [errDetail, setErrDetail] = useState('');
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState({ available: false, on: false });
  const [zoom, setZoom] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState('');

  // Гасим камеру безопасно: stop() бросает СИНХРОННО строкой, если сканер не
  // запущен (html5-qrcode.js:225) — .catch() такую ошибку не поймает.
  const stopInstance = useCallback((inst) => {
    if (!inst) return;
    try {
      const st = inst.getState();
      if (inst.isScanning || st === 2 /* SCANNING */ || st === 3 /* PAUSED */) {
        const p = inst.stop();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch {}
  }, []);

  const stopScanner = useCallback(() => {
    const inst = instRef.current;
    instRef.current = null;
    capsRef.current = null;
    stopInstance(inst);
  }, [stopInstance]);

  // Логическая ширина видоискателя фиксирована, поэтому сжимаем блок под экран.
  useLayoutEffect(() => {
    const measure = () => {
      const w = hostRef.current?.clientWidth || 0;
      if (w > 0) setScale(Math.min(1, w / SCAN_VIEW_W));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  const readCapabilities = useCallback((inst) => {
    let caps;
    try { caps = inst.getRunningTrackCameraCapabilities(); } catch { return; }
    capsRef.current = caps;
    try {
      const tf = caps.torchFeature();
      if (tf.isSupported()) setTorch({ available: true, on: tf.value() === true });
    } catch {}
    try {
      const zf = caps.zoomFeature();
      if (zf.isSupported()) {
        const min = zf.min(), max = zf.max(), step = zf.step() || 0.1;
        const cur = zf.value();
        if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
          setZoom({ min, max, step, value: Number.isFinite(cur) ? cur : min });
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      let lib;
      try { lib = await import('html5-qrcode'); }
      catch { if (!cancelled) setError(t('scannerLoadError', langRef.current)); return; }
      if (cancelled) return;

      const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = lib;
      let inst;
      try {
        inst = new Html5Qrcode(idRef.current, {
          verbose: false,
          // Только то, что мы печатаем (CODE128) и что бывает на упаковке.
          formatsToSupport: [
            F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E,
            F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE,
          ],
          // Нативный BarcodeDetector браузера вместо JS-перебора ZXing.
          useBarCodeDetectorIfSupported: true,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
      } catch {
        if (!cancelled) { setError(t('cameraUnavailable', langRef.current)); setManualOpen(true); }
        return;
      }
      if (cancelled) return;
      instRef.current = inst;

      // Широкая невысокая полоса под линейный код. Функция вызывается ровно
      // тогда, когда видоискатель готов, — попутно узнаём его высоту.
      const qrbox = (vw, vh) => {
        const W = vw > 0 ? vw : SCAN_VIEW_W;
        const H = vh > 0 ? vh : Math.round(SCAN_VIEW_W * 0.75);
        if (vh > 0) setViewH(vh);
        const width = Math.max(200, Math.floor(W * 0.95));
        const height = Math.max(90, Math.min(Math.floor(H * 0.55), Math.floor(width * 0.38)));
        return { width, height };
      };

      const onSuccess = (decodedText) => {
        if (doneRef.current) return;   // ровно один onScan на одно сканирование
        doneRef.current = true;
        try { navigator.vibrate?.(60); } catch {}
        stopScanner();
        onScanRef.current(String(decodedText || '').trim());
      };

      const base = { fps: 20, qrbox, disableFlip: true };
      // ВАЖНО: если videoConstraints задан и валиден, первый аргумент start()
      // игнорируется полностью — facingMode обязан быть внутри constraints.
      const tiers = [
        {
          ...base,
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 1280 }, height: { ideal: 720 },
            focusMode: 'continuous',
            advanced: [{ focusMode: 'continuous' }],
          },
        },
        { ...base, videoConstraints: { facingMode: 'environment' } },
      ];

      for (let i = 0; i < tiers.length; i++) {
        if (cancelled || doneRef.current) return;
        try {
          await inst.start({ facingMode: 'environment' }, tiers[i], onSuccess, () => {});
          // Размонтировались, пока камера открывалась: instRef уже обнулён
          // очисткой эффекта, поэтому гасим ЭТОТ инстанс напрямую — иначе
          // поток остался бы жить, а foreverScan крутиться на отсоединённом video.
          if (cancelled) { instRef.current = null; stopInstance(inst); return; }
          setError(''); setErrDetail('');
          setReady(true);
          readCapabilities(inst);
          return;
        } catch (e) {
          if (i === tiers.length - 1 && !cancelled) {
            // Сырое сообщение библиотеки («Error getting userMedia, error =
            // NotAllowedError...») пользователю ничего не говорит: показываем
            // человеческую причину, а техническую — мелким шрифтом.
            const raw = typeof e === 'string' ? e : (e?.message || String(e || ''));
            const notFound = /NotFound|DevicesNotFound|OverconstrainedError|NotReadable|TrackStart/i.test(raw);
            setError(t(notFound ? 'cameraUnavailable' : 'noCameraAccess', langRef.current));
            setErrDetail(raw.slice(0, 160));
            setManualOpen(true);
          }
        }
      }
    };

    boot();
    return () => { cancelled = true; stopScanner(); };
  }, [attempt, stopScanner, stopInstance, readCapabilities]);

  const toggleTorch = async () => {
    const caps = capsRef.current;
    if (!caps) return;
    const next = !torch.on;
    try {
      await caps.torchFeature().apply(next);
      setTorch(s => ({ ...s, on: next }));
    } catch {}
  };

  const applyZoom = async (v) => {
    const caps = capsRef.current;
    if (!caps || !zoom) return;
    setZoom(z => ({ ...z, value: v }));
    try { await caps.zoomFeature().apply(v); } catch {}
  };

  const retry = () => {
    doneRef.current = false;
    setError(''); setErrDetail(''); setReady(false); setViewH(0);
    setTorch({ available: false, on: false }); setZoom(null);
    setAttempt(a => a + 1);
  };

  const handleClose = () => { stopScanner(); onClose(); };

  const submitManual = () => {
    const code = manual.trim();
    if (!code || doneRef.current) return;
    doneRef.current = true;
    stopScanner();
    onScanRef.current(code);
  };

  const hostH = viewH ? Math.ceil(viewH * scale) : 220;
  const overlay = {
    position: 'absolute', inset: 0, zIndex: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,.72)', color: '#fff',
    fontSize: '13px', fontWeight: 700, textAlign: 'center',
    fontFamily: "'Nunito', sans-serif",
  };
  const pill = {
    background: 'rgba(0,0,0,.62)', border: '1px solid rgba(255,255,255,.28)',
    color: '#fff', borderRadius: '18px', padding: '7px 13px', cursor: 'pointer',
    fontWeight: 700, fontSize: '12px', fontFamily: "'Nunito', sans-serif",
  };

  return (
    <div>
      <div ref={hostRef} style={{
        position: 'relative', width: '100%', height: hostH + 'px',
        overflow: 'hidden', borderRadius: '12px', background: '#000',
      }}>
        {/* html5-qrcode рендерит video и canvas внутрь этого div. Ширина
            логическая (SCAN_VIEW_W), визуально сжимается трансформацией. */}
        <div id={idRef.current} style={{
          width: SCAN_VIEW_W + 'px',
          transform: `scale(${scale})`, transformOrigin: '0 0',
        }} />

        {!ready && !error && <div style={overlay}>{t('cameraLoading', lang)}</div>}

        {error && (
          <div style={{ ...overlay, flexDirection: 'column', gap: '10px', padding: '16px', overflowY: 'auto' }}>
            <span style={{ color: '#FCA5A5', wordBreak: 'break-word' }}>{error}</span>
            {errDetail && (
              <span style={{ color: 'rgba(255,255,255,.55)', fontSize: '10.5px', fontWeight: 600, wordBreak: 'break-word' }}>
                {errDetail}
              </span>
            )}
            <button type="button" onClick={retry} style={pill}>{t('cameraRetry', lang)}</button>
          </div>
        )}

        {ready && !error && (torch.available || zoom) && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: '8px', zIndex: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            {torch.available && (
              <button type="button" onClick={toggleTorch} style={{
                ...pill,
                background: torch.on ? '#0A84FF' : pill.background,
                border: torch.on ? '1px solid #0A84FF' : pill.border,
              }}>{t('scanTorch', lang)}</button>
            )}
            {zoom && (
              <div style={{ ...pill, cursor: 'default', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{t('scanZoom', lang)}</span>
                <input type="range" min={zoom.min} max={zoom.max} step={zoom.step}
                  value={zoom.value}
                  onChange={e => applyZoom(parseFloat(e.target.value))}
                  style={{ width: '86px' }} />
              </div>
            )}
          </div>
        )}

        <button type="button" onClick={handleClose} style={{
          position: 'absolute', top: '10px', right: '10px', zIndex: 14,
          background: 'rgba(0,0,0,.6)', border: 'none', color: '#fff',
          borderRadius: '20px', padding: '6px 14px', cursor: 'pointer',
          fontWeight: 700, fontSize: '13px', fontFamily: "'Nunito', sans-serif",
        }}>{t('stopScan', lang)}</button>
      </div>

      {/* Подсказка по дистанции + ручной ввод: экран не должен быть тупиком,
          если камера не справилась или её вообще нет. */}
      {ready && !error && (
        <div style={{ marginTop: '7px', fontSize: '11.5px', color: '#6B6F8A', fontWeight: 600, textAlign: 'center' }}>
          {t('scanAimHint', lang)}
        </div>
      )}

      <div style={{ marginTop: '8px' }}>
        {manualOpen ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              style={{ ...S.input, flex: 1, fontSize: '14px', padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace" }}
              type="text" inputMode="numeric"
              value={manual}
              onChange={e => setManual(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitManual(); } }}
              placeholder={t('codeManualPlaceholder', lang)}
            />
            <button type="button" onClick={submitManual} disabled={!manual.trim()} style={{
              padding: '10px 16px', background: manual.trim() ? '#0A84FF' : '#C7CBDD',
              color: '#fff', border: 'none', borderRadius: '8px',
              cursor: manual.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 800, fontSize: '13px', fontFamily: "'Nunito', sans-serif",
            }}>{t('findBtn', lang)}</button>
          </div>
        ) : (
          <button type="button" onClick={() => setManualOpen(true)} style={{
            width: '100%', padding: '9px', background: 'none',
            border: '1.5px dashed #E2E4F0', borderRadius: '8px', cursor: 'pointer',
            fontSize: '12.5px', fontWeight: 700, color: '#6B6F8A',
            fontFamily: "'Nunito', sans-serif",
          }}>{t('enterCodeManually', lang)}</button>
        )}
      </div>
    </div>
  );
}

// ─── Webcam Photo Capture (getUserMedia) ──────────────────────────────────────
// Works on desktop (uses laptop webcam) and mobile (uses phone camera).
// onCapture(blob) — fires with a JPEG Blob when user clicks "Capture".
function PhotoCapture({ onCapture, onClose, uz }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (e) {
        setError(uz ? 'Kameraga ruxsat yo\'q yoki mavjud emas' : 'Нет доступа к камере или она недоступна');
      }
    })();
    return () => {
      stopped = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [uz]);

  const capture = () => {
    if (!videoRef.current || !ready) return;
    const v = videoRef.current;
    if (!v.videoWidth || !v.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => { if (blob) onCapture(blob); }, 'image/jpeg', 0.85);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 1000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
      <div style={{ position: 'relative', maxWidth: '480px', width: '100%', borderRadius: '14px', overflow: 'hidden', background: '#000' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block' }} />
        {!ready && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px' }}>
            {uz ? 'Kamera yuklanmoqda...' : 'Загрузка камеры...'}
          </div>
        )}
        {error && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#f87171', fontSize: '14px', fontWeight: 700 }}>
            {error}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '18px' }}>
        <button type="button" onClick={capture} disabled={!ready} style={{
          padding: '14px 28px', background: ready ? 'linear-gradient(135deg, #0A84FF, #5E5CE6)' : '#9EA3BF',
          color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '15px',
          cursor: ready ? 'pointer' : 'not-allowed', fontFamily: "'Nunito', sans-serif",
          boxShadow: ready ? '0 4px 15px rgba(10,132,255,.4)' : 'none',
        }}>
          📸 {uz ? 'Suratga olish' : 'Снять'}
        </button>
        <button type="button" onClick={onClose} style={{
          padding: '14px 24px', background: 'rgba(255,255,255,.12)', color: '#fff',
          border: '1.5px solid rgba(255,255,255,.3)', borderRadius: '12px',
          fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: "'Nunito', sans-serif",
        }}>
          ✕ {uz ? 'Yopish' : 'Закрыть'}
        </button>
      </div>
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
  const [showCamera, setShowCamera] = useState(false);
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

  // Captured webcam blob → upload as snapshot.jpg
  const handleCaptured = async (blob) => {
    setShowCamera(false);
    if (!blob) return;
    setUploading(true); setMsg(null);
    const fd = new FormData();
    fd.append('photo', blob, `snapshot-${Date.now()}.jpg`);
    try {
      const { data } = await api.post('/upload/photo', fd);
      setForm(f => ({ ...f, photo_url: data.url }));
    } catch (err) {
      const status = err.response?.status;
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
      const errText = status === 413
        ? (uz ? `Fayl juda katta (${sizeMB} MB). Max 15 MB.` : `Файл слишком большой (${sizeMB} MB). Макс 15 MB.`)
        : (err.response?.data?.error || (uz ? 'Yuklashda xato' : 'Ошибка загрузки'));
      setMsg(errText);
    }
    setUploading(false);
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
    // Пустую цену НЕ глотаем нулём: раньше товар молча создавался с ценой 0.
    if (numNorm(form.price_buy) === '') {
      setMsg(uz ? 'Tan narxini kiriting' : 'Введите цену закупки');
      return false;
    }
    return true;
  };

  // Create product, then record initial transaction (income or outcome)
  const handleSaveWith = async (txType) => {
    if (!validateForm()) return;
    setMsg(null);
    setSaving(true);
    // Числа берём через numVal: поле могло не потерять фокус перед сабмитом,
    // и в нём ещё лежит «12,5» / «1 500 000».
    const qty = numVal(form.quantity) || 0;
    const priceBuy = numVal(form.price_buy) || 0;
    const priceSell = numVal(form.price_sell) || 0;
    try {
      const product = await api.post('/products', {
        name_ru: form.name_ru,
        name_uz: form.name_ru,
        type_id: form.type_id ? parseInt(form.type_id) : null,
        barcode: form.barcode,
        photo_url: form.photo_url || null,
        price_sell: priceSell,
        price_buy: priceBuy,
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
            price: priceBuy || priceSell || 0,
            supplier: '',
          });
          finalStock = qty;
        } else if (txType === 'outcome') {
          // For "Расход" on a brand-new product: register income first (so we have stock),
          // then outcome (so we record the sale). Net stock = 0, but both movements tracked.
          await api.post('/stock/income', {
            product_id: pid, quantity: qty,
            price: priceBuy || priceSell || 0,
            supplier: '',
          });
          await api.post('/stock/outcome', {
            product_id: pid, quantity: qty,
            price: priceSell,
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
      {showCamera && <PhotoCapture onCapture={handleCaptured} onClose={() => setShowCamera(false)} uz={uz} />}
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
                  background: selected ? '#0A84FF' : '#F4F5FA',
                  color: selected ? '#fff' : '#6B6F8A',
                  boxShadow: selected ? '0 2px 8px rgba(10,132,255,.3)' : 'none',
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
              background: '#0A84FF', color: '#fff', fontWeight: 800, cursor: 'pointer',
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
                border: `1.5px solid ${form.unit === o.u ? '#0A84FF' : '#E2E4F0'}`,
                background: form.unit === o.u ? 'rgba(10,132,255,.08)' : '#fff',
                color: form.unit === o.u ? '#0A84FF' : '#6B6F8A',
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
                padding: '8px 14px', background: '#0A84FF', color: '#fff',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 700, fontSize: '13px', fontFamily: "'Nunito', sans-serif",
              }}>OK</button>
          )}
        </div>
      </div>

      {/* Both prices side-by-side — purchase (for Приход) + sale (for Расход) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <div>
          <label style={{ ...S.label, color: '#16a34a' }}>
            {uz ? "TAN NARXI (SO'M / " + form.unit + ")" : 'ЦЕНА ЗАКУПКИ (за ' + form.unit + ')'}
          </label>
          <input
            style={{ ...S.input, fontSize: '15px', padding: '12px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", borderColor: form.price_buy ? '#16a34a' : '#E2E4F0' }}
            type="text" inputMode="decimal"
            value={form.price_buy}
            onChange={e => setForm(f => ({ ...f, price_buy: numClean(e.target.value) }))}
            onBlur={e => setForm(f => ({ ...f, price_buy: numClamp(e.target.value, 0) }))}
            placeholder="0"
          />
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px', textAlign: 'center' }}>
            {uz ? '↪ Kirim uchun' : '↪ Для прихода'}
          </div>
        </div>
        <div>
          <label style={{ ...S.label, color: '#FF6B2B' }}>
            {uz ? "SOTUV NARXI (SO'M / " + form.unit + ")" : 'ЦЕНА ПРОДАЖИ (за ' + form.unit + ')'}
          </label>
          <input
            style={{ ...S.input, fontSize: '15px', padding: '12px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", borderColor: form.price_sell ? '#FF6B2B' : '#E2E4F0' }}
            type="text" inputMode="decimal"
            value={form.price_sell}
            onChange={e => setForm(f => ({ ...f, price_sell: numClean(e.target.value) }))}
            onBlur={e => setForm(f => ({ ...f, price_sell: numClamp(e.target.value, 0) }))}
            placeholder="0"
          />
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px', textAlign: 'center' }}>
            {uz ? '↪ Chiqim/sotuv uchun' : '↪ Для расхода/продажи'}
          </div>
        </div>
      </div>

      {/* Quantity — full width */}
      <div style={{ marginBottom: '14px' }}>
        <div>
          <label style={S.label}>
            {uz ? 'MIQDOR (' + form.unit + ')' : 'КОЛИЧЕСТВО (' + form.unit + ')'}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button type="button"
              onClick={() => setForm(f => ({ ...f, quantity: String(Math.max(0, parseFloat(f.quantity || 0) - 1)) }))}
              style={{ width: '38px', height: '42px', borderRadius: '8px', border: '1.5px solid #E2E4F0', background: '#F4F5FA', fontSize: '20px', cursor: 'pointer', fontWeight: 700, color: '#0A84FF', flexShrink: 0 }}>−</button>
            <input
              style={{ ...S.input, flex: 1, fontSize: '16px', fontWeight: 800, textAlign: 'center', padding: '10px 4px', fontFamily: "'JetBrains Mono', monospace" }}
              type="text" inputMode="decimal"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: numClean(e.target.value) }))}
              onBlur={e => setForm(f => ({ ...f, quantity: numClamp(e.target.value, 0) }))}
            />
            <button type="button"
              onClick={() => setForm(f => ({ ...f, quantity: String(parseFloat(f.quantity || 0) + 1) }))}
              style={{ width: '38px', height: '42px', borderRadius: '8px', border: 'none', background: '#0A84FF', fontSize: '20px', cursor: 'pointer', fontWeight: 700, color: '#fff', flexShrink: 0 }}>+</button>
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
            padding: '10px', background: 'rgba(10,132,255,.04)',
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
            {/* Camera — live capture if getUserMedia available, else native input fallback */}
            {navigator.mediaDevices?.getUserMedia ? (
              <button type="button" onClick={() => setShowCamera(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  border: '1.5px dashed #E2E4F0', borderRadius: '10px',
                  padding: '14px', textAlign: 'center', cursor: 'pointer', background: '#fafafa',
                  fontFamily: "'Nunito', sans-serif",
                }}>
                <span style={{ fontSize: '13px', color: '#6B6F8A', fontWeight: 700 }}>
                  📷 {uz ? 'Kamera' : 'Камера'}
                </span>
              </button>
            ) : (
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
            )}
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
        {/* Штрих-код можно вписать РУКАМИ: если камера не сработала, товар
            иначе нельзя было завести с его настоящим кодом с упаковки. */}
        <input
          style={{
            flex: 1, minWidth: 0, border: '1.5px solid #E2E4F0', borderRadius: '6px',
            padding: '7px 9px', background: '#fff', outline: 'none', boxSizing: 'border-box',
            fontFamily: "'JetBrains Mono', monospace", color: '#0A84FF',
            fontWeight: 700, fontSize: '13px',
          }}
          type="text" inputMode="numeric"
          value={form.barcode}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 14);
            setForm(f => ({ ...f, barcode: v }));
            setGeneratedBarcode(v);
          }}
          placeholder={uz ? 'Shtrix-kod raqamlari' : 'Цифры штрих-кода'}
        />
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
  // Количество — СТРОКА: можно стереть поле в пустоту и ввести заново
  // (числовой стейт с «|| 1» мгновенно возвращал единицу — жалоба клиента).
  const [qty, setQty] = useState('1');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(product);
  const { openPrint, printModal } = useBarcodePrint(lang);
  const barcodeRef = useRef(null);

  const doAction = async (type) => {
    const qtyNum = numVal(qty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setMsg({ ok: false, text: lang === 'uz' ? 'Miqdorni kiriting' : 'Введите количество' });
      return;
    }
    setLoading(true); setMsg(null);
    try {
      const price = type === 'income' ? currentProduct.price_buy : currentProduct.price_sell;
      await api.post(`/stock/${type}`, {
        product_id: currentProduct.id, quantity: qtyNum, price: price || 0,
      });
      const { data } = await api.get(`/products/${currentProduct.id}`);
      setCurrentProduct(data);
      setMsg({ ok: true, text: `${fmtQty(qtyNum)} ${currentProduct.unit} — ${type === 'income' ? (lang === 'uz' ? 'qabul qilindi' : 'принято') : (lang === 'uz' ? 'chiqarildi' : 'продано')}` });
      setQty('1');
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || t('error') });
    }
    setLoading(false);
  };

  const handlePrint = () => openPrint([currentProduct]);

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
      {printModal}

      {/* Quantity + actions */}
      <div style={{ ...S.card, marginTop: '10px' }}>
        <label style={S.label}>{t('quantity')}</label>
        <div style={S.qtyRow}>
          <button type="button" onClick={() => setQty(q => String(Math.max(1, (parseFloat(q) || 0) - 1)))} style={{ ...S.qtyBtn, background: '#F4F5FA', color: '#0A84FF' }}>−</button>
          <input style={S.qtyInput} type="text" inputMode="decimal" value={qty}
            onChange={e => setQty(numClean(e.target.value))}
            onBlur={e => setQty(numClamp(e.target.value, 0.001))} />
          <button type="button" onClick={() => setQty(q => String((parseFloat(q) || 0) + 1))} style={{ ...S.qtyBtn, background: '#0A84FF', color: '#fff' }}>+</button>
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
  // Количество — СТРОКА: можно стереть поле в пустоту и ввести заново
  // (числовой стейт с «|| 1» мгновенно возвращал единицу — жалоба клиента).
  const [qty, setQty] = useState('1');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(product);
  const { openPrint, printModal } = useBarcodePrint(lang);
  const barcodeRef = useRef(null);
  const uz = lang === 'uz';
  const fmtQty = (v) => parseFloat(parseFloat(v).toFixed(3)).toString();

  useEffect(() => { setCurrentProduct(product); setQty('1'); setMsg(null); }, [product]);

  const doAction = async (type) => {
    const qtyNum = numVal(qty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setMsg({ ok: false, text: uz ? 'Miqdorni kiriting' : 'Введите количество' });
      return;
    }
    setLoading(true); setMsg(null);
    try {
      const price = type === 'income' ? currentProduct.price_buy : currentProduct.price_sell;
      await api.post(`/stock/${type}`, { product_id: currentProduct.id, quantity: qtyNum, price: price || 0 });
      const { data } = await api.get(`/products/${currentProduct.id}`);
      setCurrentProduct(data);
      setMsg({ ok: true, text: `${fmtQty(qtyNum)} ${currentProduct.unit} ${type === 'income' ? (uz ? 'kirim' : 'приход') : (uz ? 'chiqim' : 'расход')}` });
      setQty('1');
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || 'Ошибка' });
    }
    setLoading(false);
  };

  const handlePrint = () => openPrint([currentProduct]);

  const stock = parseFloat(currentProduct.stock);

  return (
    <div style={{ margin: '6px 16px 0', background: '#fff', borderRadius: '14px', boxShadow: '0 4px 20px rgba(10,132,255,.12)', border: '2px solid rgba(10,132,255,.15)', overflow: 'hidden' }}>
      {/* Product header */}
      <div style={{ background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
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
          { label: uz ? 'Narxi' : 'Цена', value: fmtMoney(currentProduct.price_sell || 0), color: '#0A84FF' },
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
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #F4F5FA' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <BarcodeImgRef value={currentProduct.barcode} svgRef={barcodeRef} />
            </div>
            <button onClick={handlePrint} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              background: '#F4F5FA', border: 'none', borderRadius: '8px', padding: '10px 12px',
              cursor: 'pointer', color: '#0A84FF', flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="2" style={{ width: 20, height: 20 }}>
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              <span style={{ fontSize: '10px', fontWeight: 800, fontFamily: "'Nunito', sans-serif" }}>{uz ? 'Chop' : 'Печать'}</span>
            </button>
          </div>
        </div>
      )}
      {printModal}

      {/* Quantity + actions */}
      <div style={{ padding: '12px 16px' }}>
        {msg && (
          <div style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, background: msg.ok ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)', color: msg.ok ? '#16a34a' : '#dc2626' }}>
            {msg.text}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <button onClick={() => setQty(q => String(Math.max(1, (parseFloat(q) || 0) - 1)))} style={{ ...S.qtyBtn, background: '#F4F5FA', color: '#0A84FF', width: '36px', height: '36px' }}>−</button>
          <input style={{ ...S.qtyInput, fontSize: '18px' }} type="text" inputMode="decimal" value={qty}
            onChange={e => setQty(numClean(e.target.value))}
            onBlur={e => setQty(numClamp(e.target.value, 0.001))} />
          <button onClick={() => setQty(q => String((parseFloat(q) || 0) + 1))} style={{ ...S.qtyBtn, background: '#0A84FF', color: '#fff', width: '36px', height: '36px' }}>+</button>
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

  // Задачи с телефона: тот же список исполнителя, что и на /desktop, но
  // полноэкранной шторкой — в шапке для отдельного раздела места нет.
  // Админу не показываем: серверная граница данных админа отдаёт ему 403.
  const [tasksOpen, setTasksOpen] = useState(false);
  const canSeeTasks = !!user?.role && user.role !== 'admin';
  // На кнопке — непрочитанные события, а не активные задачи (активные висят
  // постоянно, и кружок горел бы всегда). Гасит его сам MyTasks при открытии.
  const { unread: tasksUnread } = useTaskInbox();

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
      let { data } = await api.get('/products', { params });
      // Точный поиск по штрих-коду ничего не дал — пробуем обычный поиск
      // (серверный `search` покрывает и barcode ILIKE), чтобы ручной ввод
      // кода не упирался в «не найден» из-за формата записи.
      if (isBarcode && data.length === 0) {
        const r = await api.get('/products', { params: { search: query } });
        data = r.data;
      }
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

  // Чисто цифровой ввод 6+ знаков — это штрих-код, набранный руками:
  // ищем точным совпадением, а не ILIKE по названию.
  const runSearch = () => doSearch(searchText, /^\d{6,}$/.test(searchText.trim()));

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
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '0 1 auto' }}>
          {canSeeTasks && (
            <button onClick={() => setTasksOpen(true)}
              title={uz ? 'Vazifalarim' : 'Мои задачи'}
              style={{ ...S.backBtn, position: 'relative', fontSize: '11px', padding: '5px 10px' }}>
              {uz ? 'Vazifa' : 'Задачи'}
              {tasksUnread > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, background: '#DC2626', color: '#fff', borderRadius: 10, minWidth: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, padding: '0 4px', boxShadow: '0 1px 4px rgba(0,0,0,.25)' }}>{tasksUnread > 99 ? '99+' : tasksUnread}</span>
              )}
            </button>
          )}
          {['uz', 'ru'].map(l => (
            <button key={l} onClick={() => changeLang(l)} style={{
              padding: '4px 9px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              fontWeight: 800, fontSize: '11px',
              background: lang === l ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.15)',
              color: lang === l ? '#0A84FF' : '#fff',
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

      {/* ── Мои задачи — полноэкранная шторка поверх экрана ── */}
      {tasksOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, maxWidth: '480px', margin: '0 auto', background: '#F7F8FA', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 15 }}>{uz ? 'Mening vazifalarim' : 'Мои задачи'}</div>
            <button onClick={() => setTasksOpen(false)}
              style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: 13, fontFamily: "'Nunito', sans-serif" }}>✕</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '12px 14px' }}>
            <MyTasks />
          </div>
        </div>
      )}

      {/* ── Scanner zone ── */}
      <div style={{ margin: '12px 16px 0' }}>
        {scanning ? (
          <CameraScanner onScan={handleScan} onClose={() => setScanning(false)} lang={lang} />
        ) : (
          <div style={S.scanZone} onClick={() => setScanning(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="1.5" style={{ width: 40, height: 40, marginBottom: 8 }}>
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              <line x1="8" y1="12" x2="16" y2="12" strokeWidth="2.5"/>
            </svg>
            <div style={{ color: '#0A84FF', fontWeight: 800, fontSize: '14px' }}>
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
          onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
          placeholder={t('searchByNameOrBarcode', lang)}
        />
        {searchText ? (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={runSearch} style={{
              background: '#0A84FF', color: '#fff', border: 'none',
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
                {p.photo_url ? (
                  <img src={p.photo_url} alt=""
                    style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E4F0' }} />
                ) : (
                  <span style={{
                    width: 34, height: 34, borderRadius: 8, background: '#F4F5FA',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>📦</span>
                )}
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
            <div style={{ fontWeight: 800, fontSize: '15px', color: '#0A84FF', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="2" style={{ width: 18, height: 18 }}>
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
            background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)',
            border: 'none', borderRadius: '12px', color: '#fff',
            fontWeight: 800, fontSize: '15px', cursor: 'pointer',
            fontFamily: "'Nunito', sans-serif",
            boxShadow: '0 4px 15px rgba(10,132,255,.3)',
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
