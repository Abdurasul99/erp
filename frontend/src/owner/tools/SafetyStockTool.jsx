import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, PageHeader, Pills, Progress, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';
import { normalizeDecimal } from '../../utils/decimalInput.js';

// Страховой запас (safety stock) — read-only.
// Бэкенд считает sigma среднесуточного спроса за 90 дн и safety_stock = Z·sigma·sqrt(lead_time)
// при уровне сервиса 95%. What-if (90–99%) пересчитывается на клиенте умножением на Z'/Z(95).

// Z-значения по уровню сервиса (one-sided).
const Z = { 90: 1.28, 95: 1.65, 98: 2.05, 99: 2.33 };
const Z_BASE = Z[95]; // бэкенд отдаёт значения при 95%

const SERVICE_OPTIONS = [
  { value: 90, label: '90%', desc: 'Базовая защита — меньше запас' },
  { value: 95, label: '95%', desc: 'Стандарт — баланс запаса и риска' },
  { value: 98, label: '98%', desc: 'Высокая защита — больше запас' },
  { value: 99, label: '99%', desc: 'Максимум — почти без дефицита' },
];

// Поля what-if — строковый стейт. В onChange только чистим символы: запятая → точка
// (ru-клавиатура пишет «3,5»), один разделитель, без минусов; диапазон и нормализацию
// применяем на onBlur. type="text" вместо type="number": последний на промежуточно
// невалидном вводе («3,») отдаёт e.target.value === '' и поле само себя очищает.
const cleanDec = (s) => {
  const t = normalizeDecimal(s).replace(/[^\d.]/g, '');
  const i = t.indexOf('.');
  return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '');
};
const cleanInt = (s) => String(s).replace(/[^\d]/g, '');
// Пусто оставляем пустым (расчёт трактует как 0), «3.» приводим к «3», «007» к «7».
const normNum = (s) => {
  if (s === '') return '';
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? String(n) : '';
};

// «Нестабильность спроса» по коэффициенту вариации (CoV = sigma/avg).
function volatility(cov, tt) {
  if (cov == null) return { label: tt('Нет данных'), tone: 'gray' };
  if (cov <= 0.25) return { label: tt('Низкая'), tone: 'green' };
  if (cov <= 0.5) return { label: tt('Средняя'), tone: 'blue' };
  return { label: tt('Высокая'), tone: 'red' };
}

