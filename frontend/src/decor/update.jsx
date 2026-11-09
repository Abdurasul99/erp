// «Вышло обновление»: приложение одностраничное и само не перезагружается — открытая на телефоне вкладка
// неделями работала в старой версии (не было ЎЗ, переименования вещей на складе, «Панель» видели сотрудники).
// При возврате на вкладку и раз в 10 минут сверяем главный скрипт на сервере с загруженным; новая версия —
// плашка с кнопкой «Обновить». Сама страница не перезагружается: можно потерять то, что вводят.
import React, { useEffect, useState } from 'react';
import { useT } from './i18n.js';

const SCRIPT_RE = /<script[^>]+type="module"[^>]+src="([^"]+)"/;
const loaded = () => document.querySelector('script[type="module"][src]')?.getAttribute('src') || null;

export function useNewVersion(everyMs = 10 * 60 * 1000) {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const mine = loaded();
    if (!mine) return undefined;          // dev-сервер Vite: сравнивать не с чем
    let stop = false;
    const check = async () => {
      if (stop || document.hidden) return;
      try {
        const html = await (await fetch('/', { cache: 'no-store' })).text();
        const src = SCRIPT_RE.exec(html)?.[1];
        if (src && src !== mine) setFresh(true);
      } catch { /* нет сети — проверим в следующий раз */ }
    };
    const onShow = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', onShow);
    const timer = setInterval(check, everyMs);
    check();
    return () => { stop = true; document.removeEventListener('visibilitychange', onShow); clearInterval(timer); };
  }, [everyMs]);
  return fresh;
}

export function UpdateBanner() {
  const { t } = useT();
  const fresh = useNewVersion();
  if (!fresh) return null;
  return (
    <div className="dd-update" role="status">
      <span>{t('updateReady')}</span>
      <button type="button" className="dd-btn sm" onClick={() => window.location.reload()}>{t('updateBtn')}</button>
    </div>
  );
}
