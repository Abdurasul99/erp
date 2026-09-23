import React, { useEffect, useRef } from 'react';
import { STATUS_LABELS } from './access.js';

// Набор элементов интерфейса «Мероприятий». Свой, а не из Wave: у продукта
// свой визуальный язык, и правка компонента Wave не должна его задевать.

export function Button({ variant = 'primary', size, className = '', type = 'button', ...rest }) {
  const cls = ['ev-btn', `ev-btn-${variant}`, size === 'sm' ? 'ev-btn-sm' : '', className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest} />;
}

export function Card({ title, extra, children, className = '', ...rest }) {
  return (
    <section className={`ev-card ${className}`} {...rest}>
      {(title || extra) && (
        <h2 className="ev-card-title">
          <span>{title}</span>
          {extra}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone, children, className = '' }) {
  return <span className={`ev-badge ${tone ? `t-${tone}` : ''} ${className}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  return <span className={`ev-badge s-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

export function Kpi({ label, value, hint, tone }) {
  return (
    <div className={`ev-card ev-kpi ${tone ? `is-${tone}` : ''}`}>
      <div className="ev-kpi-label">{label}</div>
      <div className="ev-kpi-value">{value}</div>
      {hint && <div className="ev-kpi-hint">{hint}</div>}
    </div>
  );
}

export function PageHead({ title, sub, actions }) {
  return (
    <div className="ev-page-head">
      <div>
        <h1 className="ev-page-title">{title}</h1>
        {sub && <div className="ev-page-sub">{sub}</div>}
      </div>
      {actions && <div className="ev-toolbar">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`ev-field ${className}`}>
      {label && <span className="ev-field-label">{label}</span>}
      {children}
      {hint && <span className="ev-field-hint">{hint}</span>}
    </label>
  );
}

// Поле суммы: значение — СТРОКА. Число в onChange не приводим: иначе нельзя
// стереть первую цифру и поле «залипает» (эту жалобу в проекте получали пять раз).
// Разбор — при сохранении, через parseAmount из format.js.
export function AmountInput({ value, onChange, invalid, ...rest }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={`ev-input ${invalid ? 'is-invalid' : ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}

export function ErrorAlert({ children }) {
  if (!children) return null;
  return <div className="ev-alert ev-alert-error" role="alert">{children}</div>;
}

export function Empty({ title, children }) {
  return (
    <div className="ev-empty">
      {title && <div className="ev-empty-title">{title}</div>}
      {children}
    </div>
  );
}

export function Loading({ label = 'Загружаю…' }) {
  return <div className="ev-loading" aria-busy="true">{label}</div>;
}

// Модальное окно. onClose держим в ref, а НЕ в зависимостях эффекта: иначе
// инлайн-стрелка родителя пересоздаёт эффект на каждый рендер, и возврат
// фокуса в cleanup крадёт фокус из поля после каждого символа.
export function Modal({ title, onClose, children, footer, width }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const boxRef = useRef(null);

  useEffect(() => {
    const prevFocus = document.activeElement;
    const first = boxRef.current?.querySelector('input, select, textarea, button:not(.ev-icon-btn)');
    first?.focus();
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    };
  }, []);

  return (
    <div
      className="ev-modal-back"
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeRef.current?.(); }}
    >
      <div className="ev-modal" role="dialog" aria-modal="true" aria-label={title} ref={boxRef} style={width ? { maxWidth: width } : undefined}>
        <div className="ev-modal-head">
          <h2 className="ev-modal-title">{title}</h2>
          <button type="button" className="ev-icon-btn" aria-label="Закрыть" onClick={() => closeRef.current?.()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="ev-modal-body">{children}</div>
        {footer && <div className="ev-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Pills({ value, options, onChange }) {
  return (
    <div className="ev-pills" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`ev-pill ${value === o.value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
