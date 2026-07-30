import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './icons.jsx';
import AiChartBlock, { RichText } from './AiChartBlock.jsx';
import { useTt } from './tt.js';

// AI-воркспейс: чат слева + канвас справа, где перо «рисует» макет, пока ИИ
// думает, а затем экран материализуется РЕАЛЬНЫМИ данными компании (тот же
// /api/ai/chart-data, что и графики в обычном чате — просто другая подача).
// Перенос UX из дизайн-концепта (wave-erp-design/src/aiworkspace.jsx) на
// боевой AI: чат подключён к настоящему /api/ai/chat, никаких моков.

const EASE = [0.22, 1, 0.36, 1];

function TypingDots() {
  return (
    <span className="aic-typing">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} animate={{ opacity: [0.25, 1, 0.25], y: [0, -2.5, 0] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }} />
      ))}
    </span>
  );
}

function WordReveal({ text }) {
  const words = String(text || '').split(' ');
  // Сообщения могут быть длинными — ограничиваем каскад первыми ~40 словами,
  // остальное появляется сразу (иначе многословный ответ «дорисовывался» бы 5+ секунд).
  return (
    <>
      {words.map((w, i) => (
        <motion.span
          key={i} style={{ display: 'inline-block', marginRight: '0.26em' }}
          initial={{ opacity: 0, y: 5, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.28, ease: EASE, delay: Math.min(i, 40) * 0.014 }}
        >
          {w}
        </motion.span>
      ))}
    </>
  );
}

/* ── Магия рисования: перо чертит каркас, пока идёт реальный запрос к ИИ ── */
const GEN_PHRASES = ['Смотрю данные…', 'Считаю метрики…', 'Ищу закономерности…', 'Готовлю ответ…'];
const INK = '#7c9cf5';

function SketchScreen() {
  const { tt } = useTt();
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPh((p) => (p + 1) % GEN_PHRASES.length), 900);
    return () => clearInterval(t);
  }, []);

  const dr = (delay, dur = 0.5) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { pathLength: { duration: dur, delay, ease: 'easeInOut' }, opacity: { duration: 0.12, delay } },
  });

  return (
    <motion.div
      className="aiw-sketch"
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.99, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <div className="aiw-gen-pill">
        <motion.span
          style={{ display: 'flex', color: '#7c5cff' }}
          animate={{ rotate: 360, scale: [1, 1.18, 1] }}
          transition={{ rotate: { duration: 3, repeat: Infinity, ease: 'linear' }, scale: { duration: 1.3, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <Icon name="sparkle" size={13} />
        </motion.span>
        <AnimatePresence mode="wait">
          <motion.span key={ph} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: EASE }}>
            {tt(GEN_PHRASES[ph])}
          </motion.span>
        </AnimatePresence>
      </div>

      <svg viewBox="0 0 720 540" fill="none" style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        <motion.line x1="6" y1="16" x2="210" y2="16" stroke={INK} strokeWidth="2.4" strokeLinecap="round" {...dr(0.05, 0.3)} />
        {[0, 1, 2].map((i) => (
          <motion.rect key={i} x={6 + i * 242} y={42} width={224} height={84} rx={14} stroke={INK} strokeWidth="1.6" {...dr(0.32 + i * 0.17, 0.42)} />
        ))}
        <motion.rect x="6" y="142" width="708" height="214" rx="14" stroke={INK} strokeWidth="1.6" {...dr(0.92, 0.5)} />
        <motion.path
          d="M30 322 C 92 268, 150 332, 222 300 S 342 238, 424 268 S 566 208, 692 178"
          stroke={INK} strokeWidth="2.4" strokeLinecap="round" {...dr(1.4, 0.75)}
        />
        {[0, 1, 2].map((i) => (
          <motion.rect key={'r' + i} x={6} y={376 + i * 48} width={708} height={34} rx={10} stroke={INK} strokeWidth="1.4" {...dr(2.05 + i * 0.15, 0.32)} />
        ))}
        {/* перо: светящаяся точка бежит по каркасу, крутится по кругу пока идёт ответ —
            любой сетевой задержке хватает, анимация не «кончается» раньше ответа */}
        <motion.g
          initial={{ x: 6, y: 16, opacity: 0 }}
          animate={{
            x: [6, 210, 6, 230, 476, 700, 6, 700, 30, 424, 692, 6, 714, 714, 6],
            y: [16, 16, 42, 126, 42, 126, 142, 356, 322, 268, 178, 376, 425, 500, 16],
            opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          }}
          transition={{ duration: 3.2, ease: 'easeInOut', repeat: Infinity }}
        >
          <circle r="11" fill="rgba(124, 92, 255, 0.22)" />
          <circle r="4.5" fill="#7c5cff" />
        </motion.g>
      </svg>
    </motion.div>
  );
}

/* ── Бизнес-панель: собранный под вопрос ответ (инсайт + KPI + чарт + действия) ──
   Приходит с /api/ai/chart... нет — с /api/ai/canvas: ИИ выбирает, что показать,
   из РЕАЛЬНЫХ фактов компании, а не рисует случайный график. */
const TONE_COLOR = { good: '#16A34A', bad: '#DC2626', neutral: 'var(--text2)' };

