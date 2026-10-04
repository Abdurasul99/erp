import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { SECTIONS, TOOLS_TOTAL } from './data.js';
import { AreaChart, BranchBars, FlowBars, Ring, Sparkline } from './charts.jsx';
import { toolMock } from './mock.js';
import { Icon, gradCss, meta, toolGlyph } from './icons.jsx';
import { CalendarWidget, WeatherWidget } from './widgets.jsx';
import { StartMenu } from './startmenu.jsx';
import { ScrollTicks } from './scrollticks.jsx';
import { AiWorkspace } from './aiworkspace.jsx';

const EASE = [0.22, 1, 0.36, 1];
const SPRING = { type: 'spring', stiffness: 420, damping: 38 };
const fmtUsd = (v) => '$' + Math.round(v).toLocaleString('en-US');

const ALL_TOOLS = SECTIONS.flatMap((s) => s.tools.map((t) => ({ ...t, section: s })));
const findSection = (id) => SECTIONS.find((s) => s.id === id);
const findTool = (id) => ALL_TOOLS.find((t) => t.id === id);


/* ── Счётчик с пружиной ──────────────────────────────────────────────── */
function CountUp({ to, format = (v) => v, duration = 1.1 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration, ease: EASE, onUpdate: (v) => setVal(v) });
    const t = setTimeout(() => setVal(to), duration * 1000 + 600);
    return () => { c.stop(); clearTimeout(t); };
  }, [to, duration]);
  return <>{format(val)}</>;
}

/* ── Появление текста по словам ──────────────────────────────────────── */
function WordReveal({ text, className, delay = 0.15 }) {
  const words = text.split(' ');
  return (
    <span className={className}>
      {words.map((w, i) => (
        <motion.span
          key={i} style={{ display: 'inline-block', marginRight: '0.28em' }}
          initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.4, ease: EASE, delay: delay + i * 0.022 }}
        >
          {w}
        </motion.span>
      ))}
    </span>
  );
}

/* ── Данные ──────────────────────────────────────────────────────────── */
const PERIODS = {
  '7 дней': {
    revenue: 11840, revDelta: '+6,2%', profit: 3390, cash: 21340, check: 18.2, sales: 651,
    series: [1480, 1520, 1710, 1655, 1832, 1790, 1853],
    flow: [420, -180, 510, 380, -240, 620, 480],
  },
  '30 дней': {
    revenue: 48250, revDelta: '+12,4%', profit: 13900, cash: 21340, check: 18.6, sales: 2594,
    series: [1220, 1265, 1310, 1290, 1360, 1430, 1465, 1445, 1510, 1580, 1610, 1595, 1650, 1700, 1745, 1720, 1780, 1830, 1810, 1860, 1905, 1880, 1930, 1960, 1945, 2000, 2040, 2025, 2080, 2110],
    flow: [420, -180, 510, 380, -240, 620, 480, -150, 540, 610, -320, 450, 580, -200, 660, 490, -170, 700, 520, -280, 640, 560, -190, 710, 480, -230, 690, 610, -160, 730],
  },
  '90 дней': {
    revenue: 139400, revDelta: '+18,9%', profit: 38700, cash: 21340, check: 17.9, sales: 7788,
    series: [980, 1010, 1060, 1120, 1100, 1170, 1240, 1290, 1270, 1340, 1410, 1460, 1440, 1510, 1570, 1620, 1600, 1670, 1730, 1780, 1760, 1830, 1890, 1940, 1920, 1990, 2060, 2110, 2160, 2210],
    flow: [300, -120, 380, 450, -210, 520, 410, -160, 580, 490, -260, 610, 530, -180, 650, 570, -220, 690, 540, -170, 720, 600, -240, 740, 620, -190, 760, 650, -150, 780],
  },
};
const BRANCH_ROWS = [
  { name: 'Ташкент Сити', v: 21400 },
  { name: 'Чиланзар', v: 15250 },
  { name: 'Юнусабад', v: 11600 },
];
const ALERTS = [
  { color: 'var(--bad)', text: 'Кассовый разрыв через 41 день при текущем темпе расходов' },
  { color: 'var(--warn)', text: '14 SKU ниже минимального остатка — риск дефицита' },
  { color: 'var(--warn)', text: 'Отклонение среднего чека в «Юнусабад» на −9% от нормы' },
  { color: 'var(--good)', text: 'BHI вырос на +4 за месяц — бизнес здоровее' },
];
const TOP_PRODUCTS = [
  { name: 'Кроссовки Runner', v: '$4,820', sub: '212 шт · маржа 38%' },
  { name: 'Худи oversize', v: '$3,660', sub: '148 шт · маржа 41%' },
  { name: 'Джинсы slim', v: '$3,140', sub: '121 шт · маржа 35%' },
  { name: 'Куртка зимняя', v: '$2,480', sub: '54 шт · маржа 44%' },
  { name: 'Рюкзак городской', v: '$1,930', sub: '97 шт · маржа 29%' },
];
const TOP_SELLERS = [
  { name: 'Дильноза', v: '$8,140', sub: 'Ташкент Сити · 34%' },
  { name: 'Азиз', v: '$7,320', sub: 'Чиланзар · 31%' },
  { name: 'Мадина', v: '$6,890', sub: 'Ташкент Сити · 29%' },
  { name: 'Санжар', v: '$5,410', sub: 'Юнусабад · 26%' },
  { name: 'Тимур', v: '$4,970', sub: 'Чиланзар · 24%' },
];

