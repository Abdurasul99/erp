import React, { useEffect, useState } from 'react';

// Скролл-индикатор в стиле OpenAI Sora: колонка штрихов вместо обычной полосы.
// Активный штрих ярче и длиннее, соседние гаснут по расстоянию. Клик по штриху
// прокручивает контейнер к соответствующей позиции. Перенос из дизайн-концепта
// wave-erp-design/src/scrollticks.jsx — токены цвета заменены на var(--text)/(--text2).
// mode: 'fixed' — прибит к вьюпорту (для .o-content на Главной/разделах);
//       'absolute' — внутри позиционированного родителя (для окна инструмента .o-sheet).
export function ScrollTicks({ targetRef, count = 22, right = 8, mode = 'fixed' }) {
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
    <div className="o-ticks" style={{ right, position: mode }}>
      {Array.from({ length: count }, (_, i) => {
        const d = Math.abs(i - active);
        const on = d === 0;
        return (
          <button
            key={i}
            type="button"
            className="o-tick"
            aria-label={`Прокрутить к ${Math.round((i / (count - 1)) * 100)}%`}
            onClick={() => {
              const el = targetRef.current;
              if (el) el.scrollTo({ top: (i / (count - 1)) * (el.scrollHeight - el.clientHeight), behavior: 'smooth' });
            }}
            style={{
              width: on ? 22 : d === 1 ? 16 : 13,
              opacity: on ? 1 : d === 1 ? 0.55 : d === 2 ? 0.4 : 0.26,
              background: on ? 'var(--text)' : 'var(--text2)',
            }}
          />
        );
      })}
    </div>
  );
}
