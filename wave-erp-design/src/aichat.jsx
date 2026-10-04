import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './icons.jsx';

const EASE = [0.22, 1, 0.36, 1];

// Сценарные ответы «аналитика» (демо): подбор по ключевым словам
const ANSWERS = [
  { re: /разрыв|касс/i, text: 'По текущему темпу расходов кассовый разрыв наступит через 41 день — 26 августа. Главный фактор: платёж «Karvon Textile» $4,200 и закупка к сезону. Если перенести платёж на 2 недели и придержать закупку «мёртвых» SKU, риск сдвинется на +23 дня. Открыть «Прогноз кассового разрыва»?' },
  { re: /марж|прибыл/i, text: 'Маржа за 30 дней — 28,8% (+0,4 п.п.). Прибыль $13,900, рост +8,1%. Лучшая категория — «Худи oversize» (41%), худшая — «Рюкзак городской» (29%): у него выросла закупочная цена на 6% в июне. Рекомендую пересмотреть цену или поставщика.' },
  { re: /филиал|лидер|таш|чилан|юнус/i, text: 'Лидер месяца — «Ташкент Сити»: $21,400 выручки, отрыв +40% от «Чиланзар». «Юнусабад» отстаёт: средний чек на −9% ниже нормы, конверсия 22%. Совет: перенести туда Дильнозу на 2 смены — её конверсия 34%.' },
  { re: /сотруд|кто|преми|дильноза|команд/i, text: 'Топ продавец — Дильноза: $8,140 выручки, конверсия 34%. В зоне риска — Тимур: конверсия упала до 24%, 2 опоздания за неделю, индекс выгорания жёлтый. Рекомендация: премия Дильнозе $80, разговор 1-на-1 с Тимуром.' },
  { re: /bhi|здоров/i, text: 'BHI сейчас 78/100 — «здоровый бизнес», +4 за месяц. Драйверы роста: выручка (+12,4%) и повторные покупки. Тянет вниз: оборачиваемость склада (12% капитала заморожено в мёртвом стоке) и риск кассового разрыва.' },
  { re: /склад|остат|sku|товар/i, text: 'На складе 14 SKU ниже минимального остатка — риск дефицита в пик сезона. Сильнее всего: «Кроссовки Runner» (осталось 8 шт, хватит на 4 дня). Мёртвый сток — $3,100 (замороженный капитал). Сформировать заказ поставщику по EOQ?' },
];
const DEFAULT_ANSWER = 'Смотрю на ваши данные за 30 дней: выручка $48,250 (+12,4%), BHI 78, из рисков — кассовый разрыв через 41 день и 14 SKU в дефиците. Уточните вопрос — например: «почему упала маржа?», «кого премировать?», «что со складом?»';

const CHIPS = ['Где кассовый разрыв?', 'Почему такая маржа?', 'Какой филиал лидер?', 'Кого премировать?', 'Что со складом?'];

function TypingDots() {
  return (
    <span className="aic-typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2.5, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}

export function AiChat({ onClose }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Привет! Я Wave Intelligence — аналитик вашего бизнеса. Вижу все 115 инструментов и данные 3 филиалов. О чём рассказать?' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
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
    setTyping(true);
    const answer = (ANSWERS.find((a) => a.re.test(t)) || { text: DEFAULT_ANSWER }).text;
    timers.current.push(setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { role: 'ai', text: answer }]);
    }, 1100 + Math.random() * 500));
  };

  const showChips = messages.length === 1 && !typing;

  return (
    <motion.aside
      className="aic"
      initial={{ x: 460, opacity: 0.6 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 480, opacity: 0.5 }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      role="dialog" aria-label="Wave Intelligence чат"
    >
      <div className="aic-head">
        <span className="aic-spark"><Icon name="sparkle" size={15} /></span>
        <div>
          <b>Wave Intelligence</b>
          <span>Аналитик вашего бизнеса</span>
        </div>
        <button className="aic-x" onClick={onClose} aria-label="Закрыть"><Icon name="x" size={14} /></button>
      </div>

      <div className="aic-list" ref={listRef}>
        {messages.map((m, i) => (
          <motion.div
            key={i} className={`aic-msg ${m.role}`}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {m.role === 'ai' && <span className="aic-ava"><Icon name="sparkle" size={12} /></span>}
            <div className="aic-text">{m.text}</div>
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
              {CHIPS.map((c) => (
                <button key={c} className="aic-chip" onClick={() => send(c)}>{c}</button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="aic-inputwrap">
        <div className="aic-input">
          <button className="aic-attach" title="Прикрепить"><Icon name="plus" size={16} /></button>
          <input
            placeholder="Спросите о вашем бизнесе…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          />
          <motion.button
            className="aic-send" onClick={() => send()} disabled={!input.trim() || typing}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} aria-label="Отправить"
          >
            <Icon name="arrowup" size={15} strokeWidth={2} />
          </motion.button>
        </div>
        <div className="aic-note">Демо-чат · ответы сценарные, в продукте — AI по вашим данным</div>
      </div>
    </motion.aside>
  );
}