/* ── Bento-плитка ────────────────────────────────────────────────────── */
function Tile({ children, className = '', i = 0, onClick, ...rest }) {
  const C = onClick ? motion.button : motion.div;
  return (
    <C
      className={`tile ${className}`} onClick={onClick}
      initial={{ opacity: 0, y: 22, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: 0.04 + i * 0.05 }}
      whileHover={{ y: -4 }}
      {...rest}
    >
      {children}
    </C>
  );
}

/* ── Главная (bento) ─────────────────────────────────────────────────── */
function Home({ period, openSection, openAi }) {
  const d = PERIODS[period];
  const labels = d.series.map((_, i) => `День ${i + 1}`);
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  const kpis = [
    { label: 'Прибыль', value: d.profit, fmt: fmtUsd, delta: '↑ +8,1%', cls: 'up', spark: d.series.filter((_, i) => i % 3 === 0) },
    { label: 'Касса', value: d.cash, fmt: fmtUsd, delta: '10 валют', cls: 'flat' },
    { label: 'Продажи', value: d.sales, fmt: (v) => Math.round(v).toLocaleString('ru-RU'), delta: '↑ +9,6%', cls: 'up' },
    { label: 'Средний чек', value: d.check, fmt: (v) => '$' + v.toFixed(1).replace('.', ','), delta: '↑ +2,3%', cls: 'up' },
  ];

  return (
    <>
      <div className="greeting">
        <div>
          <h1><WordReveal text={`${hello}, Абдурасул`} delay={0.05} /></h1>
          <div className="sub"><span className="live-dot" />{today[0].toUpperCase() + today.slice(1)} · сеть из 3 филиалов · данные за {period.toLowerCase()}</div>
        </div>
      </div>

      <div className="bento">
        <Tile className="c2 r4" i={0}>
          <div className="tile-label">Выручка · {period}</div>
          <div className="hero-num" style={{ marginTop: 8 }}>
            <CountUp key={period} to={d.revenue} format={fmtUsd} />
          </div>
          <div className="tile-delta up">↑ {d.revDelta} к прошлому периоду</div>
          <div style={{ marginTop: 'auto' }}>
            <AreaChart key={period} id="rev" data={d.series} labels={labels} format={fmtUsd} height={218} />
          </div>
        </Tile>

        <Tile className="c2 r2 ai-tile" i={1} onClick={openAi} style={{ cursor: 'pointer', textAlign: 'left' }}>
          <span className="ai-spark" />
          <div className="tile-label"><Icon name="sparkle" size={13} /> Wave Intelligence · спросить</div>
          <div className="ai-text">
            <WordReveal delay={0.4} text="Выручка растёт, но через 41 день возможен кассовый разрыв. Рекомендую перенести платёж «Karvon Textile» — это сдвинет риск на +23 дня." />
          </div>
        </Tile>

        <Tile className="c1 r2" i={2} style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="tile-label">Здоровье бизнеса</div>
          <div style={{ marginTop: 8 }}><Ring value={78} size={96} label="BHI" /></div>
          <span className="pill pill-good" style={{ marginTop: 8 }}>Здоровый</span>
        </Tile>

        <Tile className="c1 r2" i={3}>
          <div className="tile-label">Отделы · {TOOLS_TOTAL} инстр.</div>
          <div className="dept-mini-grid">
            {SECTIONS.map((s) => (
              <motion.button
                key={s.id} className="dept-mini" title={s.title}
                style={{ background: gradCss(s.id), height: 36 }}
                whileHover={{ scale: 1.12, rotate: -3 }} whileTap={{ scale: 0.94 }}
                onClick={() => openSection(s.id)}
              >
                <Icon name={meta(s.id).icon} size={16} />
              </motion.button>
            ))}
          </div>
        </Tile>

        {kpis.map((k, i) => (
          <Tile className="c1 r2" i={4 + i} key={k.label}>
            <div className="tile-label">{k.label}</div>
            <div className="tile-value"><CountUp key={period} to={k.value} format={k.fmt} /></div>
            <div className={`tile-delta ${k.cls}`}>{k.delta}</div>
            {k.spark && <div style={{ marginTop: 'auto' }}><Sparkline data={k.spark} width={84} /></div>}
          </Tile>
        ))}

        <Tile className="c1 r2 weather-tile" i={8}>
          <WeatherWidget />
        </Tile>

        <Tile className="c2 r2" i={9}>
          <CalendarWidget />
        </Tile>

        <Tile className="c1 r2" i={10} style={{ justifyContent: 'center' }}>
          <div className="tile-label"><Icon name="clock" size={12} /> Смена сейчас</div>
          <div className="tile-value" style={{ marginTop: 10 }}>7 / 9</div>
          <div className="tile-delta flat">сотрудников на местах</div>
          <div className="tile-delta up" style={{ marginTop: 4 }}>Кассы открыты · 3 филиала</div>
        </Tile>

        <Tile className="c2 r3" i={11}>
          <div className="tile-label">Денежный поток · чистый за день</div>
          <div style={{ marginTop: 'auto' }}>
            <FlowBars key={period} data={d.flow} labels={d.flow.map((_, i) => `День ${i + 1}`)} format={fmtUsd} height={168} />
          </div>
        </Tile>

        <Tile className="c2 r3" i={12}>
          <div className="tile-label">Филиалы · выручка</div>
          <div style={{ marginTop: 6 }}>
            <BranchBars rows={BRANCH_ROWS} format={fmtUsd} />
          </div>
          <div style={{ marginTop: 'auto', fontSize: 11.5, color: 'var(--ink-3)' }}>
            Лидер — «Ташкент Сити», отрыв +40% от второго места
          </div>
        </Tile>

        <Tile className="c2 r3" i={13}>
          <div className="tile-label"><Icon name="alert" size={12} /> Центр алертов</div>
          <div style={{ marginTop: 6 }}>
            {ALERTS.map((a) => (
              <div className="alert-row" key={a.text}>
                <span className="alert-dot" style={{ background: a.color }} />
                <span style={{ flex: 1 }}>{a.text}</span>
              </div>
            ))}
          </div>
        </Tile>

        <Tile className="c1 r3" i={14}>
          <div className="tile-label">Топ товаров</div>
          <div style={{ marginTop: 4 }}>
            {TOP_PRODUCTS.map((p, i) => (
              <div className="rank-row" key={p.name}>
                <span className="rank-num">{i + 1}</span>
                <span className="rank-name">{p.name}<div className="rank-sub">{p.sub}</div></span>
                <span className="rank-val">{p.v}</span>
              </div>
            ))}
          </div>
        </Tile>

        <Tile className="c1 r3" i={15}>
          <div className="tile-label">Топ сотрудников</div>
          <div style={{ marginTop: 4 }}>
            {TOP_SELLERS.map((p, i) => (
              <div className="rank-row" key={p.name}>
                <span className="rank-num">{i + 1}</span>
                <span className="rank-name">{p.name}<div className="rank-sub">{p.sub}</div></span>
                <span className="rank-val">{p.v}</span>
              </div>
            ))}
          </div>
        </Tile>
      </div>
    </>
  );
}

