import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, Progress, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { AuthContext } from '../../App.jsx';
import { useTt } from '../tt.js';

const TYPE_META = {
  morning: { icon: '🌅', label: 'Открытие (утро)', color: '#D97706' },
  evening: { icon: '🌙', label: 'Закрытие (вечер)', color: '#1D4ED8' },
  weekly:  { icon: '📅', label: 'Еженедельный',     color: '#16A34A' },
  custom:  { icon: '✅', label: 'Произвольный',      color: '#1D4ED8' },
};

const TABS = [
  { value: 'today',   label: 'Сегодня' },
  { value: 'history', label: 'История' },
];

function fmtMin(m) {
  if (m == null) return '—';
  if (m < 60) return m + ' мин';
  return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин';
}

export default function ChecklistsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const { user } = useContext(AuthContext);
  const canCreate = ['admin', 'director', 'founder'].includes(user?.role);

  const [tab, setTab] = useState('today');
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [noteFor, setNoteFor] = useState(null); // {item, templateName}

  const loadToday = () => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/checklists/today', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  const loadHistory = () => {
    setLoading(true); setError(null);
    const params = { days: 30 };
    if (branchId) params.branch_id = branchId;
    api.get('/checklists/history', { params })
      .then(r => setHistory(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === 'today') loadToday(); else loadHistory();
    // eslint-disable-next-line
  }, [branchId, tab]);

  const checkItem = (item, isDone, note) => {
    setBusy(true);
    api.patch(`/checklists/items/${item.id}/check`, { is_done: isDone, note: note || undefined })
      .then(() => { setNoteFor(null); loadToday(); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  const summary = data?.summary || {};
  const templates = data?.templates || [];
  const branchScoped = data?.branch_scoped;

  const inp = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-2)', fontSize: 13, color: 'var(--text)' };
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4, display: 'block' };

  return (
    <>
      <PageHeader
        title={tt('✅ Чеклисты открытия/закрытия')}
        sub={tt('Утренний и вечерний регламент · выполнение · история по смене')}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Pills value={tab} onChange={setTab} options={TABS.map(t => ({ ...t, label: tt(t.label) }))} />
            {canCreate && <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>{tt('+ Шаблон')}</button>}
          </div>
        }
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>⚠️ {error}</div></Card>}

      {loading ? (
        <Card><Skeleton height={16} style={{ marginBottom: 10 }} /><Skeleton height={12} width="70%" /></Card>
      ) : tab === 'today' ? (
        <>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Tile icon="🌅" label={tt('Утро (открытие)')} value={summary.morning_pct == null ? '—' : summary.morning_pct + '%'} sub={tt('выполнено сегодня')} color="#D97706" />
            <Tile icon="🌙" label={tt('Вечер (закрытие)')} value={summary.evening_pct == null ? '—' : summary.evening_pct + '%'} sub={tt('выполнено сегодня')} color="#1D4ED8" />
            <Tile icon="⏱️" label={tt('Ср. длительность')} value={fmtMin(summary.avg_duration_min)} sub={tt('на чеклист')} color="#16A34A" />
          </div>

          {!branchScoped && (
            <Card><div style={{ color: 'var(--text2)', fontSize: 13 }}>
              {tt('Выберите филиал в шапке, чтобы отмечать пункты и видеть статус выполнения за сегодня.')}
            </div></Card>
          )}

          {templates.length === 0 ? (
            <EmptyState icon="✅" title={tt('Нет активных чеклистов')}
              description={tt('Создайте шаблон открытия/закрытия — сотрудники смогут отмечать пункты ежедневно.')}
              action={canCreate ? <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>{tt('+ Создать шаблон')}</button> : null} />
          ) : templates.map(t => {
            const meta = TYPE_META[t.type] || TYPE_META.custom;
            const c = t.completion;
            const pct = c?.pct ?? 0;
            return (
              <Card key={t.id} style={{ marginBottom: 14 }}
                icon={meta.icon}
                title={t.name}
                actions={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge tone="gray">{tt(meta.label)}</Badge>
                    {c && <Badge tone={pct === 100 ? 'green' : pct > 0 ? 'yellow' : 'gray'}>{c.items_done}/{c.items_total} · {pct}%</Badge>}
                  </div>
                }>
                {c && (
                  <div style={{ marginBottom: 12 }}>
                    <Progress value={pct} color={meta.color} />
                  </div>
                )}
                <div className="list">
                  {t.items.length === 0 ? (
                    <div style={{ padding: '12px 0', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>{tt('В шаблоне нет пунктов')}</div>
                  ) : t.items.map(it => (
                    <div key={it.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                      <button
                        type="button"
                        disabled={busy || !branchScoped}
                        onClick={() => checkItem(it, !it.is_done)}
                        title={branchScoped ? '' : tt('Выберите филиал')}
                        style={{
                          width: 26, height: 26, borderRadius: 7, flexShrink: 0, marginTop: 2,
                          border: '2px solid ' + (it.is_done ? '#16A34A' : 'var(--border)'),
                          background: it.is_done ? '#16A34A' : 'transparent',
                          color: '#fff', cursor: branchScoped ? 'pointer' : 'not-allowed',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 15, fontWeight: 900, lineHeight: 1,
                        }}>{it.is_done ? '✓' : ''}</button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div className="list-item-title" style={{ textDecoration: it.is_done ? 'line-through' : 'none', color: it.is_done ? 'var(--text3)' : 'var(--text)' }}>{it.title}</div>
                          {it.is_required && <Badge tone="gray">{tt('обязательно')}</Badge>}
                          {it.requires_photo && <Badge tone="blue">📷 {tt('фото')}</Badge>}
                        </div>
                        {it.description && <div className="list-item-sub" style={{ marginTop: 2 }}>{it.description}</div>}
                        {(it.note || it.done_at) && (
                          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>
                            {it.done_at && <span>✅ {new Date(it.done_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>}
                            {it.note && <span>{it.done_at ? ' · ' : ''}{tt('заметка')}: {it.note}</span>}
                          </div>
                        )}
                      </div>
                      {branchScoped && (
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setNoteFor({ item: it, templateName: t.name })}>{tt('Заметка')}</button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </>
      ) : (
        // === История ===
        (history?.items || []).length === 0 ? (
          <EmptyState icon="📭" title={tt('Нет истории выполнения')} description={tt('За последние 30 дней чеклисты ещё не заполнялись.')} />
        ) : (
          <Card icon="📋" title={`${tt('История (30 дней)')} · ${fmtNum(history.items.length)}`}>
            <div className="list">
              {history.items.map(h => {
                const meta = TYPE_META[h.type] || TYPE_META.custom;
                return (
                  <div key={h.id} className="list-item" style={{ alignItems: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: meta.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{meta.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div className="list-item-title">{h.template_name}</div>
                        <Badge tone={h.pct === 100 ? 'green' : h.pct > 0 ? 'yellow' : 'gray'}>{h.items_done}/{h.items_total} · {h.pct}%</Badge>
                        {h.branch_name && <Badge tone="gray">{h.branch_name}</Badge>}
                      </div>
                      <div className="list-item-sub" style={{ marginTop: 3 }}>
                        {new Date(h.date).toLocaleDateString('ru-RU')}
                        {h.completed_by_name ? ` · ${h.completed_by_name}` : ''}
                        {h.started_at ? ` · ${new Date(h.started_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        {h.completed_at ? `–${new Date(h.completed_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        {` · ${tt('длит.')}: ${fmtMin(h.duration_min)}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )
      )}

      {/* === Модалка: заметка к пункту === */}
      {noteFor && (
        <NoteModal item={noteFor.item} templateName={noteFor.templateName} busy={busy}
          onCancel={() => setNoteFor(null)}
          onSave={(note) => checkItem(noteFor.item, true, note)}
          inp={inp} lbl={lbl} tt={tt} />
      )}

      {/* === Модалка: создать шаблон === */}
      {showCreate && (
        <CreateTemplateModal busy={busy} setBusy={setBusy}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadToday(); }}
          onError={setError} inp={inp} lbl={lbl} tt={tt} />
      )}
    </>
  );
}

function NoteModal({ item, templateName, busy, onCancel, onSave, inp, lbl, tt }) {
  const [note, setNote] = useState(item.note || '');
  return (
    <div style={overlay} onClick={() => !busy && onCancel()}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{tt('Заметка к пункту')}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{templateName} · {item.title}</div>
        <label style={lbl}>{tt('Комментарий')}</label>
        <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={note} onChange={e => setNote(e.target.value)} placeholder={tt('Например: лампа в зале не работает')} />
        {item.requires_photo && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>📷 {tt('Этот пункт требует фото (загрузка фото появится позже).')}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost" disabled={busy} onClick={onCancel}>{tt('Отмена')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => onSave(note)}>{tt('Отметить выполненным')}</button>
        </div>
      </div>
    </div>
  );
}

function CreateTemplateModal({ busy, setBusy, onClose, onCreated, onError, inp, lbl, tt }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('morning');
  const [items, setItems] = useState([{ title: '', is_required: true, requires_photo: false }]);

  const setItem = (i, patch) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const addItem = () => setItems([...items, { title: '', is_required: true, requires_photo: false }]);
  const delItem = (i) => setItems(items.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!name.trim()) { onError(tt('Укажите название чеклиста')); return; }
    const clean = items.map(it => ({ ...it, title: it.title.trim() })).filter(it => it.title);
    if (!clean.length) { onError(tt('Добавьте хотя бы один пункт')); return; }
    setBusy(true);
    api.post('/checklists/templates', { name: name.trim(), type, items: clean })
      .then(onCreated)
      .catch(e => onError(e.response?.data?.error || e.message))
      .finally(() => setBusy(false));
  };

  return (
    <div style={overlay} onClick={() => !busy && onClose()}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{tt('Новый чеклист')}</div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div>
            <label style={lbl}>{tt('Название')}</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder={tt('Открытие магазина')} />
          </div>
          <div>
            <label style={lbl}>{tt('Тип')}</label>
            <select style={inp} value={type} onChange={e => setType(e.target.value)}>
              {Object.entries(TYPE_META).map(([k, m]) => <option key={k} value={k}>{tt(m.label)}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={lbl}>{tt('Пункты')}</label>
          <div className="list">
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text3)', width: 18, textAlign: 'right' }}>{i + 1}.</span>
                <input style={{ ...inp, flex: 1 }} value={it.title} onChange={e => setItem(i, { title: e.target.value })} placeholder={tt('Например: проверить кассу')} />
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text2)', whiteSpace: 'nowrap' }} title={tt('Обязательный пункт')}>
                  <input type="checkbox" checked={it.is_required} onChange={e => setItem(i, { is_required: e.target.checked })} />{tt('обяз.')}
                </label>
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text2)', whiteSpace: 'nowrap' }} title={tt('Требует фото')}>
                  <input type="checkbox" checked={it.requires_photo} onChange={e => setItem(i, { requires_photo: e.target.checked })} />📷
                </label>
                {items.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => delItem(i)}>✕</button>}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>{tt('+ Пункт')}</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost" disabled={busy} onClick={onClose}>{tt('Отмена')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{tt('Создать')}</button>
        </div>
      </div>
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modal = { background: 'var(--bg)', borderRadius: 16, padding: 22, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' };