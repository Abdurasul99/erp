// Общие элементы экранов «Декора» (как в прототипе dora-decor.html): плитка-градиент, баннер раздела, карточка,
// плашки статусов, вкладки, счётчик «− N +», выезжающее окно, всплывающее сообщение, поле даты ДД.ММ.ГГГГ.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './icons.jsx';
import { useT } from './i18n.js';
import { newKey } from './api.js';

// ---------- Разделы (нижний док) ----------
// g — градиент раздела: Заказы — розовый, Калькулятор — оранжевый, Бронь и Склад — голубой, Финансы — зелёный,
// Команда — фиолетовый, Отчёты и AI — индиго, Настройки — серый, Главная — синий.
// feature — функция компании (выключает админ Wave); step — на каком шаге появится экран.
export const SECTIONS = [
  { id: 'home', g: 'blue', i: 'home', path: '' },
  { id: 'tools', g: 'rainbow', i: 'grid', path: 'tools' },
  '|',
  { id: 'orders', g: 'pink', i: 'kanban', path: 'orders', feature: 'decor-orders', step: 4 },
  { id: 'calc', g: 'orange', i: 'calc', path: 'calc', feature: 'decor-orders' },
  { id: 'booking', g: 'cyan', i: 'cal', path: 'booking', feature: 'decor-orders', step: 4 },
  { id: 'decor', g: 'cyan', i: 'box', path: 'warehouse', feature: 'decor-warehouse' },
  { id: 'finance', g: 'green', i: 'wallet', path: 'finance', feature: 'decor-finance', step: 5 },
  { id: 'team', g: 'purple', i: 'users', path: 'team', feature: 'decor-team', step: 5 },
  { id: 'reports', g: 'indigo', i: 'camera', path: 'reports', feature: 'decor-reports', step: 6 },
  '|',
  { id: 'ai', g: 'indigo', i: 'spark', path: 'ai', feature: 'decor-ai', step: 6 },
  { id: 'settings', g: 'gray', i: 'gear', path: 'settings', step: 6 },
];
export const section = id => SECTIONS.find(s => s !== '|' && s.id === id);

// ---------- Контекст приложения: кто вошёл, полномочия, сообщения ----------
export const DecorCtx = createContext(null);
export const useDecor = () => useContext(DecorCtx);

// ---------- Загрузка данных: [data, err, reload, setData] ----------
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, err: null });
  const load = useCallback(async () => {
    try { setState({ data: await fn(), err: null }); } catch (e) { setState(s => ({ data: s.data, err: e })); }
  }, deps);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return [state.data, state.err, load, d => setState(s => ({ ...s, data: typeof d === 'function' ? d(s.data) : d }))];
}

// ---------- Записывающие действия: ключ повтора и блокировка кнопок ----------
// run(id, cfg => api.post(url, body, cfg)): ключ создаётся при нажатии и живёт, пока сервер не ответил
// (обрыв связи, тайм-аут, «ещё выполняется») — повторное нажатие того же действия шлёт тот же ключ, и сервер вернёт
// первый результат вместо дубля. Ответ получен — ключ сброшен; новое действие или другие данные (reset) — новый ключ.
// busy — id выполняющегося действия: кнопки заблокированы до ответа.
export function useActions() {
  const keys = useRef(new Map());
  const running = useRef(null);
  const [busy, setBusy] = useState(null);
  const run = useCallback(async (id, fn) => {
    if (running.current) return undefined;
    let key = keys.current.get(id);
    if (!key) { key = newKey(); keys.current.set(id, key); }
    running.current = id; setBusy(id);
    try {
      const r = await fn({ headers: { 'Idempotency-Key': key } });
      keys.current.delete(id);
      return r;
    } catch (e) {
      const st = e?.response?.status;
      if (st && st < 500 && e.response.data?.code !== 'idem_running') keys.current.delete(id);
      throw e;
    } finally { running.current = null; setBusy(null); }
  }, []);
  const reset = useCallback(id => { keys.current.delete(id); }, []);
  return { run, busy, reset };
}

// ---------- Мелкие элементы ----------
export const Tile = ({ g, i, size = 46, icon = 22 }) => (
  <div className={`dd-ticon g-${g}`} style={{ width: size, height: size }}><Icon name={i} size={icon} /></div>
);
export const Card = ({ className = '', children, ...rest }) => <div className={`dd-card ${className}`} {...rest}>{children}</div>;
export const Chip = ({ tone = '', children, title }) => <span className={`dd-chip ${tone}`} title={title}>{children}</span>;

// Статусы: серый — лид, дизайн; жёлтый — ждёт (предоплата, приёмка); синий — в работе; зелёный — готово
const STATUS_TONE = { lead: 'gray', design: 'gray', prepay: 'warn', booked: 'blue', install: 'blue', acceptance: 'warn', dismantle: 'blue', closed: 'ok' };
export function StatusChip({ status }) {
  const { t } = useT();
  return <Chip tone={STATUS_TONE[status] || 'gray'}>{t(`st_${status}`)}</Chip>;
}

