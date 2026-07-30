import React, { useContext, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AuthContext } from '../App.jsx';
import { Icon, SECTION_ICON, gradCss } from './icons.jsx';

// Launchpad всех инструментов (стиль Windows 11 Start): поиск, закреплённые,
// категории/список. Открывается радужной кнопкой в доке.
const EASE = [0.22, 1, 0.36, 1];

function AppTile({ tool, section, i, onOpen, tt }) {
  return (
    <motion.button
      type="button" className="ws-app" onClick={onOpen}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 24) * 0.016 }}
      whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}
    >
      <span className="ws-gi" style={{ background: gradCss(section.id) }}>
        <Icon name={SECTION_ICON[section.id] || 'home'} size={19} />
      </span>
      <span className="ws-app-label">{tt(tool.title)}</span>
    </motion.button>
  );
}

export default function StartMenu({ sections, onClose, navigate, tt }) {
  const { user } = useContext(AuthContext);
  const [q, setQ] = useState('');
  const [view, setView] = useState('cat');

  const deptSections = sections.filter((s) => s.id !== 'dashboard');
  const allTools = useMemo(
    () => deptSections.flatMap((s) => (s.tools || []).map((t) => ({ tool: t, section: s }))),
    [sections]
  );
  const pinned = useMemo(
    () => deptSections.filter((s) => s.id !== 'settings').flatMap((s) => (s.tools || []).slice(0, 2).map((t) => ({ tool: t, section: s }))).slice(0, 16),
    [sections]
  );
  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return null;
    return allTools.filter(({ tool, section }) =>
      (tt(tool.title) + ' ' + tt(tool.desc || '') + ' ' + tt(section.title)).toLowerCase().includes(ql));
  }, [q, allTools, tt]);

  const open = (section, tool) => { onClose(); navigate(`/owner/${section.id}/${tool.id}`); };
  const initials = (user?.first_name || user?.username || 'U').slice(0, 1).toUpperCase();

  return (
    <motion.div
      className="ws-backdrop" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
    >
      <motion.div
        className="ws-panel" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 22 }} transition={{ duration: 0.28, ease: EASE }}
      >
        <div className="ws-search">
          <Icon name="search" size={15} />
          <input
            autoFocus placeholder={`${tt('Поиск среди')} ${allTools.length} ${tt('инструментов')}`}
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && results && results[0]) open(results[0].section, results[0].tool); }}
          />
        </div>

        <div className="ws-scroll">
          {results ? (
            <>
              <div className="ws-sec-head"><h3>{tt('Результаты')} · {results.length}</h3></div>
              <div className="ws-pinned-grid">
                {results.length === 0 && <div className="ws-empty">{tt('Ничего не найдено')}</div>}
                {results.map(({ tool, section }, i) => (
                  <AppTile key={section.id + tool.id} tool={tool} section={section} i={i} tt={tt} onOpen={() => open(section, tool)} />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="ws-sec-head">
                <h3>{tt('Закреплённые')}</h3>
                <button type="button" className="ws-link" onClick={() => setView(view === 'cat' ? 'list' : 'cat')}>
                  {view === 'cat' ? tt('Все инструменты') : tt('Категории')} ›
                </button>
              </div>
              <div className="ws-pinned-grid">
                {pinned.map(({ tool, section }, i) => (
                  <AppTile key={section.id + tool.id} tool={tool} section={section} i={i} tt={tt} onOpen={() => open(section, tool)} />
                ))}
              </div>

              <div className="ws-sec-head">
                <h3>{tt('Все разделы')} · {allTools.length} {tt('инструментов')}</h3>
                <button type="button" className="ws-link" onClick={() => setView(view === 'cat' ? 'list' : 'cat')}>
                  {tt('Вид')}: {view === 'cat' ? tt('Категории') : tt('Список')} ›
                </button>
              </div>
              {view === 'cat' ? (
                <div className="ws-cat-grid">
                  {deptSections.map((s, ci) => (
                    <motion.button
                      type="button" key={s.id} className="ws-cat"
                      onClick={() => { onClose(); navigate('/owner/' + s.id); }}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: EASE, delay: 0.1 + ci * 0.03 }}
                      whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
                    >
                      <span className="ws-gi big" style={{ background: gradCss(s.id) }}>
                        <Icon name={SECTION_ICON[s.id] || 'home'} size={24} />
                      </span>
                      <span className="ws-cat-name">{tt(s.title)}</span>
                      <span className="ws-cat-cnt">{(s.tools || []).length} {tt('инструментов')}</span>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="ws-pinned-grid">
                  {allTools.map(({ tool, section }, i) => (
                    <AppTile key={section.id + tool.id} tool={tool} section={section} i={i} tt={tt} onOpen={() => open(section, tool)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="ws-footer">
          <div className="ws-user">
            <span className="o-avatar" style={{ width: 30, height: 30 }}>{initials}</span>
            <div>
              <b>{user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username}</b>
              <span>{user?.company_name || ''}</span>
            </div>
          </div>
          <button type="button" className="ws-power" onClick={onClose} title={tt('Закрыть')}>✕</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
