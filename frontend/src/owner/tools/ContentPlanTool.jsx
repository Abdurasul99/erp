import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api.js';
import { Card, Badge, PageHeader, Tile, Pills, EmptyState, Skeleton, fmtNum } from '../ui.jsx';

const PLATFORM_META = {
  instagram: { icon: '📷', label: 'Instagram', color: '#E1306C' },
  telegram:  { icon: '✈️', label: 'Telegram',  color: '#0088CC' },
  tiktok:    { icon: '🎵', label: 'TikTok',    color: '#000000' },
  youtube:   { icon: '▶️', label: 'YouTube',   color: '#FF0000' },
  facebook:  { icon: '👍', label: 'Facebook',  color: '#1877F2' },
  email:     { icon: '📧', label: 'Email',     color: '#5B4FE8' },
  sms:       { icon: '💬', label: 'SMS',       color: '#22C55E' },
  website:   { icon: '🌐', label: 'Сайт',      color: '#6B7280' },
  other:     { icon: '📌', label: 'Другое',     color: '#9094B0' },
};

const FORMAT_META = {
  post: 'Пост', reels: 'Reels', story: 'Story', video: 'Видео',
  photo: 'Фото', carousel: 'Карусель', article: 'Статья',
  email: 'Письмо', sms: 'SMS', live: 'Эфир', other: 'Другое',
};

const STATUS_META = {
  planned:     { label: '📅 Запланировано', tone: 'blue' },
  in_progress: { label: '⏳ В работе',       tone: 'yellow' },
  published:   { label: '✅ Опубликовано',   tone: 'green' },
  cancelled:   { label: '🚫 Отменено',       tone: 'gray' },
};

const empty = {
  title: '', platform: 'instagram', format: 'post',
  scheduled_for: '', status: 'planned', persona_id: '',
  hook: '', body: '', cta: '', notes: '',
};

const FILTERS = [
  { value: 'all',         label: 'Все' },
  { value: 'planned',     label: '📅 Планы' },
  { value: 'in_progress', label: '⏳ В работе' },
  { value: 'published',   label: '✅ Опублик.' },
];

