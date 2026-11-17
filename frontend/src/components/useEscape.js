import { useEffect, useRef } from 'react';

// Закрытие окна по Esc для окон со своей разметкой (не owner/Modal). QA 2026-11-17: окно админки,
// «+ Новый поставщик», «Мои задачи» закрывались только крестиком.
// Колбэк держим в ref, а эффект зависит ТОЛЬКО от active: инлайн-стрелка onClose в зависимостях
// пересоздавала бы подписку на каждый рендер (так однажды Modal крал фокус после каждого символа).
export default function useEscape(active, onClose) {
  const ref = useRef(onClose);
  useEffect(() => { ref.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) ref.current?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
}
