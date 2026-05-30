import React, { useEffect, useState, useContext } from 'react';
import api from '../api.js';
import { AuthContext } from '../App.jsx';
import { useTranslation } from '../useTranslation.js';
import { fmtMoney, formatDate, formatTime, useMsg } from '../utils.js';

const METHOD_LABEL = {
  cash: '💵 Наличные', card: '💳 Карта', click: 'Click', payme: 'Payme', transfer: '🏦 Перевод',
};

// Top-of-page shift status card. Shown on Cash section for cashier/manager.
export default function ShiftControl({ onChange }) {
  const { user } = useContext(AuthContext);
  const { lang } = useTranslation();
  const uz = lang === 'uz';
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [zreport, setZreport] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg, clearMsg] = useMsg();

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/shifts/current'); setShift(data); }
    catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submitOpen = async () => {
    setErr('');
    try {
      const cash = parseFloat(openingCash) || 0;
      await api.post('/shifts/open', { opening_cash: cash });
      setMsg('success', uz ? 'Smena ochildi' : 'Смена открыта');
      setOpenModal(false); setOpeningCash('');
      await load();
      onChange?.();
    } catch (e) { setErr(e.response?.data?.error || 'Ошибка'); }
  };

  const openCloseModal = async () => {
    setCloseModal(true); setErr(''); setActualCash(''); setCloseNote('');
    try { const { data } = await api.get(`/shifts/${shift.id}/zreport`); setZreport(data); }
    catch (e) { setErr(e.response?.data?.error || 'Ошибка'); }
  };

  const submitClose = async () => {
    setErr('');
    try {
      const actual = parseFloat(actualCash);
      await api.post(`/shifts/${shift.id}/close`, { actual_cash: actual, note: closeNote });
      setMsg('success', uz ? 'Smena yopildi' : 'Смена закрыта');
      setCloseModal(false); setZreport(null);
      await load();
      onChange?.();
    } catch (e) { setErr(e.response?.data?.error || 'Ошибка'); }
  };

  if (loading) return null;

  return (
    <div style={{ marginBottom: '14px' }}>
      {!shift ? (
        <div style={{ background: 'rgba(245,158,11,.08)', border: '1.5px dashed #d97706', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <div style={{ fontWeight: 800, color: '#d97706', fontSize: '14px' }}>
              ⚠️ {uz ? 'Smena yopiq' : 'Смена закрыта'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
              {uz ? 'Sotuv va kassa operatsiyalari uchun smenani oching' : 'Откройте смену для приёма продаж и кассы'}
            </div>
          </div>
          <button onClick={() => setOpenModal(true)} className="btn btn-primary">
            ▶️ {uz ? 'Smenani ochish' : 'Открыть смену'}
          </button>
        </div>
      ) : (
        <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,.08), rgba(34,197,94,.04))', border: '1.5px solid rgba(34,197,94,.3)', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--green)', fontSize: '14px' }}>
              ✅ {uz ? 'Smena ochiq' : 'Смена открыта'} #{shift.id}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
              {formatDate(shift.opened_at)} {formatTime(shift.opened_at)} · {shift.opened_by_name} · {uz ? 'Boshlangʻich naqd' : 'Начальная касса'}: <span className="mono" style={{ fontWeight: 700 }}>{fmtMoney(shift.opening_cash)}</span>
            </div>
          </div>
          <button onClick={openCloseModal} className="btn btn-danger">
            ⏹ {uz ? 'Smenani yopish' : 'Закрыть смену'}
          </button>
        </div>
      )}

      {msg && <div className={`alert alert-${msg.type}`} style={{ marginTop: '8px' }}>{msg.text}<button onClick={clearMsg} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}>×</button></div>}

      {/* Open modal */}
      {openModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setOpenModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>▶️ {uz ? 'Smenani ochish' : 'Открыть смену'}</div>
              <button onClick={() => setOpenModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9EA3BF' }}>×</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="label">{uz ? 'Boshlangʻich naqd (UZS)' : 'Начальная касса (UZS)'}</label>
              <input autoFocus className="input mono" type="number" min="0" step="any"
                value={openingCash} onChange={e => setOpeningCash(e.target.value)} placeholder="0" />
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                {uz ? 'Smena boshida kassada bo\'lgan naqd pul' : 'Сумма наличных в кассе на начало смены'}
              </div>
            </div>
            {err && <div className="alert alert-error">{err}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={submitOpen} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>{uz ? 'Ochish' : 'Открыть'}</button>
              <button onClick={() => setOpenModal(false)} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>{uz ? 'Bekor' : 'Отмена'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Close modal with Z-report */}
      {closeModal && shift && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setCloseModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>📊 Z-{uz ? 'hisobot' : 'отчёт'} · {uz ? 'Smenani yopish' : 'Закрытие смены'}</div>
              <button onClick={() => setCloseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#9EA3BF' }}>×</button>
            </div>

            {!zreport ? <div className="center"><div className="spinner" /></div> : (
              <>
                <Section title={uz ? 'Smena maʼlumotlari' : 'Смена'}>
                  <Row label={uz ? 'Ochilgan' : 'Открыта'} value={`${formatDate(shift.opened_at)} ${formatTime(shift.opened_at)}`} />
                  <Row label={uz ? 'Ochgan' : 'Открыл'} value={shift.opened_by_name} />
                  <Row label={uz ? 'Boshlangʻich naqd' : 'Начальная касса'} value={fmtMoney(zreport.opening_cash)} />
                </Section>

                <Section title={uz ? 'Sotuvlar' : 'Продажи'}>
                  <Row label={uz ? 'Soni' : 'Количество'} value={zreport.sales.count} />
                  <Row label={uz ? 'Tushum' : 'Выручка'} value={fmtMoney(zreport.sales.revenue)} valueColor="var(--green)" />
                  <Row label={uz ? 'Tannarx' : 'Себестоимость'} value={fmtMoney(zreport.sales.cost)} valueColor="var(--orange)" />
                  <Row label={uz ? 'Foyda' : 'Прибыль'}
                    value={fmtMoney(parseFloat(zreport.sales.revenue) - parseFloat(zreport.sales.cost))}
                    valueColor="var(--primary)" bold />
                </Section>

                <Section title={uz ? 'Tushum (toʻlov usuliga koʻra)' : 'Приход кассы (по способу оплаты)'}>
                  {zreport.income_by_method.length === 0
                    ? <div style={{ color: 'var(--text3)', fontSize: '12px', padding: '6px 0' }}>—</div>
                    : zreport.income_by_method.map(r => (
                      <Row key={r.method} label={`${METHOD_LABEL[r.method] || r.method} · ${r.cnt}`} value={'+' + fmtMoney(r.total)} valueColor="var(--green)" />
                    ))}
                </Section>

                <Section title={uz ? 'Chiqim (toʻlov usuliga koʻra)' : 'Расход кассы (по способу оплаты)'}>
                  {zreport.expense_by_method.length === 0
                    ? <div style={{ color: 'var(--text3)', fontSize: '12px', padding: '6px 0' }}>—</div>
                    : zreport.expense_by_method.map(r => (
                      <Row key={r.method} label={`${METHOD_LABEL[r.method] || r.method} · ${r.cnt}`} value={'−' + fmtMoney(r.total)} valueColor="var(--red)" />
                    ))}
                </Section>

                {zreport.sellers.length > 0 && (
                  <Section title={uz ? 'Sotuvchilar boʻyicha' : 'По продавцам'}>
                    {zreport.sellers.map(s => (
                      <Row key={s.id} label={`👤 ${s.name} · ${s.sales_count}`} value={fmtMoney(s.revenue)} />
                    ))}
                  </Section>
                )}

                <div style={{ background: 'rgba(91,79,232,.06)', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px' }}>
                  <Row label={uz ? 'Kutilayotgan naqd kassada' : 'Ожидаемая касса (наличных)'}
                    value={fmtMoney(zreport.expected_cash)} valueColor="var(--primary)" bold size="18px" />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label className="label">{uz ? 'Haqiqiy kassa (naqd)' : 'Фактическая касса (наличные)'}</label>
                  <input autoFocus className="input mono" type="number" min="0" step="any"
                    value={actualCash} onChange={e => setActualCash(e.target.value)}
                    placeholder={String(Math.round(parseFloat(zreport.expected_cash)))} />
                </div>

                {actualCash !== '' && Number.isFinite(parseFloat(actualCash)) && (
                  <div style={{ background: Math.abs(parseFloat(actualCash) - zreport.expected_cash) < 0.01 ? 'rgba(34,197,94,.08)' : 'rgba(245,158,11,.08)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)' }}>
                      {uz ? 'Farq' : 'Расхождение'}:
                    </span>
                    <span className="mono" style={{ fontSize: '16px', fontWeight: 900, color: parseFloat(actualCash) - zreport.expected_cash < 0 ? 'var(--red)' : parseFloat(actualCash) - zreport.expected_cash > 0 ? 'var(--green)' : 'var(--text2)' }}>
                      {parseFloat(actualCash) - zreport.expected_cash >= 0 ? '+' : ''}{fmtMoney(parseFloat(actualCash) - zreport.expected_cash)}
                    </span>
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label className="label">{uz ? 'Izoh (ixtiyoriy)' : 'Примечание (опционально)'}</label>
                  <input className="input" value={closeNote} onChange={e => setCloseNote(e.target.value)} />
                </div>

                {err && <div className="alert alert-error">{err}</div>}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={submitClose} className="btn btn-danger" style={{ flex: 2, justifyContent: 'center' }}>
                    ⏹ {uz ? 'Smenani yopish' : 'Закрыть смену'}
                  </button>
                  <button onClick={() => setCloseModal(false)} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>{uz ? 'Bekor' : 'Отмена'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>{title}</div>
      <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '8px 12px' }}>{children}</div>
    </div>
  );
}

function Row({ label, value, valueColor, bold, size }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{label}</span>
      <span className="mono" style={{ fontSize: size || '13px', fontWeight: bold ? 900 : 700, color: valueColor || '#1A1B2E' }}>{value}</span>
    </div>
  );
}