export default function ContentPlanTool() {
  const [list, setList] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const reload = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        api.get('/marketing/content'),
        api.get('/marketing/personas'),
      ]);
      setList(c.data || []);
      setPersonas(p.data || []);
    } catch (e) { setError(e.response?.data?.error || e.message); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return list;
    return list.filter(c => c.status === statusFilter);
  }, [list, statusFilter]);

  const summary = useMemo(() => ({
    total: list.length,
    planned: list.filter(c => c.status === 'planned').length,
    in_progress: list.filter(c => c.status === 'in_progress').length,
    published: list.filter(c => c.status === 'published').length,
    this_week: list.filter(c => {
      if (!c.scheduled_for) return false;
      const days = (new Date(c.scheduled_for) - new Date()) / 86400000;
      return days >= 0 && days <= 7;
    }).length,
  }), [list]);

  const openNew = () => {
    setForm({ ...empty, scheduled_for: new Date().toISOString().slice(0, 10) });
    setEditing('new');
  };
  const openEdit = (c) => {
    setForm({
      title: c.title || '', platform: c.platform || 'instagram', format: c.format || 'post',
      scheduled_for: c.scheduled_for ? c.scheduled_for.slice(0, 10) : '',
      status: c.status || 'planned', persona_id: c.persona_id || '',
      hook: c.hook || '', body: c.body || '', cta: c.cta || '', notes: c.notes || '',
    });
    setEditing(c.id);
  };
  const cancel = () => { setEditing(null); setForm(empty); };

  const save = async () => {
    if (!form.title.trim()) { setError('Заголовок обязателен'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        ...form,
        scheduled_for: form.scheduled_for || null,
        persona_id: form.persona_id || null,
      };
      if (editing === 'new') await api.post('/marketing/content', payload);
      else await api.put('/marketing/content/' + editing, payload);
      cancel(); await reload();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    setSaving(false);
  };

  const remove = async (c) => {
    if (!confirm(`Удалить запись "${c.title}"?`)) return;
    try { await api.delete('/marketing/content/' + c.id); await reload(); }
    catch (e) { setError(e.response?.data?.error || e.message); }
  };

  const setStatusQuick = async (c, status) => {
    try { await api.put('/marketing/content/' + c.id, { status }); await reload(); }
    catch (e) { setError(e.response?.data?.error || e.message); }
  };

  return (
    <>
      <PageHeader
        title="📝 Контент-план"
        sub="Календарь публикаций · хук · CTA · привязка к ЦА"
        actions={
          <>
            <Badge tone="green">Live · CRUD</Badge>
            <button className="btn btn-primary btn-sm" onClick={openNew} disabled={editing !== null}>
              + Запланировать
            </button>
          </>
        }
      />

      {error && (
        <Card style={{ marginBottom: 16, borderLeft: '4px solid var(--red)' }}>
          <div style={{ color: 'var(--red)', fontWeight: 700 }}>⚠️ {error}</div>
        </Card>
      )}

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Tile icon="📝" label="Всего"          value={fmtNum(summary.total)}       sub="публикаций"         color="#EC4899" />
        <Tile icon="📅" label="Запланировано" value={fmtNum(summary.planned)}     sub="ждут"               color="#5B4FE8" />
        <Tile icon="⏳" label="В работе"       value={fmtNum(summary.in_progress)} sub="готовится"          color="#F59E0B" />
        <Tile icon="✅" label="На этой неделе" value={fmtNum(summary.this_week)}   sub="выйдет ≤ 7 дней"    color="#22C55E" />
      </div>

      {editing !== null && (
        <Card icon={editing === 'new' ? '➕' : '✏️'} title={editing === 'new' ? 'Новая публикация' : 'Редактирование'}
          style={{ marginBottom: 16 }}
          actions={
            <>
              <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={saving}>Отмена</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? '...' : '💾 Сохранить'}</button>
            </>
          }>
          <Field label="Заголовок / тема" required value={form.title}
            onChange={v => setForm({ ...form, title: v })}
            placeholder="«5 идей зимних подарков» или «Распаковка нового товара»" />
          <div className="grid-3" style={{ gap: 14, marginTop: 14 }}>
            <Field label="Платформа" value={form.platform}
              onChange={v => setForm({ ...form, platform: v })} type="select"
              options={Object.keys(PLATFORM_META).map(k => ({ value: k, label: PLATFORM_META[k].icon + ' ' + PLATFORM_META[k].label }))} />
            <Field label="Формат" value={form.format}
              onChange={v => setForm({ ...form, format: v })} type="select"
              options={Object.keys(FORMAT_META).map(k => ({ value: k, label: FORMAT_META[k] }))} />
            <Field label="Когда" value={form.scheduled_for}
              onChange={v => setForm({ ...form, scheduled_for: v })} type="date" />
          </div>
          <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
            <Field label="Статус" value={form.status}
              onChange={v => setForm({ ...form, status: v })} type="select"
              options={Object.keys(STATUS_META).map(k => ({ value: k, label: STATUS_META[k].label }))} />
            <Field label="Для какой ЦА" value={form.persona_id}
              onChange={v => setForm({ ...form, persona_id: v })} type="select"
              options={[{ value: '', label: '— не указана —' },
                ...personas.map(p => ({ value: String(p.id), label: '👤 ' + p.name }))]} />
          </div>
          <Field label="🎣 Hook (первые 3 секунды)" value={form.hook}
            onChange={v => setForm({ ...form, hook: v })}
            placeholder="«А вы знали что 80% покупателей выбирают глазами?»"
            multiline style={{ marginTop: 14 }} />
          <Field label="📖 Основной текст / структура" value={form.body}
            onChange={v => setForm({ ...form, body: v })}
            placeholder="AIDA / PAS / 4U · покажи проблему → агитация → решение"
            multiline style={{ marginTop: 14 }} />
          <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
            <Field label="🎯 CTA (что сделать читателю)" value={form.cta}
              onChange={v => setForm({ ...form, cta: v })}
              placeholder="«Пиши «хочу» в комменты» / «Заходи на сайт»" multiline />
            <Field label="📝 Примечание / референсы" value={form.notes}
              onChange={v => setForm({ ...form, notes: v })}
              placeholder="Ссылки на конкурентов, идеи кадров..." multiline />
          </div>
        </Card>
      )}

      <Card icon="📅" title={`Список (${filtered.length})`}
        actions={<Pills value={statusFilter} onChange={setStatusFilter} options={FILTERS} />}>
        {loading ? (
          <div className="list">
            {[0,1,2,3].map(i => <Skeleton key={i} height={40} style={{ marginBottom: 8 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="📝"
            title="Публикаций ещё нет"
            description="Запланируй хотя бы 5 публикаций на ближайшую неделю — Reels, посты, истории. Контент-план превращает «я не успеваю» в «у меня всё по графику»."
            action={<button className="btn btn-primary" onClick={openNew}>+ Запланировать первую</button>}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Платформа</th>
                  <th>Формат</th>
                  <th>Заголовок</th>
                  <th>ЦА</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const meta = PLATFORM_META[c.platform] || PLATFORM_META.other;
                  const status = STATUS_META[c.status] || STATUS_META.planned;
                  return (
                    <tr key={c.id}>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {c.scheduled_for ? new Date(c.scheduled_for).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td><span title={meta.label} style={{ fontSize: 16 }}>{meta.icon}</span> <span style={{ fontSize: 12, color: 'var(--text2)' }}>{meta.label}</span></td>
                      <td style={{ fontSize: 12 }}>{FORMAT_META[c.format] || c.format}</td>
                      <td style={{ fontWeight: 700 }}>{c.title}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.persona_name ? '👤 ' + c.persona_name : '—'}</td>
                      <td><Badge tone={status.tone}>{status.label}</Badge></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {c.status !== 'published' && (
                            <button className="action-btn action-btn-ok"
                              onClick={() => setStatusQuick(c, 'published')}
                              title="Отметить опубликованным">✅</button>
                          )}
                          <button className="action-btn action-btn-edit" onClick={() => openEdit(c)} title="Редактировать">✏️</button>
                          <button className="action-btn action-btn-del" onClick={() => remove(c)} title="Удалить">🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Field({ label, value, onChange, placeholder, required, multiline, type, options, style }) {
  if (type === 'select') {
    return (
      <div style={style}>
        <label className={'label' + (required ? ' required' : '')}>{label}</label>
        <select className="input" value={value} onChange={e => onChange(e.target.value)}>
          {(options || []).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }
  if (type === 'date') {
    return (
      <div style={style}>
        <label className={'label' + (required ? ' required' : '')}>{label}</label>
        <input className="input" type="date" value={value} onChange={e => onChange(e.target.value)} />
      </div>
    );
  }
  if (multiline) {
    return (
      <div style={style}>
        <label className={'label' + (required ? ' required' : '')}>{label}</label>
        <textarea className="input" rows={3} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} style={{ resize: 'vertical', minHeight: 70, fontFamily: 'inherit', lineHeight: 1.5 }} />
      </div>
    );
  }
  return (
    <div style={style}>
      <label className={'label' + (required ? ' required' : '')}>{label}</label>
      <input className="input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
