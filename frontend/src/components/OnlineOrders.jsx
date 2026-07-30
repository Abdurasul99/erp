import React, { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import { useTranslation } from '../useTranslation.js';

// «Заказы с сайта» — входящие заявки интернет-магазина для персонала за прилавком
// (кассир/продавец). Сервер сам ограничивает выборку: только source='online' и
// только свой филиал. Поток обработки: Новый → В работе → Продано / Отказ.

const fmtSum = (v) => `${Math.round(parseFloat(v) || 0).toLocaleString('ru-RU')} `;

export default function OnlineOrders() {
  const { lang } = useTranslation();
  const uz = lang === 'uz';
  const L = (ru, uzs) => (uz ? uzs : ru);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [tab, setTab] = useState('active');

  const load = () => {
    setError('');
    api.get('/marketing/leads')
      .then(({ data }) => setLeads((data?.leads || []).filter((l) => l.source === 'online')))
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Автообновление: новый заказ с сайта появится без перезагрузки страницы.
    const timer = setInterval(load, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const setStatus = (lead, status) => {
    setSavingId(lead.id);
    api.patch(`/marketing/leads/${lead.id}/status`, { status })
      .then(() => load())
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setSavingId(null));
  };

  const STATUS = {
    new:         { label: L('Новый', 'Yangi'),        color: '#1D4ED8', bg: 'rgba(29,78,216,.1)' },
    in_progress: { label: L('В работе', 'Jarayonda'), color: '#D97706', bg: 'rgba(217,119,6,.12)' },
    negotiation: { label: L('В работе', 'Jarayonda'), color: '#D97706', bg: 'rgba(217,119,6,.12)' },
    won:         { label: L('Продано', 'Sotildi'),    color: '#16A34A', bg: 'rgba(22,163,74,.12)' },
    lost:        { label: L('Отказ', 'Rad etildi'),   color: '#DC2626', bg: 'rgba(220,38,38,.1)' },
    returned:    { label: L('Возврат', 'Qaytarildi'), color: '#7C3AED', bg: 'rgba(124,58,237,.1)' },
  };

  const counts = useMemo(() => ({
    new: leads.filter((l) => l.status === 'new').length,
    active: leads.filter((l) => ['new', 'in_progress', 'negotiation'].includes(l.status)).length,
    won: leads.filter((l) => l.status === 'won').length,
  }), [leads]);

  const shown = useMemo(() => (
    tab === 'active'
      ? leads.filter((l) => ['new', 'in_progress', 'negotiation'].includes(l.status))
      : tab === 'done'
        ? leads.filter((l) => ['won', 'lost', 'returned'].includes(l.status))
        : leads
  ), [leads, tab]);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {/* Сводка */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{L('Новые заказы', 'Yangi buyurtmalar')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: counts.new > 0 ? '#1D4ED8' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{counts.new}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{L('Активные', 'Faol')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{counts.active}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{L('Продано', 'Sotildi')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#16A34A', fontVariantNumeric: 'tabular-nums' }}>{counts.won}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>🛒 {L('Заказы с сайта', 'Saytdan buyurtmalar')}</div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2, #F1F2F6)', borderRadius: 9, padding: 3 }}>
            {[['active', L('Активные', 'Faol')], ['done', L('Завершённые', 'Yakunlangan')], ['all', L('Все', 'Barchasi')]].map(([k, lb]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                style={{
                  border: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: 7, fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                  background: tab === k ? '#fff' : 'transparent', color: tab === k ? 'var(--primary, #0A84FF)' : 'var(--text3)',
                  boxShadow: tab === k ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                }}>{lb}</button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load} style={{ marginLeft: 'auto' }}>↻ {L('Обновить', 'Yangilash')}</button>
        </div>

        {error && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>{L('Загрузка…', 'Yuklanmoqda…')}</div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 34, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🛍️</div>
            {L('Пока нет заказов с сайта. Новые появятся здесь автоматически.', "Hozircha saytdan buyurtma yo'q. Yangilari shu yerda avtomatik paydo bo'ladi.")}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shown.map((l) => {
              const st = STATUS[l.status] || STATUS.new;
              const isActive = ['new', 'in_progress', 'negotiation'].includes(l.status);
              return (
                <div key={l.id} style={{ border: '1px solid var(--border, #E5E7F0)', borderRadius: 12, padding: '12px 14px', background: l.status === 'new' ? 'rgba(29,78,216,.03)' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 12, fontWeight: 800, fontSize: 12 }}>{st.label}</span>
                    <span style={{ fontWeight: 800 }}>№{l.id}</span>
                    <span style={{ fontWeight: 700 }}>{l.name || '—'}</span>
                    {l.phone && <a href={`tel:${l.phone}`} style={{ color: 'var(--primary, #0A84FF)', fontWeight: 700, textDecoration: 'none' }}>📞 {l.phone}</a>}
                    <span style={{ marginLeft: 'auto', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtSum(l.est_value)}{L('сум', "so'm")}</span>
                  </div>
                  {l.interest && (
                    <div style={{ fontSize: 13, color: 'var(--text2, #555)', marginTop: 7, lineHeight: 1.45 }}>{l.interest}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                      {l.created_at ? new Date(l.created_at).toLocaleString(uz ? 'uz-UZ' : 'ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    {/* Статус можно менять и ПОСЛЕ закрытия: продано → возврат,
                        любой завершённый → вернуть в работу (жизнь заказа не
                        заканчивается на «Продано»). */}
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {l.status === 'new' && (
                        <button type="button" disabled={savingId === l.id} onClick={() => setStatus(l, 'in_progress')}
                          style={{ border: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: 9, fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', background: '#1D4ED8', color: '#fff' }}>
                          {L('Взять в работу', 'Ishga olish')}
                        </button>
                      )}
                      {isActive && l.status !== 'new' && (
                        <>
                          <button type="button" disabled={savingId === l.id} onClick={() => setStatus(l, 'won')}
                            style={{ border: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: 9, fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', background: '#16A34A', color: '#fff' }}>
                            ✓ {L('Продано', 'Sotildi')}
                          </button>
                          <button type="button" disabled={savingId === l.id} onClick={() => setStatus(l, 'lost')}
                            style={{ border: '1.5px solid #DC2626', cursor: 'pointer', padding: '6px 14px', borderRadius: 9, fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', background: '#fff', color: '#DC2626' }}>
                            {L('Отказ', 'Rad etish')}
                          </button>
                        </>
                      )}
                      {l.status === 'won' && (
                        <button type="button" disabled={savingId === l.id} onClick={() => setStatus(l, 'returned')}
                          style={{ border: '1.5px solid #7C3AED', cursor: 'pointer', padding: '6px 14px', borderRadius: 9, fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', background: '#fff', color: '#7C3AED' }}>
                          ↩ {L('Возврат', 'Qaytarish')}
                        </button>
                      )}
                      {['won', 'lost', 'returned'].includes(l.status) && (
                        <button type="button" disabled={savingId === l.id} onClick={() => setStatus(l, 'in_progress')}
                          style={{ border: '1.5px solid #C9CDDC', cursor: 'pointer', padding: '6px 14px', borderRadius: 9, fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', background: '#fff', color: '#5A5F73' }}>
                          {L('Вернуть в работу', 'Ishga qaytarish')}
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
