import React, { useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Icon, SECTION_ICON, gradCss } from './icons.jsx';

// macOS-док: главная навигация панели. Иконки-«приложения» с магнификацией
// при наведении. Заменяет прежний сайдбар (перенос дизайна wave-erp-design).

// Экспортируется: переиспользуется админ-доком (AdminShell) с другим набором пунктов.
export function DockItem({ id, title, active, mouseX, onClick, bg, icon, label, showLabel, badge }) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);
  const distance = useTransform(mouseX, (val) => {
    const b = ref.current?.getBoundingClientRect();
    return b ? val - b.x - b.width / 2 : Infinity;
  });
  const sizeRaw = useTransform(distance, [-120, 0, 120], [42, 64, 42]);
  const size = useSpring(sizeRaw, { mass: 0.1, stiffness: 200, damping: 14 });

  return (
    <div className={'dock-item' + (active ? ' active' : '')}>
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
        ref={ref} type="button" style={{ width: size, height: size }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onClick={onClick} whileTap={{ scale: 0.88 }} aria-label={title}
      >
        <span className="dock-icon" style={{ background: bg || gradCss(id) }}>
          <Icon name={icon || SECTION_ICON[id] || 'home'} size="52%" strokeWidth={1.9} />
        </span>
      </motion.button>
      <span className="dock-dot" />
      {/* Счётчик крепится к обёртке, а НЕ к кнопке: её размер гонит пружина
          магнификации (42→64px), и бейдж на кнопке ездил бы вместе с иконкой. */}
      {Number(badge) > 0 && <span className="dock-badge">{Number(badge) > 99 ? '99+' : Number(badge)}</span>}
      {/* Постоянная подпись под иконкой — чтобы имя раздела было понятно без наведения. */}
      {label && showLabel && <span className="dock-label">{label}</span>}
    </div>
  );
}

const LP_BG = 'conic-gradient(from 220deg, #ff6482, #ff9f0a, #ffd60a, #30d158, #32ade6, #0a84ff, #bf5af2, #ff6482)';

export default function Dock({ sections, activeSection, navigate, aiEnabled, isOwner, tt, lpOpen, onLaunchpad, compact }) {
  const mouseX = useMotionValue(Infinity);
  const [hovered, setHovered] = useState(false);
  const deptSections = sections.filter((s) => s.id !== 'dashboard' && s.id !== 'settings');
  const settings = sections.find((s) => s.id === 'settings');
  const toolsTotal = deptSections.reduce((n, s) => n + (s.tools?.length || 0), 0);

  // Внутри инструмента (compact) док «прячется»: уменьшен и приглушён, чтобы не
  // маячил. Наведение курсора разворачивает его в полный размер (как на Главной).
  // Подписи-имена показываются в развёрнутом состоянии.
  const expanded = !compact || hovered;

  return (
    <div className={'dock-wrap' + (compact ? ' dock-wrap-compact' : '')}>
      <motion.div
        className={'dock' + (expanded ? '' : ' dock-collapsed')}
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { mouseX.set(Infinity); setHovered(false); }}
        initial={{ y: 90, opacity: 0 }}
        animate={{ y: 0, opacity: expanded ? 1 : 0.55, scale: expanded ? 1 : 0.66 }}
        style={{ transformOrigin: 'bottom center' }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      >
        <DockItem id="dashboard" title={tt('Главная')} label={tt('Главная')} showLabel={expanded} active={activeSection === 'dashboard' && !lpOpen} mouseX={mouseX} onClick={() => navigate('/owner')} />
        <DockItem title={`${tt('Все инструменты')} · ${toolsTotal}`} label={tt('Инструменты')} showLabel={expanded} active={!!lpOpen} mouseX={mouseX} onClick={onLaunchpad} bg={LP_BG} icon="layout" />
        <span className="dock-sep" />
        {deptSections.map((s) => (
          <DockItem
            key={s.id} id={s.id}
            title={`${tt(s.title)} · ${s.tools.length}`}
            label={tt(s.title)} showLabel={expanded}
            active={activeSection === s.id}
            mouseX={mouseX}
            onClick={() => navigate('/owner/' + s.id)}
          />
        ))}
        {(settings || (isOwner && aiEnabled)) && <span className="dock-sep" />}
        {isOwner && aiEnabled && (
          <DockItem
            id="ai" title={tt('AI-помощник')} label={tt('AI')} showLabel={expanded} icon="sparkles"
            active={activeSection === 'ai'} mouseX={mouseX}
            onClick={() => navigate('/owner/ai')}
          />
        )}
        {settings && (
          <DockItem
            id="settings" title={tt(settings.title)} label={tt(settings.title)} showLabel={expanded}
            active={activeSection === 'settings'} mouseX={mouseX}
            onClick={() => navigate('/owner/settings')}
          />
        )}
      </motion.div>
    </div>
  );
}
