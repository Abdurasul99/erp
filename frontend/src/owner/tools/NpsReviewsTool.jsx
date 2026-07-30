import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// NPS = % промоутеров(9-10) − % критиков(0-6). Считается на сервере по отзывам.
// Источник данных: магазины, онлайн-магазин, Telegram, ручной ввод.

const SOURCE_OPTS = [
  { value: 'all',      label: 'Все источники' },
  { value: 'store',    label: 'Магазин' },
  { value: 'online',   label: 'Онлайн' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'manual',   label: 'Вручную' },
];

const TYPE_OPTS = [
  { value: 'all',       label: 'Все типы' },
  { value: 'vip',       label: 'VIP' },
  { value: 'regular',   label: 'Постоянный' },
  { value: 'onetime',   label: 'Разовый' },
  { value: 'anonymous', label: 'Аноним' },
];

const TYPE_LABEL = {
  vip: 'VIP', regular: 'Постоянный', onetime: 'Разовый', anonymous: 'Аноним',
};
const SOURCE_LABEL = {
  store: 'Магазин', online: 'Онлайн', telegram: 'Telegram', manual: 'Вручную',
};

function scoreColor(s) {
  if (s >= 9) return '#16A34A';
  if (s >= 7) return '#D97706';
  return '#DC2626';
}

// Полоска промоутеры/нейтралы/критики
function NpsBar({ promoters, passives, detractors, total, tt }) {
  const t = total || 1;
  const p = (promoters / t) * 100, n = (passives / t) * 100, d = (detractors / t) * 100;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', height: 14, borderRadius: 99, overflow: 'hidden', background: 'var(--border)' }}>
        <div style={{ width: p + '%', background: '#16A34A' }} />
        <div style={{ width: n + '%', background: '#D97706' }} />
        <div style={{ width: d + '%', background: '#DC2626' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, fontWeight: 700 }}>
        <span style={{ color: '#16A34A' }}>● {fmtNum(promoters)} {tt('промоутеры (9–10)')}</span>
        <span style={{ color: '#D97706' }}>● {fmtNum(passives)} {tt('нейтралы (7–8)')}</span>
        <span style={{ color: '#DC2626' }}>● {fmtNum(detractors)} {tt('критики (0–6)')}</span>
      </div>
    </div>
  );
}

// Форма ручного добавления отзыва (source='manual' на сервере по умолчанию).
const EMPTY_REVIEW = { score: null, comment: '', type: 'regular', is_anonymous: false };