// Баннер раздела: заголовок, подпись, 2–3 крупные цифры, справа кнопки-переходы
export function Hero({ id, stats = [], acts = [] }) {
  const { t } = useT();
  const s = section(id);
  return (
    <section className={`dd-hero g-${s.g === 'rainbow' ? 'blue' : s.g}`}>
      <div className="dd-hero-main">
        <h1>{t(`t_${id}`)}</h1>
        <p>{t(`d_${id}`)}</p>
        {stats.length > 0 && (
          <div className="dd-hero-stats">
            {stats.map(([v, label], k) => <div key={k} className="dd-hero-stat"><b className="num">{v}</b><span>{label}</span></div>)}
          </div>
        )}
      </div>
      {acts.length > 0 && (
        <div className="dd-hero-acts">
          {acts.map((a, k) => <button key={k} type="button" className="dd-hbtn" onClick={a.onClick}>{a.label} →</button>)}
        </div>
      )}
    </section>
  );
}

export function Tabs({ value, onChange, items }) {
  return (
    <div className="dd-tabs" role="tablist">
      {items.map(([key, label, badge, tone]) => (
        <button key={key} type="button" role="tab" aria-selected={value === key} className={`dd-tab ${value === key ? 'on' : ''}`} onClick={() => onChange(key)}>
          {label}{badge ? <span className={`dd-tab-badge ${tone || ''}`}>{badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

// Счётчик «− N +» с полем ввода — крупный, для телефона
export function Stepper({ value, onChange, min = 0, max, label }) {
  const v = Number.isFinite(Number(value)) ? Number(value) : 0;
  const set = n => onChange(Math.max(min, max !== undefined ? Math.min(max, n) : n));
  return (
    <div className="dd-stepper" aria-label={label}>
      <button type="button" onClick={() => set(v - 1)} disabled={v <= min} aria-label="−"><Icon name="minus" size={18} /></button>
      <input inputMode="numeric" value={value} aria-label={label}
        onChange={e => { const d = e.target.value.replace(/\D/g, ''); onChange(d === '' ? '' : Number(d)); }}
        onBlur={() => set(v)} />
      <button type="button" onClick={() => set(v + 1)} disabled={max !== undefined && v >= max} aria-label="+"><Icon name="plus" size={18} /></button>
    </div>
  );
}

export function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const k = e => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="dd-sheet-bg" onClick={onClose}>
      <div className="dd-sheet" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="dd-row dd-between"><h3>{title}</h3><button type="button" className="dd-btn ghost sm" onClick={onClose} aria-label="close"><Icon name="x" size={16} /></button></div>
        <div className="dd-sheet-body">{children}</div>
        {footer && <div className="dd-sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const show = useCallback((m, tone = '') => {
    setMsg({ m, tone }); clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), Math.max(2800, String(m).length * 55));
  }, []);
  return [msg ? <div className={`dd-toast ${msg.tone}`} role="status">{msg.m}</div> : null, show];
}

export function Loading({ err, retry }) {
  const { t } = useT();
  if (err) {
    return <Card className="dd-empty"><div className="dd-err">{err?.response?.data?.error || err.message || t('error')}</div>
      {retry && <button type="button" className="dd-btn ghost" onClick={retry}>{t('retry')}</button>}</Card>;
  }
  return <Card className="dd-empty">{t('loading')}</Card>;
}
export const Empty = ({ children }) => <Card className="dd-empty">{children}</Card>;

// Нет доступа: функция выключена админом или нет полномочия у должности
export function NoAccess({ err }) {
  const { t } = useT();
  const { me } = useDecor();
  const code = err?.response?.data?.code;
  const text = code === 'feature_off' ? t('featureOff', { name: err.response.data.error?.match(/«(.+)»/)?.[1] || '' })
    : t('noAccess', { role: t(`r_${me.user.role}`) });
  return <Card className="dd-empty">{text}</Card>;
}

// Дата ДД.ММ.ГГГГ на любом телефоне (системное поле показало бы «10/24/2026»), рядом — календарь
const toIso = s => {
  const d = String(s || '').replace(/\D/g, '');
  if (d.length !== 8) return null;
  const [dd, mm, yy] = [d.slice(0, 2), d.slice(2, 4), d.slice(4)];
  const x = new Date(`${yy}-${mm}-${dd}T00:00:00`);
  return x.getDate() === Number(dd) && x.getMonth() + 1 === Number(mm) ? `${yy}-${mm}-${dd}` : null;
};
const toText = iso => { const [y, m, d] = String(iso || '').slice(0, 10).split('-'); return d ? `${d}.${m}.${y}` : ''; };
export function DateInput({ value, onChange, id }) {
  const [text, setText] = useState(toText(value));
  const picker = useRef();
  useEffect(() => { if (toIso(text) !== (value || null)) setText(toText(value)); }, [value]);   // eslint-disable-line react-hooks/exhaustive-deps
  const type = v => {
    const d = v.replace(/\D/g, '').slice(0, 8);
    setText([d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('.'));
    if (toIso(d)) onChange(toIso(d));
  };
  const open = () => { try { picker.current.showPicker(); } catch { picker.current.focus(); } };
  return (
    <div className="dd-date">
      <input id={id} className="dd-inp" inputMode="numeric" placeholder="24.10.2026" maxLength={10} value={text}
        onChange={e => type(e.target.value)} onBlur={() => setText(toText(value))} />
      <button type="button" className="dd-date-btn" onClick={open} aria-label="calendar"><Icon name="cal" size={18} /></button>
      <input ref={picker} type="date" tabIndex={-1} aria-hidden="true" className="dd-date-native" value={value || ''} onChange={e => e.target.value && onChange(e.target.value)} />
    </div>
  );
}

// Число из поля: '' остаётся пустым, иначе число (запятая как точка)
export const numIn = v => { const s = String(v).replace(/\s/g, '').replace(',', '.'); return s === '' ? '' : s.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'); };
