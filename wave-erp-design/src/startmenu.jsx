import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { SECTIONS, TOOLS_TOTAL } from './data.js';
import { Icon, meta, toolGlyph } from './icons.jsx';
import { LiveGlyph } from './live-icons.jsx';
import { ScrollTicks } from './scrollticks.jsx';

const EASE = [0.22, 1, 0.36, 1];
const ALL_TOOLS = SECTIONS.flatMap((s) => s.tools.map((t) => ({ ...t, section: s })));
const byId = (id) => ALL_TOOLS.find((t) => t.id === id);

// Закреплённые (2 ряда «звёздных» инструментов)
const PINNED = [
  'founder-board', 'cash-gap', 'pnl', 'cash', 'pos', 'sales-history', 'stock', 'inventory-mgmt',
  'crm', 'churn', 'team-kpi', 'fire-analysis', 'global-whatif', 'store-police', 'alert-center', 'panel-manager',
].map(byId).filter(Boolean);

// Рекомендуем (недавнее/важное — как в Windows 11)
const RECOMMENDED = [
  { id: 'cash-gap', sub: 'Алерт: разрыв через 41 день' },
  { id: 'sales-history', sub: 'Открывали 11 мин назад' },
  { id: 'store-police', sub: '3 новых события за смену' },
  { id: 'salaries', sub: 'Выплата ФОТ — в пятницу' },
  { id: 'audit', sub: 'Завтра — инвентаризация, Чиланзар' },
  { id: 'nps', sub: 'Новый отзыв 4★ — Юнусабад' },
].map((r) => ({ ...r, tool: byId(r.id) })).filter((r) => r.tool);

// Стеклянная живая иконка. Float и пробегающий блик — чистый CSS (компоновщик,
// нулевая нагрузка на JS-поток); framer остаётся только у глифов (live=true).
export function GlassIcon({ tool, size = 44, glyphSize = 20, live = true, i = 0 }) {
  const g = meta(tool.section.id).grad;
  return (
    <span
      className="gi live"
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.27),
        '--tint1': g[0], '--tint2': g[1],
        '--fd': `${3.4 + (i % 5) * 0.4}s`, '--fdel': `${(i % 7) * 0.33}s`,
        '--sd': `${5 + (i % 6) * 0.9}s`, '--sdel': `${(i % 9) * 0.5}s`,
      }}
    >
      <span className="lp-shine" />
      <LiveGlyph name={toolGlyph(tool, tool.section.id)} size={glyphSize} strokeWidth={1.7} active={live} />
    </span>
  );
}

function AppTile({ tool, i, onClick, live = true }) {
  return (
    <motion.button
      className="ws-app" onClick={onClick}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE, delay: Math.min(i, 24) * 0.018 }}
      whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}
    >
      <GlassIcon tool={tool} i={i} live={live} />
      <span className="ws-app-label">{tool.title}</span>
    </motion.button>
  );
}

export function StartMenu({ onClose, openTool, openSection }) {
  const [q, setQ] = useState('');
  const [view, setView] = useState('cat'); // 'cat' | 'list'
  const scrollRef = useRef(null);

  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return null;
    return ALL_TOOLS.filter((t) => (t.title + ' ' + t.desc + ' ' + t.section.title).toLowerCase().includes(ql));
  }, [q]);

  return (
    <motion.div
      className="ws-backdrop" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
    >
      <motion.div
        className="ws-panel" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 22, scale: 0.985 }} transition={{ duration: 0.3, ease: EASE }}
      >
        <div className="ws-search">
          <Icon name="search" size={16} />
          <input
            autoFocus placeholder={`Поиск среди ${TOOLS_TOTAL} инструментов, отчётов и настроек`}
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && results && results[0]) openTool(results[0].id); }}
          />
        </div>

        <div className="ws-scroll" ref={scrollRef}>
          {results ? (
            <>
              <div className="ws-sec-head"><h3>Результаты · {results.length}</h3></div>
              <div className="ws-pinned-grid">
                {results.length === 0 && <div className="ws-empty">Ничего не найдено по запросу «{q}»</div>}
                {results.map((t, i) => <AppTile key={t.id} tool={t} i={i} onClick={() => openTool(t.id)} live={i < 12} />)}
              </div>
            </>
          ) : (
            <>
              <div className="ws-sec-head">
                <h3>Закреплённые</h3>
                <button className="ws-link" onClick={() => setView(view === 'cat' ? 'list' : 'cat')}>
                  {view === 'cat' ? 'Все инструменты' : 'Категории'} <Icon name="chevron" size={11} />
                </button>
              </div>
              <div className="ws-pinned-grid">
                {PINNED.map((t, i) => <AppTile key={t.id} tool={t} i={i} onClick={() => openTool(t.id)} />)}
              </div>

              <div className="ws-sec-head">
                <h3>Рекомендуем</h3>
                <button className="ws-link" onClick={() => setView('list')}>Показать все <Icon name="chevron" size={11} /></button>
              </div>
              <div className="ws-rec-grid">
                {RECOMMENDED.map((r, i) => (
                  <motion.button
                    key={r.id} className="ws-rec" onClick={() => openTool(r.id)}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, ease: EASE, delay: 0.1 + i * 0.04 }}
                    whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                  >
                    <GlassIcon tool={r.tool} size={38} glyphSize={18} i={i + 3} />
                    <div style={{ minWidth: 0 }}>
                      <div className="ws-rec-title">{r.tool.title}</div>
                      <div className="ws-rec-sub">{r.sub}</div>
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="ws-sec-head">
                <h3>Все · {TOOLS_TOTAL}</h3>
                <button className="ws-link" onClick={() => setView(view === 'cat' ? 'list' : 'cat')}>
                  Вид: {view === 'cat' ? 'Категории' : 'Список'} <Icon name="chevron" size={11} style={{ transform: 'rotate(90deg)' }} />
                </button>
              </div>
              {view === 'cat' ? (
                <div className="ws-cat-grid">
                  {SECTIONS.map((s, ci) => (
                    <motion.button
                      key={s.id} className="ws-cat" onClick={() => openSection(s.id)}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, ease: EASE, delay: 0.12 + ci * 0.035 }}
                      whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
                    >
                      <div className="ws-cat-mini">
                        {s.tools.slice(0, 4).map((t, ti) => (
                          <GlassIcon key={t.id} tool={{ ...t, section: s }} size={30} glyphSize={15} live={false} i={ti} />
                        ))}
                      </div>
                      <span className="ws-cat-name">{s.title}</span>
                      <span className="ws-cat-cnt">{s.tools.length} инструментов</span>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="ws-pinned-grid">
                  {ALL_TOOLS.map((t, i) => <AppTile key={t.id} tool={t} i={i} onClick={() => openTool(t.id)} live={false} />)}
                </div>
              )}
            </>
          )}
        </div>

        <ScrollTicks targetRef={scrollRef} count={18} right={9} />

        <div className="ws-footer">
          <div className="ws-user">
            <span className="tb-avatar">А</span>
            <div>
              <b>Абдурасул</b>
              <span>Учредитель · Wave ERP</span>
            </div>
          </div>
          <button className="ws-power" onClick={onClose} title="Закрыть меню"><Icon name="power" size={16} /></button>
        </div>
      </motion.div>
    </motion.div>
  );
}
