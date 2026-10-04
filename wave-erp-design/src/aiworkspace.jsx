import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SECTIONS } from './data.js';
import { Icon, meta, toolGlyph } from './icons.jsx';
import { AreaChart } from './charts.jsx';
import { toolMock } from './mock.js';

const EASE = [0.22, 1, 0.36, 1];
const ALL_TOOLS = SECTIONS.flatMap((s) => s.tools.map((t) => ({ ...t, section: s })));
const byId = (id) => ALL_TOOLS.find((t) => t.id === id);
const fmtUsd = (v) => '$' + Math.round(v).toLocaleString('en-US');

// Сценарные ответы: текст + инструмент, который рисуем на канвасе
const ANSWERS = [
  { re: /разрыв|касс/i, tool: 'cash-gap', text: 'Кассовый разрыв наступит через 41 день — 26 августа. Главный фактор: платёж «Karvon Textile» $4,200 и закупка к сезону. Перенос платежа на 2 недели сдвинет риск на +23 дня. Нарисовал «Прогноз кассового разрыва» →' },
  { re: /марж|прибыл|pnl|p&l/i, tool: 'pnl', text: 'Маржа за 30 дней — 28,8% (+0,4 п.п.), прибыль $13,900 (+8,1%). Лучшая категория — «Худи oversize» (41%), худшая — «Рюкзак городской» (29%). Нарисовал P&L →' },
  { re: /филиал|лидер|таш|чилан|юнус/i, tool: 'branch-compare', text: 'Лидер — «Ташкент Сити»: $21,400, отрыв +40% от «Чиланзар». «Юнусабад» проседает по среднему чеку (−9% от нормы). Нарисовал «Сравнение филиалов» →' },
  { re: /сотруд|кто|преми|дильноза|команд|увол/i, tool: 'fire-analysis', text: 'Топ — Дильноза ($8,140, конверсия 34%) — рекомендую премию $80. В зоне риска Тимур: конверсия 24%, выгорание жёлтое. Нарисовал «Анализ на увольнение» →' },
  { re: /bhi|здоров/i, tool: 'founder-board', text: 'BHI — 78/100, «здоровый бизнес», +4 за месяц. Драйверы: выручка +12,4% и повторные покупки. Нарисовал дашборд учредителя →' },
  { re: /склад|остат|sku|товар|запас/i, tool: 'min-stock-alert', text: '14 SKU ниже минимального остатка. Критично: «Кроссовки Runner» — 8 шт, хватит на 4 дня. Нарисовал «Минимальный остаток» →' },
];
const DEFAULT = { tool: 'founder-board', text: 'Вот сводка: выручка $48,250 (+12,4%), BHI 78, из рисков — кассовый разрыв через 41 день и 14 SKU в дефиците. Уточните вопрос — например: «почему такая маржа?» или «что со складом?»' };

const CHIPS = ['Где кассовый разрыв?', 'Почему такая маржа?', 'Какой филиал лидер?', 'Кого премировать?', 'Что со складом?'];

function TypingDots() {
  return (
    <span className="aic-typing">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} animate={{ opacity: [0.25, 1, 0.25], y: [0, -2.5, 0] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }} />
      ))}
    </span>
  );
}

function WordReveal({ text, delay = 0 }) {
  return (
    <>
      {text.split(' ').map((w, i) => (
        <motion.span
          key={i} style={{ display: 'inline-block', marginRight: '0.26em' }}
          initial={{ opacity: 0, y: 5, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.32, ease: EASE, delay: delay + i * 0.018 }}
        >
          {w}
        </motion.span>
      ))}
    </>
  );
}

/* ── Магия рисования: перо чертит каркас интерфейса на канвасе ────────── */
const GEN_PHRASES = ['Смотрю данные…', 'Рисую макет…', 'Наношу график…', 'Заполняю цифры…'];
const INK = '#7c9cf5';

