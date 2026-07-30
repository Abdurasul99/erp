import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import api from '../../api.js';
import { useTt, fmtDate } from '../tt.js';
import AiDiagnose from '../AiDiagnose.jsx';
import AiWorkspace from '../AiWorkspace.jsx';
import { BranchScope } from '../OwnerShell.jsx';

// Стартовые вопросы (показываются как чипы-подсказки, пока чат свежий).
const SEED_QUESTIONS = [
  'Растёт ли моя выручка по сравнению с прошлым периодом?',
  'Какой филиал лидер и кто отстаёт?',
  'Что у меня горит сегодня — что разобрать в первую очередь?',
  'Какие товары мёртвые — куда отнести скидку?',
  'Где у меня самая низкая маржа и что с этим делать?',
  'Как мотивировать команду продаж?',
];

const FALLBACK_FOLLOWUPS = [
  'Что ещё я могу улучшить?',
  'Покажи конкретные шаги',
  'Какой риск если этого не сделаю?',
];

const STORAGE_KEY = 'ai_chat_sessions_v1';

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveSessions(sessions) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch {}
}

function newSession() {
  return {
    id: 'chat-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now(),
    title: 'Новый чат',
    messages: [{ role: 'assistant', seed: true, text: 'Привет! Я Wave Intelligence — аналитик вашего бизнеса. Задайте вопрос, а я отвечу и нарисую нужный экран справа.' }],
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

function makeTitle(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (firstUser) return firstUser.text.slice(0, 50) + (firstUser.text.length > 50 ? '...' : '');
  return 'Новый чат';
}

// AI-страница: воркспейс «чат слева, рисует справа» (перенос дизайн-концепта
// wave-erp-design) поверх РЕАЛЬНОГО /api/ai/chat + /api/ai/chart-data.
// История чатов (localStorage) и диагност «Где у меня проблемы?» сохранены —
// диагност показывается в чате, пока разговор свежий; история — по кнопке в шапке.
export default function AiChatPage() {
  const { tt, lang } = useTt();
  const { branchId } = useContext(BranchScope);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [sessions, setSessions] = useState(() => {
    const loaded = loadSessions();
    return loaded.length > 0 ? loaded : [newSession()];
  });
  const [activeId, setActiveId] = useState(() => {
    const loaded = loadSessions();
    return loaded.length > 0 ? loaded[0].id : null;
  });
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [followUps, setFollowUps] = useState(SEED_QUESTIONS);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (sessions.length === 0) {
      const s = newSession();
      setSessions([s]);
      setActiveId(s.id);
    } else if (!sessions.find(s => s.id === activeId)) {
      setActiveId(sessions[0].id);
    }
  }, [sessions, activeId]);

  useEffect(() => { saveSessions(sessions); }, [sessions]);

  const active = sessions.find(s => s.id === activeId) || sessions[0];

  const updateActive = useCallback((updater) => {
    setSessions(prev => prev.map(s => s.id === activeId ? updater(s) : s));
  }, [activeId]);

  const startNewChat = () => {
    const s = newSession();
    setSessions(prev => [s, ...prev]);
    setActiveId(s.id);
    setInput('');
    setFollowUps(SEED_QUESTIONS);
    setSidebarOpen(false);
  };

  const deleteSession = (id) => {
    if (!confirm(tt('Удалить этот чат?'))) return;
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (next.length === 0) return [newSession()];
      return next;
    });
    if (activeId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveId(remaining[0]?.id || null);
    }
  };

  const sendMessage = async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || typing || !active) return;
    setInput('');
    setFollowUps([]);

    const newMessages = [...active.messages, { role: 'user', text: trimmed, ts: Date.now() }];
    updateActive(s => ({ ...s, messages: newMessages, title: s.title === 'Новый чат' ? makeTitle(newMessages) : s.title, updated_at: Date.now() }));
    setTyping(true);

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.text }));
      const { data } = await api.post('/ai/chat', { messages: apiMessages, lang });
      const reply = data.reply || tt('Не получил ответ. Попробуй переформулировать.');
      updateActive(s => ({
        ...s,
        messages: [...s.messages, { role: 'assistant', text: reply, ts: Date.now(), model: data.model, usage: data.usage }],
        updated_at: Date.now(),
      }));
      api.post('/ai/suggest', { last_reply: reply, lang })
        .then(r => {
          const qs = Array.isArray(r.data?.questions) ? r.data.questions : [];
          setFollowUps(qs.length > 0 ? qs : FALLBACK_FOLLOWUPS);
        })
        .catch(() => setFollowUps(FALLBACK_FOLLOWUPS));

      // Канвас справа — собранная под вопрос бизнес-панель на ТОМ ЖЕ языке (lang).
      // Привязываем к последнему ответу ассистента активной сессии.
      setCanvasLoading(true);
      api.post('/ai/canvas', { question: trimmed, reply, branch_id: branchId || undefined, lang })
        .then(r => {
          const cv = r.data?.canvas || null;
          updateActive(s => {
            const msgs = [...s.messages];
            for (let i = msgs.length - 1; i >= 0; i--) {
              if (msgs[i].role === 'assistant') { msgs[i] = { ...msgs[i], canvas: cv }; break; }
            }
            return { ...s, messages: msgs };
          });
        })
        .catch(() => {})
        .finally(() => setCanvasLoading(false));
    } catch (e) {
      const msg = e.response?.data?.error || tt('Не удалось связаться с AI. Попробуй ещё раз.');
      updateActive(s => ({
        ...s,
        messages: [...s.messages, { role: 'assistant', text: '⚠️ ' + msg, ts: Date.now(), error: true }],
      }));
      setFollowUps(SEED_QUESTIONS);
    }
    setTyping(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="ai-page" style={{
      display: 'grid',
      gridTemplateColumns: sidebarOpen ? '260px 1fr' : '0px 1fr',
      gap: 0,
      transition: 'grid-template-columns .2s var(--ease)',
      overflow: 'hidden',
    }}>
      <aside style={{
        background: 'var(--surface)',
        border: sidebarOpen ? '1px solid var(--border)' : 'none',
        borderRadius: sidebarOpen ? 18 : 0,
        marginRight: sidebarOpen ? 12 : 0,
        boxShadow: sidebarOpen ? 'var(--shadow)' : 'none',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        minWidth: sidebarOpen ? 260 : 0,
        transition: 'margin-right .2s var(--ease)',
      }}>
        <div style={{ padding: '14px 12px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={startNewChat} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            ✨ {tt('Новый чат')}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {sessions.map(s => (
            <div key={s.id}
              onClick={() => { setActiveId(s.id); setSidebarOpen(false); }}
              style={{
                padding: '10px 12px', marginBottom: 4, borderRadius: 8,
                cursor: 'pointer',
                background: s.id === activeId ? 'var(--surface)' : 'transparent',
                boxShadow: s.id === activeId ? 'var(--shadow-sm)' : 'none',
                border: s.id === activeId ? '1px solid var(--border)' : '1px solid transparent',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background-color .15s',
              }}
              onMouseEnter={e => { if (s.id !== activeId) e.currentTarget.style.background = 'rgba(29,78,216,.06)'; }}
              onMouseLeave={e => { if (s.id !== activeId) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 14 }}>💬</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                  {tt(s.title)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                  {s.messages.length} {tt('сообщений')} · {fmtDate(s.updated_at, { day: 'numeric', month: 'short' }, lang)}
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, padding: 2, opacity: s.id === activeId ? 1 : 0.5 }}
                title={tt('Удалить чат')}
              >🗑</button>
            </div>
          ))}
        </div>
      </aside>

      <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AiWorkspace
          messages={active?.messages || []}
          typing={typing}
          followUps={followUps.length ? followUps : SEED_QUESTIONS}
          onSend={sendMessage}
          input={input}
          setInput={setInput}
          onKeyDown={onKeyDown}
          onNewChat={startNewChat}
          onToggleSidebar={() => setSidebarOpen(v => !v)}
          extraTop={active && active.messages.length <= 1 ? <AiDiagnose /> : null}
          canvasLoading={canvasLoading}
        />
      </section>
    </div>
  );
}