function BusinessPanel({ canvas }) {
  const { tt } = useTt();
  const navigate = useNavigate();
  const pop = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring', stiffness: 340, damping: 30 },
  };
  return (
    <motion.div className="aiw-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }} transition={{ duration: 0.35, ease: EASE }}>
      <motion.div className="aiw-panel-head" {...pop}>
        <span className="aiw-panel-badge"><Icon name="sparkle" size={15} /></span>
        <div>
          <b>{canvas.title}</b>
          {canvas.headline && <p>{canvas.headline}</p>}
        </div>
      </motion.div>

      {canvas.metrics?.length > 0 && (
        <motion.div className="aiw-panel-metrics" {...pop} transition={{ ...pop.transition, delay: 0.06 }}>
          {canvas.metrics.map((m, i) => (
            <div key={i} className="aiw-metric">
              <div className="aiw-metric-label">{m.label}</div>
              <div className="aiw-metric-value" style={{ color: TONE_COLOR[m.tone] || TONE_COLOR.neutral }}>{m.value}</div>
              {m.hint && <div className="aiw-metric-hint">{m.hint}</div>}
            </div>
          ))}
        </motion.div>
      )}

      {canvas.chart && (
        <motion.div className="aiw-panel-chart" {...pop} transition={{ ...pop.transition, delay: 0.1 }}>
          <AiChartBlock chartType={canvas.chart} />
        </motion.div>
      )}

      {canvas.actions?.length > 0 && (
        <motion.div className="aiw-panel-actions" {...pop} transition={{ ...pop.transition, delay: 0.14 }}>
          <div className="aiw-panel-actions-t">{tt('Что сделать')}</div>
          {canvas.actions.map((a, i) => (
            <button key={i} className="aiw-action" onClick={() => navigate(a.route)}>
              <div style={{ minWidth: 0 }}>
                <div className="aiw-action-label">{a.label}</div>
                {a.why && <div className="aiw-action-why">{a.why}</div>}
              </div>
              <Icon name="chevron" size={14} />
            </button>
          ))}
        </motion.div>
      )}

      <div className="aiw-panel-foot">{tt('Собрано под ваш вопрос · реальные данные компании')}</div>
    </motion.div>
  );
}

/* ── Воркспейс: чат (реальный /ai/chat) + канвас (реальные графики) ─────── */
export default function AiWorkspace({
  messages, typing, followUps, onSend, input, setInput, onKeyDown, onNewChat, onClose,
  onToggleSidebar, extraTop, canvasLoading,
}) {
  const { tt } = useTt();
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  // Канвас справа — собранная под вопрос бизнес-панель (/api/ai/canvas), привязана
  // к последнему ответу ИИ. Не случайный график: ИИ сам выбирает инсайт/KPI/чарт/действия.
  const lastAi = [...(messages || [])].reverse().find((m) => m.role === 'assistant');
  const canvas = lastAi?.canvas || null;

  const showChips = (messages || []).length <= 1 && !typing;

  return (
    <div className="aiw">
      {/* Без «панели»-бара: история и новый чат — компактные плавающие кнопки
          в правом верхнем углу, поверх канваса. Воркспейс занимает весь экран. */}
      <div className="aiw-float">
        {onToggleSidebar && (
          <button className="aiw-fbtn" onClick={onToggleSidebar} title={tt('История чатов')}>
            <Icon name="layout" size={16} />
          </button>
        )}
        {onNewChat && (
          <button className="aiw-fbtn" onClick={onNewChat} title={tt('Новый чат')}>
            <Icon name="plus" size={16} />
          </button>
        )}
      </div>

      <div className="aiw-body">
        <div className="aiw-chat">
          <div className="aic-list" ref={listRef}>
            {(messages || []).map((m, i) => {
              const isUser = m.role === 'user';
              let cleanText = isUser ? m.text : m.text.replace(/\[\[CHART:[a-z_]+\]\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
              // Стартовое приветствие — единственный статичный текст ассистента: локализуем.
              if (m.seed) cleanText = tt(cleanText);
              if (!cleanText) return null;
              return (
                <motion.div key={i} className={`aic-msg ${isUser ? 'user' : 'ai'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
                  {!isUser && <span className="aic-ava"><Icon name="sparkle" size={12} /></span>}
                  <div className="aic-text">{isUser ? cleanText : (i === messages.length - 1 ? <WordReveal text={cleanText} /> : <RichText text={cleanText} />)}</div>
                </motion.div>
              );
            })}
            {typing && (
              <div className="aic-msg ai">
                <span className="aic-ava"><Icon name="sparkle" size={12} /></span>
                <TypingDots />
              </div>
            )}
            {showChips && extraTop}
            <AnimatePresence>
              {showChips && followUps?.length > 0 && (
                <motion.div className="aic-chips" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.2, duration: 0.35 }}>
                  {followUps.slice(0, 6).map((c) => <button key={c} className="aic-chip" onClick={() => onSend(c)}>{tt(c)}</button>)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="aic-inputwrap">
            <div className="aic-input">
              <input
                placeholder={tt('Спросите о вашем бизнесе…')}
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown} disabled={typing}
              />
              <motion.button className="aic-send" onClick={() => onSend()} disabled={!input.trim() || typing} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} aria-label={tt('Отправить')}>
                <Icon name="arrowup" size={15} strokeWidth={2} />
              </motion.button>
            </div>
            <div className="aic-note">{tt('AI может ошибаться — проверяйте важные цифры в самой системе')}</div>
          </div>
        </div>

        <div className="aiw-canvas">
          <AnimatePresence mode="wait">
            {(typing || canvasLoading) ? (
              <SketchScreen key="sketch" />
            ) : canvas ? (
              <BusinessPanel key={'panel|' + (messages?.length || 0)} canvas={canvas} />
            ) : (
              <motion.div
                key="empty" className="aiw-empty"
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <motion.span className="aiw-orb" animate={{ scale: [1, 1.06, 1], rotate: [0, 6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
                  <Icon name="sparkle" size={30} />
                </motion.span>
                <h3>{tt('Спросите — соберу бизнес-разбор')}</h3>
                <p>{tt('Отвечаю словами слева, а здесь собираю ответ под ваш вопрос: цифры, график и что сделать.')}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