function SketchScreen() {
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPh((p) => (p + 1) % GEN_PHRASES.length), 720);
    return () => clearInterval(t);
  }, []);

  // Штрих: контур прорисовывается pathLength 0→1 в свой момент времени
  const dr = (delay, dur = 0.5) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: {
      pathLength: { duration: dur, delay, ease: 'easeInOut' },
      opacity: { duration: 0.12, delay },
    },
  });

  return (
    <motion.div
      className="aiw-sketch"
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.99, transition: { duration: 0.22 } }}
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
            {GEN_PHRASES[ph]}
          </motion.span>
        </AnimatePresence>
      </div>

      <svg viewBox="0 0 720 540" fill="none" style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        {/* заголовок */}
        <motion.line x1="6" y1="16" x2="210" y2="16" stroke={INK} strokeWidth="2.4" strokeLinecap="round" {...dr(0.05, 0.3)} />
        {/* три карточки метрик */}
        {[0, 1, 2].map((i) => (
          <motion.rect key={i} x={6 + i * 242} y={42} width={224} height={84} rx={14} stroke={INK} strokeWidth="1.6" {...dr(0.32 + i * 0.17, 0.42)} />
        ))}
        {/* поле графика */}
        <motion.rect x="6" y="142" width="708" height="214" rx="14" stroke={INK} strokeWidth="1.6" {...dr(0.92, 0.5)} />
        {/* сама линия графика — волна */}
        <motion.path
          d="M30 322 C 92 268, 150 332, 222 300 S 342 238, 424 268 S 566 208, 692 178"
          stroke={INK} strokeWidth="2.4" strokeLinecap="round" {...dr(1.4, 0.75)}
        />
        {/* строки таблицы */}
        {[0, 1, 2].map((i) => (
          <motion.rect key={'r' + i} x={6} y={376 + i * 48} width={708} height={34} rx={10} stroke={INK} strokeWidth="1.4" {...dr(2.05 + i * 0.15, 0.32)} />
        ))}
        {/* перо: светящаяся точка бежит по макету, пока идёт рисование */}
        <motion.g
          initial={{ x: 6, y: 16, opacity: 0 }}
          animate={{
            x: [6, 210, 6, 230, 476, 700, 6, 700, 30, 424, 692, 6, 714, 714],
            y: [16, 16, 42, 126, 42, 126, 142, 356, 322, 268, 178, 376, 425, 500],
            opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
          }}
          transition={{ duration: 2.7, ease: 'easeInOut' }}
        >
          <circle r="11" fill="rgba(124, 92, 255, 0.22)" />
          <circle r="4.5" fill="#7c5cff" />
        </motion.g>
      </svg>
    </motion.div>
  );
}