export default function SafetyStockTool() {
  const { tt } = useTt();
  const { branchId } = useContext(BranchScope);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [service, setService] = useState(95);

  // What-if калькулятор (локальный, на клиенте).
  const [wiSigma, setWiSigma] = useState('');
  const [wiLead, setWiLead] = useState('');
  const [wiService, setWiService] = useState(95);

  useEffect(() => {
    setLoading(true); setError(null);
    const params = {};
    if (branchId) params.branch_id = branchId;
    api.get('/warehouse/safety-stock', { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const items = data?.items || [];
  const factor = Z[service] / Z_BASE; // масштаб от базового уровня (95%) к выбранному

  // Пересчёт по выбранному уровню сервиса.
  const rows = useMemo(() => items.map(it => {
    const ss = Math.ceil((it.safety_stock || 0) * factor);
    const value = ss * (it.price_buy || 0);
    return { ...it, ss, value };
  }), [items, factor]);

  const totals = useMemo(() => {
    const totalUnits = rows.reduce((s, r) => s + r.ss, 0);
    const totalValue = rows.reduce((s, r) => s + r.value, 0);
    const unstable = rows.filter(r => r.cov != null && r.cov > 0.5).length;
    return { totalUnits, totalValue, unstable, count: rows.length };
  }, [rows]);

  // What-if результат.
  const wiResult = useMemo(() => {
    const sig = parseFloat(wiSigma) || 0;
    const lt = parseFloat(wiLead) || 0;
    if (sig <= 0 || lt <= 0) return null;
    return Math.ceil(Z[wiService] * sig * Math.sqrt(lt));
  }, [wiSigma, wiLead, wiService]);

  return (
    <>
      <PageHeader
        title={tt('🛡️ Страховой запас')}
        sub={tt('Буфер на случай скачка спроса и задержки поставки · 90 дней истории')}
        actions={<Badge tone="yellow">{tt('Только просмотр')}</Badge>}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[0, 1, 2, 3].map(i => <Card key={i}><Skeleton height={48} /></Card>)}
          </div>
          <Card><Skeleton height={200} /></Card>
        </>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="📦" label={tt('Товаров в расчёте')} value={fmtNum(totals.count)} sub={tt('с историей продаж')} color="var(--primary)" />
            <Tile icon="🛡️" label={tt('Страховой запас')} value={`${fmtNum(totals.totalUnits)}`} sub={tt('единиц суммарно')} color="#1D4ED8" />
            <Tile icon="💰" label={tt('Стоимость запаса')} value={fmtMoneyFull(totals.totalValue)} sub={tt('сум по себестоимости')} color="#16A34A" />
            <Tile icon="⚠️" label={tt('Нестабильные')} value={fmtNum(totals.unstable)} sub={tt('высокая волатильность')} color="#DC2626" />
          </div>

          <Card
            icon="🎚️"
            title={tt('Уровень сервиса')}
            style={{ marginBottom: 16 }}
            actions={
              <Pills
                value={service}
                onChange={setService}
                options={SERVICE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              />
            }
          >
            <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
              {tt('Уровень сервиса — вероятность не остаться без товара в период поставки.')}{' '}
              {tt(SERVICE_OPTIONS.find(o => o.value === service)?.desc || '')}{' '}
              <span className="mono" style={{ color: 'var(--text3)' }}>(Z = {Z[service]})</span>
            </div>
          </Card>

          <Card icon="📋" title={`${tt('Страховой запас по товарам')} (${rows.length})`} style={{ marginBottom: 16 }}>
            {rows.length === 0 ? (
              <EmptyState
                icon="📭"
                title={tt('Нет данных')}
                description={tt('Недостаточно истории продаж за 90 дней для расчёта страхового запаса.')}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>{tt('Товар')}</th>
                      <th style={{ textAlign: 'center' }}>{tt('Нестабильность спроса')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Срок поставки (дней)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Страховой запас (шт)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Стоимость запаса (сум)')}</th>
                      <th style={{ textAlign: 'center' }}>{tt('Уровень защиты')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map(it => {
                      const vol = volatility(it.cov, tt);
                      return (
                        <tr key={it.product_id}>
                          <td style={{ fontWeight: 700 }}>{it.name}</td>
                          <td style={{ textAlign: 'center' }}>
                            <Badge tone={vol.tone}>{vol.label}</Badge>
                          </td>
                          <td className="mono" style={{ textAlign: 'right' }}>{fmtNum(it.lead_time_days)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                            {fmtNum(it.ss)} {it.unit}
                          </td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoneyFull(it.value)}</td>
                          <td style={{ textAlign: 'center', minWidth: 90 }}>
                            <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{service}%</div>
                            <Progress value={service} max={100} color="#16A34A" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card icon="🧮" title={tt('Что если')}>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.5 }}>
              {tt('Прикиньте страховой запас для своих значений: нестабильность спроса (sigma, шт/день) и срок поставки.')}
            </div>
            <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
                  {tt('Нестабильность спроса (шт/день)')}
                </label>
                <input
                  type="text" inputMode="decimal" className="input mono"
                  value={wiSigma}
                  onChange={e => setWiSigma(cleanDec(e.target.value))}
                  onBlur={() => setWiSigma(v => normNum(v))}
                  placeholder={tt('напр. 3.5')}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
                  {tt('Срок поставки (дней)')}
                </label>
                <input
                  type="text" inputMode="numeric" className="input mono"
                  value={wiLead}
                  onChange={e => setWiLead(cleanInt(e.target.value))}
                  onBlur={() => setWiLead(v => normNum(v))}
                  placeholder={tt('напр. 7')}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
                  {tt('Уровень сервиса')}
                </label>
                <Pills
                  value={wiService}
                  onChange={setWiService}
                  options={SERVICE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                />
              </div>
            </div>
            <div style={{
              background: 'rgba(29,78,216,.06)', borderRadius: 12, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{tt('Страховой запас')}</div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 900, color: 'var(--primary)' }}>
                  {wiResult == null ? '—' : `${fmtNum(wiResult)} ${tt('шт')}`}
                </div>
              </div>
              {wiResult != null && (
                <div style={{ fontSize: 12.5, color: 'var(--text2)', maxWidth: 360, lineHeight: 1.5 }}>
                  {tt('Держать')} {fmtNum(wiResult)} {tt('шт как буфер на случай скачка спроса и задержки поставки.')}
                </div>
              )}
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12 }}>
              SS = Z × sigma × √(lead_time)
            </div>
          </Card>
        </>
      )}
    </>
  );
}
