import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../api.js';
import { Card, Tile, Badge, Pills, PageHeader, Skeleton, EmptyState, fmtMoneyFull, fmtNum } from '../ui.jsx';
import { BranchScope } from '../OwnerShell.jsx';
import { useTt } from '../tt.js';
import { BONUS_CATS, PENALTY_CATS, CAT_LABELS, disciplineLevel, pickLabel } from '../taskMeta.js';
import { normalizeDecimal } from '../../utils/decimalInput.js';

// Сумма — строковый стейт и type="text" (как в RoleBoardTool): у type="number"
// Chrome отдаёт пустую строку на промежуточно-невалидном вводе («250 000»,
// «1500,»), и контролируемое поле само себя очищает. Плюс step="1000" делал
// колёсико мыши/стрелки редактором суммы — прокрутил страницу с фокусом в поле,
// и премия молча уехала на 1000. У type="text" такого поведения нет.
const cleanMoney = (s) => String(s).replace(/[^\d\s.,]/g, '');
// Строка поля → целые сумы. Пустое/мусор → NaN, чтобы NaN не ушёл на сервер.
const moneyNum = (s) => {
  const v = normalizeDecimal(s);
  if (v === '' || v === '.') return NaN;
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

const PERIODS = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
];

export default function HrAdjustmentsTool() {
  const { tt, lang } = useTt();
  const uz = lang === 'uz';
  const { branchId } = useContext(BranchScope);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // form state
  const [type, setType] = useState('bonus');
  const [employeeId, setEmployeeId] = useState('');
  const [category, setCategory] = useState('sales_target');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);

  const load = useCallback(() => {
    let ignore = false;
    setLoading(true); setError(null);
    const params = { period };
    if (branchId) params.branch_id = branchId;
    api.get('/hr/adjustments', { params })
      .then(r => { if (!ignore) setData(r.data); })
      .catch(e => { if (!ignore) setError(e.response?.data?.error || e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [period, branchId]);

  useEffect(() => load(), [load]);

  const cats = type === 'bonus' ? BONUS_CATS : PENALTY_CATS;
  useEffect(() => { setCategory(cats[0].value); }, [type]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    setFormErr(null);
    if (!employeeId) { setFormErr(tt('Выберите сотрудника')); return; }
    const amt = moneyNum(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setFormErr(tt('Введите сумму')); return; }
    setSaving(true);
    try {
      await api.post('/hr/adjustments', {
        employee_id: Number(employeeId), type, category, amount: amt, note: note.trim() || null,
      });
      setEmployeeId(''); setAmount(''); setNote('');
      load();
    } catch (err) {
      setFormErr(err.response?.data?.error || err.message);
    } finally { setSaving(false); }
  };

  const summary = data?.summary || { bonus_total: 0, penalty_total: 0, net: 0, violations: 0 };
  const events = data?.events || [];
  const byEmployee = data?.by_employee || [];
  const employees = data?.employees || [];

  return (
    <>
      <PageHeader title={tt('Штрафы и Бонусы · Дисциплина')} sub={tt('Премии, штрафы и дисциплина по сотрудникам')} />

      <div style={{ marginBottom: 16 }}>
        <Pills value={period} onChange={setPeriod} label="Период"
          options={PERIODS.map(p => ({ value: p.value, label: tt(p.label) }))} />
      </div>

      {/* Форма добавления */}
      <Card icon="➕" title={tt('Назначить премию или штраф')} style={{ marginBottom: 18 }}>
        <form onSubmit={submit}>
          <div className="grid-3" style={{ gap: 12, marginBottom: 12 }}>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{tt('Сотрудник')}</div>
              <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} style={{ width: '100%' }}>
                <option value="">{tt('— выберите —')}</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{tt('Тип')}</div>
              <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%' }}>
                <option value="bonus">{tt('Премия')}</option>
                <option value="penalty">{tt('Штраф')}</option>
              </select>
            </label>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{tt('Категория')}</div>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%' }}>
                {cats.map(c => <option key={c.value} value={c.value}>{pickLabel(c, uz)}</option>)}
              </select>
            </label>
          </div>
          <div className="grid-3" style={{ gap: 12, alignItems: 'end' }}>
            <label style={{ display: 'block' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{tt('Сумма (сум)')}</div>
              {/* Округление только на blur: кламп в onChange не дал бы стереть
                  последнюю цифру. */}
              <input type="text" inputMode="numeric" value={amount}
                onChange={e => setAmount(cleanMoney(e.target.value))}
                onBlur={() => setAmount(v => {
                  const n = moneyNum(v);
                  return Number.isFinite(n) ? String(Math.max(0, n)) : '';
                })}
                placeholder="0" style={{ width: '100%' }} />
            </label>
            <label style={{ display: 'block', gridColumn: 'span 1' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{tt('Причина / примечание')}</div>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder={tt('необязательно')} style={{ width: '100%' }} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={saving}
              style={{ background: 'var(--primary)', color: '#fff' }}>
              {saving ? tt('Сохранение…') : tt('Назначить')}
            </button>
          </div>
          {formErr && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10, fontWeight: 600 }}>{formErr}</div>}
        </form>
      </Card>

      {loading && !data ? (
        <Card><Skeleton height={40} style={{ marginBottom: 12 }} /><Skeleton height={200} /></Card>
      ) : error ? (
        <Card><div style={{ color: 'var(--red)', fontWeight: 600 }}>{error}</div></Card>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <Tile icon="💰" label={tt('Премий начислено')} value={fmtMoneyFull(summary.bonus_total)} sub={tt('сум')} color="#16A34A" />
            <Tile icon="❌" label={tt('Штрафов начислено')} value={fmtMoneyFull(summary.penalty_total)} sub={tt('сум')} color="#DC2626" />
            <Tile icon="⚖️" label={tt('Чистый эффект')} value={(summary.net >= 0 ? '+' : '') + fmtMoneyFull(summary.net)} sub={tt('сум')} color={summary.net >= 0 ? '#16A34A' : '#DC2626'} />
            <Tile icon="🚫" label={tt('Нарушений')} value={fmtNum(summary.violations)} sub={tt('всего')} color="#D97706" />
          </div>

          <Card icon="📋" title={tt('Все события дисциплины и корректировки')} style={{ marginBottom: 18 }}>
            {events.length === 0 ? (
              <EmptyState icon="📭" title={tt('Событий нет')} description={tt('За выбранный период корректировок не было.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Дата и время')}</th>
                      <th>{tt('Сотрудник')}</th>
                      <th>{tt('Тип')}</th>
                      <th>{tt('Причина')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Сумма (сум)')}</th>
                      <th>{tt('Кто назначил')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(ev => {
                      const isBonus = ev.type === 'bonus';
                      const catLabel = pickLabel(CAT_LABELS[ev.category], uz);
                      return (
                        <tr key={ev.id}>
                          <td className="mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                            {new Date(ev.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ fontWeight: 700 }}>{ev.employee_name || '—'}</td>
                          <td>
                            <Badge tone={isBonus ? 'green' : 'red'}>
                              {isBonus ? tt('Премия') : (catLabel || tt('Штраф'))}
                            </Badge>
                          </td>
                          <td style={{ color: 'var(--text2)', fontSize: 13 }}>{ev.note || catLabel || '—'}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: isBonus ? '#16A34A' : '#DC2626' }}>
                            {(isBonus ? '+' : '−') + fmtMoneyFull(ev.amount)}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text2)' }}>{ev.created_by_name || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card icon="📊" title={tt('По сотрудникам · итог')}>
            {byEmployee.length === 0 ? (
              <EmptyState icon="📭" title={tt('Данных нет')} description={tt('Нет корректировок за период.')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{tt('Сотрудник')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Премии (сум)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Штрафы (сум)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Итого (сум)')}</th>
                      <th style={{ textAlign: 'right' }}>{tt('Нарушений')}</th>
                      <th>{tt('Дисциплина')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byEmployee.map(r => {
                      const lvl = disciplineLevel(r.violations, r.net);
                      return (
                        <tr key={r.employee_id}>
                          <td style={{ fontWeight: 700 }}>{r.employee_name || '—'}</td>
                          <td className="mono" style={{ textAlign: 'right', color: '#16A34A' }}>{r.bonus_total > 0 ? fmtMoneyFull(r.bonus_total) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                          <td className="mono" style={{ textAlign: 'right', color: '#DC2626' }}>{r.penalty_total > 0 ? fmtMoneyFull(r.penalty_total) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: r.net >= 0 ? '#16A34A' : '#DC2626' }}>{(r.net >= 0 ? '+' : '') + fmtMoneyFull(r.net)}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{r.violations > 0 ? fmtNum(r.violations) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                          <td><Badge tone={lvl.tone}>{pickLabel(lvl, uz)}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
              {tt('Чистый эффект = премии − штрафы. Нарушение = любой штраф. Суммы в сумах полным числом.')}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
