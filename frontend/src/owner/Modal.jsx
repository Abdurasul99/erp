import React, { useEffect, useRef } from 'react';
import { useTt } from './tt.js';

export function Modal({ open, onClose, title, icon, children, footer, width = 520 }) {
  const { tt } = useTt();
  const dialogRef = useRef(null);
  const titleId = useRef('modal-title-' + Math.random().toString(36).slice(2, 8)).current;

  // onClose приходит инлайн-стрелкой, то есть НОВОЙ функцией на каждый рендер.
  // Пока он был в зависимостях эффекта ниже, эффект перезапускался на каждое
  // нажатие клавиши, а его очистка возвращала фокус на кнопку, открывшую окно:
  // первый символ попадал в поле, остальные улетали на кнопку, а пробел её
  // нажимал. Держим колбэк в ref, чтобы эффект зависел ТОЛЬКО от open.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const prevFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') { onCloseRef.current?.(); return; }
      // Focus trap: Tab/Shift+Tab держим фокус внутри модалки
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // Перевести фокус внутрь модалки при открытии
    const t = setTimeout(() => {
      const f = dialogRef.current?.querySelector('input, select, textarea, button');
      f?.focus();
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(t);
      // Вернуть фокус на элемент, открывший модалку
      const pf = prevFocusRef.current;
      if (pf && pf.focus) pf.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div ref={dialogRef} onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby={titleId}
        style={{
          background: 'var(--surface, #fff)', borderRadius: 18, width: '100%', maxWidth: width,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,.3)',
        }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          {icon && <div style={{ fontSize: 22 }} aria-hidden="true">{icon}</div>}
          <div id={titleId} style={{ fontWeight: 800, fontSize: 17, flex: 1 }}>{title}</div>
          <button onClick={onClose} aria-label={tt('Закрыть')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text3)', padding: 4 }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Toast — simple top-right notifications
let toastId = 0;
const listeners = new Set();
let toasts = [];

export function toast(msg, type = 'success') {
  // Захватываем id В ЛОКАЛЬНУЮ КОНСТАНТУ — иначе setTimeout-замыкание
  // прочитает изменившийся глобальный toastId и удалит чужой тост.
  const id = ++toastId;
  toasts = [...toasts, { id, msg, type }];
  listeners.forEach(l => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    listeners.forEach(l => l(toasts));
  }, 3000);
}

export function ToastHost() {
  const [list, setList] = React.useState(toasts);
  useEffect(() => {
    listeners.add(setList);
    return () => listeners.delete(setList);
  }, []);
  return (
    <div style={{ position: 'fixed', top: 76, right: 20, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map(t => (
        <div key={t.id} style={{
          background: t.type === 'success' ? '#16A34A' : t.type === 'error' ? '#DC2626' : '#1D4ED8',
          color: '#fff', padding: '12px 18px', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,.2)',
          fontWeight: 700, fontSize: 13, minWidth: 240, maxWidth: 360,
          animation: 'slideIn .25s ease',
        }}>
          {t.type === 'success' && '✓ '}{t.type === 'error' && '⚠️ '}{t.type === 'info' && 'ℹ️ '}
          {t.msg}
        </div>
      ))}
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  );
}
