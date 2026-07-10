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

export default function NpsReviewsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('all');
  const [type, setType] = useState('all');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    if (source !== 'all') params.source = source;
    if (type !== 'all') params.type = type;
    api.get('/nps/reviews', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, source, type]);

  const reviews = data?.reviews || [];
  const b = data?.breakdown || { promoters: 0, passives: 0, detractors: 0, total: 0 };

  return (
    <>
      <PageHeader
        title={tt('⭐ NPS и отзывы')}
        sub={tt('Индекс лояльности · NPS = %промоутеров(9–10) − %критиков(0–6)')}
        actions={<Badge tone="green">{tt('Live')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

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