/* ── Страница отдела ─────────────────────────────────────────────────── */
function DeptPage({ section, openTool, goHome }) {
  return (
    <>
      <button className="back-btn" onClick={goHome}><Icon name="back" size={14} /> Главная</button>
      <motion.div
        className="dept-banner" style={{ background: gradCss(section.id, 120) }}
        initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
      >
        <span className="shine" />
        <span className="big-glyph"><Icon name={meta(section.id).icon} size={210} strokeWidth={1.1} /></span>
        <h1><WordReveal text={section.title} delay={0.1} /></h1>
        <p>{section.desc}</p>
        <div className="stats">
          <div><b>{section.tools.length}</b><span>ИНСТРУМЕНТОВ</span></div>
          <div><b>+14,2%</b><span>АКТИВНОСТЬ 30Д</span></div>
          <div><b>2</b><span>АЛЕРТА</span></div>
        </div>
      </motion.div>

      <div className="tools-grid">
        {section.tools.map((t, i) => (
          <motion.button
            key={t.id} className="tool-card" layoutId={`card-${t.id}`} onClick={() => openTool(t.id)}
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.12 + Math.min(i, 16) * 0.03 }}
            whileHover={{ y: -4, scale: 1.015 }} whileTap={{ scale: 0.98 }}
          >
            <span className="tool-chip" style={{ background: gradCss(section.id) }}>
              <Icon name={toolGlyph(t, section.id)} size={17} />
            </span>
            <h4>{t.title}</h4>
            <p>{t.desc}</p>
            <span className="go"><Icon name="chevron" size={14} /></span>
          </motion.button>
        ))}
      </div>
    </>
  );
}

