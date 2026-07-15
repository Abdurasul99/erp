import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTt } from './tt.js';
import { Icon, SECTION_ICON } from './icons.jsx';

// Глобальный поиск по инструментам (Ctrl+K / Cmd+K) — главный способ навигации
// при минималистичной панели: набрал пару букв → Enter → нужный экран.
// Ищет по названию И описанию (описания хабов содержат названия вкладок,
// поэтому «аномалии» найдёт Центр контроля, «EOQ» — Расчёты запасов).
export default function CommandPalette({ open, onClose, sections }) {
  const { tt } = useTt();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const items = useMemo(() => {
    const out = [];
    for (const s of sections) {
      if (s.id === 'dashboard') continue;
      out.push({ kind: 'section', section: s, title: tt(s.title), sub: tt(s.desc), path: '/owner/' + s.id });
      for (const t of s.tools || []) {
        out.push({ kind: 'tool', section: s, title: tt(t.title), sub: tt(t.desc), path: `/owner/${s.id}/${t.id}` });
      }
    }
    return out;
  }, [sections, tt]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items.filter(i => i.kind === 'section');
    const words = needle.split(/\s+/);
    return items
      .map(i => {
        const title = i.title.toLowerCase();
        const sub = (i.sub || '').toLowerCase();
        let score = 0;
        for (const w of words) {
          if (title.startsWith(w)) score += 30;
          else if (title.includes(w)) score += 20;
          else if (sub.includes(w)) score += 8;
          else return null;
        }
        if (i.kind === 'tool') score += 5; // инструменты приоритетнее разделов
        return { ...i, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [q, items]);

  useEffect(() => {
    if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [open]);
  useEffect(() => { setIdx(0); }, [q]);

  const go = (item) => { if (!item) return; onClose(); navigate(item.path); };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[idx]); }
  };

  useEffect(() => {
    // Держим активный пункт в зоне видимости при навигации стрелками
    const el = listRef.current?.children?.[idx];
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [idx]);

  if (!open) return null;

  return (
    <div className="cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label={tt('Поиск по инструментам')}>
        <input
          ref={inputRef}
          className="cmdk-input"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder={tt('Найти инструмент…')}
          aria-label={tt('Поиск по инструментам')}
        />
        <div className="cmdk-list" ref={listRef} role="listbox">
          {results.length === 0 && (
            <div className="cmdk-empty">{tt('Ничего не найдено')}</div>
          )}
          {results.map((r, i) => (
            <div
              key={r.path}
              role="option"
              aria-selected={i === idx}
              className={'cmdk-item' + (i === idx ? ' active' : '')}
              onMouseEnter={() => setIdx(i)}
              onMouseDown={(e) => { e.preventDefault(); go(r); }}
            >
              <span style={{ color: 'var(--text3)', display: 'flex' }}><Icon name={SECTION_ICON[r.section.id] || 'home'} size={16} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="cmdk-item-title">
                  {r.title}
                  {r.kind === 'tool' && <span className="cmdk-item-sec">{tt(r.section.title)}</span>}
                </div>
                {r.sub && <div className="cmdk-item-sub">{r.sub}</div>}
              </div>
              {i === idx && <span className="cmdk-enter">↵</span>}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span>↑↓ — {tt('выбор')}</span>
          <span>Enter — {tt('открыть')}</span>
          <span>Esc — {tt('закрыть')}</span>
        </div>
      </div>
    </div>
  );
}
