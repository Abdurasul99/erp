import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api.js';
import { AuthContext } from '../App.jsx';

// ═══ Инбокс задач: счётчики уведомлений + лента событий ════════════════════
// WebSocket/SSE в проекте нет, поэтому «живость» держится на поллинге ОДНОГО
// лёгкого эндпоинта /notifications/count. Тяжёлый /notifications грузится
// лениво — только когда пользователь реально открыл попап колокольчика.
// ⚠ /api/tasks по таймеру дёргать нельзя: он запускает генерацию задач из
// шаблонов. Доска и «Мои дела» вместо этого подписываются на version.

const POLL_MS = 45 * 1000;

// Общие пустышки: одна ссылка на модуль — setState с тем же значением не
// вызывает лишний рендер (Object.is), а FALLBACK не пересоздаётся.
const EMPTY_COUNTS = { unread: 0, active: 0, overdue: 0 };
const EMPTY_ITEMS = [];

const FALLBACK = {
  ...EMPTY_COUNTS,
  version: 0,
  items: EMPTY_ITEMS,
  itemsLoading: false,
  refresh: () => {},
  loadItems: () => Promise.resolve(EMPTY_ITEMS),
  markRead: () => Promise.resolve(0),
  markAllRead: () => Promise.resolve(0),
};

const TaskInboxContext = createContext(null);

export function TaskInboxProvider({ children }) {
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id || null;

  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [version, setVersion] = useState(0);
  const [items, setItems] = useState(EMPTY_ITEMS);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Счётчики дублируем в ref: version сравнивает новое unread со старым ВНЕ
  // рендера, а читать это из state-updater'а нельзя — updater обязан быть
  // чистым (в StrictMode он вызывается дважды).
  const countsRef = useRef(EMPTY_COUNTS);
  // Номер последнего запроса ленты — гасит гонку ответов (медленный первый
  // ответ не должен затирать быстрый второй).
  const itemsSeq = useRef(0);

  const putCounts = useCallback((next) => {
    countsRef.current = next;
    setCounts(next);
  }, []);

  // Локально помечаем прочитанным то, что уже показано в попапе: бейдж и
  // подсветка гаснут сразу, не дожидаясь ответа refresh().
  const stampItems = useCallback((match) => {
    const now = new Date().toISOString();
    setItems((list) => {
      let touched = false;
      const next = list.map((it) => {
        if (it.read_at || !match(it)) return it;
        touched = true;
        return { ...it, read_at: now };
      });
      return touched ? next : list;
    });
  }, []);

  const refresh = useCallback(() => {
    if (!userId) return;
    api.get('/notifications/count')
      .then(({ data }) => {
        const next = {
          unread: Math.max(0, Number(data?.unread) || 0),
          active: Math.max(0, Number(data?.active) || 0),
          overdue: Math.max(0, Number(data?.overdue) || 0),
        };
        const grew = next.unread > countsRef.current.unread;
        putCounts(next);
        // version растёт ТОЛЬКО на росте непрочитанных. На него подписаны
        // доска и «Мои дела» — так изменение статуса третьим лицом видно
        // без поллинга самих задач.
        if (grew) setVersion((v) => v + 1);
      })
      .catch(() => {});
  }, [userId, putCounts]);

  const loadItems = useCallback((opts = {}) => {
    if (!userId) return Promise.resolve(EMPTY_ITEMS);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 30));
    const params = { limit };
    if (opts.onlyUnread) params.only_unread = 1;
    const seq = ++itemsSeq.current;
    setItemsLoading(true);
    return api.get('/notifications', { params })
      .then(({ data }) => {
        // Роут отдаёт массив; распаковку оставляем на случай обёртки.
        const list = Array.isArray(data) ? data : (data?.items || data?.notifications || EMPTY_ITEMS);
        if (seq !== itemsSeq.current) return list;
        setItems(list);
        setItemsLoading(false);
        return list;
      })
      .catch(() => {
        // Молча: при сбое остаётся прошлая лента, ничего не рендерим заново.
        if (seq === itemsSeq.current) setItemsLoading(false);
        return EMPTY_ITEMS;
      });
  }, [userId]);

  // Аргумент: число → id задачи ({task_id}); массив → id событий ({ids});
  // объект → тело как есть ({ids} | {task_id} | {all:true}).
  const markRead = useCallback((arg) => {
    if (!userId) return Promise.resolve(0);
    let body = null;
    if (Array.isArray(arg)) {
      const ids = arg.map(Number).filter((n) => Number.isFinite(n) && n > 0);
      if (ids.length) body = { ids };
    } else if (arg && typeof arg === 'object') {
      body = arg;
    } else if (Number(arg) > 0) {
      body = { task_id: Number(arg) };
    }
    if (!body) return Promise.resolve(0);
    return api.post('/notifications/read', body)
      .then(({ data }) => {
        const updated = Math.max(0, Number(data?.updated) || 0);
        if (updated > 0) {
          if (body.all) stampItems(() => true);
          else if (body.ids) stampItems((it) => body.ids.includes(Number(it.id)));
          else if (body.task_id) stampItems((it) => Number(it.task_id) === Number(body.task_id));
          // Оптимистично снимаем прочитанные: countsRef уезжает вниз вместе с
          // state, поэтому следующий refresh не примет то же число за «рост».
          putCounts({ ...countsRef.current, unread: Math.max(0, countsRef.current.unread - updated) });
        }
        refresh();
        return updated;
      })
      .catch(() => 0);
  }, [userId, putCounts, refresh, stampItems]);

  const markAllRead = useCallback(() => markRead({ all: true }), [markRead]);

  useEffect(() => {
    if (!userId) {
      // Не залогинен (или вышел) — не опрашиваем вовсе и чистим хвост сессии.
      putCounts(EMPTY_COUNTS);
      setItems(EMPTY_ITEMS);
      setItemsLoading(false);
      return undefined;
    }
    refresh();
    const timer = setInterval(() => {
      // Вкладка в фоне — тик пропускаем: чисел всё равно не видно, а при
      // возврате focus/visibilitychange дадут свежие немедленно.
      if (document.hidden) return;
      refresh();
    }, POLL_MS);
    const onWake = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [userId, refresh, putCounts]);

  const value = useMemo(() => ({
    unread: counts.unread,
    active: counts.active,
    overdue: counts.overdue,
    version,
    items,
    itemsLoading,
    refresh,
    loadItems,
    markRead,
    markAllRead,
  }), [counts, version, items, itemsLoading, refresh, loadItems, markRead, markAllRead]);

  return <TaskInboxContext.Provider value={value}>{children}</TaskInboxContext.Provider>;
}

// Вне провайдера (публичная витрина, экран логина) возвращаем нейтральную
// заглушку — колокольчик просто ничего не показывает, а не роняет дерево.
export function useTaskInbox() {
  return useContext(TaskInboxContext) || FALLBACK;
}