/* ── Экран инструмента (App Store-раскрытие) ─────────────────────────── */
function ToolSheet({ tool, onClose, morph = true }) {
  const m = useMemo(() => toolMock(tool, tool.section.title), [tool]);
  const labels = m.series.map((_, i) => `День ${i + 1}`);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <motion.div
      className="sheet-backdrop" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
    >
      <motion.div
        className="sheet" onClick={(e) => e.stopPropagation()}
        {...(morph
          ? { layoutId: `card-${tool.id}` }
          : {
              initial: { opacity: 0, scale: 0.94, y: 28 },
              animate: { opacity: 1, scale: 1, y: 0 },
              exit: { opacity: 0, scale: 0.96, y: 18 },
            })}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <div className="sheet-head" style={{ background: gradCss(tool.section.id, 120) }}>
          <button className="sheet-close" onClick={onClose}><Icon name="x" size={15} /></button>
          <div className="row">
            <span className="tool-chip" style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)', width: 44, height: 44 }}>
              <Icon name={toolGlyph(tool, tool.section.id)} size={21} />
            </span>
            <div>
              <h2>{tool.title}</h2>
              <p>{tool.desc}</p>
            </div>
          </div>
        </div>
        <div className="sheet-body">
          <div className="sheet-grid">
            {m.stats.map((s, i) => (
              <motion.div
                className="panel s3" key={s.label}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING, delay: 0.12 + i * 0.05 }}
              >
                <div className="tile-label">{s.label}</div>
                <div className="tile-value" style={{ fontSize: 21 }}>{s.value}</div>
                <div className={`tile-delta ${s.up ? 'up' : 'down'}`}>{s.up ? '↑' : '↓'} {s.delta}</div>
              </motion.div>
            ))}
            <motion.div className="panel s8" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.3 }}>
              <div className="tile-label">Динамика · 14 дней</div>
              <div style={{ marginTop: 12 }}>
                <AreaChart id={tool.id} data={m.series} labels={labels} format={fmtUsd} height={172} />
              </div>
            </motion.div>
            <motion.div className="panel s4 ai-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.36 }}>
              <span className="ai-tag"><Icon name="sparkle" size={12} /> WAVE INTELLIGENCE</span>
              <p><WordReveal text={m.insight} delay={0.45} /></p>
            </motion.div>
            <motion.div className="panel s12" style={{ padding: '6px 8px' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.42 }}>
              <table className="data">
                <thead>
                  <tr><th>Название</th><th className="num">Значение</th><th className="num">Доля</th><th className="num">Δ</th><th style={{ textAlign: 'right' }}>Статус</th></tr>
                </thead>
                <tbody>
                  {m.rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{r.value}</td>
                      <td className="num">{r.share}</td>
                      <td className="num" style={{ color: r.delta.startsWith('+') ? 'var(--good-text)' : 'var(--bad)' }}>{r.delta}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`pill ${r.good ? 'pill-good' : 'pill-bad'}`}>{r.good ? 'В НОРМЕ' : 'ВНИМАНИЕ'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>
            Демо-данные · концепт экрана «{tool.title}» · {tool.section.title}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Док с магнификацией ─────────────────────────────────────────────── */
const LP_BG = 'conic-gradient(from 220deg, #ff6482, #ff9f0a, #ffd60a, #30d158, #32ade6, #0a84ff, #bf5af2, #ff6482)';

function DockItem({ id, title, active, mouseX, onClick, bg, icon }) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);
  const distance = useTransform(mouseX, (val) => {
    const b = ref.current?.getBoundingClientRect();
    return b ? val - b.x - b.width / 2 : Infinity;
  });
  const sizeRaw = useTransform(distance, [-120, 0, 120], [44, 68, 44]);
  const size = useSpring(sizeRaw, { mass: 0.1, stiffness: 200, damping: 14 });

  return (
    <div className={`dock-item${active ? ' active' : ''}`}>
      <AnimatePresence>
        {hovered && (
          <motion.span
            className="dock-tip"
            initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }} transition={{ duration: 0.16 }}
          >
            {title}
          </motion.span>
        )}
      </AnimatePresence>
      <motion.button
        ref={ref} style={{ width: size, height: size }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onClick={onClick} whileTap={{ scale: 0.88 }} aria-label={title}
      >
        <span className="dock-icon" style={{ background: bg || gradCss(id) }}>
          <Icon name={icon || meta(id).icon} size="52%" />
        </span>
      </motion.button>
      <span className="dock-dot" />
    </div>
  );
}

