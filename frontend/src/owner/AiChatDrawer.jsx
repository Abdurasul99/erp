import React, { useState, useEffect, useRef } from 'react';
import api from '../api.js';
import AiChartBlock, { parseChartTags, RichText } from './AiChartBlock.jsx';
import { useTt } from './tt.js';

const SEED_QUESTIONS = [
  'Растёт ли моя выручка по сравнению с прошлым периодом?',
  'Какой филиал лидер и кто отстаёт?',
  'Что у меня горит сегодня — что разобрать в первую очередь?',
  'Какие товары мёртвые — куда отнести скидку?',
  'Кого из спящих клиентов вернуть в первую очередь?',
  'Где у меня самая низкая маржа и что с этим делать?',
  'Как настроить программу лояльности для VIP?',
  'Что писать в Reels на этой неделе, чтобы привлечь клиентов?',
];

const FALLBACK_FOLLOWUPS = [
  'Что ещё я могу улучшить?',
  'Покажи конкретные шаги',
  'Какой риск, если я этого не сделаю?',
];

export default function AiChatDrawer({ open, onClose }) {
  const { tt, lang } = useTt();
  const [history, setHistory] = useState([
    { role: 'assistant', text: tt('Привет! Я твой AI-консультант по бизнесу. Спроси что-нибудь или выбери вопрос ниже.') },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [followUps, setFollowUps] = useState(SEED_QUESTIONS);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    }
  }, [history, open, typing]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  const sendMessage = async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || typing) return;
    setError(null);
    setInput('');
    const newHistory = [...history, { role: 'user', text: trimmed }];
    setHistory(newHistory);
    setTyping(true);
    setFollowUps([]);
    try {
      const apiMessages = newHistory.map(m => ({ role: m.role, content: m.text }));
      const { data } = await api.post('/ai/chat', { messages: apiMessages, lang });
      const reply = data.reply || tt('Не получил ответ. Попробуй переформулировать.');
      setHistory(h => [...h, { role: 'assistant', text: reply }]);
      api.post('/ai/suggest', { last_reply: reply, lang })
        .then(r => {
          const qs = Array.isArray(r.data?.questions) ? r.data.questions : [];
          setFollowUps(qs.length > 0 ? qs : FALLBACK_FOLLOWUPS);
        })
        .catch(() => setFollowUps(FALLBACK_FOLLOWUPS));
    } catch (e) {
      const msg = e.response?.data?.error || tt('Не получилось связаться с AI. Попробуй ещё раз.');
      setError(msg);
      setHistory(h => [...h, { role: 'assistant', text: '⚠️ ' + msg }]);
      setFollowUps(SEED_QUESTIONS);
    }
    setTyping(false);
  };

  const reset = () => {
    setHistory([{ role: 'assistant', text: tt('Начнём заново. Что тебя интересует?') }]);
    setFollowUps(SEED_QUESTIONS);
    setError(null);
  };

  if (!open) return null;

  return (
      <div style={{
        height: '100vh', minWidth: 0, overflow: 'hidden',
        background: '#fff', borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 32px rgba(15,23,42,.08)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #1E293B, #1D4ED8)',
          color: '#fff',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid rgba(255,255,255,.1)',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(255,255,255,.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>🤖</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{tt('AI-консультант')}</div>
            <div style={{ fontSize: 11, opacity: .8 }}>Wave AI · {tt('готов помочь')}</div>
          </div>
          <button onClick={reset} title={tt('Начать заново')} style={{
            background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
            width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 14,
          }}>↻</button>
          <button onClick={onClose} title={tt('Закрыть')} style={{
            background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
            width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 18,
          }}>×</button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map((m, i) => {
            const isUser = m.role === 'user';
            const { cleanText, chartTypes } = !isUser ? parseChartTags(m.text) : { cleanText: m.text, chartTypes: [] };
            return (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
              }}>
                {cleanText && (
                  <div style={{
                    maxWidth: '92%',
                    padding: isUser ? '10px 14px' : '12px 15px',
                    borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isUser ? 'linear-gradient(135deg, #1D4ED8, #1E3A8A)' : 'var(--bg-2)',
                    color: isUser ? '#fff' : 'var(--text)',
                    fontFamily: isUser ? 'inherit' : "'Inter', 'Nunito', system-ui, sans-serif",
                    fontSize: isUser ? 13 : 14,
                    lineHeight: isUser ? 1.5 : 1.7,
                    letterSpacing: isUser ? 0 : '-0.1px',
                    whiteSpace: isUser ? 'pre-wrap' : 'normal',
                    wordBreak: 'break-word',
                  }}>
                    {isUser ? cleanText : <RichText text={cleanText} />}
                  </div>
                )}
                {chartTypes.length > 0 && (
                  <div style={{ width: '100%', maxWidth: 380, marginTop: cleanText ? 6 : 0 }}>
                    {chartTypes.map((t, idx) => <AiChartBlock key={idx + ':' + t} chartType={t} />)}
                  </div>
                )}
              </div>
            );
          })}
          {typing && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
                background: 'var(--bg-2)', color: 'var(--text2)', fontSize: 13,
              }}>
                <span style={{ display: 'inline-flex', gap: 3 }}>
                  <span style={{ animation: 'aiDot 1s infinite' }}>●</span>
                  <span style={{ animation: 'aiDot 1s infinite .2s' }}>●</span>
                  <span style={{ animation: 'aiDot 1s infinite .4s' }}>●</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {followUps.length > 0 && !typing && (
          <div style={{
            padding: '10px 16px 4px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
              {tt('Подсказки:')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {followUps.slice(0, 5).map((q, i) => (
                <button key={i} onClick={() => sendMessage(tt(q))} disabled={typing} style={{
                  padding: '7px 11px',
                  background: '#fff',
                  border: '1.5px solid var(--border-strong)',
                  borderRadius: 16,
                  cursor: 'pointer',
                  fontSize: 11.5, fontWeight: 700,
                  color: 'var(--primary)',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  maxWidth: '100%',
                }}>
                  {tt(q)}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} style={{
          padding: '10px 16px 14px',
          background: 'var(--bg)',
          display: 'flex', gap: 8,
          borderTop: followUps.length === 0 || typing ? '1px solid var(--border)' : 'none',
        }}>
          <input
            ref={inputRef}
            className="input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={typing ? tt('AI думает...') : tt('Спроси что-нибудь...')}
            disabled={typing}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            disabled={typing || !input.trim()}
            className="btn btn-primary"
            style={{ padding: '0 14px' }}
          >
            {typing ? '...' : tt('Отправить')}
          </button>
        </form>

        <style>{`@keyframes aiDot { 0%,80%,100% { opacity: .3; } 40% { opacity: 1; } }`}</style>
      </div>
  );
}
