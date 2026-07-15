import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { AreaChart, Bars, Skeleton, fmtMoney } from './ui.jsx';
import { useTt } from './tt.js';

const CHART_META = {
  monthly_revenue:  { icon: '📈', kind: 'bars-with-labels' },
  top_products:     { icon: '🏆', kind: 'horizontal-bars' },
  top_sellers:      { icon: '👤', kind: 'horizontal-bars' },
  branches:         { icon: '🏭', kind: 'horizontal-bars' },
  period_compare:   { icon: '📊', kind: 'area-compare' },
};

export default function AiChartBlock({ chartType }) {
  const { tt } = useTt();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/ai/chart-data', { params: { type: chartType } })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [chartType]);

  const meta = CHART_META[chartType];

  if (!meta) {
    return null;
  }

  if (loading) {
    return (
      <div style={{
        marginTop: 10, padding: 16,
        background: 'var(--surface)', borderRadius: 14,
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <Skeleton height={14} style={{ width: '40%', marginBottom: 10 }} />
        <Skeleton height={120} />
      </div>
    );
  }

  if (error || !data || !data.data) {
    return (
      <div style={{
        marginTop: 10, padding: 12,
        background: 'var(--bg-2)', borderRadius: 12,
        fontSize: 12, color: 'var(--text3)',
      }}>
        🚫 {tt('График недоступен')}: {error || tt('Нет данных')}
      </div>
    );
  }

  return (
    <div style={{
      marginTop: 10, padding: 16,
      background: 'var(--surface)', borderRadius: 14,
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 12,
      }}>
        <span style={{ fontSize: 16 }}>{meta.icon}</span>
        {data.title}
      </div>

      {meta.kind === 'bars-with-labels' && <MonthlyBarsChart points={data.data} />}
      {meta.kind === 'horizontal-bars' && <HorizontalBarChart points={data.data} />}
      {meta.kind === 'area-compare' && <PeriodCompareChart current={data.data.current} prev={data.data.prev} />}
    </div>
  );
}

function MonthlyBarsChart({ points }) {
  const { tt } = useTt();
  if (!points || points.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{tt('Нет данных')}</div>;
  }
  const max = Math.max(...points.map(p => p.value), 1);
  return (
    <div>
      <Bars data={points.map(p => p.value)} color="#1D4ED8" />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--text3)', fontWeight: 700, gap: 4, overflowX: 'auto' }}>
        {points.map((p, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 30 }}>{p.label.slice(2)}</div>
        ))}
      </div>
      <div style={{ marginTop: 10, padding: 8, background: 'var(--bg-2)', borderRadius: 8, fontSize: 11, color: 'var(--text2)' }}>
        {tt('Период')}: <strong>{points[0].label}</strong> — <strong>{points[points.length - 1].label}</strong>.
        {tt('Максимум')}: <strong>{fmtMoney(max)}</strong>. {tt('Сумма')}: <strong>{fmtMoney(points.reduce((s, p) => s + p.value, 0))}</strong>.
      </div>
    </div>
  );
}

function HorizontalBarChart({ points }) {
  const { tt } = useTt();
  if (!points || points.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{tt('Нет данных')}</div>;
  }
  const max = Math.max(...points.map(p => p.value), 1);
  return (
    <div>
      {points.map((p, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{
                width: 22, height: 22, borderRadius: 6,
                background: i < 3 ? 'rgba(255,107,43,.15)' : 'var(--bg-2)',
                color: i < 3 ? 'var(--orange)' : 'var(--text2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 11, flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
            </div>
            <span className="mono" style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 12, flexShrink: 0, marginLeft: 8 }}>
              {fmtMoney(p.value)}
            </span>
          </div>
          <div style={{
            height: 6, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: ((p.value / max) * 100) + '%',
              background: 'linear-gradient(90deg, var(--primary), var(--orange))',
              borderRadius: 4,
              transition: 'width .3s ease',
            }} />
          </div>
          {p.sub && (
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontWeight: 600 }}>
              {p.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PeriodCompareChart({ current, prev }) {
  const { tt } = useTt();
  if (!current || current.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{tt('Нет данных за период')}</div>;
  }
  const curVals = current.map(p => p.value);
  const prevVals = (prev || []).map(p => p.value);
  const curSum = curVals.reduce((s, v) => s + v, 0);
  const prevSum = prevVals.reduce((s, v) => s + v, 0);
  const delta = prevSum > 0 ? Math.round(((curSum - prevSum) / prevSum) * 100) : null;
  return (
    <div>
      <AreaChart data={curVals} prevData={prevVals} color="#16A34A" prevColor="#94A0B5" height={140} />
      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 3, background: '#16A34A', borderRadius: 2 }} />
          <span style={{ color: 'var(--text2)' }}>{tt('Сейчас')}: <strong>{fmtMoney(curSum)}</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 0, borderTop: '2px dashed #94A0B5' }} />
          <span style={{ color: 'var(--text2)' }}>{tt('Раньше')}: <strong>{fmtMoney(prevSum)}</strong></span>
        </div>
        {delta != null && (
          <div style={{ marginLeft: 'auto', fontWeight: 800, color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </div>
        )}
      </div>
    </div>
  );
}

// Helper for parsing message text — extracts chart types from [[CHART:type]] tags
// and returns { cleanText, chartTypes: [...] }
export function parseChartTags(text) {
  if (!text || typeof text !== 'string') return { cleanText: text || '', chartTypes: [] };
  const re = /\[\[CHART:([a-z_]+)\]\]/g;
  const types = [];
  const cleanText = text.replace(re, (_, t) => { types.push(t); return ''; }).replace(/\n{3,}/g, '\n\n').trim();
  return { cleanText, chartTypes: types };
}

// Лёгкий рендер markdown в ответах AI: **жирный**, `код`, списки (1. / - / •), абзацы.
// Без внешних зависимостей — иначе модель выдаёт сырые «**» и текст выглядит грязно.
function renderInline(text, kp) {
  const out = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] != null) out.push(<strong key={kp + 'b' + i++} style={{ fontWeight: 800, color: 'var(--text)' }}>{m[1]}</strong>);
    else out.push(<code key={kp + 'c' + i++} style={{ fontSize: '.92em', background: 'rgba(127,127,127,.14)', padding: '1px 5px', borderRadius: 5 }}>{m[2]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text }) {
  const lines = String(text || '').split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 7 }} />;
        const numbered = t.match(/^(\d+)[.)]\s+(.*)$/);
        const bullet = t.match(/^[-*•]\s+(.*)$/);
        if (numbered) return (
          <div key={i} style={{ display: 'flex', gap: 9, marginBottom: 5 }}>
            <span style={{ fontWeight: 800, color: 'var(--primary)', flexShrink: 0 }}>{numbered[1]}.</span>
            <span>{renderInline(numbered[2], i + '-')}</span>
          </div>
        );
        if (bullet) return (
          <div key={i} style={{ display: 'flex', gap: 9, marginBottom: 5 }}>
            <span style={{ color: 'var(--primary)', fontWeight: 800, flexShrink: 0 }}>•</span>
            <span>{renderInline(bullet[1], i + '-')}</span>
          </div>
        );
        return <div key={i} style={{ marginBottom: 5 }}>{renderInline(t, i + '-')}</div>;
      })}
    </>
  );
}
