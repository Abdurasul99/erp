import React, { useEffect, useState } from 'react';

// Скролл-индикатор в стиле OpenAI Sora: колонка штрихов, активный — ярче и длиннее.
// Клик по штриху прокручивает контейнер к соответствующей позиции.
export function ScrollTicks({ targetRef, count = 22, right = 9 }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollHeight - el.clientHeight;
      setVisible(max > 60);
      setProgress(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); mo.disconnect(); };
  }, [targetRef]);

  if (!visible) return null;
  const active = Math.round(progress * (count - 1));

  return (
    <div className="ticks" style={{ right }}>
      {Array.from({ length: count }, (_, i) => {
        const d = Math.abs(i - active);
        const on = d === 0;
        return (
          <button
            key={i}
            className="tick"
            aria-label={`Прокрутить к ${Math.round((i / (count - 1)) * 100)}%`}
            onClick={() => {
              const el = targetRef.current;
              if (el) el.scrollTo({ top: (i / (count - 1)) * (el.scrollHeight - el.clientHeight), behavior: 'smooth' });
            }}
            style={{
              width: on ? 22 : d === 1 ? 16 : 13,
              opacity: on ? 1 : d === 1 ? 0.55 : d === 2 ? 0.4 : 0.26,
              background: on ? 'var(--ink)' : 'var(--ink-2)',
            }}
          />
        );
      })}
    </div>
  );
}
