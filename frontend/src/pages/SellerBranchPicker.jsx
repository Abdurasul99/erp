import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, LangContext } from '../App.jsx';
import api from '../api.js';

export default function SellerBranchPicker() {
  const { user, logout } = useContext(AuthContext);
  const { lang } = useContext(LangContext);
  const navigate = useNavigate();
  const uz = lang === 'uz';

  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/branches');
        if (!cancelled) setBranches(data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || (uz ? 'Filiallarni yuklab bo\'lmadi' : 'Не удалось загрузить филиалы'));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const pick = (b) => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    localStorage.setItem('seller_branch_id', String(b.id));
    localStorage.setItem('seller_branch_name', b.name || '');
    localStorage.setItem('seller_branch_picked_date', today);
    navigate('/sell', { replace: true });
  };

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #1e1b4b 0%, #3730a3 50%, #4338ca 100%)', fontFamily: "'Nunito', sans-serif", padding: '24px 16px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', color: '#fff' }}>
          <div>
            <div style={{ fontSize: '13px', opacity: .7, fontWeight: 700, letterSpacing: '0.4px' }}>{uz ? 'KIRDINGIZ' : 'ВЫ ВОШЛИ'}</div>
            <div style={{ fontSize: '18px', fontWeight: 900, marginTop: '4px' }}>{fullName}</div>
            <div style={{ fontSize: '12px', opacity: .65, marginTop: '2px' }}>@{user?.username} • {uz ? 'Sotuvchi' : 'Продавец'}</div>
          </div>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: '10px', color: '#fff', padding: '10px 18px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: "'Nunito', sans-serif" }}>
            {uz ? 'Chiqish' : 'Выйти'}
          </button>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #5B4FE8, #3D33C4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🏪</div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#1A1B2E' }}>
                {uz ? 'Filialni tanlang' : 'Выберите филиал'}
              </div>
              <div style={{ fontSize: '13px', color: '#6B6F8A' }}>
                {uz ? 'Sotuvlar va tarix shu filialga bog\'lanadi' : 'Продажи и история будут привязаны к этому филиалу'}
              </div>
            </div>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          )}

          {!loading && error && (
            <div style={{ background: 'rgba(220,38,38,.1)', color: '#dc2626', padding: '14px', borderRadius: '12px', marginTop: '16px', fontSize: '14px', fontWeight: 700 }}>
              {error}
            </div>
          )}

          {!loading && !error && branches.length === 0 && (
            <div style={{ background: '#F4F5FA', padding: '24px', borderRadius: '12px', marginTop: '20px', textAlign: 'center', color: '#6B6F8A', fontSize: '14px' }}>
              {uz ? 'Sizning kompaniyangizda filiallar topilmadi. Menejerga murojaat qiling.' : 'В вашей компании не найдено филиалов. Обратитесь к менеджеру.'}
            </div>
          )}

          {!loading && !error && branches.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
              {branches.map(b => {
                const isDefault = user?.branch_id && Number(user.branch_id) === Number(b.id);
                return (
                  <button key={b.id} onClick={() => pick(b)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      background: '#fff', border: '1.5px solid #E2E4F0',
                      borderRadius: '14px', padding: '16px 18px', cursor: 'pointer',
                      textAlign: 'left', transition: 'all .15s',
                      fontFamily: "'Nunito', sans-serif",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#4338CA'; e.currentTarget.style.background = '#F8F9FF'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E4F0'; e.currentTarget.style.background = '#fff'; }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(91,79,232,.12), rgba(61,51,196,.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>🏪</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '15px', color: '#1A1B2E', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {b.name}
                        {isDefault && (
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#16a34a', background: 'rgba(22,163,74,.12)', padding: '2px 8px', borderRadius: '8px' }}>
                            {uz ? 'ASOSIY' : 'ОСНОВНОЙ'}
                          </span>
                        )}
                      </div>
                      {b.address && <div style={{ fontSize: '12px', color: '#6B6F8A', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.address}</div>}
                      <div style={{ fontSize: '11px', color: '#9EA3BF', marginTop: '4px' }}>
                        {b.company_name} {b.phone ? ' • ' + b.phone : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: '22px', color: '#9EA3BF', fontWeight: 600, lineHeight: 1 }}>›</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
