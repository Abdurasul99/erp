import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { Modal, toast } from '../Modal.jsx';
import { useTt } from '../tt.js';

const PERIODS = [
  { value: 'day',   label: 'День' },
  { value: 'week',  label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year',  label: 'Год' },
];

// Цвет ступени по индексу (градиент сверху воронки вниз).
const STAGE_COLORS = ['#1D4ED8', '#3B82F6', '#0EA5E9', '#16A34A', '#D97706', '#F97316'];

// Показы и посетители — счётные целые, стейт СТРОКА. type="number" возвращал ''
// на промежуточно-невалидном вводе («120 000» с пробелом из буфера, запятая),
// из-за чего контролируемое поле само себя очищало. Поэтому type="text" + чистка
// цифр в onChange; 9 цифр — предел INTEGER в funnel_inputs.
const digitsOnly = (v) => String(v ?? '').replace(/[^\d]/g, '').slice(0, 9);
// Нормализация на blur, а не в onChange (иначе не стереть первую цифру): «007» → «7».
const normCount = (v) => (v === '' ? '' : String(parseInt(v, 10) || 0));

// Тон конверсии для Badge: <15% красный, <40% жёлтый, иначе зелёный.
function convTone(pct) {
  if (pct == null) return 'gray';
  if (pct < 15) return 'red';
  if (pct < 40) return 'yellow';
  return 'green';
}

// Цвет текста по тону. Жёлтый берём именно из --yellow: внутри .owner-shell
// переменная --orange переопределена в СИНИЙ, и предупредительная зона
// конверсии печаталась синим, то есть читалась как нейтральная.
function convTextColor(pct) {
  const t = convTone(pct);
  if (t === 'green') return 'var(--green, var(--text2))';
  if (t === 'red') return 'var(--red, var(--text2))';
  if (t === 'yellow') return 'var(--yellow, var(--text2))';
  return 'var(--text3)';
}

export default function BusinessFunnelTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('month');
  const [editOpen, setEditOpen] = useState(false);
  const [adViews, setAdViews] = useState('');
  const [visitors, setVisitors] = useState('');
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/analytics/funnel', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, period, reloadKey]);

  function openEdit() {
    const s = data?.stages || [];
    setAdViews(digitsOnly(s[0]?.count ?? ''));
    setVisitors(digitsOnly(s[1]?.count ?? ''));
    setEditOpen(true);
  }

  async function saveInputs() {
    // Сервер перезаписывает ОБА поля (upsert), поэтому пустое поле нельзя молча
    // отправить нулём — так обнулялся верхний этап воронки. Просим ввести явно:
    // ноль тоже вводится вручную («0»), а пустое = «не знаю» и не сохраняется.
    const adNum = parseInt(adViews, 10);
    const visNum = parseInt(visitors, 10);
    if (!Number.isFinite(adNum) || !Number.isFinite(visNum)) {
      toast(tt('Заполните оба поля — показы и посетители (если показов не было, введите 0)'), 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        ad_views: Math.max(0, adNum),
        visitors: Math.max(0, visNum),
      };
      if (branchId) body.branch_id = branchId;
      await api.post('/analytics/funnel/inputs', body);
      toast(tt('Данные сохранены'), 'success');
      setEditOpen(false);
      setReloadKey(k => k + 1);
    } catch (e) {
      toast(e.response?.data?.error || e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const stages = data?.stages || [];
  const weakest = data?.weakest || null;
  const maxCount = Math.max(1, ...stages.map(s => s.count || 0));

  return (
    <>
      <PageHeader
        title={tt('🪜 Воронка бизнеса')}
        sub={tt('Показы → посетители → первая покупка → повторные → лояльные → VIP')}
        actions={
          // flexWrap: на телефоне переключатель периода и кнопка ввода в одну
          // строку не влезали и уносили экран вбок на 119px.
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
            <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />
            <button className="btn btn-sm" onClick={openEdit} disabled={loading}>{tt('Ввод показов/посетителей')}</button>
          </div>
        }
      />

      {error && <Card icon="⚠️"><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><Skeleton height={20} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : stages.length === 0 ? (
        <EmptyState icon="🪜" title={tt('Нет данных')} description={tt('Недостаточно данных за период')} />
      ) : (
        <>
          {data?.inputs_missing && (
            <Card style={{ marginBottom: 16, background: 'rgba(245,158,11,.08)', borderColor: 'rgba(245,158,11,.3)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 20 }}>📢</span>
                <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800 }}>{tt('Показы рекламы и посетители не введены')}</div>
                  <div style={{ color: 'var(--text2)' }}>
                    {tt('Этих данных нет в системе — введите вручную (за текущий месяц), чтобы увидеть верхние ступени воронки.')}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={openEdit}>{tt('Ввести')}</button>
              </div>
            </Card>
          )}

          {/* Слабейшая ступень + рекомендация */}
          {weakest && (
            <Card icon="🎯" title={tt('Слабейший этап')} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{tt(weakest.label)}</span>
                <Badge tone={convTone(weakest.conversion_pct)}>
                  {weakest.conversion_pct != null ? `${weakest.conversion_pct}%` : '—'} {tt('конверсия')}
                </Badge>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                💡 {tt(weakest.recommendation)}
              </div>
            </Card>
          )}

          {/* Каскад воронки */}
          <Card icon="🪜" title={tt('Воронка')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {stages.map((s, i) => {
                const color = STAGE_COLORS[i] || '#1D4ED8';
                const w = Math.max(8, Math.round(((s.count || 0) / maxCount) * 100));
                const isWeak = weakest && weakest.stage === s.name;
                return (
                  <div key={s.name}>
                    {/* Конверсия от предыдущей ступени */}
                    {i > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 11.5, color: 'var(--text3)', padding: '2px 0' }}>
                        <span className="mono" style={{ color: convTextColor(s.conversion_pct), fontWeight: 800 }}>
                          ▼ {s.conversion_pct != null ? `${s.conversion_pct}%` : '—'}
                        </span>
                        {s.loss != null && s.loss > 0 && (
                          <span>{tt('потеря')}: <b>{fmtNum(s.loss)}</b></span>
                        )}
                      </div>
                    )}
                    {/* Полоса ступени */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                      <div style={{ width: 180, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{tt(s.label)}</span>
                        {isWeak && <Badge tone="red">{tt('слабое')}</Badge>}
                      </div>
                      <div style={{ flex: 1, background: 'var(--bg2, #F1F5F9)', borderRadius: 8, height: 34, position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          width: w + '%', height: '100%',
                          background: `linear-gradient(90deg, ${color}, ${color}CC)`,
                          borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                          paddingRight: 10, transition: 'width .35s ease',
                        }}>
                          <span className="mono" style={{ color: '#fff', fontWeight: 900, fontSize: 13 }}>{fmtNum(s.count)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Детальная таблица */}
          <Card icon="📋" title={tt('Детализация по этапам')} style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Этап')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Кол-во')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Конверсия')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Потеря')}</th>
                    <th>{tt('Источник')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map(s => (
                    <tr key={s.name}>
                      <td style={{ fontWeight: 700 }}>{tt(s.label)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 800 }}>{fmtNum(s.count)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {s.conversion_pct != null ? (
                          <span style={{ color: convTextColor(s.conversion_pct), fontWeight: 800 }}>
                            {s.conversion_pct}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text2)' }}>
                        {s.loss != null ? fmtNum(s.loss) : '—'}
                      </td>
                      <td style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                        {s.manual ? tt('ручной ввод') : s.source === 'customer_rfm' ? 'RFM' : tt('продажи')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, padding: '0 4px' }}>
            {tt('Конверсия = следующая ступень / предыдущая × 100. Потеря = разница между ступенями. Показы рекламы и посетители вводятся вручную за текущий месяц (нет данных в системе). Лояльные/VIP считаются по RFM на уровне компании.')}
          </div>
        </>
      )}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        icon="✏️"
        title={tt('Показы и посетители (текущий месяц)')}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>{tt('Отмена')}</button>
            <button className="btn" onClick={saveInputs} disabled={saving}>
              {saving ? tt('Сохранение…') : tt('Сохранить')}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{tt('📢 Просмотры рекламы')}</div>
            <input type="text" inputMode="numeric" value={adViews}
              onChange={e => setAdViews(digitsOnly(e.target.value))}
              onBlur={() => setAdViews(v => normCount(v))}
              className="input" style={{ width: '100%' }} placeholder="0" />
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{tt('🚶 Посетители')}</div>
            <input type="text" inputMode="numeric" value={visitors}
              onChange={e => setVisitors(digitsOnly(e.target.value))}
              onBlur={() => setVisitors(v => normCount(v))}
              className="input" style={{ width: '100%' }} placeholder="0" />
          </label>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.4 }}>
            {tt('Данные сохраняются за текущий месяц')}{branchId ? tt(' и выбранный филиал') : tt(' по всей компании')}. {tt('При выборе филиала ввод привязывается к нему.')}
          </div>
        </div>
      </Modal>
    </>
  );
}