export default function NpsReviewsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('all');
  const [type, setType] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_REVIEW);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    if (source !== 'all') params.source = source;
    if (type !== 'all') params.type = type;
    api.get('/nps/reviews', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [branchId, source, type]);

  const saveReview = () => {
    if (form.score == null) return;
    setSaving(true);
    api.post('/nps/reviews', {
      score: form.score,
      comment: form.comment.trim() || null,
      type: form.is_anonymous ? 'anonymous' : form.type,
      is_anonymous: form.is_anonymous,
      source: 'manual',
      branch_id: branchId || undefined,
    })
      .then(() => { setForm(EMPTY_REVIEW); setShowAdd(false); load(); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setSaving(false));
  };

  const reviews = data?.reviews || [];
  const b = data?.breakdown || { promoters: 0, passives: 0, detractors: 0, total: 0 };

  return (
    <>
      <PageHeader
        title={tt('⭐ NPS и отзывы')}
        sub={tt('Индекс лояльности · NPS = %промоутеров(9–10) − %критиков(0–6)')}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge tone="green">{tt('Live')}</Badge>
            <button className="btn-primary" onClick={() => setShowAdd(v => !v)}
              style={{ padding: '7px 14px', fontSize: 13, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: showAdd ? 'var(--border)' : 'linear-gradient(135deg,#0A84FF,#5E5CE6)', color: showAdd ? 'var(--text2)' : '#fff' }}>
              {showAdd ? tt('Закрыть') : '＋ ' + tt('Добавить отзыв')}
            </button>
          </div>
        }
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {showAdd && (
        <Card icon="✍️" title={tt('Новый отзыв')} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Оценка')} (0–10)</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {Array.from({ length: 11 }, (_, i) => i).map(n => (
                  <button key={n} type="button" onClick={() => setForm(f => ({ ...f, score: n }))}
                    style={{
                      width: 34, height: 34, borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer',
                      border: form.score === n ? '2px solid ' + scoreColor(n) : '1.5px solid var(--border)',
                      background: form.score === n ? scoreColor(n) + '18' : '#fff',
                      color: form.score === n ? scoreColor(n) : 'var(--text2)',
                    }}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{ minWidth: 150 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Тип клиента')}</div>
              <select className="input" value={form.type} disabled={form.is_anonymous}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 9, border: '1.5px solid var(--border)', fontSize: 13, minWidth: 150 }}>
                <option value="vip">{tt('VIP')}</option>
                <option value="regular">{tt('Постоянный')}</option>
                <option value="onetime">{tt('Разовый')}</option>
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', paddingBottom: 8 }}>
              <input type="checkbox" checked={form.is_anonymous}
                onChange={e => setForm(f => ({ ...f, is_anonymous: e.target.checked }))} />
              {tt('Аноним')}
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{tt('Комментарий')}</div>
            <textarea className="input" value={form.comment}
              onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
              placeholder={tt('Что сказал клиент?')} rows={2}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={saveReview} disabled={form.score == null || saving}
              style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700, borderRadius: 10, border: 'none',
                cursor: form.score == null || saving ? 'not-allowed' : 'pointer', opacity: form.score == null || saving ? 0.55 : 1,
                background: 'linear-gradient(135deg,#0A84FF,#5E5CE6)', color: '#fff' }}>
              {saving ? tt('Сохранение…') : tt('Сохранить отзыв')}
            </button>
            <button onClick={() => { setForm(EMPTY_REVIEW); setShowAdd(false); }}
              style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700, borderRadius: 10, border: '1.5px solid var(--border)', cursor: 'pointer', background: '#fff', color: 'var(--text2)' }}>
              {tt('Отмена')}
            </button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📊" label={tt('Общий NPS')} value={data?.nps == null ? '—' : data.nps} sub={tt('по всем отзывам')} color="var(--primary)" />
            <Tile icon="💎" label={tt('NPS лояльных')} value={data?.nps_loyal == null ? '—' : data.nps_loyal} sub={tt('VIP + постоянные')} color="#16A34A" />
            <Tile icon="🆕" label={tt('NPS разовых')} value={data?.nps_onetime == null ? '—' : data.nps_onetime} sub={tt('новые + анонимы')} color="#1D4ED8" />
            <Tile icon="⚠️" label={tt('Критики')} value={fmtNum(b.detractors)} sub={tt('оценка 0–6 · внимание')} color="#DC2626" />
          </div>

          <Card icon="🎯" title={tt('Структура NPS')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <div className="mono" style={{ fontSize: 44, fontWeight: 900, color: 'var(--primary)' }}>
                {data?.nps == null ? '—' : data.nps}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                {tt('из')} {fmtNum(b.total)} {tt('отзывов')}
              </div>
            </div>
            <NpsBar promoters={b.promoters} passives={b.passives} detractors={b.detractors} total={b.total} tt={tt} />
          </Card>

          <Card
            icon="💬"
            title={`${tt('Отзывы')} (${reviews.length})`}
            actions={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Pills value={source} onChange={setSource} options={SOURCE_OPTS.map(o => ({ ...o, label: tt(o.label) }))} />
                <Pills value={type} onChange={setType} options={TYPE_OPTS.map(o => ({ ...o, label: tt(o.label) }))} />
              </div>
            }
          >
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Дата')}</th>
                    <th>{tt('Клиент')}</th>
                    <th>{tt('Тип')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Оценка')}</th>
                    <th>{tt('Комментарий')}</th>
                    <th>{tt('Источник')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет отзывов')}</td></tr>
                  ) : reviews.slice(0, 200).map(r => (
                    <tr key={r.id}>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString('ru-RU') : '—'}
                      </td>
                      <td style={{ fontWeight: 700 }}>{r.is_anonymous ? tt('Аноним') : (r.customer_name || tt('Гость'))}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{tt(TYPE_LABEL[r.type] || r.type || '—')}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ background: scoreColor(r.score) + '20', color: scoreColor(r.score), padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 13 }}>
                          {r.score}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--text2)', maxWidth: 320 }}>{r.comment || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text3)' }}>{tt(SOURCE_LABEL[r.source] || r.source || '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