function Dock({ activeId, openSection, openLaunchpad, lpOpen }) {
  const mouseX = useMotionValue(Infinity);
  return (
    <div className="dock-wrap">
      <motion.div
        className="dock"
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING, delay: 0.25 }}
      >
        <DockItem id="dashboard" title="Главная" active={activeId === 'dashboard' && !lpOpen} mouseX={mouseX} onClick={() => openSection('dashboard')} />
        <DockItem title={`Все инструменты · ${TOOLS_TOTAL}`} active={lpOpen} mouseX={mouseX} onClick={openLaunchpad} bg={LP_BG} icon="grid" />
        <span className="dock-sep" />
        {SECTIONS.map((s) => (
          <DockItem key={s.id} id={s.id} title={`${s.title} · ${s.tools.length}`} active={activeId === s.id && !lpOpen} mouseX={mouseX} onClick={() => openSection(s.id)} />
        ))}
      </motion.div>
    </div>
  );
}

/* ── Командная палитра ───────────────────────────────────────────────── */
function CommandPalette({ onClose, openTool }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return ALL_TOOLS.slice(0, 9);
    return ALL_TOOLS.filter((t) => (t.title + ' ' + t.desc + ' ' + t.section.title).toLowerCase().includes(ql)).slice(0, 12);
  }, [q]);

  return (
    <motion.div
      className="cmdk-backdrop" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
    >
      <motion.div
        className="cmdk" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: -12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -8 }} transition={{ duration: 0.2, ease: EASE }}
      >
        <div className="cmdk-inputrow">
          <Icon name="search" size={17} />
          <input
            autoFocus placeholder={`Поиск по ${TOOLS_TOTAL} инструментам…`}
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) openTool(results[0].id); }}
          />
        </div>
        <div className="cmdk-list">
          {results.length === 0 && <div className="cmdk-empty">Ничего не найдено</div>}
          {results.map((t) => (
            <button key={t.id} className="cmdk-row" onClick={() => openTool(t.id)}>
              <span className="cg" style={{ background: gradCss(t.section.id) }}>
                <Icon name={toolGlyph(t, t.section.id)} size={14} />
              </span>
              <span>{t.title}</span>
              <span className="cs">{t.section.title}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Hash-роутинг ────────────────────────────────────────────────────── */
function parseHash(h) {
  const m = (h || '').match(/^#\/(section|tool)\/([\w-]+)/);
  if (m && m[1] === 'section' && findSection(m[2])) return { dept: m[2], tool: null };
  if (m && m[1] === 'tool' && findTool(m[2])) return { dept: findTool(m[2]).section.id, tool: m[2] };
  return { dept: null, tool: null };
}
const stateToHash = (dept, tool) => (tool ? `#/tool/${tool}` : dept ? `#/section/${dept}` : '#/');

/* ── Приложение ──────────────────────────────────────────────────────── */
export default function App() {
  const init = parseHash(window.location.hash);
  const [dept, setDept] = useState(init.dept);      // null = Главная
  const [toolId, setToolId] = useState(init.tool);  // открытый инструмент (шит)
  const [period, setPeriod] = useState('30 дней');
  const [cmdk, setCmdk] = useState(false);
  const [lp, setLp] = useState(false);
  const [toolFrom, setToolFrom] = useState('other');
  const [aiOpen, setAiOpen] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    const target = stateToHash(dept, toolId);
    if (window.location.hash !== target) window.history.pushState(null, '', target);
  }, [dept, toolId]);
  useEffect(() => {
    const onPop = () => { const p = parseHash(window.location.hash); setDept(p.dept); setToolId(p.tool); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdk((v) => !v); }
      if (e.key === 'Escape') { setCmdk(false); setLp(false); setAiOpen(false); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const openSection = useCallback((id) => {
    setLp(false);
    setToolId(null);
    setDept(id === 'dashboard' ? null : id);
  }, []);
  // from='grid' — открытие из сетки отдела (морф карточки); иначе шит просто
  // всплывает поверх текущей страницы, без смены страницы под ним (легче и без лагов).
  const openTool = useCallback((id, from = 'other') => {
    setCmdk(false);
    setLp(false);
    setToolFrom(from);
    if (from === 'grid') setDept(findTool(id).section.id);
    setToolId(id);
  }, []);

  const section = dept ? findSection(dept) : null;
  const tool = toolId ? findTool(toolId) : null;
  const activeId = dept || 'dashboard';

  return (
    <div className="app">
      <div className="topbar">
        <div className="tb-logo">
          <span className="tb-mark"><Icon name="wave" size={16} strokeWidth={2} /></span>
          Wave ERP
        </div>
        <button className="tb-search" onClick={() => setCmdk(true)}>
          <Icon name="search" size={14} /> Найти инструмент… <kbd>⌘K</kbd>
        </button>
        <div className="tb-right">
          <div className="seg">
            {Object.keys(PERIODS).map((p) => (
              <button key={p} className={p === period ? 'on' : ''} onClick={() => setPeriod(p)}>
                {p === period && <motion.span layoutId="seg-bg" className="seg-bg" transition={SPRING} />}
                <span>{p}</span>
              </button>
            ))}
          </div>
          <button className="tb-btn tb-ai" title="Wave Intelligence" onClick={() => setAiOpen((v) => !v)}>
            <Icon name="sparkle" size={16} />
          </button>
          <button className="tb-btn" title="Уведомления"><Icon name="bell" size={16} /></button>
          <span className="tb-avatar">А</span>
        </div>
      </div>

      <div className="content" ref={contentRef}>
        <AnimatePresence mode="wait">
          <motion.div
            key={(section ? section.id : 'home') + ':' + (section ? '' : period)}
            className="page"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {section
              ? <DeptPage section={section} openTool={(id) => openTool(id, 'grid')} goHome={() => openSection('dashboard')} />
              : <Home period={period} openSection={openSection} openAi={() => setAiOpen(true)} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <ScrollTicks targetRef={contentRef} count={24} right={10} />

      <Dock activeId={activeId} openSection={openSection} openLaunchpad={() => setLp((v) => !v)} lpOpen={lp} />

      <AnimatePresence>
        {lp && <StartMenu onClose={() => setLp(false)} openTool={openTool} openSection={openSection} />}
      </AnimatePresence>

      <AnimatePresence>
        {tool && <ToolSheet key={tool.id} tool={tool} morph={toolFrom === 'grid'} onClose={() => setToolId(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {cmdk && <CommandPalette onClose={() => setCmdk(false)} openTool={openTool} />}
      </AnimatePresence>

      <AnimatePresence>
        {aiOpen && <AiWorkspace onClose={() => setAiOpen(false)} openTool={openTool} />}
      </AnimatePresence>
    </div>
  );
}
