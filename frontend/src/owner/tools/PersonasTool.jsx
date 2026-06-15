import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Card, Badge, PageHeader, Tile, EmptyState, Skeleton, fmtNum } from '../ui.jsx';
import { useTt } from '../tt.js';

const CHANNEL_OPTIONS = ['Instagram', 'Telegram', 'TikTok', 'Сарафан', 'Витрина', 'Маркетплейсы', 'Сайт', 'Холодные звонки', 'Другое'];
const BUDGET_OPTIONS = ['до 200К/мес', '200К-500К/мес', '500К-1М/мес', '1М-3М/мес', '3М+/мес'];

const empty = {
  name: '', age_range: '', gender: '', jtbd: '', pains: '', objections: '',
  channels: '', budget: '', notes: '',
};

export default function PersonasTool() {
  const { tt } = useTt();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try { setList((await api.get('/marketing/personas')).data || []); }
    catch (e) { setError(e.response?.data?.error || e.message); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const openNew = () => { setForm(empty); setEditing('new'); };
  const openEdit = (p) => {
    setForm({
      name: p.name || '', age_range: p.age_range || '', gender: p.gender || '',
      jtbd: p.jtbd || '', pains: p.pains || '', objections: p.objections || '',
      channels: p.channels || '', budget: p.budget || '', notes: p.notes || '',
    });
    setEditing(p.id);
  };
  const cancel = () => { setEditing(null); setForm(empty); };

  const save = async () => {
    if (!form.name.trim()) { setError(tt('Название обязательно')); return; }
    setSaving(true); setError(null);
    try {
      if (editing === 'new') await api.post('/marketing/personas', form);
      else await api.put('/marketing/personas/' + editing, form);
      cancel(); await reload();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    setSaving(false);
  };

  const remove = async (p) => {
    if (!confirm(`${tt('Удалить портрет')} "${p.name}"?`)) return;
    try { await api.delete('/marketing/personas/' + p.id); await reload(); }
    catch (e) { setError(e.response?.data?.error || e.message); }
  };

  return (
    <>
      <PageHeader
        title={tt('🎯 Анализ ЦА (JTBD · портреты · боли)')}
        sub={tt('Опиши своих покупателей: кто они, что хотят, что им мешает купить')}
        actions={
          <>
            <Badge tone="green">{tt('Live · CRUD')}</Badge>
            <button className="btn btn-primary btn-sm" onClick={openNew} disabled={editing !== null}>
              {tt('+ Добавить портрет')}
            </button>
          </>
        }
      />

      {error && (
        <Card style={{ marginBottom: 16, borderLeft: '4px solid var(--red)' }}>
          <div style={{ color: 'var(--red)', fontWeight: 700 }}>⚠️ {error}</div>
        </Card>
      )}

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Tile icon="👥" label={tt('Всего портретов')}  value={fmtNum(list.length)} sub={tt('ЦА-аватаров')} color="#EC4899" />
        <Tile icon="🎯" label={tt('С JTBD')}            value={fmtNum(list.filter(p => p.jtbd).length)} sub={tt('есть задача-кандидат')} color="#7C3AED" />
        <Tile icon="💔" label={tt('С болями')}          value={fmtNum(list.filter(p => p.pains).length)} sub={tt('описаны pain points')} color="#EF4444" />
      </div>

      {editing !== null && (
        <Card icon={editing === 'new' ? '➕' : '✏️'} title={editing === 'new' ? tt('Новый портрет ЦА') : tt('Редактирование портрета')}
          style={{ marginBottom: 16 }}
          actions={
            <>
              <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={saving}>{tt('Отмена')}</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? '...' : tt('💾 Сохранить')}</button>
            </>
          }>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label={tt('Название')} required value={form.name}
              onChange={v => setForm({ ...form, name: v })}
              placeholder={tt('Молодая мама 25-35 / Студент / Прораб...')} />
            <Field label={tt('Возраст')} value={form.age_range}
              onChange={v => setForm({ ...form, age_range: v })} placeholder="25-35" />
            <Field label={tt('Пол')} value={form.gender}
              onChange={v => setForm({ ...form, gender: v })}
              type="select" options={['', tt('Ж'), tt('М'), tt('Любой')]} />
            <Field label={tt('Бюджет на покупки')} value={form.budget}
              onChange={v => setForm({ ...form, budget: v })}
              type="select" options={['', ...BUDGET_OPTIONS.map(o => tt(o))]} />
            <Field label={tt('Каналы — где живёт')} value={form.channels}
              onChange={v => setForm({ ...form, channels: v })}
              placeholder={tt('Instagram, Telegram, сарафан')} hint={CHANNEL_OPTIONS.map(o => tt(o)).join(' · ')} />
            <Field label={tt('JTBD — что покупает')} value={form.jtbd}
              onChange={v => setForm({ ...form, jtbd: v })}
              placeholder={tt('«Чтобы быстро купить подарок ребёнку, не выходя из дома»')}
              multiline />
          </div>
          <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
            <Field label={tt('Боли / страхи')} value={form.pains}
              onChange={v => setForm({ ...form, pains: v })}
              placeholder={tt('«Боится переплатить · нет времени на сравнение»')} multiline />
            <Field label={tt('Возражения')} value={form.objections}
              onChange={v => setForm({ ...form, objections: v })}
              placeholder={tt('«Дорого · долго ждать доставку · не уверен в качестве»')} multiline />
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label={tt('Примечание')} value={form.notes}
              onChange={v => setForm({ ...form, notes: v })}
              placeholder={tt('Любые наблюдения о ЦА')} multiline />
          </div>
        </Card>
      )}

      {loading ? (
        <div className="grid-3">
          {[0,1,2].map(i => (
            <div key={i} className="card" style={{ padding: 18 }}>
              <Skeleton height={20} style={{ width: '60%', marginBottom: 10 }} />
              <Skeleton height={12} style={{ marginBottom: 8 }} />
              <Skeleton height={12} style={{ marginBottom: 8 }} />
              <Skeleton height={12} style={{ width: '70%' }} />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon="🎯"
          title={tt('Портретов ЦА ещё нет')}
          description={tt('Опиши хотя бы 3 портрета — это база любого маркетинга. Кто твой покупатель? Что у него болит? Где он живёт онлайн? Это поможет писать контент, скрипты продаж и таргет.')}
          action={<button className="btn btn-primary" onClick={openNew}>{tt('+ Создать первый портрет')}</button>}
        />
      ) : (
        <div className="grid-3">
          {list.map(p => (
            <Card key={p.id} style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>👤 {p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {p.age_range || '—'}{p.gender ? ' · ' + p.gender : ''}{p.budget ? ' · ' + p.budget : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="action-btn action-btn-edit" onClick={() => openEdit(p)} title={tt('Редактировать')}>✏️</button>
                  <button className="action-btn action-btn-del" onClick={() => remove(p)} title={tt('Удалить')}>🗑</button>
                </div>
              </div>
              {p.jtbd && <CardLine icon="🎯" label={tt('JTBD')} text={p.jtbd} />}
              {p.pains && <CardLine icon="💔" label={tt('Боли')} text={p.pains} />}
              {p.objections && <CardLine icon="🛑" label={tt('Возражения')} text={p.objections} />}
              {p.channels && <CardLine icon="📡" label={tt('Каналы')} text={p.channels} />}
              {p.notes && <CardLine icon="📝" label={tt('Прим')} text={p.notes} />}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, placeholder, required, multiline, type, options, hint }) {
  const { tt } = useTt();
  return (
    <div>
      <label className={'label' + (required ? ' required' : '')}>{label}</label>
      {type === 'select' ? (
        <select className="input" value={value} onChange={e => onChange(e.target.value)}>
          {(options || []).map(o => <option key={o} value={o}>{o || tt('— не указано —')}</option>)}
        </select>
      ) : multiline ? (
        <textarea className="input" rows={3} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} style={{ resize: 'vertical', minHeight: 70, fontFamily: 'inherit', lineHeight: 1.5 }} />
      ) : (
        <input className="input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>💡 {hint}</div>}
    </div>
  );
}

function CardLine({ icon, label, text }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5, marginTop: 2 }}>{text}</div>
      </div>
    </div>
  );
}
