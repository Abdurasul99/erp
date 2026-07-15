import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { SECTIONS, DASH_WIDGETS } from '../modules.js';
import { Card, PageHeader, Skeleton } from '../ui.jsx';
import { useTt } from '../tt.js';

// Панель управления виджетами: учредитель включает/выключает любой инструмент для всей
// компании. Выключенные пропадают из меню у всех сотрудников. Хранится в companies.disabled_tools.
// Плюс — виджеты Главной (Asosiy): выключенные пропадают с дашборда у всех (companies.disabled_widgets).
export default function PanelManagerTool() {
  const { tt } = useTt();
  const [disabled, setDisabled] = useState(null);       // Set of disabled tool ids
  const [disabledW, setDisabledW] = useState(null);      // Set of disabled dashboard-widget ids
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get('/company/tool-settings')
      .then(r => { setDisabled(new Set(r.data.disabled_tools || [])); setDisabledW(new Set(r.data.disabled_widgets || [])); })
      .catch(() => { setDisabled(new Set()); setDisabledW(new Set()); });
  }, []);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(null), 3500); };

  // ── инструменты (окна) ─────────────────────────────────────────────
  const toggle = (id) => {
    if (id === 'panel-manager') return;
    const s = new Set(disabled); s.has(id) ? s.delete(id) : s.add(id); setDisabled(s);
  };
  const setSectionAll = (sec, on) => {
    const s = new Set(disabled);
    for (const t of (sec.tools || [])) { if (t.id === 'panel-manager') continue; on ? s.delete(t.id) : s.add(t.id); }
    setDisabled(s);
  };

  // ── виджеты Главной ────────────────────────────────────────────────
  const toggleW = (id) => { const s = new Set(disabledW); s.has(id) ? s.delete(id) : s.add(id); setDisabledW(s); };
  const setWidgetsAll = (on) => {
    const s = new Set(disabledW);
    for (const w of DASH_WIDGETS) { on ? s.delete(w.id) : s.add(w.id); }
    setDisabledW(s);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.put('/company/tool-settings', { disabled_tools: [...disabled], disabled_widgets: [...disabledW] });
      flash('✅ Сохранено — обновляю страницу…');
      // Перезагрузка: /auth/me отдаст свежие company_disabled_tools/widgets → меню и Главная применят изменения.
      setTimeout(() => window.location.reload(), 800);
    } catch (e) { flash('⚠️ ' + (e.response?.data?.error || e.message)); setSaving(false); }
  };

  if (!disabled || !disabledW) return <div className="card" style={{ padding: 20 }}><Skeleton height={44} /></div>;

  const allTools = SECTIONS.flatMap(s => s.tools || []);
  const activeCount = allTools.filter(t => !disabled.has(t.id)).length;

  // Единый вид переключателя (инструмент или виджет).
  const ToggleBtn = ({ icon, title, on, onClick, locked }) => (
    <button onClick={onClick} disabled={locked}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
        cursor: locked ? 'default' : 'pointer', textAlign: 'left', opacity: locked ? 0.7 : 1,
        border: '1.5px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
        background: on ? 'var(--primary-50)' : 'var(--bg-2)',
      }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: on ? 'var(--text)' : 'var(--text3)' }}>
        {title}
      </span>
      <span style={{ width: 36, height: 20, borderRadius: 20, background: on ? 'var(--primary)' : '#CBD5E1', position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </span>
    </button>
  );

  const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 };

  return (
    <>
      <PageHeader
        title={tt('🎛️ Управление панелью')}
        sub={`${tt('Включи/выключи инструменты для всей компании')} · ${tt('активно')} ${activeCount} ${tt('из')} ${allTools.length}`}
      />
      {/* Кнопка «Сохранить» в теле инструмента (НЕ в топбаре) — иначе замыкание save устаревает
          и изменения виджетов не сохраняются (topbar-actions не перерисовываются на каждый тоггл). */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '10px 0', marginBottom: 6, background: 'var(--bg, #fff)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.4 }}>
          {tt('Выключенные инструменты пропадут из меню у всех сотрудников компании (кроме этого экрана). Меняет только учредитель.')}
        </div>
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? tt('Сохранение…') : tt('💾 Сохранить')}</button>
      </div>
      {msg && <Card style={{ marginBottom: 12 }}><div style={{ fontWeight: 700 }}>{tt(msg)}</div></Card>}

      {SECTIONS.map(sec => {
        // «Главная» (Asosiy) — не набор окон, а виджеты дашборда. Показываем их вместо пустого списка.
        if (sec.id === 'dashboard') {
          const onCount = DASH_WIDGETS.filter(w => !disabledW.has(w.id)).length;
          return (
            <Card key={sec.id} icon={sec.icon} title={`${tt(sec.title)} · ${onCount}/${DASH_WIDGETS.length}`} style={{ marginBottom: 14 }}
              actions={
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setWidgetsAll(true)}>{tt('Всё вкл')}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setWidgetsAll(false)}>{tt('Всё выкл')}</button>
                </div>
              }>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                {tt('Виджеты Главной для всей компании. Выключенные исчезнут с дашборда у всех сотрудников.')}
              </div>
              <div style={gridStyle}>
                {DASH_WIDGETS.map(w => (
                  <ToggleBtn key={w.id} title={tt(w.label)} on={!disabledW.has(w.id)} onClick={() => toggleW(w.id)} />
                ))}
              </div>
            </Card>
          );
        }

        const tools = sec.tools || [];
        if (tools.length === 0) return null; // пустые секции не показываем
        const onCount = tools.filter(t => !disabled.has(t.id)).length;
        return (
          <Card key={sec.id} icon={sec.icon} title={`${tt(sec.title)} · ${onCount}/${tools.length}`} style={{ marginBottom: 14 }}
            actions={
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setSectionAll(sec, true)}>{tt('Всё вкл')}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSectionAll(sec, false)}>{tt('Всё выкл')}</button>
              </div>
            }>
            <div style={gridStyle}>
              {tools.map(t => (
                <ToggleBtn key={t.id} icon={t.icon} title={tt(t.title)} on={!disabled.has(t.id)} onClick={() => toggle(t.id)} locked={t.id === 'panel-manager'} />
              ))}
            </div>
          </Card>
        );
      })}
    </>
  );
}
