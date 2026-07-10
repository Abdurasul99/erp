import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api.js';
import { Card, Badge, PageHeader, Tile, Pills, EmptyState, Skeleton, fmtNum } from '../ui.jsx';
import { useTt, fmtDate } from '../tt.js';

const PLATFORM_META = {
  instagram: { icon: '📷', label: 'Instagram', color: '#E1306C' },
  telegram:  { icon: '✈️', label: 'Telegram',  color: '#0088CC' },
  tiktok:    { icon: '🎵', label: 'TikTok',    color: '#000000' },
  youtube:   { icon: '▶️', label: 'YouTube',   color: '#FF0000' },
  facebook:  { icon: '👍', label: 'Facebook',  color: '#1877F2' },
  email:     { icon: '📧', label: 'Email',     color: '#1D4ED8' },
  sms:       { icon: '💬', label: 'SMS',       color: '#16A34A' },
  website:   { icon: '🌐', label: 'Сайт',      color: '#6B7280' },
  other:     { icon: '📌', label: 'Другое',     color: '#94A0B5' },
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

// Воронка контента: TOFU (привлечение) → MOFU (вовлечение) → BOFU (продажа)
const FUNNEL_META = {
  tofu: { label: 'TOFU · Привлечение', short: 'TOFU', tone: 'blue',   hint: 'Знакомят с брендом, охват' },
  mofu: { label: 'MOFU · Вовлечение',  short: 'MOFU', tone: 'yellow', hint: 'Прогрев, доверие, польза' },
  bofu: { label: 'BOFU · Продажа',     short: 'BOFU', tone: 'green',  hint: 'Призыв купить, оффер' },
};

const empty = {
  title: '', platform: 'instagram', format: 'post',
  scheduled_for: '', status: 'planned', persona_id: '',
  hook: '', body: '', cta: '', notes: '',
  funnel_stage: '', reference_link: '',
  plan_views: '', plan_likes: '', plan_comments: '',
  fact_views: '', fact_likes: '', fact_comments: '', analysis: '',
};

const FILTERS = [
  { value: 'all',         label: 'Все' },
  { value: 'tofu',        label: 'TOFU' },
  { value: 'mofu',        label: 'MOFU' },
  { value: 'bofu',        label: 'BOFU' },
  { value: 'published',   label: '✅ Опублик.' },
];

export default function ContentPlanTool() {
  const { tt, lang } = useTt();
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
    if (['tofu', 'mofu', 'bofu'].includes(statusFilter)) return list.filter(c => c.funnel_stage === statusFilter);
    return list.filter(c => c.status === statusFilter);
  }, [list, statusFilter]);

  const summary = useMemo(() => ({
    total: list.length,
    tofu: list.filter(c => c.funnel_stage === 'tofu').length,
    mofu: list.filter(c => c.funnel_stage === 'mofu').length,
    bofu: list.filter(c => c.funnel_stage === 'bofu').length,
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
      funnel_stage: c.funnel_stage || '', reference_link: c.reference_link || '',
      plan_views: c.plan_views ?? '', plan_likes: c.plan_likes ?? '', plan_comments: c.plan_comments ?? '',
      fact_views: c.fact_views ?? '', fact_likes: c.fact_likes ?? '', fact_comments: c.fact_comments ?? '',
      analysis: c.analysis || '',
    });
    setEditing(c.id);
  };
  const cancel = () => { setEditing(null); setForm(empty); };

  const save = async () => {
    if (!form.title.trim()) { setError(tt('Заголовок обязателен')); return; }
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
    if (!confirm(`${tt('Удалить запись')} "${c.title}"?`)) return;
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
        title={tt('🎬 Конструктор контента')}
        sub={tt('Воронка TOFU/MOFU/BOFU · план/факт · анализ после публикации')}
        actions={
          <>
            <Badge tone="green">Live · CRUD</Badge>
            <button className="btn btn-primary btn-sm" onClick={openNew} disabled={editing !== null}>
              + {tt('Запланировать')}
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
        <Tile icon="📝" label={tt('Всего публикаций')} value={fmtNum(summary.total)} sub={tt('в плане')}          color="#EC4899" />
        <Tile icon="🔵" label="TOFU"             value={fmtNum(summary.tofu)} sub={tt('привлечение')}      color="#1D4ED8" />
        <Tile icon="🟡" label="MOFU"             value={fmtNum(summary.mofu)} sub={tt('вовлечение')}       color="#D97706" />
        <Tile icon="🟢" label="BOFU"             value={fmtNum(summary.bofu)} sub={tt('продажа')}          color="#16A34A" />
      </div>

      {editing !== null && (
        <Card icon={editing === 'new' ? '➕' : '✏️'} title={editing === 'new' ? tt('Новая публикация') : tt('Редактирование')}
          style={{ marginBottom: 16 }}
          actions={
            <>
              <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={saving}>{tt('Отмена')}</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? '...' : '💾 ' + tt('Сохранить')}</button>
            </>
          }>
          <Field label={tt('Заголовок / тема')} required value={form.title}
            onChange={v => setForm({ ...form, title: v })}
            placeholder={tt('«5 идей зимних подарков» или «Распаковка нового товара»')} />
          <div className="grid-3" style={{ gap: 14, marginTop: 14 }}>
            <Field label={tt('Платформа')} value={form.platform}
              onChange={v => setForm({ ...form, platform: v })} type="select"
              options={Object.keys(PLATFORM_META).map(k => ({ value: k, label: PLATFORM_META[k].icon + ' ' + tt(PLATFORM_META[k].label) }))} />
            <Field label={tt('Формат')} value={form.format}
              onChange={v => setForm({ ...form, format: v })} type="select"
              options={Object.keys(FORMAT_META).map(k => ({ value: k, label: tt(FORMAT_META[k]) }))} />
            <Field label={tt('Когда')} value={form.scheduled_for}
              onChange={v => setForm({ ...form, scheduled_for: v })} type="date" />
          </div>
          <div className="grid-3" style={{ gap: 14, marginTop: 14 }}>
            <Field label={tt('🎯 Стадия воронки')} value={form.funnel_stage}
              onChange={v => setForm({ ...form, funnel_stage: v })} type="select"
              options={[{ value: '', label: tt('— не указана —') },
                ...Object.keys(FUNNEL_META).map(k => ({ value: k, label: tt(FUNNEL_META[k].label) }))]} />
            <Field label={tt('Статус')} value={form.status}
              onChange={v => setForm({ ...form, status: v })} type="select"
              options={Object.keys(STATUS_META).map(k => ({ value: k, label: tt(STATUS_META[k].label) }))} />
            <Field label={tt('Для какой ЦА')} value={form.persona_id}
              onChange={v => setForm({ ...form, persona_id: v })} type="select"
              options={[{ value: '', label: tt('— не указана —') },
                ...personas.map(p => ({ value: String(p.id), label: '👤 ' + p.name }))]} />
          </div>
          <Field label={tt('🎣 Hook (первые 3 секунды)')} value={form.hook}
            onChange={v => setForm({ ...form, hook: v })}
            placeholder={tt('«А вы знали что 80% покупателей выбирают глазами?»')}
            multiline style={{ marginTop: 14 }} />
          <Field label={tt('📖 Основной текст / структура')} value={form.body}
            onChange={v => setForm({ ...form, body: v })}
            placeholder={tt('AIDA / PAS / 4U · покажи проблему → агитация → решение')}
            multiline style={{ marginTop: 14 }} />
          <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
            <Field label={tt('🎯 CTA (что сделать читателю)')} value={form.cta}
              onChange={v => setForm({ ...form, cta: v })}
              placeholder={tt('«Пиши «хочу» в комменты» / «Заходи на сайт»')} multiline />
            <Field label={tt('🔗 Референс / ссылка на пост')} value={form.reference_link}
              onChange={v => setForm({ ...form, reference_link: v })}
              placeholder={tt('https://instagram.com/... или идея-референс')} />
          </div>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border, #E3EAF3)' }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>📊 {tt('Метрики: план vs факт')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 10, alignItems: 'center', fontSize: 12 }}>
              <div></div>
              <div style={{ fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>👁 {tt('Просмотры')}</div>
              <div style={{ fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>❤️ {tt('Лайки')}</div>
              <div style={{ fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>💬 {tt('Комменты')}</div>
              <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{tt('План')}</div>
              <input className="input" type="number" min="0" value={form.plan_views} onChange={e => setForm({ ...form, plan_views: e.target.value })} placeholder="0" />
              <input className="input" type="number" min="0" value={form.plan_likes} onChange={e => setForm({ ...form, plan_likes: e.target.value })} placeholder="0" />
              <input className="input" type="number" min="0" value={form.plan_comments} onChange={e => setForm({ ...form, plan_comments: e.target.value })} placeholder="0" />
              <div style={{ fontWeight: 700, color: 'var(--green)' }}>{tt('Факт')}</div>
              <input className="input" type="number" min="0" value={form.fact_views} onChange={e => setForm({ ...form, fact_views: e.target.value })} placeholder="0" />
              <input className="input" type="number" min="0" value={form.fact_likes} onChange={e => setForm({ ...form, fact_likes: e.target.value })} placeholder="0" />
              <input className="input" type="number" min="0" value={form.fact_comments} onChange={e => setForm({ ...form, fact_comments: e.target.value })} placeholder="0" />
            </div>
            <Field label={tt('🔍 Разбор: что залетело / что нет / почему')} value={form.analysis}
              onChange={v => setForm({ ...form, analysis: v })}
              placeholder={tt('«Хук про экономию зашёл — досмотры 80%. CTA слабый, мало комментов. В следующий раз вопрос в конце.»')}
              multiline style={{ marginTop: 14 }} />
          </div>
        </Card>
      )}

      <Card icon="📅" title={`${tt('Список')} (${filtered.length})`}
        actions={<Pills value={statusFilter} onChange={setStatusFilter} options={FILTERS.map(f => ({ ...f, label: tt(f.label) }))} />}>
        {loading ? (
          <div className="list">
            {[0,1,2,3].map(i => <Skeleton key={i} height={40} style={{ marginBottom: 8 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="📝"
            title={tt('Публикаций ещё нет')}
            description={tt('Запланируй хотя бы 5 публикаций на ближайшую неделю — Reels, посты, истории. Контент-план превращает «я не успеваю» в «у меня всё по графику».')}
            action={<button className="btn btn-primary" onClick={openNew}>+ {tt('Запланировать первую')}</button>}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{tt('Дата')}</th>
                  <th>{tt('Воронка')}</th>
                  <th>{tt('Платформа')}</th>
                  <th>{tt('Заголовок')}</th>
                  <th>{tt('Результат')}</th>
                  <th>{tt('Статус')}</th>
                  <th>{tt('Действия')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const meta = PLATFORM_META[c.platform] || PLATFORM_META.other;
                  const status = STATUS_META[c.status] || STATUS_META.planned;
                  const fn = FUNNEL_META[c.funnel_stage];
                  const hasFact = c.fact_views != null || c.fact_likes != null;
                  const hit = hasFact && c.plan_views != null && (c.fact_views || 0) >= (c.plan_views || 0);
                  return (
                    <tr key={c.id}>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {c.scheduled_for ? fmtDate(c.scheduled_for, { day: 'numeric', month: 'short' }, lang) : '—'}
                      </td>
                      <td>{fn ? <Badge tone={fn.tone}>{fn.short}</Badge> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td><span title={tt(meta.label)} style={{ fontSize: 16 }}>{meta.icon}</span> <span style={{ fontSize: 12, color: 'var(--text2)' }}>{FORMAT_META[c.format] ? tt(FORMAT_META[c.format]) : c.format}</span></td>
                      <td style={{ fontWeight: 700 }}>{c.title}{c.persona_name && <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>👤 {c.persona_name}</div>}</td>
                      <td style={{ fontSize: 12 }}>
                        {hasFact ? (
                          <span title={`${tt('План просмотров:')} ${fmtNum(c.plan_views || 0)}`}>
                            <Badge tone={hit ? 'green' : 'red'}>{hit ? '🔥 ' + tt('залетело') : '📉 ' + tt('не зашло')}</Badge>
                            <div style={{ color: 'var(--text3)', marginTop: 2 }}>👁 {fmtNum(c.fact_views || 0)} · ❤️ {fmtNum(c.fact_likes || 0)}</div>
                          </span>
                        ) : c.plan_views != null ? (
                          <span style={{ color: 'var(--text3)' }}>{tt('план')} 👁 {fmtNum(c.plan_views)}</span>
                        ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td><Badge tone={status.tone}>{tt(status.label)}</Badge></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {c.status !== 'published' && (
                            <button className="action-btn action-btn-ok"
                              onClick={() => setStatusQuick(c, 'published')}
                              title={tt('Отметить опубликованным')}>✅</button>
                          )}
                          <button className="action-btn action-btn-edit" onClick={() => openEdit(c)} title={tt('Редактировать')}>✏️</button>
                          <button className="action-btn action-btn-del" onClick={() => remove(c)} title={tt('Удалить')}>🗑</button>
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
