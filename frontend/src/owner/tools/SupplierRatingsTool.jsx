import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, fmtMoneyFull, fmtNum, Pills } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Рейтинг поставщиков — read-only агрегат по stock_income (+ брак, если есть).
// Балл 0-5: доставка в срок (60% · до 3.0) + качество/без брака (30% · до 1.5) + опыт/объём (10% · до 0.5).

const PERIODS = [
  { value: '7',   label: 'Неделя' },
  { value: '30',  label: 'Месяц' },
  { value: '90',  label: 'Квартал' },
  { value: '365', label: 'Год' },
];

// Оценка по баллу → подпись + цвет.
function grade(score, tt) {
  if (score >= 4.5) return { label: tt('Отлично'), color: '#16A34A' };
  if (score >= 4.0) return { label: tt('Хорошо'),  color: '#1D4ED8' };
  if (score >= 3.0) return { label: tt('Средне'),  color: '#D97706' };
  return { label: tt('Плохо'), color: '#DC2626' };
}

function Stars({ score }) {
  const full = Math.round(score);
  return (
    <span style={{ whiteSpace: 'nowrap', letterSpacing: 1 }}>
      <span style={{ color: '#F59E0B' }}>{'★'.repeat(Math.min(5, full))}</span>
      <span style={{ color: 'var(--border, #E3EAF3)' }}>{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}

export default function SupplierRatingsTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('90');

  useEffect(() => {
    setLoading(true); setError(null);
    const params = { days: period };
    if (branchId) params.branch_id = branchId;
    api.get('/procurement/ratings', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId, period]);

  const rows = data?.suppliers || [];
  const avg = data?.avg_rating || 0;
  const best = data?.best || null;
  const worst = data?.worst || null;

  return (
    <>
      <PageHeader
        title={tt('⭐ Рейтинг поставщиков')}
        sub={tt('Доставка в срок · брак · опыт — балл 0-5 по приходам')}
        actions={<Badge tone="amber">{tt('Полезно')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><div className="coming-soon"><div className="coming-soon-icon">⏳</div><div>{tt('Загрузка...')}</div></div></Card>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Pills value={period} onChange={setPeriod} options={PERIODS.map(p => ({ ...p, label: tt(p.label) }))} />
          </div>

          <div className="grid-3" style={{ marginBottom: 16 }}>
            <Tile icon="📊" label={tt('Средний рейтинг по базе')} value={avg.toFixed(1) + ' / 5'} sub={tt('по активным поставщикам')} color="var(--primary)" />
            <Tile icon="🏆" label={tt('Лучший')}
              value={best ? best.name : '—'}
              sub={best ? `${best.score.toFixed(1)} / 5` : tt('нет данных')} color="#16A34A" />
            <Tile icon="⚠️" label={tt('Худший')}
              value={worst ? worst.name : '—'}
              sub={worst ? `${worst.score.toFixed(1)} / 5` : tt('нет данных')} color="#DC2626" />
          </div>

          <Card icon="📐" title={tt('Как считается рейтинг')} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
              <div style={{ flex: '1 1 180px' }}>
                <b style={{ color: 'var(--text)' }}>{tt('Доставка в срок')}</b> — 60% ({tt('до')} 3.0 {tt('балла')})
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <b style={{ color: 'var(--text)' }}>{tt('Качество / без брака')}</b> — 30% ({tt('до')} 1.5 {tt('балла')})
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <b style={{ color: 'var(--text)' }}>{tt('Опыт / объём')}</b> — 10% ({tt('до')} 0.5 {tt('балла')})
              </div>
            </div>
          </Card>

          <Card icon="📋" title={`${tt('Поставщики')} (${rows.length})`}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th>{tt('Поставщик')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Рейтинг')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Заказов всего')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Объём')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('В срок (%)')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('С опозданием')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Брака (%)')}</th>
                    <th style={{ textAlign: 'center' }}>{tt('Оценка')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 30 }}>{tt('Нет поставщиков с приходами за период')}</td></tr>
                  ) : rows.map(s => {
                    const g = grade(s.score, tt);
                    return (
                      <tr key={s.supplier_id || s.name}>
                        <td style={{ fontWeight: 700 }}>{s.name}</td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <Stars score={s.score} />
                          <span className="mono" style={{ marginLeft: 6, fontWeight: 800, color: g.color }}>{(s.score || 0).toFixed(1)}</span>
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(s.orders)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(s.volume)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{Math.round(s.on_time_pct)}%</td>
                        <td className="mono" style={{ textAlign: 'right', color: s.late_count > 0 ? 'var(--red)' : 'var(--text2)' }}>{fmtNum(s.late_count)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: s.defect_pct > 0 ? 'var(--red)' : 'var(--text2)' }}>{(s.defect_pct || 0).toFixed(1)}%</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: g.color + '20', color: g.color, padding: '3px 10px', borderRadius: 14, fontWeight: 800, fontSize: 12 }}>
                            {g.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
