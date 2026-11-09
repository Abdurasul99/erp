// ИИ-помощник Wave Intelligence: вопрос по данным своей компании → POST /ai/chat. Ответ ничего не меняет в системе.
// Переписка живёт только на экране (не сохраняется); на сервер уходят последние 10 сообщений.
// Суммы ИИ знает только те, что этот сотрудник видит и на экранах, — контекст собирает сервер.
import React, { useEffect, useRef, useState } from 'react';
import api, { errText } from '../api.js';
import { useT } from '../i18n.js';
import { Card } from '../kit.jsx';

const SUGGEST = ['aiQ1', 'aiQ2', 'aiQ3', 'aiQ4'];
// Ответ модели — обычный текст; разметку **жирный** и ## заголовки убираем, переносы строк оставляем
const plain = s => String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '');

export default function Chat() {
  const { t, lang } = useT();
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs, busy]);

  const send = async (text) => {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    const before = msgs;
    const next = [...msgs, { role: 'user', content: question }];
    setMsgs(next); setQ(''); setErr(''); setBusy(true);
    try {
      const { data } = await api.post('/ai/chat', { messages: next.slice(-10), lang });
      setMsgs([...next, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      // вопрос не теряется: возвращаем его в поле, переписку — как была
      setErr(errText(e, t('error'))); setMsgs(before); setQ(question);
    } finally { setBusy(false); }
  };

  return (
    <Card className="dd-aichat">
      <div className="dd-eyebrow">✦ Wave Intelligence</div>
      <h3>{t('aiChatT')}</h3>
      <p className="dd-note">{t('aiChatP')}</p>
      {!msgs.length && (
        <div className="dd-aichat-sugg">
          {SUGGEST.map(k => <button key={k} type="button" className="dd-btn ghost sm" disabled={busy} onClick={() => send(t(k))}>{t(k)}</button>)}
        </div>
      )}
      {(msgs.length > 0 || busy) && (
        <div className="dd-aichat-log" aria-live="polite">
          {msgs.map((m, i) => <div key={i} className={`dd-aimsg ${m.role}`}>{m.role === 'assistant' ? plain(m.content) : m.content}</div>)}
          {busy && <div className="dd-aimsg assistant busy">{t('aiThinking')}</div>}
          <div ref={end} />
        </div>
      )}
      {err && <div className="dd-err" style={{ marginTop: 10 }}>{err}</div>}
      <form className="dd-aichat-form" onSubmit={e => { e.preventDefault(); send(); }}>
        <input className="dd-inp" value={q} maxLength={2000} placeholder={t('aiPh')} aria-label={t('aiPh')}
          onChange={e => setQ(e.target.value)} />
        <button type="submit" className="dd-btn" disabled={busy || !q.trim()}>{t('aiSend')}</button>
      </form>
      {msgs.length > 0 && (
        <button type="button" className="dd-btn ghost sm" style={{ marginTop: 10 }} disabled={busy}
          onClick={() => { setMsgs([]); setErr(''); }}>{t('aiClear')}</button>
      )}
    </Card>
  );
}
