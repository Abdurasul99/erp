import React, { useEffect } from 'react';

export function Modal({ open, onClose, title, icon, children, footer, width = 520 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(26,27,46,.5)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: width,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,.3)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          {icon && <div style={{ fontSize: 22 }}>{icon}</div>}
          <div style={{ fontWeight: 800, fontSize: 17, flex: 1 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text3)', padding: 4 }}>×</button>
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
  toasts = [...toasts, { id: ++toastId, msg, type }];
  listeners.forEach(l => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== toastId);
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
          background: t.type === 'success' ? '#16A34A' : t.type === 'error' ? '#EF4444' : '#5B4FE8',
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