/* ── Нарисованный экран: без окна — блоки прямо на канвасе ────────────── */
function DrawnScreen({ tool, openTool }) {
  const m = toolMock(tool, tool.section.title);
  const color = meta(tool.section.id).color;
  const pop = (d) => ({
    initial: { opacity: 0, scale: 0.96, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { type: 'spring', stiffness: 360, damping: 30, delay: d },
  });

  return (
    <motion.div className="aiw-drawn" key={tool.id} exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}>
      <motion.div className="aiw-drawn-title" {...pop(0)}>
        <span className="glyph" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
          <Icon name={toolGlyph(tool, tool.section.id)} size={14} />
        </span>
        {tool.title}
        <span className="crumb">{tool.section.title}</span>
      </motion.div>

      <div className="aiw-stats">
        {m.stats.slice(0, 3).map((s, i) => (
          <motion.div className="aiw-stat" key={s.label} {...pop(0.1 + i * 0.09)}>
            <div className="l">{s.label}</div>
            <div className="v">{s.value}</div>
            <div className={`d ${s.up ? 'up' : 'down'}`}>{s.up ? '↑' : '↓'} {s.delta}</div>
          </motion.div>
        ))}
      </div>

      <motion.div className="aiw-card" {...pop(0.38)}>
        <AreaChart id={'aiw-' + tool.id} data={m.series} labels={m.series.map((_, i) => `День ${i + 1}`)} format={fmtUsd} height={168} />
      </motion.div>

      <motion.div className="aiw-card" style={{ padding: '6px 10px' }} {...pop(0.52)}>
        <table className="data aiw-table">
          <tbody>
            {m.rows.slice(0, 4).map((r, i) => (
              <motion.tr key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: EASE, delay: 0.62 + i * 0.07 }}>
                <td>{r.name}</td>
                <td className="num" style={{ fontWeight: 600 }}>{r.value}</td>
                <td className="num" style={{ color: r.delta.startsWith('+') ? 'var(--good-text)' : 'var(--bad)' }}>{r.delta}</td>
                <td style={{ textAlign: 'right' }}><span className={`pill ${r.good ? 'pill-good' : 'pill-bad'}`}>{r.good ? 'В НОРМЕ' : 'ВНИМАНИЕ'}</span></td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      <motion.div className="aiw-drawn-foot" {...pop(0.82)}>
        <span>Нарисовано из вопроса · демо-данные</span>
        <motion.button className="aiw-open" onClick={() => openTool(tool.id)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}>
          Открыть инструмент <Icon name="chevron" size={12} />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/* ── Воркспейс ────────────────────────────────────────────────────────── */
export function AiWorkspace({ onClose, openTool }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Привет! Я Wave Intelligence — аналитик вашего бизнеса. Задайте вопрос, а я отвечу и нарисую нужный экран справа.' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [screen, setScreen] = useState(null);
  const listRef = useRef(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const send = (text) => {
    const t = (text ?? input).trim();
    if (!t || typing) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: t }]);
    setScreen(null);
    setTyping(true);
    const a = ANSWERS.find((x) => x.re.test(t)) || DEFAULT;
    // рисование каркаса занимает ~2.7с — даём магии отработать
    timers.current.push(setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { role: 'ai', text: a.text }]);
      setScreen(byId(a.tool));
    }, 2900 + Math.random() * 300));
  };

  const showChips = messages.length === 1 && !typing;

  return (
    <motion.div
      className="aiw"
      initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.015 }}
      transition={{ duration: 0.25, ease: EASE }}
      role="dialog" aria-label="Wave Intelligence"
    >
      <div className="aiw-top">
        <span className="aic-spark"><Icon name="sparkle" size={15} /></span>
        <div>
          <b>Wave Intelligence</b>
          <span>AI-воркспейс · чат слева, рисует справа</span>
        </div>
        <button className="aiw-new" onClick={() => { setMessages(messages.slice(0, 1)); setScreen(null); }}>
          <Icon name="plus" size={13} /> Новый чат
        </button>
        <button className="aic-x" onClick={onClose} aria-label="Закрыть"><Icon name="x" size={14} /></button>
      </div>

      <div className="aiw-body">
        <div className="aiw-chat">
          <div className="aic-list" ref={listRef}>
            {messages.map((m, i) => (
              <motion.div key={i} className={`aic-msg ${m.role}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
                {m.role === 'ai' && <span className="aic-ava"><Icon name="sparkle" size={12} /></span>}
                <div className="aic-text">{m.role === 'ai' ? <WordReveal text={m.text} delay={0.1} /> : m.text}</div>
              </motion.div>
            ))}
            {typing && (
              <div className="aic-msg ai">
                <span className="aic-ava"><Icon name="sparkle" size={12} /></span>
                <TypingDots />
              </div>
            )}
            <AnimatePresence>
              {showChips && (
                <motion.div className="aic-chips" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.25, duration: 0.35 }}>
                  {CHIPS.map((c) => <button key={c} className="aic-chip" onClick={() => send(c)}>{c}</button>)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="aic-inputwrap">
            <div className="aic-input">
              <button className="aic-attach" title="Прикрепить"><Icon name="plus" size={16} /></button>
              <input
                autoFocus placeholder="Спросите о вашем бизнесе…"
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              />
              <motion.button className="aic-send" onClick={() => send()} disabled={!input.trim() || typing} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} aria-label="Отправить">
                <Icon name="arrowup" size={15} strokeWidth={2} />
              </motion.button>
            </div>
            <div className="aic-note">Демо-чат · ответы сценарные, в продукте — AI по вашим данным</div>
          </div>
        </div>

        <div className="aiw-canvas">
          <AnimatePresence mode="wait">
            {typing ? (
              <SketchScreen key="sketch" />
            ) : screen ? (
              <DrawnScreen key={screen.id} tool={screen} openTool={openTool} />
            ) : (
              <motion.div
                key="empty" className="aiw-empty"
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <motion.span
                  className="aiw-orb"
                  animate={{ scale: [1, 1.06, 1], rotate: [0, 6, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Icon name="sparkle" size={30} />
                </motion.span>
                <h3>Спросите — нарисую экран</h3>
                <p>Отвечаю словами слева, а здесь перо чертит макет и наполняет его вашими данными.</p>
                <div className="aiw-empty-chips">
                  {CHIPS.slice(0, 3).map((c) => <button key={c} className="aic-chip" onClick={() => send(c)}>{c}</button>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
