import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api.js';
import AiChartBlock, { parseChartTags, RichText } from '../AiChartBlock.jsx';
import { useTt, fmtDate } from '../tt.js';

const SEED_QUESTIONS = [
  { icon: '📈', text: 'Растёт ли моя выручка по сравнению с прошлым периодом?' },
  { icon: '🏭', text: 'Какой филиал лидер и кто отстаёт?' },
  { icon: '🔥', text: 'Что у меня горит сегодня — что разобрать в первую очередь?' },
  { icon: '💀', text: 'Какие товары мёртвые — куда отнести скидку?' },
  { icon: '😴', text: 'Кого из спящих клиентов вернуть в первую очередь?' },
  { icon: '💸', text: 'Где у меня самая низкая маржа и что с этим делать?' },
  { icon: '🎁', text: 'Как настроить программу лояльности для VIP?' },
  { icon: '🎬', text: 'Что писать в Reels на этой неделе?' },
  { icon: '🏷️', text: 'Какие цены пересмотреть и почему?' },
  { icon: '📊', text: 'Дай мне сводку по бизнесу за прошлый месяц.' },
  { icon: '👥', text: 'Как мотивировать команду продаж?' },
  { icon: '💰', text: 'Как улучшить мою прибыль на 10%?' },
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
    messages: [{ role: 'assistant', text: 'Привет! Я AI-консультант по бизнесу. Спроси что-нибудь или выбери вопрос ниже.' }],
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

function makeTitle(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (firstUser) return firstUser.text.slice(0, 50) + (firstUser.text.length > 50 ? '...' : '');
  return 'Новый чат';
}

export default function AiChatPage() {
  const { tt, lang } = useTt();
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
  const [followUps, setFollowUps] = useState(SEED_QUESTIONS.map(s => s.text));
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  // Ensure we always have an active session
  useEffect(() => {
    if (sessions.length === 0) {
      const s = newSession();
      setSessions([s]);
      setActiveId(s.id);
    } else if (!sessions.find(s => s.id === activeId)) {
      setActiveId(sessions[0].id);
    }
  }, [sessions, activeId]);

  // Persist on any session change
  useEffect(() => { saveSessions(sessions); }, [sessions]);

  const active = sessions.find(s => s.id === activeId) || sessions[0];

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    }
  }, [active?.messages?.length, typing]);

  // Focus textarea on mount
  useEffect(() => { setTimeout(() => textareaRef.current?.focus(), 100); }, [activeId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const h = Math.min(textareaRef.current.scrollHeight, 180);
      textareaRef.current.style.height = h + 'px';
    }
  }, [input]);

  const updateActive = useCallback((updater) => {
    setSessions(prev => prev.map(s => s.id === activeId ? updater(s) : s));
  }, [activeId]);

  const startNewChat = () => {
    const s = newSession();
    setSessions(prev => [s, ...prev]);
    setActiveId(s.id);
    setInput('');
    setFollowUps(SEED_QUESTIONS.map(q => q.text));
    setError(null);
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
    setError(null);
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
    } catch (e) {
      const msg = e.response?.data?.error || tt('Не удалось связаться с AI. Попробуй ещё раз.');
      setError(msg);
      updateActive(s => ({
        ...s,
        messages: [...s.messages, { role: 'assistant', text: '⚠️ ' + msg, ts: Date.now(), error: true }],
      }));
      setFollowUps(SEED_QUESTIONS.map(q => q.text));
    }
    setTyping(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const copyMessage = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const showSeeds = active && active.messages.length <= 1;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: sidebarOpen ? '260px 1fr' : '0px 1fr',
      gap: 0,
      height: 'calc(100vh - 110px)',
      marginTop: -22, marginLeft: -22, marginRight: -22,
      transition: 'grid-template-columns .2s var(--ease)',
      overflow: 'hidden',
    }}>
      <aside style={{
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        minWidth: sidebarOpen ? 260 : 0,
      }}>
        <div style={{ padding: '14px 12px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={startNewChat} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            ✨ {tt('Новый чат')}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {sessions.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{tt('Нет чатов')}</div>
          ) : sessions.map(s => (
            <div key={s.id}
              onClick={() => setActiveId(s.id)}
              style={{
                padding: '10px 12px', marginBottom: 4, borderRadius: 8,
                cursor: 'pointer',
                background: s.id === activeId ? 'var(--surface)' : 'transparent',
                boxShadow: s.id === activeId ? 'var(--shadow-sm)' : 'none',
                border: s.id === activeId ? '1px solid var(--border)' : '1px solid transparent',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'background-color .15s',
              }}
              onMouseEnter={e => { if (s.id !== activeId) e.currentTarget.style.background = 'rgba(91,79,232,.06)'; }}
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
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text3)', fontSize: 14, padding: 2,
                  opacity: s.id === activeId ? 1 : 0.5,
                }}
                title={tt('Удалить чат')}
              >🗑</button>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)' }}>
          💡 {tt('Чаты хранятся локально в браузере')}
        </div>
      </aside>

      <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          padding: '12px 20px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="btn btn-ghost btn-sm"
            title={sidebarOpen ? tt('Скрыть историю') : tt('Показать историю')}
            style={{ padding: '6px 10px' }}
          >
            {sidebarOpen ? '«' : '»'}
          </button>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #1e1b4b, #5B4FE8)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
            boxShadow: '0 4px 12px rgba(91,79,232,.25)',
          }}>🤖</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {active?.title ? tt(active.title) : tt('AI-консультант')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
              DeepSeek · {tt('бизнес-консультант · ответы кратко по делу')}
            </div>
          </div>
          <button onClick={startNewChat} className="btn btn-ghost btn-sm" title={tt('Новый чат')}>
            ✨ {tt('Новый')}
          </button>
        </header>

        <div ref={scrollRef} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          background: 'linear-gradient(180deg, var(--bg) 0%, var(--surface) 100%)',
        }}>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            {active?.messages.map((m, i) => (
              <Message key={i} message={m} onCopy={() => copyMessage(m.text)} />
            ))}
            {typing && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <Avatar role="assistant" />
                <div style={{
                  padding: '12px 16px',
                  background: 'var(--bg-2)',
                  borderRadius: '4px 16px 16px 16px',
                  color: 'var(--text2)',
                  fontSize: 13,
                }}>
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <span style={{ animation: 'aiDot 1s infinite' }}>●</span>
                    <span style={{ animation: 'aiDot 1s infinite .2s' }}>●</span>
                    <span style={{ animation: 'aiDot 1s infinite .4s' }}>●</span>
                  </span>
                </div>
              </div>
            )}

            {showSeeds && (
              <div style={{ marginTop: 24, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>
                  {tt('С чего начнём?')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {SEED_QUESTIONS.map((q, i) => (
                    <button key={i}
                      onClick={() => sendMessage(q.text)}
                      style={{
                        padding: '12px 14px',
                        background: 'var(--surface)',
                        border: '1.5px solid var(--border)',
                        borderRadius: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        fontFamily: 'inherit',
                        transition: 'all .15s var(--ease)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-50)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{q.icon}</span>
                      <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, fontWeight: 600 }}>{tt(q.text)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!showSeeds && followUps.length > 0 && !typing && (
              <div style={{ marginTop: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>
                  {tt('Подсказки')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {followUps.slice(0, 5).map((q, i) => (
                    <button key={i} onClick={() => sendMessage(q)} disabled={typing} style={{
                      padding: '8px 14px',
                      background: 'var(--surface)',
                      border: '1.5px solid var(--border-strong)',
                      borderRadius: 18,
                      cursor: 'pointer',
                      fontSize: 12.5, fontWeight: 700,
                      color: 'var(--primary)',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}>{tt(q)}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{
            padding: '8px 24px',
            background: 'rgba(239,68,68,.08)',
            color: 'var(--red)',
            fontSize: 12, fontWeight: 600,
            borderTop: '1px solid rgba(239,68,68,.18)',
          }}>⚠️ {error}</div>
        )}

        <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} style={{
          padding: '12px 24px 16px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-end',
              background: 'var(--bg-2)',
              border: '1.5px solid var(--border)',
              borderRadius: 16,
              padding: '8px 8px 8px 14px',
            }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={typing ? tt('AI думает...') : tt('Напиши вопрос... (Enter — отправить, Shift+Enter — новая строка)')}
                disabled={typing}
                rows={1}
                style={{
                  flex: 1,
                  border: 'none', outline: 'none',
                  background: 'transparent',
                  resize: 'none',
                  fontSize: 14, lineHeight: 1.5,
                  fontFamily: "'Nunito', sans-serif",
                  color: 'var(--text)',
                  minHeight: 24, maxHeight: 180,
                  padding: '6px 0',
                }}
              />
              <button
                type="submit"
                disabled={typing || !input.trim()}
                className="btn btn-primary"
                style={{ padding: '8px 16px', alignSelf: 'flex-end' }}
              >
                {typing ? '...' : '↑ ' + tt('Отправить')}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
              {tt('AI может ошибаться — всегда проверяй важные цифры в самой системе. История хранится локально.')}
            </div>
          </div>
        </form>
      </section>

      <style>{`
        @keyframes aiDot { 0%,80%,100% { opacity: .3; } 40% { opacity: 1; } }
      `}</style>
    </div>
  );
}

function Message({ message, onCopy }) {
  const { tt } = useTt();
  const isUser = message.role === 'user';
  const [hovered, setHovered] = useState(false);

  // For assistant messages: detect [[CHART:type]] tags, strip them, render charts inline.
  const { cleanText, chartTypes } = !isUser ? parseChartTags(message.text) : { cleanText: message.text, chartTypes: [] };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 12,
        marginBottom: 18,
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}>
      <Avatar role={message.role} />
      <div style={{
        maxWidth: '85%',
        display: 'flex', flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        minWidth: 0,
      }}>
        {cleanText && (
          <div style={{
            padding: isUser ? '12px 16px' : '14px 18px',
            borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
            background: isUser
              ? 'linear-gradient(135deg, #5B4FE8, #3D33C4)'
              : (message.error ? 'rgba(239,68,68,.10)' : 'var(--bg-2)'),
            color: isUser ? '#fff' : (message.error ? '#b91c1c' : 'var(--text)'),
            fontFamily: isUser ? 'inherit' : "'Inter', 'Nunito', system-ui, sans-serif",
            fontSize: isUser ? 13.5 : 14.5,
            lineHeight: isUser ? 1.6 : 1.72,
            letterSpacing: isUser ? 0 : '-0.1px',
            whiteSpace: isUser ? 'pre-wrap' : 'normal',
            wordBreak: 'break-word',
            boxShadow: isUser ? '0 4px 12px rgba(91,79,232,.20)' : 'var(--shadow-sm)',
          }}>
            {isUser ? tt(cleanText) : <RichText text={cleanText} />}
          </div>
        )}
        {chartTypes.length > 0 && (
          <div style={{ width: '100%', maxWidth: 580, marginTop: cleanText ? 6 : 0 }}>
            {chartTypes.map((t, i) => <AiChartBlock key={i + ':' + t} chartType={t} />)}
          </div>
        )}
        <div style={{
          marginTop: 4, display: 'flex', gap: 6, alignItems: 'center',
          fontSize: 10, color: 'var(--text3)', fontWeight: 600,
          opacity: hovered ? 1 : 0,
          transition: 'opacity .15s',
        }}>
          {message.ts && <span>{new Date(message.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>}
          {message.usage && <span>· {message.usage.completion || 0} {tt('ток.')}</span>}
          <button
            onClick={onCopy}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2, fontSize: 11 }}
            title={tt('Копировать')}
          >📋</button>
        </div>
      </div>
    </div>
  );
}

function Avatar({ role }) {
  const isUser = role === 'user';
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 10,
      background: isUser
        ? 'linear-gradient(135deg, #FF6B2B, #F59E0B)'
        : 'linear-gradient(135deg, #1e1b4b, #5B4FE8)',
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16,
      flexShrink: 0,
      boxShadow: isUser ? '0 2px 8px rgba(255,107,43,.25)' : '0 2px 8px rgba(91,79,232,.25)',
    }}>
      {isUser ? '👤' : '🤖'}
    </div>
  );
}
