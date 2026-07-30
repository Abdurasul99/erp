import React, { useState, useEffect } from 'react';
import api from '../../api.js';
import { Tile, Card, Badge, PageHeader, Skeleton, fmtNum } from '../../owner/ui.jsx';
import { normalizeDecimal } from '../../utils/decimalInput.js';

// Точка безубыточности САМОЙ платформы WoW: платят за ФИЛИАЛ ($1000/мес), нужно
// отбить ИНВЕСТИЦИИ ($20 300). Точка = столько филиалов, что их месячной оплаты
// хватает покрыть инвестиции. Число филиалов/компаний — реальное из базы (без тест).

const fld = { width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', fontWeight: 700, textAlign: 'right', outline: 'none' };

// Суммы вводятся текстом, а не type="number": Chrome на промежуточно-невалидном
// вводе («20 300 000», «1500,») отдаёт e.target.value === '' — контролируемое поле
// само себя очищало, и сумма уходила в PUT нулём.
const cleanMoney = (s) => String(s).replace(/[^\d.,\s]/g, '');   // пробелы разрешены: «20 300 000»
const parseMoney = (s) => parseFloat(normalizeDecimal(s));
// К числу приводим только при отправке — с явным 0 по умолчанию, чтобы на сервер
// не ушли NaN или строка с пробелами (parseFloat('20 300 000') === 20).
const toMoney = (s) => { const n = parseMoney(s); return Number.isFinite(n) && n > 0 ? n : 0; };
// Нормализация на blur: убрать пробелы, привести запятую к точке, округлить до копеек.
const normMoney = (s) => {
  const raw = String(s ?? '').replace(/\s/g, '').trim();
  if (raw === '') return '';
  const n = parseMoney(raw);
  return Number.isFinite(n) && n >= 0 ? String(Math.round(n * 100) / 100) : '';
};

export default function BreakEven() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ sub_price: '', fixed_costs: '' });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const apply = (d) => {
    setData(d);
    setForm({ sub_price: String(d.inputs.sub_price || 0), fixed_costs: String(d.inputs.fixed_costs || 0) });
  };

  useEffect(() => {
    setLoading(true); setError(null);
    api.get('/admin/bep')
      .then(r => apply(r.data))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  const save = () => {
    setSaving(true); setError(null);
    api.put('/admin/bep', { sub_price: toMoney(form.sub_price), fixed_costs: toMoney(form.fixed_costs) })
      .then(r => { apply(r.data); setSavedAt(Date.now()); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setSaving(false));
  };

  const cur = data?.inputs?.currency || '$';
  const money = (v) => cur === '$' ? `$${fmtNum(Math.round(v || 0))}` : `${fmtNum(Math.round(v || 0))} ${cur}`;

  return (
    <>
      <PageHeader
        title="⚖️ Точка безубыточности WoW"
        sub="Когда оплата филиалов отбивает инвестиции в платформу"
        actions={data && (
          data.above_break_even
            ? <Badge tone="green">Инвестиции отбиты</Badge>
            : <Badge tone="amber">Ещё не отбито</Badge>
        )}
      />

      {error && <Card><div style={{ color: 'var(--red)' }}>{error}</div></Card>}

      {loading ? (
        <Card><Skeleton height={120} /></Card>
      ) : !data ? null : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Tile icon="🏢" label="Платящих филиалов" value={fmtNum(data.branches)} sub={`${fmtNum(data.companies)} компаний в базе`} color="#7C3AED" />
            <Tile icon="⚖️" label="Точка безубыточности"
              value={data.break_even_branches != null ? `${fmtNum(data.break_even_branches)}` : '—'}
              sub={data.break_even_branches != null ? 'филиалов отобьют инвестиции' : 'задайте цену за филиал'}
              color="#0A84FF" />
            <Tile icon="💵" label="Доход в месяц" value={money(data.mrr)} sub={`${fmtNum(data.branches)} × ${money(data.price_per_branch)}`} color="#30D158" />
            <Tile icon="⏳" label="Срок окупаемости"
              value={data.payback_months != null ? `${data.payback_months} мес` : '—'}
              sub={data.above_break_even ? 'окупается за ~1 мес' : 'при текущих филиалах'}
              color="#FF9F0A" />
          </div>

          <Card icon="🎯" title="Прогресс к возврату инвестиций" style={{ marginBottom: 16 }}>
            {data.break_even_branches == null ? (
              <div style={{ color: 'var(--text2)', fontSize: 14 }}>Задайте цену за филиал, чтобы рассчитать точку безубыточности.</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div className="mono" style={{ fontSize: 34, fontWeight: 900, color: data.above_break_even ? 'var(--green)' : 'var(--primary)' }}>
                    {fmtNum(data.branches)} / {fmtNum(data.break_even_branches)}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text2)' }}>
                    {data.above_break_even
                      ? `✅ Инвестиции отбиты — запас ${fmtNum(data.branches - data.break_even_branches)} филиал(ов)`
                      : `Осталось подключить ${fmtNum(data.branches_to_break_even)} филиал(ов)`}
                  </div>
                </div>
                <div style={{ height: 14, borderRadius: 99, background: 'var(--border)', overflow: 'hidden', marginTop: 12 }}>
                  <div style={{
                    width: (data.progress_pct || 0) + '%', height: '100%',
                    background: data.above_break_even ? 'linear-gradient(90deg,#16A34A,#30D158)' : 'linear-gradient(90deg,#0A84FF,#5E5CE6)',
                    transition: 'width .4s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12.5, color: 'var(--text2)' }}>
                  <span>Отбито за месяц: <strong>{money(data.recovered)}</strong> из {money(data.investment)}</span>
                  <span>Осталось отбить: <strong>{money(data.remaining_to_recover)}</strong></span>
                </div>
              </>
            )}
          </Card>

          <Card icon="✍️" title="Вводные (правит оператор)">
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14 }}>
              Число филиалов и компаний берётся из базы автоматически. Задайте цену за филиал и сумму инвестиций.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div>
                <label className="label">Цена за филиал / мес, {cur}</label>
                <input style={fld} type="text" inputMode="numeric" value={form.sub_price}
                  onChange={e => setForm(f => ({ ...f, sub_price: cleanMoney(e.target.value) }))}
                  onBlur={() => setForm(f => ({ ...f, sub_price: normMoney(f.sub_price) }))} placeholder="1000" />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Сколько платит один филиал компании-клиента</div>
              </div>
              <div>
                <label className="label">Инвестиции в платформу, {cur}</label>
                <input style={fld} type="text" inputMode="numeric" value={form.fixed_costs}
                  onChange={e => setForm(f => ({ ...f, fixed_costs: cleanMoney(e.target.value) }))}
                  onBlur={() => setForm(f => ({ ...f, fixed_costs: normMoney(f.fixed_costs) }))} placeholder="20300" />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Всего вложено — эту сумму нужно отбить</div>
              </div>
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{ minWidth: 160, justifyContent: 'center' }}>
                {saving ? 'Сохранение…' : 'Сохранить и пересчитать'}
              </button>
              {savedAt && !saving && <span style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>✓ Сохранено</span>}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
