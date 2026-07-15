import React, { useState, useEffect, useContext } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Skeleton, EmptyState, fmtNum } from '../ui.jsx';
import HrCriteriaBar from './HrCriteriaBar.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';

// Рабочее окно карты: 9:00–19:00 (10 часов).
const DAY_START = 9;
const DAY_END = 19;
const SPAN = DAY_END - DAY_START; // часов на оси

const RANGES = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
];

// Категории сегментов дня и их цвета (сине-белая палитра + акценты).
const CATS = [
  { key: 'work',    ru: 'Продуктивная работа', color: '#1D4ED8' },
  { key: 'routine', ru: 'Рутина',              color: '#60A5FA' },
  { key: 'break',   ru: 'Перерыв',             color: '#FBBF24' },
  { key: 'idle',    ru: 'Простой',             color: '#E2E8F0' },
];
const CAT_COLOR = CATS.reduce((m, c) => { m[c.key] = c.color; return m; }, {});

const hLabel = (h) => `${String(h).padStart(2, '0')}:00`;
const initials = (name) => (name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

export default function WorkdayMapTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [range, setRange] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { date: range };
    if (branchId) params.branch_id = branchId;
    api.get('/hr/workday-map', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [branchId, range]);

  const kpi = data?.kpi || {};
  const employees = data?.employees || [];
  const hasData = employees.length > 0;

  // Сетка часовых меток для оси времени.
  const ticks = [];
  for (let h = DAY_START; h <= DAY_END; h++) ticks.push(h);

  return (
    <>
      <PageHeader
        title={tt('🗺️ Карта рабочего дня')}
        sub={tt('Персонал · таймлайн дня каждого сотрудника · рабочее окно 9:00–19:00')}
        actions={<Pills value={range} onChange={setRange} label={tt('Период')} options={RANGES.map(p => ({ ...p, label: tt(p.label) }))} />}
      />

      <HrCriteriaBar tool="workday" />

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={240} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>⚠️ {error}</div></Card>
      ) : !hasData ? (
        <Card>
          <EmptyState
            icon="🗺️"
            title={tt('Нет данных о рабочем дне')}
            description={tt('За выбранный период нет отметок явки или продаж, чтобы построить карту дня.')}
          />
        </Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile
              icon="⚡"
              label={tt('Средняя продуктивность')}
              value={`${fmtNum(kpi.avg_productivity_pct || 0)}%`}
              sub={tt('доля активных часов')}
              color="#1D4ED8"
            />
            <Tile
              icon="💤"
              label={tt('Средний простой')}
              value={`${fmtNum(kpi.avg_idle_hours || 0)} ${tt('ч')}`}
              sub={tt('на сотрудника')}
              color="#DC2626"
            />
            <Tile
              icon="🏆"
              label={tt('Лучший по продуктивности')}
              value={kpi.best?.name || '—'}
              sub={kpi.best ? `${fmtNum(kpi.best.productivity_pct)}%` : '—'}
              color="#16A34A"
            />
            <Tile
              icon="📉"
              label={tt('Худший по продуктивности')}
              value={kpi.worst?.name || '—'}
              sub={kpi.worst ? `${fmtNum(kpi.worst.productivity_pct)}%` : '—'}
              color="#D97706"
            />
          </div>

          <Card icon="🗺️" title={tt('Таймлайн рабочего дня')}>
            {/* Легенда категорий */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 14 }}>
              {CATS.map(c => (
                <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: c.color, display: 'inline-block', border: '1px solid rgba(0,0,0,.06)' }} />
                  {tt(c.ru)}
                </div>
              ))}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 640 }}>
                {/* Ось времени */}
                <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 6 }}>
                  <div style={{ width: 180, flexShrink: 0 }} />
                  <div style={{ position: 'relative', flex: 1, height: 16 }}>
                    {ticks.map(h => (
                      <span key={h} style={{
                        position: 'absolute',
                        left: `${((h - DAY_START) / SPAN) * 100}%`,
                        transform: 'translateX(-50%)',
                        fontSize: 10, color: 'var(--text3)', fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}>{hLabel(h)}</span>
                    ))}
                  </div>
                </div>

                {/* Строка-сотрудник = stacked-бар */}
                {employees.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10 }}>
                    <div style={{ width: 180, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, paddingRight: 10 }}>
                      <div className="o-avatar" style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0 }}>{initials(e.name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtNum(e.productivity_pct)}% · {fmtNum(e.idle_hours)} {tt('ч простой')}</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: 26, borderRadius: 7, overflow: 'hidden', background: '#F1F5F9', border: '1px solid var(--border, #E3EAF3)' }}>
                      {/* вертикальные часовые насечки */}
                      {ticks.slice(1, -1).map(h => (
                        <div key={h} style={{
                          position: 'absolute', top: 0, bottom: 0,
                          left: `${((h - DAY_START) / SPAN) * 100}%`,
                          width: 1, background: 'rgba(148,163,184,.25)',
                        }} />
                      ))}
                      {(e.segments || []).map((seg, i) => {
                        const left = ((seg.start - DAY_START) / SPAN) * 100;
                        const width = ((seg.end - seg.start) / SPAN) * 100;
                        if (width <= 0) return null;
                        const cat = CATS.find(c => c.key === seg.cat);
                        const tip = `${tt(cat ? cat.ru : seg.cat)} · ${hLabel(Math.floor(seg.start))}–${hLabel(Math.ceil(seg.end))}`;
                        return (
                          <div key={i} title={tip} style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: `${Math.max(0, left)}%`,
                            width: `${Math.min(width, 100 - Math.max(0, left))}%`,
                            background: CAT_COLOR[seg.cat] || '#E2E8F0',
                          }} />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12 }}>
              {tt('ℹ️ Рабочее окно берётся из отметок явки (приход/уход); активные часы — это часы с продажами продавца, остальные часы в окне считаются простоем. Где явки нет — окно приближено к 9:00–19:00.')}
            </div>
          </Card>

          <Card icon="📊" title={tt('Сводка по сотрудникам')} style={{ marginTop: 18 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{tt('Сотрудник')}</th>
                    <th>{tt('Рабочее окно')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Активные часы')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Простой')}</th>
                    <th style={{ textAlign: 'right' }}>{tt('Продуктивность')}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(e => (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="o-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(e.name)}</div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{e.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>@{e.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="mono" style={{ color: 'var(--text2)' }}>{hLabel(e.window_start)} – {hLabel(e.window_end)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(e.active_hours)} {tt('ч')}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(e.idle_hours)} {tt('ч')}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Badge tone={e.productivity_pct >= 60 ? 'green' : e.productivity_pct >= 35 ? 'orange' : 'red'}>{fmtNum(e.productivity_pct)}%</Badge>
                      </td>
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
