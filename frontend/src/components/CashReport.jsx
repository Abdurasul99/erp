import React, { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';
import { fmtMoney, fmtNum } from '../utils.js';
import PeriodFilter from './PeriodFilter.jsx';

// Cashier's «Отчёт» — replaces the old «Остатки» tab.
// Period-aware aggregate: settled income, pending, expense, profit, by method/seller/day/product, debts.
export default function CashReport() {
  const { t, lang } = useTranslation();
  const uz = lang === 'uz';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });

  // Resolve period → ISO from/to so backend can aggregate exactly.
  const range = useMemo(() => {
    const now = new Date();
    const startOf = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
    let from, to;
    if (period === 'today') { from = startOf(now); to = new Date(now); }
    else if (period === 'week') {
      const d = new Date(now); const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow); from = startOf(d); to = new Date(now);
    }
    else if (period === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now); }
    else if (period === 'year')  { from = new Date(now.getFullYear(), 0, 1); to = new Date(now); }
    else if (period === 'custom' && customRange.from && customRange.to) {
      from = new Date(customRange.from); to = new Date(customRange.to);
    } else { return null; }
    // end of day for `to`
    if (to) { to.setHours(23, 59, 59, 999); }
    return { from: from.toISOString(), to: to.toISOString() };
  }, [period, customRange.from, customRange.to]);

  const load = async () => {
    setLoading(true);
    try {
      const params = range ? { from: range.from, to: range.to } : {};
      const { data } = await api.get('/cash/report', { params });
      setData(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [range?.from, range?.to]);

  const periodLabel = {
    today: uz ? 'Bugun' : 'Сегодня',
    week:  uz ? 'Hafta' : 'Неделя',
    month: uz ? 'Oy'    : 'Месяц',
    year:  uz ? 'Yil'   : 'Год',
    custom: uz ? 'Davr' : 'Период',
  }[period] || '';

  const methodMeta = {
    cash:     { label: uz ? 'Naqd'    : 'Наличные',    icon: '💵', color: '#16a34a' },
    card:     { label: uz ? 'Karta'   : 'Карта',       icon: '💳', color: '#2563eb' },
    transfer: { label: uz ? 'Oʻtkazma': 'Перевод',     icon: '🏦', color: '#0891B2' },
    wire:     { label: uz ? 'Hisobga' : 'Перечисление', icon: '📑', color: '#7C3AED' },
    click:    { label: 'Click', icon: '⚡', color: '#0EA5E9' },
    payme:    { label: 'Payme', icon: '💠', color: '#7C3AED' },
  };
  const curSymbol = { USD: '$', EUR: '€', RUB: '₽', KZT: '₸', CNY: '¥', TRY: '₺', KRW: '₩', GBP: '£', AED: 'د.إ' };

  // Chart sizing
  const maxByDay = useMemo(() => {
    if (!data?.by_day?.length) return 1;
    return Math.max(...data.by_day.map(d => Math.max(d.income, d.expense)), 1);
  }, [data]);

  if (loading && !data) return <div className="center" style={{ padding: '60px' }}><div className="spinner" /></div>;
  if (!data) return null;

  const { income, expense, sales, profit, by_method, by_seller, by_day, top_products, debts, by_currency } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      {/* Period selector */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: '14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text)' }}>
          📊 {uz ? 'Hisobot' : 'Отчёт'} · <span style={{ color: 'var(--primary)' }}>{periodLabel}</span>
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <PeriodFilter period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} compact />
        </div>
        <button onClick={load} className="btn btn-ghost btn-sm">{uz ? 'Yangilash' : 'Обновить'}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {/* ── BIG TILES: revenue / income / expense / profit ── */}
        <div className="grid-4" style={{ marginBottom: '14px' }}>
          <Tile icon="📥" label={uz ? 'Tushum (kassa)' : 'Поступило в кассу'} value={fmtMoney(income.settled)}
                sub={`${income.settled_count} ${uz ? 'ta' : 'операций'}`} color="#16a34a" />
          <Tile icon="📤" label={uz ? 'Chiqim (kassa)' : 'Расход кассы'} value={fmtMoney(expense.total)}
                sub={`${expense.count} ${uz ? 'ta' : 'операций'}`} color="#dc2626" />
          <Tile icon="💼" label={uz ? 'Savdo' : 'Продаж'} value={fmtMoney(sales.revenue)}
                sub={`${sales.count} · ${fmtNum(sales.qty)} ${uz ? 'birlik' : 'ед.'}`} color="#4338ca" />
          <Tile icon="🟢" label={uz ? 'Sof foyda' : 'Чистая прибыль'}
                value={fmtMoney(profit.net)}
                sub={`${uz ? 'Marja' : 'Маржа'}: ${sales.margin_pct.toFixed(1)}%`}
                color={profit.net >= 0 ? '#16a34a' : '#dc2626'} />
        </div>

        {/* Pending alert */}
        {income.pending > 0 && (
          <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: '12px', padding: '10px 16px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '13px', color: '#b45309' }}>
                ⏳ {uz ? 'Sotuvchilardan kutilmoqda' : 'Ожидается от продавцов'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                {income.pending_count} {uz ? 'ta sotuv hali topshirilmagan' : 'продаж не сданы кассиру'}
              </div>
            </div>
            <div className="mono" style={{ fontSize: '17px', fontWeight: 800, color: '#d97706' }}>+{fmtMoney(income.pending)}</div>
          </div>
        )}

        {/* Debts alert */}
        {debts.count > 0 && (
          <div style={{ background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.20)', borderRadius: '12px', padding: '10px 16px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '13px', color: '#b91c1c' }}>
                📒 {uz ? 'Mijoz qarzlari (jami)' : 'Долги клиентов (всего)'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{debts.count} {uz ? 'ta toʻlanmagan sotuv' : 'неоплаченных продаж'}</div>
            </div>
            <div className="mono" style={{ fontSize: '17px', fontWeight: 800, color: '#dc2626' }}>{fmtMoney(debts.owed)}</div>
          </div>
        )}

        <div className="grid-2" style={{ marginBottom: '14px' }}>
          {/* By payment method */}
          <Section icon="💳" title={uz ? "Toʻlov usuli boʻyicha" : 'По способу оплаты'}>
            {by_method.length === 0 ? (
              <Empty label={uz ? 'Maʼlumot yoʻq' : 'Нет данных'} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {by_method.map(m => {
                  const meta = methodMeta[m.method] || { label: m.method, icon: '💰', color: '#6B6F8A' };
                  const pct = income.settled > 0 ? (m.total / income.settled * 100) : 0;
                  return (
                    <div key={m.method}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '13px' }}>
                        <span style={{ fontWeight: 700 }}>{meta.icon} {meta.label}</span>
                        <span className="mono" style={{ fontWeight: 800, color: meta.color }}>{fmtMoney(m.total)}</span>
                      </div>
                      <div style={{ height: '8px', background: '#F4F5FA', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: meta.color, borderRadius: '6px', transition: 'width .3s ease' }} />
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>{m.count} {uz ? 'ta' : 'операций'} · {pct.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* By seller */}
          <Section icon="👥" title={uz ? 'Sotuvchilar boʻyicha' : 'По продавцам'}>
            {by_seller.length === 0 ? (
              <Empty label={uz ? 'Maʼlumot yoʻq' : 'Нет данных'} />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{uz ? 'Sotuvchi' : 'Продавец'}</th>
                    <th style={{ textAlign: 'right' }}>{uz ? 'Savdo' : 'Продаж'}</th>
                    <th style={{ textAlign: 'right' }}>{uz ? 'Summa' : 'Сумма'}</th>
                  </tr>
                </thead>
                <tbody>
                  {by_seller.map(s => (
                    <tr key={s.user_id}>
                      <td style={{ fontWeight: 700, fontSize: '13px' }}>
                        {s.name}
                        {s.pending > 0 && (
                          <div style={{ fontSize: '10px', color: '#d97706', fontWeight: 700, marginTop: '2px' }}>
                            ⏳ {fmtMoney(s.pending)} {uz ? 'kutilmoqda' : 'не сдано'}
                          </div>
                        )}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700 }}>{s.sales_count}</td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{fmtMoney(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        {/* By day chart */}
        <Section icon="📈" title={uz ? 'Kunlik dinamika' : 'Динамика по дням'}>
          {by_day.length === 0 ? (
            <Empty label={uz ? 'Maʼlumot yoʻq' : 'Нет данных'} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px', padding: '8px 0' }}>
              {by_day.map((d, i) => {
                const incH = (d.income / maxByDay) * 100;
                const expH = (d.expense / maxByDay) * 100;
                return (
                  <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '14px' }}
                       title={`${d.day}\n+${fmtMoney(d.income)}\n-${fmtMoney(d.expense)}`}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', justifyContent: 'flex-start', alignItems: 'center', width: '100%', gap: '1px' }}>
                      <div style={{ width: '100%', height: `${incH}%`, background: 'linear-gradient(180deg, #22C55E, #16a34a)', borderRadius: '3px 3px 0 0', minHeight: d.income > 0 ? '2px' : 0 }} />
                      {d.expense > 0 && (
                        <div style={{ width: '100%', height: `${expH}%`, background: 'linear-gradient(180deg, #FCA5A5, #ef4444)', borderRadius: '0', minHeight: '2px' }} />
                      )}
                    </div>
                    {i % Math.max(1, Math.floor(by_day.length / 7)) === 0 && (
                      <div style={{ fontSize: '9px', color: 'var(--text3)', marginTop: '4px', fontWeight: 700 }}>
                        {d.day.slice(5)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '11px' }}>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#16a34a', borderRadius: '2px', marginRight: '4px' }} />{uz ? 'Tushum' : 'Доход'}</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px', marginRight: '4px' }} />{uz ? 'Chiqim' : 'Расход'}</span>
          </div>
        </Section>

        <div className="grid-2" style={{ marginTop: '14px' }}>
          {/* Top products */}
          <Section icon="🏆" title={uz ? 'Eng sotilgan tovarlar' : 'Топ товаров'}>
            {top_products.length === 0 ? (
              <Empty label={uz ? 'Maʼlumot yoʻq' : 'Нет данных'} />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{uz ? 'Tovar' : 'Товар'}</th>
                    <th style={{ textAlign: 'right' }}>{uz ? 'Soni' : 'Кол-во'}</th>
                    <th style={{ textAlign: 'right' }}>{uz ? 'Daromad' : 'Сумма'}</th>
                  </tr>
                </thead>
                <tbody>
                  {top_products.map(p => (
                    <tr key={p.product_id}>
                      <td style={{ fontSize: '13px', fontWeight: 700 }}>{(uz && p.name_uz) || p.name_ru}</td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: '12px' }}>{fmtNum(p.qty)} {p.unit}</td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: '13px', fontWeight: 800, color: '#FF6B2B' }}>{fmtMoney(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Foreign currency */}
          <Section icon="💱" title={uz ? 'Boshqa valyutalardagi sotuv' : 'Продажи в валюте'}>
            {by_currency.length === 0 ? (
              <Empty label={uz ? 'Hammasi UZS' : 'Только UZS'} />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{uz ? 'Valyuta' : 'Валюта'}</th>
                    <th style={{ textAlign: 'right' }}>{uz ? 'Soni' : 'Кол-во'}</th>
                    <th style={{ textAlign: 'right' }}>{uz ? 'Originalda' : 'В валюте'}</th>
                    <th style={{ textAlign: 'right' }}>UZS</th>
                  </tr>
                </thead>
                <tbody>
                  {by_currency.map(c => (
                    <tr key={c.currency}>
                      <td style={{ fontWeight: 800, fontSize: '13px' }}>{c.currency}</td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: '12px' }}>{c.count}</td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#4338ca' }}>
                        {curSymbol[c.currency] || ''}{c.original_total.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text2)' }}>{fmtMoney(c.uzs_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        {/* Detailed breakdown row */}
        <div className="grid-2" style={{ marginTop: '14px' }}>
          <Section icon="🧮" title={uz ? "Savdo tafsilotlari" : 'Детализация продаж'}>
            <Row label={uz ? 'Tushum (sof)' : 'Выручка'} value={fmtMoney(sales.revenue)} color="#4338ca" />
            <Row label={uz ? 'Tannarx' : 'Себестоимость'} value={fmtMoney(sales.cost)} color="#6B6F8A" />
            <Row label={uz ? 'Yalpi foyda' : 'Валовая прибыль'} value={fmtMoney(profit.gross)} color="#16a34a" bold />
            <Row label={uz ? 'Marja' : 'Маржа'} value={`${sales.margin_pct.toFixed(1)}%`} color="#FF6B2B" />
            <Row label={uz ? 'Sotuvlar soni' : 'Количество продаж'} value={`${sales.count}`} color="var(--text2)" />
          </Section>

          <Section icon="💰" title={uz ? 'Kassa balansi' : 'Касса'}>
            <Row label={uz ? 'Tushum (topshirilgan)' : 'Поступило (сдано)'} value={`+${fmtMoney(income.settled)}`} color="#16a34a" />
            <Row label={uz ? 'Topshirilmagan' : 'Не сдано'} value={`+${fmtMoney(income.pending)}`} color="#d97706" />
            <Row label={uz ? 'Chiqim' : 'Расход'} value={`−${fmtMoney(expense.total)}`} color="#dc2626" />
            <Row label={uz ? 'Sof kassa' : 'Чистая касса'} value={fmtMoney(profit.net)} color={profit.net >= 0 ? '#16a34a' : '#dc2626'} bold />
          </Section>
        </div>

        <div style={{ height: '20px' }} />
      </div>
    </div>
  );
}

function Tile({ icon, label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
        {icon} {label}
      </div>
      <div className="mono" style={{ fontSize: '20px', fontWeight: 800, color, lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>{sub}</div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)', marginBottom: '12px' }}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
      <span style={{ color: 'var(--text2)', fontWeight: 700 }}>{label}</span>
      <span className="mono" style={{ color, fontWeight: bold ? 900 : 700 }}>{value}</span>
    </div>
  );
}

function Empty({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: '13px' }}>
      {label}
    </div>
  );
}
